package stats

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"gorm.io/gorm"
)

// Service provides business logic for stats operations
type Service struct {
	repo Repository
	db   *gorm.DB
}

// NewService creates a new stats service
func NewService(repo Repository, db *gorm.DB) *Service {
	return &Service{repo: repo, db: db}
}

// GetDashboardStats retrieves comprehensive dashboard statistics for a festival
func (s *Service) GetDashboardStats(ctx context.Context, festivalID uuid.UUID, timeframe Timeframe) (*DashboardStats, error) {
	// Verify festival exists
	var festivalExists bool
	if err := s.db.WithContext(ctx).Raw(
		"SELECT EXISTS(SELECT 1 FROM public.festivals WHERE id = ?)",
		festivalID,
	).Scan(&festivalExists).Error; err != nil {
		return nil, fmt.Errorf("failed to check festival existence: %w", err)
	}
	if !festivalExists {
		return nil, errors.ErrFestivalNotFound
	}

	// Get overview stats
	festivalStats, err := s.repo.GetFestivalStats(ctx, festivalID, timeframe)
	if err != nil {
		return nil, fmt.Errorf("failed to get festival stats: %w", err)
	}

	// Get revenue chart data (last 7 days for TODAY/WEEK, last 30 days for MONTH/ALL)
	var chartDays int
	switch timeframe {
	case TimeframeToday:
		chartDays = 1
	case TimeframeWeek:
		chartDays = 7
	case TimeframeMonth:
		chartDays = 30
	case TimeframeAll:
		chartDays = 30 // Default to 30 days for ALL
	default:
		chartDays = 7
	}

	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -chartDays+1)
	revenueChart, err := s.GetRevenueChart(ctx, festivalID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get revenue chart: %w", err)
	}

	// Get top products
	topProducts, err := s.GetTopSellingProducts(ctx, festivalID, 10, timeframe)
	if err != nil {
		return nil, fmt.Errorf("failed to get top products: %w", err)
	}

	// Get top stands
	topStands, err := s.repo.GetTopStands(ctx, festivalID, 5, timeframe)
	if err != nil {
		return nil, fmt.Errorf("failed to get top stands: %w", err)
	}

	topStandsResponse := make([]StandStatsResponse, len(topStands))
	for i, stand := range topStands {
		topStandsResponse[i] = stand.ToResponse()
	}

	// Get recent transactions
	recentTx, err := s.repo.GetRecentTransactions(ctx, festivalID, 10)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent transactions: %w", err)
	}

	recentTxResponse := make([]RecentTransactionResponse, len(recentTx))
	for i, tx := range recentTx {
		recentTxResponse[i] = tx.ToResponse()
	}

	dashboard := &DashboardStats{
		Overview:           festivalStats.ToResponse(),
		RevenueChart:       *revenueChart,
		TopProducts:        topProducts,
		TopStands:          topStandsResponse,
		RecentTransactions: recentTxResponse,
	}

	return dashboard, nil
}

// GetRevenueChart retrieves revenue chart data for a date range
func (s *Service) GetRevenueChart(ctx context.Context, festivalID uuid.UUID, startDate, endDate time.Time) (*RevenueChartData, error) {
	dailyStats, err := s.repo.GetDailyStats(ctx, festivalID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get daily stats: %w", err)
	}

	chartData := &RevenueChartData{
		Labels:    make([]string, len(dailyStats)),
		Revenue:   make([]int64, len(dailyStats)),
		TopUps:    make([]int64, len(dailyStats)),
		Purchases: make([]int64, len(dailyStats)),
	}

	for i, day := range dailyStats {
		chartData.Labels[i] = day.Date.Format("2006-01-02")
		chartData.Revenue[i] = day.Revenue
		chartData.TopUps[i] = day.TopUps
		chartData.Purchases[i] = day.Purchases
	}

	return chartData, nil
}

// GetTopSellingProducts retrieves the top selling products for a festival
func (s *Service) GetTopSellingProducts(ctx context.Context, festivalID uuid.UUID, limit int, timeframe Timeframe) ([]ProductStatsResponse, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}

	products, err := s.repo.GetTopProducts(ctx, festivalID, limit, timeframe)
	if err != nil {
		return nil, fmt.Errorf("failed to get top products: %w", err)
	}

	response := make([]ProductStatsResponse, len(products))
	for i, p := range products {
		response[i] = p.ToResponse()
	}

	return response, nil
}

