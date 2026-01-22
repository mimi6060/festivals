package stats

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for stats data access
type Repository interface {
	GetFestivalStats(ctx context.Context, festivalID uuid.UUID, timeframe Timeframe) (*FestivalStats, error)
	GetDailyStats(ctx context.Context, festivalID uuid.UUID, startDate, endDate time.Time) ([]DailyStats, error)
	GetStandStats(ctx context.Context, standID uuid.UUID, timeframe Timeframe) (*StandStats, error)
	GetTopProducts(ctx context.Context, festivalID uuid.UUID, limit int, timeframe Timeframe) ([]ProductStats, error)
	GetRecentTransactions(ctx context.Context, festivalID uuid.UUID, limit int) ([]RecentTransaction, error)
	GetTopStands(ctx context.Context, festivalID uuid.UUID, limit int, timeframe Timeframe) ([]StandStats, error)
	GetStaffPerformance(ctx context.Context, festivalID uuid.UUID, timeframe Timeframe) ([]StaffPerformance, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new stats repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// GetFestivalStats retrieves aggregated statistics for a festival
func (r *repository) GetFestivalStats(ctx context.Context, festivalID uuid.UUID, timeframe Timeframe) (*FestivalStats, error) {
	stats := &FestivalStats{
		FestivalID:  festivalID,
		Timeframe:   timeframe,
		GeneratedAt: time.Now(),
	}

	startTime := timeframe.GetStartTime()
	timeFilter := ""
	args := []interface{}{festivalID}

	if !startTime.IsZero() {
		timeFilter = " AND created_at >= ?"
		args = append(args, startTime)
	}

	// Get ticket stats
	ticketQuery := `
		SELECT
			COALESCE(COUNT(*), 0) as tickets_sold,
			COALESCE(SUM(CASE WHEN status = 'USED' THEN 1 ELSE 0 END), 0) as tickets_checked_in
		FROM public.tickets
		WHERE festival_id = ?` + timeFilter

	var ticketStats struct {
		TicketsSold      int
		TicketsCheckedIn int
	}
	if err := r.db.WithContext(ctx).Raw(ticketQuery, args...).Scan(&ticketStats).Error; err != nil {
		return nil, fmt.Errorf("failed to get ticket stats: %w", err)
	}
	stats.TicketsSold = ticketStats.TicketsSold
	stats.TicketsCheckedIn = ticketStats.TicketsCheckedIn

	// Get wallet stats
	walletArgs := []interface{}{festivalID}
	walletTimeFilter := ""
	if !startTime.IsZero() {
		walletTimeFilter = " AND created_at >= ?"
		walletArgs = append(walletArgs, startTime)
	}

	walletQuery := `
		SELECT
			COALESCE(COUNT(*), 0) as total_wallets,
			COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) as active_wallets
		FROM public.wallets
		WHERE festival_id = ?` + walletTimeFilter

	var walletStats struct {
		TotalWallets  int
		ActiveWallets int
	}
	if err := r.db.WithContext(ctx).Raw(walletQuery, walletArgs...).Scan(&walletStats).Error; err != nil {
		return nil, fmt.Errorf("failed to get wallet stats: %w", err)
	}
	stats.TotalWallets = walletStats.TotalWallets
	stats.ActiveWallets = walletStats.ActiveWallets

	// Get transaction stats - join with wallets to filter by festival
	txArgs := []interface{}{festivalID}
	txTimeFilter := ""
	if !startTime.IsZero() {
		txTimeFilter = " AND t.created_at >= ?"
		txArgs = append(txArgs, startTime)
	}

	transactionQuery := `
		SELECT
			COALESCE(COUNT(*), 0) as total_transactions,
			COALESCE(SUM(CASE WHEN t.type IN ('TOP_UP', 'CASH_IN') THEN ABS(t.amount) ELSE 0 END), 0) as total_top_ups,
			COALESCE(SUM(CASE WHEN t.type = 'PURCHASE' THEN ABS(t.amount) ELSE 0 END), 0) as total_purchases,
			COALESCE(AVG(ABS(t.amount)), 0) as average_transaction
		FROM public.transactions t
		INNER JOIN public.wallets w ON t.wallet_id = w.id
		WHERE w.festival_id = ? AND t.status = 'COMPLETED'` + txTimeFilter

	var txStats struct {
		TotalTransactions  int
		TotalTopUps        int64
		TotalPurchases     int64
		AverageTransaction float64
	}
	if err := r.db.WithContext(ctx).Raw(transactionQuery, txArgs...).Scan(&txStats).Error; err != nil {
		return nil, fmt.Errorf("failed to get transaction stats: %w", err)
	}
	stats.TotalTransactions = txStats.TotalTransactions
	stats.TotalTopUps = txStats.TotalTopUps
	stats.TotalPurchases = txStats.TotalPurchases
	stats.AverageTransaction = int64(txStats.AverageTransaction)
	stats.TotalRevenue = txStats.TotalTopUps // Revenue from top-ups

	// Get stand stats
	standArgs := []interface{}{festivalID}
	standTimeFilter := ""
	if !startTime.IsZero() {
		standTimeFilter = " AND t.created_at >= ?"
		standArgs = append(standArgs, startTime)
	}

	standQuery := `
		SELECT
			COALESCE(COUNT(DISTINCT s.id), 0) as total_stands,
			COALESCE(COUNT(DISTINCT CASE WHEN t.id IS NOT NULL THEN s.id END), 0) as active_stands
		FROM public.stands s
		LEFT JOIN public.transactions t ON t.stand_id = s.id AND t.status = 'COMPLETED'` + standTimeFilter + `
		WHERE s.festival_id = ?`

	// Reorder args for this query
	if !startTime.IsZero() {
		standArgs = []interface{}{startTime, festivalID}
	} else {
		standArgs = []interface{}{festivalID}
	}

	var standStats struct {
		TotalStands  int
		ActiveStands int
	}
	if err := r.db.WithContext(ctx).Raw(standQuery, standArgs...).Scan(&standStats).Error; err != nil {
		return nil, fmt.Errorf("failed to get stand stats: %w", err)
	}
	stats.TotalStands = standStats.TotalStands
	stats.ActiveStands = standStats.ActiveStands

	return stats, nil
}

// GetDailyStats retrieves daily statistics for a festival within a date range
func (r *repository) GetDailyStats(ctx context.Context, festivalID uuid.UUID, startDate, endDate time.Time) ([]DailyStats, error) {
	query := `
		WITH date_series AS (
			SELECT generate_series(
				?::date,
				?::date,
				'1 day'::interval
			)::date as date
		),
		daily_transactions AS (
			SELECT
				DATE(t.created_at) as date,
				SUM(CASE WHEN t.type IN ('TOP_UP', 'CASH_IN') THEN ABS(t.amount) ELSE 0 END) as top_ups,
				SUM(CASE WHEN t.type = 'PURCHASE' THEN ABS(t.amount) ELSE 0 END) as purchases,
				COUNT(*) as transactions,
				COUNT(DISTINCT t.wallet_id) as unique_customers
			FROM public.transactions t
			INNER JOIN public.wallets w ON t.wallet_id = w.id
			WHERE w.festival_id = ?
				AND t.status = 'COMPLETED'
				AND t.created_at >= ?
				AND t.created_at < ? + INTERVAL '1 day'
			GROUP BY DATE(t.created_at)
		),
		daily_wallets AS (
			SELECT
				DATE(created_at) as date,
				COUNT(*) as new_wallets
			FROM public.wallets
			WHERE festival_id = ?
				AND created_at >= ?
				AND created_at < ? + INTERVAL '1 day'
			GROUP BY DATE(created_at)
		),
		daily_tickets AS (
			SELECT
				DATE(created_at) as date,
				COUNT(*) as tickets_sold
			FROM public.tickets
			WHERE festival_id = ?
				AND created_at >= ?
				AND created_at < ? + INTERVAL '1 day'
			GROUP BY DATE(created_at)
		),
		daily_checkins AS (
			SELECT
				DATE(checked_in_at) as date,
				COUNT(*) as tickets_checked_in
			FROM public.tickets
			WHERE festival_id = ?
				AND checked_in_at IS NOT NULL
				AND checked_in_at >= ?
				AND checked_in_at < ? + INTERVAL '1 day'
			GROUP BY DATE(checked_in_at)
		)
		SELECT
			ds.date,
			COALESCE(dt.top_ups, 0) + COALESCE(dt.purchases, 0) as revenue,
			COALESCE(dt.transactions, 0) as transactions,
			COALESCE(dw.new_wallets, 0) as new_wallets,
			COALESCE(dt.top_ups, 0) as top_ups,
			COALESCE(dt.purchases, 0) as purchases,
			COALESCE(dt.unique_customers, 0) as unique_customers,
			COALESCE(dtk.tickets_sold, 0) as tickets_sold,
			COALESCE(dc.tickets_checked_in, 0) as tickets_checked_in
		FROM date_series ds
		LEFT JOIN daily_transactions dt ON ds.date = dt.date
		LEFT JOIN daily_wallets dw ON ds.date = dw.date
		LEFT JOIN daily_tickets dtk ON ds.date = dtk.date
		LEFT JOIN daily_checkins dc ON ds.date = dc.date
		ORDER BY ds.date ASC`

	args := []interface{}{
		startDate, endDate,
		festivalID, startDate, endDate,
		festivalID, startDate, endDate,
		festivalID, startDate, endDate,
		festivalID, startDate, endDate,
	}

	var results []struct {
		Date             time.Time
		Revenue          int64
		Transactions     int
		NewWallets       int
		TopUps           int64
		Purchases        int64
		UniqueCustomers  int
		TicketsSold      int
		TicketsCheckedIn int
	}

	if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get daily stats: %w", err)
	}

	dailyStats := make([]DailyStats, len(results))
	for i, r := range results {
		dailyStats[i] = DailyStats{
			Date:             r.Date,
			Revenue:          r.Revenue,
			Transactions:     r.Transactions,
			NewWallets:       r.NewWallets,
			TopUps:           r.TopUps,
			Purchases:        r.Purchases,
			UniqueCustomers:  r.UniqueCustomers,
			TicketsSold:      r.TicketsSold,
			TicketsCheckedIn: r.TicketsCheckedIn,
		}
	}

	return dailyStats, nil
}

// GetStandStats retrieves statistics for a specific stand
func (r *repository) GetStandStats(ctx context.Context, standID uuid.UUID, timeframe Timeframe) (*StandStats, error) {
	startTime := timeframe.GetStartTime()
	timeFilter := ""
	args := []interface{}{standID}

	if !startTime.IsZero() {
		timeFilter = " AND t.created_at >= ?"
		args = append(args, startTime)
	}

	// Get stand info and transaction stats
	query := `
		SELECT
			s.id as stand_id,
			s.name as stand_name,
			COALESCE(SUM(ABS(t.amount)), 0) as revenue,
			COALESCE(COUNT(t.id), 0) as transactions,
			COALESCE(AVG(ABS(t.amount)), 0) as average_transaction,
			COALESCE(COUNT(DISTINCT t.wallet_id), 0) as unique_customers
		FROM public.stands s
		LEFT JOIN public.transactions t ON t.stand_id = s.id AND t.status = 'COMPLETED' AND t.type = 'PURCHASE'` + timeFilter + `
		WHERE s.id = ?
		GROUP BY s.id, s.name`

	// Adjust args order
	if !startTime.IsZero() {
		args = []interface{}{startTime, standID}
	} else {
		args = []interface{}{standID}
	}

	var result struct {
		StandID            uuid.UUID
		StandName          string
		Revenue            int64
		Transactions       int
		AverageTransaction float64
		UniqueCustomers    int
	}

	if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&result).Error; err != nil {
		return nil, fmt.Errorf("failed to get stand stats: %w", err)
	}

	// Get top products for this stand
	topProducts, err := r.getStandTopProducts(ctx, standID, 5, timeframe)
	if err != nil {
		return nil, err
	}

	stats := &StandStats{
		StandID:            result.StandID,
		StandName:          result.StandName,
		Revenue:            result.Revenue,
		Transactions:       result.Transactions,
		AverageTransaction: int64(result.AverageTransaction),
		UniqueCustomers:    result.UniqueCustomers,
		TopProducts:        topProducts,
		Timeframe:          timeframe,
	}

	return stats, nil
}

