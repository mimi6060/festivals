package inventory

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	// InventoryItem operations
	CreateItem(ctx context.Context, item *InventoryItem) error
	GetItemByID(ctx context.Context, id uuid.UUID) (*InventoryItem, error)
	GetItemByProductAndStand(ctx context.Context, productID, standID uuid.UUID) (*InventoryItem, error)
	ListItemsByStand(ctx context.Context, standID uuid.UUID, offset, limit int) ([]InventoryItem, int64, error)
	ListItemsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]InventoryItem, int64, error)
	ListLowStockItems(ctx context.Context, festivalID uuid.UUID) ([]InventoryItem, error)
	UpdateItem(ctx context.Context, item *InventoryItem) error
	DeleteItem(ctx context.Context, id uuid.UUID) error

	// Stock operations with locking
	AdjustStock(ctx context.Context, itemID uuid.UUID, delta int) (*InventoryItem, error)
	SetStock(ctx context.Context, itemID uuid.UUID, quantity int) (*InventoryItem, error)

	// StockMovement operations
	CreateMovement(ctx context.Context, movement *StockMovement) error
	GetMovementByID(ctx context.Context, id uuid.UUID) (*StockMovement, error)
	ListMovementsByItem(ctx context.Context, itemID uuid.UUID, offset, limit int) ([]StockMovement, int64, error)
	ListMovementsByStand(ctx context.Context, standID uuid.UUID, offset, limit int) ([]StockMovement, int64, error)
	ListMovementsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]StockMovement, int64, error)
	ListMovementsByDateRange(ctx context.Context, festivalID uuid.UUID, start, end time.Time) ([]StockMovement, error)

	// StockAlert operations
	CreateAlert(ctx context.Context, alert *StockAlert) error
	GetAlertByID(ctx context.Context, id uuid.UUID) (*StockAlert, error)
	GetActiveAlertByItem(ctx context.Context, itemID uuid.UUID, alertType AlertType) (*StockAlert, error)
	ListAlertsByFestival(ctx context.Context, festivalID uuid.UUID, status *AlertStatus, offset, limit int) ([]StockAlert, int64, error)
	ListAlertsByStand(ctx context.Context, standID uuid.UUID, status *AlertStatus) ([]StockAlert, error)
	UpdateAlert(ctx context.Context, alert *StockAlert) error
	ResolveAlert(ctx context.Context, id uuid.UUID) error

	// InventoryCount operations
	CreateCount(ctx context.Context, count *InventoryCount) error
	GetCountByID(ctx context.Context, id uuid.UUID) (*InventoryCount, error)
	ListCountsByStand(ctx context.Context, standID uuid.UUID, offset, limit int) ([]InventoryCount, int64, error)
	ListCountsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]InventoryCount, int64, error)
	UpdateCount(ctx context.Context, count *InventoryCount) error

	// InventoryCountItem operations
	CreateCountItems(ctx context.Context, items []InventoryCountItem) error
	GetCountItemByID(ctx context.Context, id uuid.UUID) (*InventoryCountItem, error)
	ListCountItemsByCount(ctx context.Context, countID uuid.UUID) ([]InventoryCountItem, error)
	UpdateCountItem(ctx context.Context, item *InventoryCountItem) error

	// Summary operations
	GetStockSummary(ctx context.Context, festivalID uuid.UUID) (*StockSummary, error)
	GetStandStockSummary(ctx context.Context, standID uuid.UUID) (*StockSummary, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// InventoryItem operations

func (r *repository) CreateItem(ctx context.Context, item *InventoryItem) error {
	return r.db.WithContext(ctx).Create(item).Error
}

func (r *repository) GetItemByID(ctx context.Context, id uuid.UUID) (*InventoryItem, error) {
	var item InventoryItem
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get inventory item: %w", err)
	}
	return &item, nil
}

func (r *repository) GetItemByProductAndStand(ctx context.Context, productID, standID uuid.UUID) (*InventoryItem, error) {
	var item InventoryItem
	err := r.db.WithContext(ctx).
		Where("product_id = ? AND stand_id = ?", productID, standID).
		First(&item).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get inventory item: %w", err)
	}
	return &item, nil
}

func (r *repository) ListItemsByStand(ctx context.Context, standID uuid.UUID, offset, limit int) ([]InventoryItem, int64, error) {
	var items []InventoryItem
	var total int64

	query := r.db.WithContext(ctx).Model(&InventoryItem{}).Where("stand_id = ?", standID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count inventory items: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list inventory items: %w", err)
	}

	return items, total, nil
}

func (r *repository) ListItemsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]InventoryItem, int64, error) {
	var items []InventoryItem
	var total int64

	query := r.db.WithContext(ctx).Model(&InventoryItem{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count inventory items: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list inventory items: %w", err)
	}

	return items, total, nil
}

func (r *repository) ListLowStockItems(ctx context.Context, festivalID uuid.UUID) ([]InventoryItem, error) {
	var items []InventoryItem
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND quantity <= min_threshold", festivalID).
		Order("quantity ASC").
		Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list low stock items: %w", err)
	}
	return items, nil
}

