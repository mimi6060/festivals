package reports

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for reports data access
type Repository interface {
	// Report CRUD operations
	CreateReport(ctx context.Context, report *Report) error
	GetReportByID(ctx context.Context, id uuid.UUID) (*Report, error)
	GetReportsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Report, int64, error)
	UpdateReport(ctx context.Context, report *Report) error
	DeleteExpiredReports(ctx context.Context) error

	// Export data retrieval
	GetTransactionsForExport(ctx context.Context, festivalID uuid.UUID, dateRange *DateRange, filters *ReportFilters) ([]TransactionExport, error)
	GetSalesForExport(ctx context.Context, festivalID uuid.UUID, dateRange *DateRange, filters *ReportFilters) ([]SalesExport, error)
	GetTicketsForExport(ctx context.Context, festivalID uuid.UUID, dateRange *DateRange, filters *ReportFilters) ([]TicketExport, error)
	GetWalletsForExport(ctx context.Context, festivalID uuid.UUID, dateRange *DateRange, filters *ReportFilters) ([]WalletExport, error)
	GetStaffPerformanceForExport(ctx context.Context, festivalID uuid.UUID, dateRange *DateRange, filters *ReportFilters) ([]StaffPerformanceExport, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new reports repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// CreateReport creates a new report record
func (r *repository) CreateReport(ctx context.Context, report *Report) error {
	return r.db.WithContext(ctx).Create(report).Error
}

// GetReportByID retrieves a report by ID
func (r *repository) GetReportByID(ctx context.Context, id uuid.UUID) (*Report, error) {
	var report Report
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&report).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get report: %w", err)
	}
	return &report, nil
}

// GetReportsByFestival retrieves reports for a festival with pagination
func (r *repository) GetReportsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Report, int64, error) {
	var reports []Report
	var total int64

	query := r.db.WithContext(ctx).Model(&Report{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count reports: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&reports).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list reports: %w", err)
	}

	return reports, total, nil
}

// UpdateReport updates a report record
func (r *repository) UpdateReport(ctx context.Context, report *Report) error {
	return r.db.WithContext(ctx).Save(report).Error
}

// DeleteExpiredReports deletes reports that have expired
func (r *repository) DeleteExpiredReports(ctx context.Context) error {
	return r.db.WithContext(ctx).
		Where("expires_at IS NOT NULL AND expires_at < ?", time.Now()).
		Delete(&Report{}).Error
}

// GetTransactionsForExport retrieves transaction data for export
func (r *repository) GetTransactionsForExport(ctx context.Context, festivalID uuid.UUID, dateRange *DateRange, filters *ReportFilters) ([]TransactionExport, error) {
	query := `
		SELECT
			t.id,
			t.wallet_id,
			COALESCE(u.email, '') as user_email,
			COALESCE(u.name, '') as user_name,
			t.type,
			t.amount,
			t.balance_before,
			t.balance_after,
			COALESCE(t.reference, '') as reference,
			t.stand_id,
			COALESCE(s.name, '') as stand_name,
			t.staff_id,
			COALESCE(staff.name, '') as staff_name,
			t.status,
			t.created_at
		FROM public.transactions t
		INNER JOIN public.wallets w ON t.wallet_id = w.id
		LEFT JOIN public.users u ON w.user_id = u.id
		LEFT JOIN public.stands s ON t.stand_id = s.id
		LEFT JOIN public.users staff ON t.staff_id = staff.id
		WHERE w.festival_id = ?`

	args := []interface{}{festivalID}

	if dateRange != nil {
		query += " AND t.created_at >= ? AND t.created_at <= ?"
		args = append(args, dateRange.StartDate, dateRange.EndDate)
	}

	if filters != nil {
		if len(filters.StandIDs) > 0 {
			query += " AND t.stand_id IN (?)"
			args = append(args, filters.StandIDs)
		}
		if len(filters.StaffIDs) > 0 {
			query += " AND t.staff_id IN (?)"
			args = append(args, filters.StaffIDs)
		}
		if len(filters.Status) > 0 {
			query += " AND t.status IN (?)"
			args = append(args, filters.Status)
		}
		if filters.MinAmount != nil {
			query += " AND ABS(t.amount) >= ?"
			args = append(args, *filters.MinAmount)
		}
		if filters.MaxAmount != nil {
			query += " AND ABS(t.amount) <= ?"
			args = append(args, *filters.MaxAmount)
		}
	}

	query += " ORDER BY t.created_at DESC"

	var results []struct {
		ID            uuid.UUID
		WalletID      uuid.UUID
		UserEmail     string
		UserName      string
		Type          string
		Amount        int64
		BalanceBefore int64
		BalanceAfter  int64
		Reference     string
		StandID       *uuid.UUID
		StandName     string
		StaffID       *uuid.UUID
		StaffName     string
		Status        string
		CreatedAt     time.Time
	}

	if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get transactions for export: %w", err)
	}

	exports := make([]TransactionExport, len(results))
	for i, row := range results {
		exports[i] = TransactionExport{
			ID:            row.ID,
			WalletID:      row.WalletID,
			UserEmail:     row.UserEmail,
			UserName:      row.UserName,
			Type:          row.Type,
			Amount:        row.Amount,
			AmountDisplay: formatCurrency(row.Amount),
			BalanceBefore: row.BalanceBefore,
			BalanceAfter:  row.BalanceAfter,
			Reference:     row.Reference,
			StandID:       row.StandID,
			StandName:     row.StandName,
			StaffID:       row.StaffID,
			StaffName:     row.StaffName,
			Status:        row.Status,
			CreatedAt:     row.CreatedAt,
		}
	}

	return exports, nil
}