// getStandTopProducts retrieves top products for a specific stand
func (r *repository) getStandTopProducts(ctx context.Context, standID uuid.UUID, limit int, timeframe Timeframe) ([]ProductStats, error) {
	startTime := timeframe.GetStartTime()
	timeFilter := ""
	args := []interface{}{standID}

	if !startTime.IsZero() {
		timeFilter = " AND ps.created_at >= ?"
		args = append(args, startTime)
	}
	args = append(args, limit)

	// This query assumes there's a product_sales or similar junction table
	// If products are tracked differently, adjust accordingly
	query := `
		SELECT
			p.id as product_id,
			p.name as product_name,
			p.stand_id,
			COALESCE(ps.quantity_sold, 0) as quantity_sold,
			COALESCE(ps.revenue, 0) as revenue,
			p.price as unit_price
		FROM public.products p
		LEFT JOIN (
			SELECT
				product_id,
				SUM(quantity) as quantity_sold,
				SUM(amount) as revenue,
				MAX(created_at) as created_at
			FROM public.product_sales
			WHERE stand_id = ?` + timeFilter + `
			GROUP BY product_id
		) ps ON p.id = ps.product_id
		WHERE p.stand_id = ?
		ORDER BY COALESCE(ps.quantity_sold, 0) DESC
		LIMIT ?`

	// Adjust args
	if !startTime.IsZero() {
		args = []interface{}{standID, startTime, standID, limit}
	} else {
		args = []interface{}{standID, standID, limit}
	}

	var results []struct {
		ProductID    uuid.UUID
		ProductName  string
		StandID      uuid.UUID
		QuantitySold int
		Revenue      int64
		UnitPrice    int64
	}

	// Try to get product stats, but don't fail if table doesn't exist
	err := r.db.WithContext(ctx).Raw(query, args...).Scan(&results).Error
	if err != nil {
		// Fallback: just get products without sales data
		fallbackQuery := `
			SELECT
				id as product_id,
				name as product_name,
				stand_id,
				0 as quantity_sold,
				0 as revenue,
				price as unit_price
			FROM public.products
			WHERE stand_id = ?
			ORDER BY sort_order ASC
			LIMIT ?`

		if err := r.db.WithContext(ctx).Raw(fallbackQuery, standID, limit).Scan(&results).Error; err != nil {
			return nil, fmt.Errorf("failed to get stand top products: %w", err)
		}
	}

	products := make([]ProductStats, len(results))
	for i, r := range results {
		products[i] = ProductStats{
			ProductID:    r.ProductID,
			ProductName:  r.ProductName,
			StandID:      r.StandID,
			QuantitySold: r.QuantitySold,
			Revenue:      r.Revenue,
			UnitPrice:    r.UnitPrice,
		}
	}

	return products, nil
}