func (r *repository) UpdateItem(ctx context.Context, item *InventoryItem) error {
	return r.db.WithContext(ctx).Save(item).Error
}

func (r *repository) DeleteItem(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&InventoryItem{}).Error
}

// Stock operations with locking

func (r *repository) AdjustStock(ctx context.Context, itemID uuid.UUID, delta int) (*InventoryItem, error) {
	var item InventoryItem

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Lock the row for update
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", itemID).
			First(&item).Error; err != nil {
			return fmt.Errorf("failed to lock inventory item: %w", err)
		}

		newQty := item.Quantity + delta
		if newQty < 0 {
			return fmt.Errorf("insufficient stock: current=%d, requested=%d", item.Quantity, -delta)
		}

		item.Quantity = newQty
		item.UpdatedAt = time.Now()

		if delta > 0 {
			now := time.Now()
			item.LastRestockAt = &now
		}

		if err := tx.Save(&item).Error; err != nil {
			return fmt.Errorf("failed to update stock: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &item, nil
}

func (r *repository) SetStock(ctx context.Context, itemID uuid.UUID, quantity int) (*InventoryItem, error) {
	var item InventoryItem

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", itemID).
			First(&item).Error; err != nil {
			return fmt.Errorf("failed to lock inventory item: %w", err)
		}

		item.Quantity = quantity
		item.UpdatedAt = time.Now()
		now := time.Now()
		item.LastCountAt = &now

		if err := tx.Save(&item).Error; err != nil {
			return fmt.Errorf("failed to set stock: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &item, nil
}

// StockMovement operations

func (r *repository) CreateMovement(ctx context.Context, movement *StockMovement) error {
	return r.db.WithContext(ctx).Create(movement).Error
}

func (r *repository) GetMovementByID(ctx context.Context, id uuid.UUID) (*StockMovement, error) {
	var movement StockMovement
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&movement).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get stock movement: %w", err)
	}
	return &movement, nil
}

func (r *repository) ListMovementsByItem(ctx context.Context, itemID uuid.UUID, offset, limit int) ([]StockMovement, int64, error) {
	var movements []StockMovement
	var total int64

	query := r.db.WithContext(ctx).Model(&StockMovement{}).Where("inventory_item_id = ?", itemID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count movements: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&movements).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list movements: %w", err)
	}

	return movements, total, nil
}

func (r *repository) ListMovementsByStand(ctx context.Context, standID uuid.UUID, offset, limit int) ([]StockMovement, int64, error) {
	var movements []StockMovement
	var total int64

	query := r.db.WithContext(ctx).Model(&StockMovement{}).Where("stand_id = ?", standID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count movements: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&movements).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list movements: %w", err)
	}

	return movements, total, nil
}

func (r *repository) ListMovementsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]StockMovement, int64, error) {
	var movements []StockMovement
	var total int64

	query := r.db.WithContext(ctx).Model(&StockMovement{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count movements: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&movements).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list movements: %w", err)
	}

	return movements, total, nil
}

func (r *repository) ListMovementsByDateRange(ctx context.Context, festivalID uuid.UUID, start, end time.Time) ([]StockMovement, error) {
	var movements []StockMovement
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND created_at >= ? AND created_at <= ?", festivalID, start, end).
		Order("created_at DESC").
		Find(&movements).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list movements by date range: %w", err)
	}
	return movements, nil
}

// StockAlert operations

func (r *repository) CreateAlert(ctx context.Context, alert *StockAlert) error {
	return r.db.WithContext(ctx).Create(alert).Error
}

func (r *repository) GetAlertByID(ctx context.Context, id uuid.UUID) (*StockAlert, error) {
	var alert StockAlert
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&alert).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get stock alert: %w", err)
	}
	return &alert, nil
}

func (r *repository) GetActiveAlertByItem(ctx context.Context, itemID uuid.UUID, alertType AlertType) (*StockAlert, error) {
	var alert StockAlert
	err := r.db.WithContext(ctx).
		Where("inventory_item_id = ? AND type = ? AND status = ?", itemID, alertType, AlertStatusActive).
		First(&alert).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get active alert: %w", err)
	}
	return &alert, nil
}

func (r *repository) ListAlertsByFestival(ctx context.Context, festivalID uuid.UUID, status *AlertStatus, offset, limit int) ([]StockAlert, int64, error) {
	var alerts []StockAlert
	var total int64

	query := r.db.WithContext(ctx).Model(&StockAlert{}).Where("festival_id = ?", festivalID)
	if status != nil {
		query = query.Where("status = ?", *status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count alerts: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&alerts).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list alerts: %w", err)
	}

	return alerts, total, nil
}

func (r *repository) ListAlertsByStand(ctx context.Context, standID uuid.UUID, status *AlertStatus) ([]StockAlert, error) {
	var alerts []StockAlert
	query := r.db.WithContext(ctx).Where("stand_id = ?", standID)
	if status != nil {
		query = query.Where("status = ?", *status)
	}
	err := query.Order("created_at DESC").Find(&alerts).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list alerts: %w", err)
	}
	return alerts, nil
}