// GetSalesForExport retrieves sales data for export
func (r *repository) GetSalesForExport(ctx context.Context, festivalID uuid.UUID, dateRange *DateRange, filters *ReportFilters) ([]SalesExport, error) {
	query := `
		SELECT
			s.id as stand_id,
			s.name as stand_name,
			p.id as product_id,
			p.name as product_name,
			COALESCE(SUM(ps.quantity), 0) as quantity,
			p.price as unit_price,
			COALESCE(SUM(ps.amount), 0) as total_revenue,
			DATE(ps.created_at) as date
		FROM public.stands s
		INNER JOIN public.products p ON p.stand_id = s.id
		LEFT JOIN public.product_sales ps ON ps.product_id = p.id
		WHERE s.festival_id = ?`

	args := []interface{}{festivalID}

	if dateRange != nil {
		query += " AND (ps.created_at IS NULL OR (ps.created_at >= ? AND ps.created_at <= ?))"
		args = append(args, dateRange.StartDate, dateRange.EndDate)
	}

	if filters != nil && len(filters.StandIDs) > 0 {
		query += " AND s.id IN (?)"
		args = append(args, filters.StandIDs)
	}

	query += " GROUP BY s.id, s.name, p.id, p.name, p.price, DATE(ps.created_at)"
	query += " ORDER BY s.name, p.name, date DESC"

	var results []struct {
		StandID      uuid.UUID
		StandName    string
		ProductID    uuid.UUID
		ProductName  string
		Quantity     int
		UnitPrice    int64
		TotalRevenue int64
		Date         *time.Time
	}

	if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get sales for export: %w", err)
	}

	exports := make([]SalesExport, len(results))
	for i, row := range results {
		export := SalesExport{
			StandID:        row.StandID,
			StandName:      row.StandName,
			ProductID:      row.ProductID,
			ProductName:    row.ProductName,
			Quantity:       row.Quantity,
			UnitPrice:      row.UnitPrice,
			TotalRevenue:   row.TotalRevenue,
			RevenueDisplay: formatCurrency(row.TotalRevenue),
		}
		if row.Date != nil {
			export.Date = *row.Date
		}
		exports[i] = export
	}

	return exports, nil
}