// GetTopProducts retrieves top selling products across all stands for a festival
func (r *repository) GetTopProducts(ctx context.Context, festivalID uuid.UUID, limit int, timeframe Timeframe) ([]ProductStats, error) {
	startTime := timeframe.GetStartTime()
	timeFilter := ""
	args := []interface{}{festivalID}

	if !startTime.IsZero() {
		timeFilter = " AND ps.created_at >= ?"
		args = append(args, startTime)
	}
	args = append(args, limit)

	query := `
		SELECT
			p.id as product_id,
			p.name as product_name,
			p.stand_id,
			s.name as stand_name,
			COALESCE(ps.quantity_sold, 0) as quantity_sold,
			COALESCE(ps.revenue, 0) as revenue,
			p.price as unit_price
		FROM public.products p
		INNER JOIN public.stands s ON p.stand_id = s.id
		LEFT JOIN (
			SELECT
				product_id,
				SUM(quantity) as quantity_sold,
				SUM(amount) as revenue,
				MAX(created_at) as created_at
			FROM public.product_sales
			GROUP BY product_id
		) ps ON p.id = ps.product_id` + timeFilter + `
		WHERE s.festival_id = ?
		ORDER BY COALESCE(ps.quantity_sold, 0) DESC
		LIMIT ?`

	// Adjust args based on whether we have a time filter
	if !startTime.IsZero() {
		args = []interface{}{startTime, festivalID, limit}
	} else {
		args = []interface{}{festivalID, limit}
	}

	var results []struct {
		ProductID    uuid.UUID
		ProductName  string
		StandID      uuid.UUID
		StandName    string
		QuantitySold int
		Revenue      int64
		UnitPrice    int64
	}

	// Try to get product stats
	err := r.db.WithContext(ctx).Raw(query, args...).Scan(&results).Error
	if err != nil {
		// Fallback query without product_sales table
		fallbackQuery := `
			SELECT
				p.id as product_id,
				p.name as product_name,
				p.stand_id,
				s.name as stand_name,
				0 as quantity_sold,
				0 as revenue,
				p.price as unit_price
			FROM public.products p
			INNER JOIN public.stands s ON p.stand_id = s.id
			WHERE s.festival_id = ?
			ORDER BY p.sort_order ASC
			LIMIT ?`

		if err := r.db.WithContext(ctx).Raw(fallbackQuery, festivalID, limit).Scan(&results).Error; err != nil {
			return nil, fmt.Errorf("failed to get top products: %w", err)
		}
	}

	products := make([]ProductStats, len(results))
	for i, r := range results {
		products[i] = ProductStats{
			ProductID:    r.ProductID,
			ProductName:  r.ProductName,
			StandID:      r.StandID,
			StandName:    r.StandName,
			QuantitySold: r.QuantitySold,
			Revenue:      r.Revenue,
			UnitPrice:    r.UnitPrice,
		}
	}

	return products, nil
}