func (r *repository) UpdateAlert(ctx context.Context, alert *StockAlert) error {
	return r.db.WithContext(ctx).Save(alert).Error
}

func (r *repository) ResolveAlert(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&StockAlert{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":      AlertStatusResolved,
			"resolved_at": now,
			"updated_at":  now,
		}).Error
}

// InventoryCount operations

func (r *repository) CreateCount(ctx context.Context, count *InventoryCount) error {
	return r.db.WithContext(ctx).Create(count).Error
}

func (r *repository) GetCountByID(ctx context.Context, id uuid.UUID) (*InventoryCount, error) {
	var count InventoryCount
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&count).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get inventory count: %w", err)
	}
	return &count, nil
}

func (r *repository) ListCountsByStand(ctx context.Context, standID uuid.UUID, offset, limit int) ([]InventoryCount, int64, error) {
	var counts []InventoryCount
	var total int64

	query := r.db.WithContext(ctx).Model(&InventoryCount{}).Where("stand_id = ?", standID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count inventory counts: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&counts).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list inventory counts: %w", err)
	}

	return counts, total, nil
}

func (r *repository) ListCountsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]InventoryCount, int64, error) {
	var counts []InventoryCount
	var total int64

	query := r.db.WithContext(ctx).Model(&InventoryCount{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count inventory counts: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&counts).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list inventory counts: %w", err)
	}

	return counts, total, nil
}

func (r *repository) UpdateCount(ctx context.Context, count *InventoryCount) error {
	return r.db.WithContext(ctx).Save(count).Error
}

// InventoryCountItem operations

func (r *repository) CreateCountItems(ctx context.Context, items []InventoryCountItem) error {
	return r.db.WithContext(ctx).Create(&items).Error
}

func (r *repository) GetCountItemByID(ctx context.Context, id uuid.UUID) (*InventoryCountItem, error) {
	var item InventoryCountItem
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get count item: %w", err)
	}
	return &item, nil
}

func (r *repository) ListCountItemsByCount(ctx context.Context, countID uuid.UUID) ([]InventoryCountItem, error) {
	var items []InventoryCountItem
	err := r.db.WithContext(ctx).Where("count_id = ?", countID).Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list count items: %w", err)
	}
	return items, nil
}

func (r *repository) UpdateCountItem(ctx context.Context, item *InventoryCountItem) error {
	return r.db.WithContext(ctx).Save(item).Error
}

// Summary operations

func (r *repository) GetStockSummary(ctx context.Context, festivalID uuid.UUID) (*StockSummary, error) {
	var summary StockSummary

	// Total items and quantity
	row := r.db.WithContext(ctx).
		Model(&InventoryItem{}).
		Where("festival_id = ?", festivalID).
		Select("COUNT(*) as total_items, COALESCE(SUM(quantity), 0) as total_quantity").
		Row()
	if err := row.Scan(&summary.TotalItems, &summary.TotalQuantity); err != nil {
		return nil, fmt.Errorf("failed to get stock summary: %w", err)
	}

	// Low stock count
	r.db.WithContext(ctx).
		Model(&InventoryItem{}).
		Where("festival_id = ? AND quantity > 0 AND quantity <= min_threshold", festivalID).
		Count((*int64)(&summary.LowStockCount))

	// Out of stock count
	r.db.WithContext(ctx).
		Model(&InventoryItem{}).
		Where("festival_id = ? AND quantity = 0", festivalID).
		Count((*int64)(&summary.OutOfStockCount))

	// Active alerts
	r.db.WithContext(ctx).
		Model(&StockAlert{}).
		Where("festival_id = ? AND status = ?", festivalID, AlertStatusActive).
		Count((*int64)(&summary.ActiveAlerts))

	return &summary, nil
}

func (r *repository) GetStandStockSummary(ctx context.Context, standID uuid.UUID) (*StockSummary, error) {
	var summary StockSummary

	// Total items and quantity
	row := r.db.WithContext(ctx).
		Model(&InventoryItem{}).
		Where("stand_id = ?", standID).
		Select("COUNT(*) as total_items, COALESCE(SUM(quantity), 0) as total_quantity").
		Row()
	if err := row.Scan(&summary.TotalItems, &summary.TotalQuantity); err != nil {
		return nil, fmt.Errorf("failed to get stand stock summary: %w", err)
	}

	// Low stock count
	r.db.WithContext(ctx).
		Model(&InventoryItem{}).
		Where("stand_id = ? AND quantity > 0 AND quantity <= min_threshold", standID).
		Count((*int64)(&summary.LowStockCount))

	// Out of stock count
	r.db.WithContext(ctx).
		Model(&InventoryItem{}).
		Where("stand_id = ? AND quantity = 0", standID).
		Count((*int64)(&summary.OutOfStockCount))

	// Active alerts
	r.db.WithContext(ctx).
		Model(&StockAlert{}).
		Where("stand_id = ? AND status = ?", standID, AlertStatusActive).
		Count((*int64)(&summary.ActiveAlerts))

	return &summary, nil
}