// GetTicketsForExport retrieves ticket data for export
func (r *repository) GetTicketsForExport(ctx context.Context, festivalID uuid.UUID, dateRange *DateRange, filters *ReportFilters) ([]TicketExport, error) {
	query := `
		SELECT
			t.id,
			t.code,
			t.ticket_type_id,
			tt.name as ticket_type,
			tt.price,
			t.holder_name,
			t.holder_email,
			t.user_id,
			t.status,
			t.checked_in_at,
			COALESCE(u.name, '') as checked_in_by,
			t.created_at
		FROM public.tickets t
		INNER JOIN public.ticket_types tt ON t.ticket_type_id = tt.id
		LEFT JOIN public.users u ON t.checked_in_by = u.id
		WHERE t.festival_id = ?`

	args := []interface{}{festivalID}

	if dateRange != nil {
		query += " AND t.created_at >= ? AND t.created_at <= ?"
		args = append(args, dateRange.StartDate, dateRange.EndDate)
	}

	if filters != nil {
		if len(filters.TicketTypes) > 0 {
			query += " AND t.ticket_type_id IN (?)"
			args = append(args, filters.TicketTypes)
		}
		if len(filters.Status) > 0 {
			query += " AND t.status IN (?)"
			args = append(args, filters.Status)
		}
	}

	query += " ORDER BY t.created_at DESC"

	var results []struct {
		ID           uuid.UUID
		Code         string
		TicketTypeID uuid.UUID
		TicketType   string
		Price        int64
		HolderName   string
		HolderEmail  string
		UserID       *uuid.UUID
		Status       string
		CheckedInAt  *time.Time
		CheckedInBy  string
		CreatedAt    time.Time
	}

	if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get tickets for export: %w", err)
	}

	exports := make([]TicketExport, len(results))
	for i, row := range results {
		exports[i] = TicketExport{
			ID:           row.ID,
			Code:         row.Code,
			TicketTypeID: row.TicketTypeID,
			TicketType:   row.TicketType,
			Price:        row.Price,
			PriceDisplay: formatCurrency(row.Price),
			HolderName:   row.HolderName,
			HolderEmail:  row.HolderEmail,
			UserID:       row.UserID,
			Status:       row.Status,
			CheckedInAt:  row.CheckedInAt,
			CheckedInBy:  row.CheckedInBy,
			CreatedAt:    row.CreatedAt,
		}
	}

	return exports, nil
}

// GetWalletsForExport retrieves wallet data for export
func (r *repository) GetWalletsForExport(ctx context.Context, festivalID uuid.UUID, dateRange *DateRange, filters *ReportFilters) ([]WalletExport, error) {
	query := `
		SELECT
			w.id,
			w.user_id,
			COALESCE(u.email, '') as user_email,
			COALESCE(u.name, '') as user_name,
			w.balance,
			w.status,
			COALESCE(tx_stats.total_top_ups, 0) as total_top_ups,
			COALESCE(tx_stats.total_purchases, 0) as total_purchases,
			COALESCE(tx_stats.transaction_count, 0) as transaction_count,
			w.created_at
		FROM public.wallets w
		LEFT JOIN public.users u ON w.user_id = u.id
		LEFT JOIN (
			SELECT
				wallet_id,
				SUM(CASE WHEN type IN ('TOP_UP', 'CASH_IN') THEN ABS(amount) ELSE 0 END) as total_top_ups,
				SUM(CASE WHEN type = 'PURCHASE' THEN ABS(amount) ELSE 0 END) as total_purchases,
				COUNT(*) as transaction_count
			FROM public.transactions
			WHERE status = 'COMPLETED'
			GROUP BY wallet_id
		) tx_stats ON tx_stats.wallet_id = w.id
		WHERE w.festival_id = ?`

	args := []interface{}{festivalID}

	if dateRange != nil {
		query += " AND w.created_at >= ? AND w.created_at <= ?"
		args = append(args, dateRange.StartDate, dateRange.EndDate)
	}

	if filters != nil && len(filters.Status) > 0 {
		query += " AND w.status IN (?)"
		args = append(args, filters.Status)
	}

	query += " ORDER BY w.created_at DESC"

	var results []struct {
		ID               uuid.UUID
		UserID           uuid.UUID
		UserEmail        string
		UserName         string
		Balance          int64
		Status           string
		TotalTopUps      int64
		TotalPurchases   int64
		TransactionCount int
		CreatedAt        time.Time
	}

	if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get wallets for export: %w", err)
	}

	exports := make([]WalletExport, len(results))
	for i, row := range results {
		exports[i] = WalletExport{
			ID:               row.ID,
			UserID:           row.UserID,
			UserEmail:        row.UserEmail,
			UserName:         row.UserName,
			Balance:          row.Balance,
			BalanceDisplay:   formatCurrency(row.Balance),
			Status:           row.Status,
			TotalTopUps:      row.TotalTopUps,
			TotalPurchases:   row.TotalPurchases,
			TransactionCount: row.TransactionCount,
			CreatedAt:        row.CreatedAt,
		}
	}

	return exports, nil
}