// GetRecentTransactions retrieves recent transactions for a festival
func (r *repository) GetRecentTransactions(ctx context.Context, festivalID uuid.UUID, limit int) ([]RecentTransaction, error) {
	query := `
		SELECT
			t.id,
			t.type,
			t.amount,
			t.stand_id,
			COALESCE(s.name, '') as stand_name,
			t.staff_id,
			COALESCE(u.name, '') as staff_name,
			t.created_at
		FROM public.transactions t
		INNER JOIN public.wallets w ON t.wallet_id = w.id
		LEFT JOIN public.stands s ON t.stand_id = s.id
		LEFT JOIN public.users u ON t.staff_id = u.id
		WHERE w.festival_id = ? AND t.status = 'COMPLETED'
		ORDER BY t.created_at DESC
		LIMIT ?`

	var results []struct {
		ID        uuid.UUID
		Type      string
		Amount    int64
		StandID   sql.NullString
		StandName string
		StaffID   sql.NullString
		StaffName string
		CreatedAt time.Time
	}

	if err := r.db.WithContext(ctx).Raw(query, festivalID, limit).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get recent transactions: %w", err)
	}

	transactions := make([]RecentTransaction, len(results))
	for i, r := range results {
		tx := RecentTransaction{
			ID:        r.ID,
			Type:      r.Type,
			Amount:    r.Amount,
			StandName: r.StandName,
			StaffName: r.StaffName,
			CreatedAt: r.CreatedAt,
		}

		if r.StandID.Valid {
			id, _ := uuid.Parse(r.StandID.String)
			tx.StandID = &id
		}
		if r.StaffID.Valid {
			id, _ := uuid.Parse(r.StaffID.String)
			tx.StaffID = &id
		}

		transactions[i] = tx
	}

	return transactions, nil
}