// GetStaffPerformance retrieves performance statistics for all staff at a festival
func (s *Service) GetStaffPerformance(ctx context.Context, festivalID uuid.UUID, timeframe Timeframe) ([]StaffPerformanceResponse, error) {
	// Verify festival exists
	var festivalExists bool
	if err := s.db.WithContext(ctx).Raw(
		"SELECT EXISTS(SELECT 1 FROM public.festivals WHERE id = ?)",
		festivalID,
	).Scan(&festivalExists).Error; err != nil {
		return nil, fmt.Errorf("failed to check festival existence: %w", err)
	}
	if !festivalExists {
		return nil, errors.ErrFestivalNotFound
	}

	performance, err := s.repo.GetStaffPerformance(ctx, festivalID, timeframe)
	if err != nil {
		return nil, fmt.Errorf("failed to get staff performance: %w", err)
	}

	response := make([]StaffPerformanceResponse, len(performance))
	for i, p := range performance {
		response[i] = p.ToResponse()
	}

	return response, nil
}

// GetFestivalStats retrieves overall statistics for a festival
func (s *Service) GetFestivalStats(ctx context.Context, festivalID uuid.UUID, timeframe Timeframe) (*FestivalStatsResponse, error) {
	// Verify festival exists
	var festivalExists bool
	if err := s.db.WithContext(ctx).Raw(
		"SELECT EXISTS(SELECT 1 FROM public.festivals WHERE id = ?)",
		festivalID,
	).Scan(&festivalExists).Error; err != nil {
		return nil, fmt.Errorf("failed to check festival existence: %w", err)
	}
	if !festivalExists {
		return nil, errors.ErrFestivalNotFound
	}

	stats, err := s.repo.GetFestivalStats(ctx, festivalID, timeframe)
	if err != nil {
		return nil, fmt.Errorf("failed to get festival stats: %w", err)
	}

	response := stats.ToResponse()
	return &response, nil
}

// GetStandStats retrieves statistics for a specific stand
func (s *Service) GetStandStats(ctx context.Context, standID uuid.UUID, timeframe Timeframe) (*StandStatsResponse, error) {
	// Verify stand exists
	var standExists bool
	if err := s.db.WithContext(ctx).Raw(
		"SELECT EXISTS(SELECT 1 FROM public.stands WHERE id = ?)",
		standID,
	).Scan(&standExists).Error; err != nil {
		return nil, fmt.Errorf("failed to check stand existence: %w", err)
	}
	if !standExists {
		return nil, errors.ErrNotFound
	}

	stats, err := s.repo.GetStandStats(ctx, standID, timeframe)
	if err != nil {
		return nil, fmt.Errorf("failed to get stand stats: %w", err)
	}

	response := stats.ToResponse()
	return &response, nil
}

// GetRecentTransactions retrieves recent transactions for a festival
func (s *Service) GetRecentTransactions(ctx context.Context, festivalID uuid.UUID, limit int) ([]RecentTransactionResponse, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	transactions, err := s.repo.GetRecentTransactions(ctx, festivalID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent transactions: %w", err)
	}

	response := make([]RecentTransactionResponse, len(transactions))
	for i, tx := range transactions {
		response[i] = tx.ToResponse()
	}

	return response, nil
}

// GetDailyStats retrieves daily statistics for a date range
func (s *Service) GetDailyStats(ctx context.Context, festivalID uuid.UUID, startDate, endDate time.Time) ([]DailyStatsResponse, error) {
	// Verify festival exists
	var festivalExists bool
	if err := s.db.WithContext(ctx).Raw(
		"SELECT EXISTS(SELECT 1 FROM public.festivals WHERE id = ?)",
		festivalID,
	).Scan(&festivalExists).Error; err != nil {
		return nil, fmt.Errorf("failed to check festival existence: %w", err)
	}
	if !festivalExists {
		return nil, errors.ErrFestivalNotFound
	}

	stats, err := s.repo.GetDailyStats(ctx, festivalID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get daily stats: %w", err)
	}

	response := make([]DailyStatsResponse, len(stats))
	for i, day := range stats {
		response[i] = day.ToResponse()
	}

	return response, nil
}

// GetTopStands retrieves top performing stands for a festival
func (s *Service) GetTopStands(ctx context.Context, festivalID uuid.UUID, limit int, timeframe Timeframe) ([]StandStatsResponse, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	stands, err := s.repo.GetTopStands(ctx, festivalID, limit, timeframe)
	if err != nil {
		return nil, fmt.Errorf("failed to get top stands: %w", err)
	}

	response := make([]StandStatsResponse, len(stands))
	for i, stand := range stands {
		response[i] = stand.ToResponse()
	}

	return response, nil
}
