package order

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	// Order operations
	CreateOrder(ctx context.Context, order *Order) error
	GetOrderByID(ctx context.Context, id uuid.UUID) (*Order, error)
	UpdateOrder(ctx context.Context, order *Order) error
	DeleteOrder(ctx context.Context, id uuid.UUID) error

	// Query operations
	GetOrdersByUser(ctx context.Context, userID, festivalID uuid.UUID, offset, limit int) ([]Order, int64, error)
	GetOrdersByStand(ctx context.Context, standID uuid.UUID, offset, limit int, filter *OrderFilter) ([]Order, int64, error)
	GetOrdersByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int, filter *OrderFilter) ([]Order, int64, error)

	// Statistics
	GetStandStats(ctx context.Context, standID uuid.UUID, startDate, endDate *time.Time) (*OrderStandStats, error)
}

// OrderFilter represents filter options for querying orders
type OrderFilter struct {
	Status    *OrderStatus
	StartDate *time.Time
	EndDate   *time.Time
	UserID    *uuid.UUID
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) CreateOrder(ctx context.Context, order *Order) error {
	return r.db.WithContext(ctx).Create(order).Error
}

func (r *repository) GetOrderByID(ctx context.Context, id uuid.UUID) (*Order, error) {
	var order Order
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&order).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get order: %w", err)
	}
	return &order, nil
}

func (r *repository) UpdateOrder(ctx context.Context, order *Order) error {
	return r.db.WithContext(ctx).Save(order).Error
}

func (r *repository) DeleteOrder(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&Order{}, "id = ?", id).Error
}

func (r *repository) GetOrdersByUser(ctx context.Context, userID, festivalID uuid.UUID, offset, limit int) ([]Order, int64, error) {
	var orders []Order
	var total int64

	query := r.db.WithContext(ctx).Model(&Order{}).
		Where("user_id = ? AND festival_id = ?", userID, festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count orders: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&orders).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list orders: %w", err)
	}

	return orders, total, nil
}

func (r *repository) GetOrdersByStand(ctx context.Context, standID uuid.UUID, offset, limit int, filter *OrderFilter) ([]Order, int64, error) {
	var orders []Order
	var total int64

	query := r.db.WithContext(ctx).Model(&Order{}).Where("stand_id = ?", standID)
	query = r.applyFilter(query, filter)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count orders: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&orders).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list orders: %w", err)
	}

	return orders, total, nil
}

func (r *repository) GetOrdersByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int, filter *OrderFilter) ([]Order, int64, error) {
	var orders []Order
	var total int64

	query := r.db.WithContext(ctx).Model(&Order{}).Where("festival_id = ?", festivalID)
	query = r.applyFilter(query, filter)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count orders: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&orders).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list orders: %w", err)
	}

	return orders, total, nil
}

func (r *repository) applyFilter(query *gorm.DB, filter *OrderFilter) *gorm.DB {
	if filter == nil {
		return query
	}

	if filter.Status != nil {
		query = query.Where("status = ?", *filter.Status)
	}

	if filter.StartDate != nil {
		query = query.Where("created_at >= ?", *filter.StartDate)
	}

	if filter.EndDate != nil {
		query = query.Where("created_at <= ?", *filter.EndDate)
	}

	if filter.UserID != nil {
		query = query.Where("user_id = ?", *filter.UserID)
	}

	return query
}

func (r *repository) GetStandStats(ctx context.Context, standID uuid.UUID, startDate, endDate *time.Time) (*OrderStandStats, error) {
	stats := &OrderStandStats{StandID: standID}

	query := r.db.WithContext(ctx).Model(&Order{}).Where("stand_id = ?", standID)

	if startDate != nil {
		query = query.Where("created_at >= ?", *startDate)
	}
	if endDate != nil {
		query = query.Where("created_at <= ?", *endDate)
	}

	// Total orders
	if err := query.Count(&stats.TotalOrders).Error; err != nil {
		return nil, fmt.Errorf("failed to count total orders: %w", err)
	}

	// Total revenue (only from paid orders)
	var totalRevenue struct {
		Sum int64
	}
	if err := r.db.WithContext(ctx).Model(&Order{}).
		Select("COALESCE(SUM(total_amount), 0) as sum").
		Where("stand_id = ? AND status = ?", standID, OrderStatusPaid).
		Scan(&totalRevenue).Error; err != nil {
		return nil, fmt.Errorf("failed to calculate total revenue: %w", err)
	}
	stats.TotalRevenue = totalRevenue.Sum

	// Average order value
	if stats.TotalOrders > 0 {
		stats.AverageOrder = stats.TotalRevenue / stats.TotalOrders
	}

	// Count by status
	statusCounts := []struct {
		Status OrderStatus
		Count  int64
	}{}
	if err := r.db.WithContext(ctx).Model(&Order{}).
		Select("status, COUNT(*) as count").
		Where("stand_id = ?", standID).
		Group("status").
		Scan(&statusCounts).Error; err != nil {
		return nil, fmt.Errorf("failed to count orders by status: %w", err)
	}

	for _, sc := range statusCounts {
		switch sc.Status {
		case OrderStatusPaid:
			stats.PaidOrders = sc.Count
		case OrderStatusCancelled:
			stats.CancelledOrders = sc.Count
		case OrderStatusRefunded:
			stats.RefundedOrders = sc.Count
		}
	}

	return stats, nil
}