// GetTopStands retrieves top performing stands for a festival
func (r *repository) GetTopStands(ctx context.Context, festivalID uuid.UUID, limit int, timeframe Timeframe) ([]StandStats, error) {
	startTime := timeframe.GetStartTime()
	timeFilter := ""
	args := []interface{}{festivalID}

	if !startTime.IsZero() {
		timeFilter = " AND t.created_at >= ?"
		args = append(args, startTime)
	}
	args = append(args, limit)

	query := `
		SELECT
			s.id as stand_id,
			s.name as stand_name,
			COALESCE(SUM(ABS(t.amount)), 0) as revenue,
			COALESCE(COUNT(t.id), 0) as transactions,
			COALESCE(AVG(ABS(t.amount)), 0) as average_transaction,
			COALESCE(COUNT(DISTINCT t.wallet_id), 0) as unique_customers
		FROM public.stands s
		LEFT JOIN public.transactions t ON t.stand_id = s.id AND t.status = 'COMPLETED' AND t.type = 'PURCHASE'` + timeFilter + `
		WHERE s.festival_id = ?
		GROUP BY s.id, s.name
		ORDER BY revenue DESC
		LIMIT ?`

	// Adjust args order
	if !startTime.IsZero() {
		args = []interface{}{startTime, festivalID, limit}
	} else {
		args = []interface{}{festivalID, limit}
	}

	var results []struct {
		StandID            uuid.UUID
		StandName          string
		Revenue            int64
		Transactions       int
		AverageTransaction float64
		UniqueCustomers    int
	}

	if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get top stands: %w", err)
	}

	stands := make([]StandStats, len(results))
	for i, r := range results {
		stands[i] = StandStats{
			StandID:            r.StandID,
			StandName:          r.StandName,
			Revenue:            r.Revenue,
			Transactions:       r.Transactions,
			AverageTransaction: int64(r.AverageTransaction),
			UniqueCustomers:    r.UniqueCustomers,
			Timeframe:          timeframe,
		}
	}

	return stands, nil
}