// GetStaffPerformanceForExport retrieves staff performance data for export
func (r *repository) GetStaffPerformanceForExport(ctx context.Context, festivalID uuid.UUID, dateRange *DateRange, filters *ReportFilters) ([]StaffPerformanceExport, error) {
	query := `
		SELECT
			t.staff_id,
			COALESCE(u.name, 'Unknown') as staff_name,
			COALESCE(u.email, '') as staff_email,
			t.stand_id,
			COALESCE(s.name, 'Unknown') as stand_name,
			COUNT(t.id) as transactions,
			COALESCE(SUM(ABS(t.amount)), 0) as total_amount,
			COALESCE(AVG(ABS(t.amount)), 0) as average_amount,
			COALESCE(SUM(CASE WHEN t.type IN ('TOP_UP', 'CASH_IN') THEN 1 ELSE 0 END), 0) as top_ups,
			COALESCE(SUM(CASE WHEN t.type = 'PURCHASE' THEN 1 ELSE 0 END), 0) as purchases,
			COALESCE(SUM(CASE WHEN t.type = 'REFUND' THEN 1 ELSE 0 END), 0) as refunds
		FROM public.transactions t
		INNER JOIN public.wallets w ON t.wallet_id = w.id
		LEFT JOIN public.users u ON t.staff_id = u.id
		LEFT JOIN public.stands s ON t.stand_id = s.id
		WHERE w.festival_id = ?
			AND t.status = 'COMPLETED'
			AND t.staff_id IS NOT NULL`

	args := []interface{}{festivalID}

	if dateRange != nil {
		query += " AND t.created_at >= ? AND t.created_at <= ?"
		args = append(args, dateRange.StartDate, dateRange.EndDate)
	}

	if filters != nil {
		if len(filters.StaffIDs) > 0 {
			query += " AND t.staff_id IN (?)"
			args = append(args, filters.StaffIDs)
		}
		if len(filters.StandIDs) > 0 {
			query += " AND t.stand_id IN (?)"
			args = append(args, filters.StandIDs)
		}
	}

	query += " GROUP BY t.staff_id, u.name, u.email, t.stand_id, s.name"
	query += " ORDER BY total_amount DESC"

	var results []struct {
		StaffID       uuid.UUID
		StaffName     string
		StaffEmail    string
		StandID       uuid.UUID
		StandName     string
		Transactions  int
		TotalAmount   int64
		AverageAmount float64
		TopUps        int
		Purchases     int
		Refunds       int
	}

	if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get staff performance for export: %w", err)
	}

	exports := make([]StaffPerformanceExport, len(results))
	for i, row := range results {
		exports[i] = StaffPerformanceExport{
			StaffID:          row.StaffID,
			StaffName:        row.StaffName,
			StaffEmail:       row.StaffEmail,
			StandID:          row.StandID,
			StandName:        row.StandName,
			Transactions:     row.Transactions,
			TotalAmount:      row.TotalAmount,
			AmountDisplay:    formatCurrency(row.TotalAmount),
			AverageAmount:    int64(row.AverageAmount),
			AvgAmountDisplay: formatCurrency(int64(row.AverageAmount)),
			TopUps:           row.TopUps,
			Purchases:        row.Purchases,
			Refunds:          row.Refunds,
		}
	}

	return exports, nil
}

// formatCurrency formats cents to a currency display string
func formatCurrency(cents int64) string {
	euros := float64(cents) / 100
	if euros == float64(int64(euros)) {
		return fmt.Sprintf("%.0f EUR", euros)
	}
	return fmt.Sprintf("%.2f EUR", euros)
}