// GetStaffPerformance retrieves performance statistics for all staff at a festival
func (r *repository) GetStaffPerformance(ctx context.Context, festivalID uuid.UUID, timeframe Timeframe) ([]StaffPerformance, error) {
	startTime := timeframe.GetStartTime()
	timeFilter := ""
	args := []interface{}{festivalID}

	if !startTime.IsZero() {
		timeFilter = " AND t.created_at >= ?"
		args = append(args, startTime)
	}

	query := `
		SELECT
			t.staff_id,
			COALESCE(u.name, 'Unknown') as staff_name,
			COUNT(t.id) as transactions,
			COALESCE(SUM(ABS(t.amount)), 0) as total_amount,
			COALESCE(AVG(ABS(t.amount)), 0) as average_amount,
			t.stand_id,
			COALESCE(s.name, 'Unknown') as stand_name
		FROM public.transactions t
		INNER JOIN public.wallets w ON t.wallet_id = w.id
		LEFT JOIN public.users u ON t.staff_id = u.id
		LEFT JOIN public.stands s ON t.stand_id = s.id
		WHERE w.festival_id = ?
			AND t.status = 'COMPLETED'
			AND t.staff_id IS NOT NULL` + timeFilter + `
		GROUP BY t.staff_id, u.name, t.stand_id, s.name
		ORDER BY total_amount DESC`

	var results []struct {
		StaffID       uuid.UUID
		StaffName     string
		Transactions  int
		TotalAmount   int64
		AverageAmount float64
		StandID       uuid.UUID
		StandName     string
	}

	if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get staff performance: %w", err)
	}

	performance := make([]StaffPerformance, len(results))
	for i, r := range results {
		performance[i] = StaffPerformance{
			StaffID:       r.StaffID,
			StaffName:     r.StaffName,
			Transactions:  r.Transactions,
			TotalAmount:   r.TotalAmount,
			AverageAmount: int64(r.AverageAmount),
			StandID:       r.StandID,
			StandName:     r.StandName,
		}
	}

	return performance, nil
}
