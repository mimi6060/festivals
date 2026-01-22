package inventory

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// CreateItem creates a new inventory item
func (s *Service) CreateItem(ctx context.Context, req CreateInventoryItemRequest) (*InventoryItem, error) {
	// Check if item already exists
	existing, err := s.repo.GetItemByProductAndStand(ctx, req.ProductID, req.StandID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing item: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("inventory item already exists for this product and stand")
	}

	item := &InventoryItem{
		ID:           uuid.New(),
		ProductID:    req.ProductID,
		StandID:      req.StandID,
		FestivalID:   req.FestivalID,
		Quantity:     req.Quantity,
		MinThreshold: req.MinThreshold,
		MaxCapacity:  req.MaxCapacity,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.repo.CreateItem(ctx, item); err != nil {
		return nil, fmt.Errorf("failed to create inventory item: %w", err)
	}

	// Check if we need to create an alert
	if err := s.checkAndCreateAlert(ctx, item); err != nil {
		// Log error but don't fail the creation
		fmt.Printf("Warning: failed to check alert for new item: %v\n", err)
	}

	return item, nil
}

// GetItemByID gets an inventory item by ID
func (s *Service) GetItemByID(ctx context.Context, id uuid.UUID) (*InventoryItem, error) {
	item, err := s.repo.GetItemByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, errors.ErrNotFound
	}
	return item, nil
}

// GetItemByProductAndStand gets an inventory item by product and stand
func (s *Service) GetItemByProductAndStand(ctx context.Context, productID, standID uuid.UUID) (*InventoryItem, error) {
	return s.repo.GetItemByProductAndStand(ctx, productID, standID)
}

// ListItemsByStand lists inventory items for a stand
func (s *Service) ListItemsByStand(ctx context.Context, standID uuid.UUID, page, perPage int) ([]InventoryItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage
	return s.repo.ListItemsByStand(ctx, standID, offset, perPage)
}

// ListItemsByFestival lists inventory items for a festival
func (s *Service) ListItemsByFestival(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]InventoryItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage
	return s.repo.ListItemsByFestival(ctx, festivalID, offset, perPage)
}

// UpdateItem updates an inventory item's settings
func (s *Service) UpdateItem(ctx context.Context, id uuid.UUID, req UpdateInventoryItemRequest) (*InventoryItem, error) {
	item, err := s.repo.GetItemByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, errors.ErrNotFound
	}

	if req.MinThreshold != nil {
		item.MinThreshold = *req.MinThreshold
	}
	if req.MaxCapacity != nil {
		item.MaxCapacity = req.MaxCapacity
	}

	item.UpdatedAt = time.Now()

	if err := s.repo.UpdateItem(ctx, item); err != nil {
		return nil, fmt.Errorf("failed to update inventory item: %w", err)
	}

	// Re-check alerts with new thresholds
	if err := s.checkAndCreateAlert(ctx, item); err != nil {
		fmt.Printf("Warning: failed to check alert after update: %v\n", err)
	}

	return item, nil
}

// GetStock gets the current stock level for a product at a stand
func (s *Service) GetStock(ctx context.Context, productID, standID uuid.UUID) (int, error) {
	item, err := s.repo.GetItemByProductAndStand(ctx, productID, standID)
	if err != nil {
		return 0, err
	}
	if item == nil {
		return 0, nil // No inventory tracking = unlimited
	}
	return item.Quantity, nil
}

// AdjustStock adjusts the stock level for a product
func (s *Service) AdjustStock(ctx context.Context, req AdjustStockRequest, performedBy uuid.UUID, performedByName string) (*InventoryItem, error) {
	// Get or create inventory item
	item, err := s.repo.GetItemByProductAndStand(ctx, req.ProductID, req.StandID)
	if err != nil {
		return nil, fmt.Errorf("failed to get inventory item: %w", err)
	}
	if item == nil {
		return nil, fmt.Errorf("inventory item not found for product %s at stand %s", req.ProductID, req.StandID)
	}

	previousQty := item.Quantity

	// Adjust stock
	updatedItem, err := s.repo.AdjustStock(ctx, item.ID, req.Delta)
	if err != nil {
		return nil, err
	}

	// Record movement
	movement := &StockMovement{
		ID:              uuid.New(),
		InventoryItemID: item.ID,
		ProductID:       req.ProductID,
		StandID:         req.StandID,
		FestivalID:      item.FestivalID,
		Type:            req.Type,
		Quantity:        req.Delta,
		PreviousQty:     previousQty,
		NewQty:          updatedItem.Quantity,
		Reason:          req.Reason,
		Reference:       req.Reference,
		PerformedBy:     performedBy,
		PerformedByName: performedByName,
		CreatedAt:       time.Now(),
	}

	if err := s.repo.CreateMovement(ctx, movement); err != nil {
		fmt.Printf("Warning: failed to record stock movement: %v\n", err)
	}

	// Check and update alerts
	if err := s.checkAndCreateAlert(ctx, updatedItem); err != nil {
		fmt.Printf("Warning: failed to check alert after adjustment: %v\n", err)
	}

	return updatedItem, nil
}

// RecordSale records a sale and decrements stock automatically
func (s *Service) RecordSale(ctx context.Context, req RecordSaleRequest, performedBy uuid.UUID, performedByName string) error {
	item, err := s.repo.GetItemByProductAndStand(ctx, req.ProductID, req.StandID)
	if err != nil {
		return fmt.Errorf("failed to get inventory item: %w", err)
	}
	if item == nil {
		// No inventory tracking for this product
		return nil
	}

	_, err = s.AdjustStock(ctx, AdjustStockRequest{
		ProductID: req.ProductID,
		StandID:   req.StandID,
		Delta:     -req.Quantity,
		Type:      MovementTypeOut,
		Reason:    "Sale",
		Reference: req.OrderID,
	}, performedBy, performedByName)

	return err
}

// RecordRefund records a refund and increments stock
func (s *Service) RecordRefund(ctx context.Context, productID, standID uuid.UUID, quantity int, orderID string, performedBy uuid.UUID, performedByName string) error {
	item, err := s.repo.GetItemByProductAndStand(ctx, productID, standID)
	if err != nil {
		return fmt.Errorf("failed to get inventory item: %w", err)
	}
	if item == nil {
		return nil
	}

	_, err = s.AdjustStock(ctx, AdjustStockRequest{
		ProductID: productID,
		StandID:   standID,
		Delta:     quantity,
		Type:      MovementTypeReturn,
		Reason:    "Refund",
		Reference: orderID,
	}, performedBy, performedByName)

	return err
}

// GetLowStockAlerts gets all active low stock alerts for a festival
func (s *Service) GetLowStockAlerts(ctx context.Context, festivalID uuid.UUID) ([]StockAlert, error) {
	status := AlertStatusActive
	alerts, _, err := s.repo.ListAlertsByFestival(ctx, festivalID, &status, 0, 1000)
	return alerts, err
}

// GetAlertsByFestival gets all alerts for a festival with pagination
func (s *Service) GetAlertsByFestival(ctx context.Context, festivalID uuid.UUID, status *AlertStatus, page, perPage int) ([]StockAlert, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage
	return s.repo.ListAlertsByFestival(ctx, festivalID, status, offset, perPage)
}

// AcknowledgeAlert acknowledges an alert
func (s *Service) AcknowledgeAlert(ctx context.Context, alertID, acknowledgedBy uuid.UUID) (*StockAlert, error) {
	alert, err := s.repo.GetAlertByID(ctx, alertID)
	if err != nil {
		return nil, err
	}
	if alert == nil {
		return nil, errors.ErrNotFound
	}

	now := time.Now()
	alert.Status = AlertStatusAcknowledged
	alert.AcknowledgedBy = &acknowledgedBy
	alert.AcknowledgedAt = &now
	alert.UpdatedAt = now

	if err := s.repo.UpdateAlert(ctx, alert); err != nil {
		return nil, fmt.Errorf("failed to acknowledge alert: %w", err)
	}

	return alert, nil
}

// CreateInventoryCount creates a new inventory count session
func (s *Service) CreateInventoryCount(ctx context.Context, req CreateCountRequest, startedBy uuid.UUID) (*InventoryCount, error) {
	now := time.Now()
	count := &InventoryCount{
		ID:         uuid.New(),
		StandID:    req.StandID,
		FestivalID: req.FestivalID,
		Status:     CountStatusInProgress,
		StartedAt:  &now,
		StartedBy:  &startedBy,
		Notes:      req.Notes,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := s.repo.CreateCount(ctx, count); err != nil {
		return nil, fmt.Errorf("failed to create inventory count: %w", err)
	}

	// Create count items for all inventory items in the stand
	items, _, err := s.repo.ListItemsByStand(ctx, req.StandID, 0, 1000)
	if err != nil {
		return nil, fmt.Errorf("failed to get stand inventory: %w", err)
	}

	countItems := make([]InventoryCountItem, len(items))
	for i, item := range items {
		countItems[i] = InventoryCountItem{
			ID:              uuid.New(),
			CountID:         count.ID,
			InventoryItemID: item.ID,
			ProductID:       item.ProductID,
			ExpectedQty:     item.Quantity,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
	}

	if len(countItems) > 0 {
		if err := s.repo.CreateCountItems(ctx, countItems); err != nil {
			return nil, fmt.Errorf("failed to create count items: %w", err)
		}
	}

	return count, nil
}

// GetInventoryCount gets an inventory count by ID
func (s *Service) GetInventoryCount(ctx context.Context, id uuid.UUID) (*InventoryCount, error) {
	count, err := s.repo.GetCountByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if count == nil {
		return nil, errors.ErrNotFound
	}
	return count, nil
}

// GetCountItems gets all items for a count
func (s *Service) GetCountItems(ctx context.Context, countID uuid.UUID) ([]InventoryCountItem, error) {
	return s.repo.ListCountItemsByCount(ctx, countID)
}

// ListCountsByFestival lists inventory counts for a festival
func (s *Service) ListCountsByFestival(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]InventoryCount, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage
	return s.repo.ListCountsByFestival(ctx, festivalID, offset, perPage)
}

// RecordCountItem records a count for a single item
func (s *Service) RecordCountItem(ctx context.Context, countItemID uuid.UUID, countedQty int, notes string, countedBy uuid.UUID) (*InventoryCountItem, error) {
	item, err := s.repo.GetCountItemByID(ctx, countItemID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, errors.ErrNotFound
	}

	now := time.Now()
	variance := countedQty - item.ExpectedQty

	item.CountedQty = &countedQty
	item.Variance = &variance
	item.Notes = notes
	item.CountedAt = &now
	item.CountedBy = &countedBy
	item.UpdatedAt = now

	if err := s.repo.UpdateCountItem(ctx, item); err != nil {
		return nil, fmt.Errorf("failed to update count item: %w", err)
	}

	return item, nil
}

// ReconcileCount reconciles an inventory count and adjusts stock levels
func (s *Service) ReconcileCount(ctx context.Context, countID uuid.UUID, req ReconcileCountRequest, completedBy uuid.UUID, completedByName string) (*InventoryCount, error) {
	count, err := s.repo.GetCountByID(ctx, countID)
	if err != nil {
		return nil, err
	}
	if count == nil {
		return nil, errors.ErrNotFound
	}
	if count.Status == CountStatusCompleted {
		return nil, fmt.Errorf("count already completed")
	}

	now := time.Now()

	// Process each item
	for _, itemReq := range req.Items {
		// Get the count item
		countItems, err := s.repo.ListCountItemsByCount(ctx, countID)
		if err != nil {
			return nil, err
		}

		var countItem *InventoryCountItem
		for _, ci := range countItems {
			if ci.InventoryItemID == itemReq.InventoryItemID {
				countItem = &ci
				break
			}
		}

		if countItem == nil {
			continue
		}

		// Record the count
		variance := itemReq.CountedQty - countItem.ExpectedQty
		countItem.CountedQty = &itemReq.CountedQty
		countItem.Variance = &variance
		countItem.Notes = itemReq.Notes
		countItem.CountedAt = &now
		countItem.CountedBy = &completedBy
		countItem.UpdatedAt = now

		if err := s.repo.UpdateCountItem(ctx, countItem); err != nil {
			return nil, fmt.Errorf("failed to update count item: %w", err)
		}

		// If there's a variance, adjust the stock
		if variance != 0 {
			item, err := s.repo.GetItemByID(ctx, itemReq.InventoryItemID)
			if err != nil || item == nil {
				continue
			}

			previousQty := item.Quantity
			_, err = s.repo.SetStock(ctx, item.ID, itemReq.CountedQty)
			if err != nil {
				return nil, fmt.Errorf("failed to adjust stock: %w", err)
			}

			// Record movement
			movement := &StockMovement{
				ID:              uuid.New(),
				InventoryItemID: item.ID,
				ProductID:       item.ProductID,
				StandID:         item.StandID,
				FestivalID:      item.FestivalID,
				Type:            MovementTypeAdjustment,
				Quantity:        variance,
				PreviousQty:     previousQty,
				NewQty:          itemReq.CountedQty,
				Reason:          fmt.Sprintf("Inventory count reconciliation: %s", itemReq.Notes),
				Reference:       countID.String(),
				PerformedBy:     completedBy,
				PerformedByName: completedByName,
				CreatedAt:       now,
			}

			if err := s.repo.CreateMovement(ctx, movement); err != nil {
				fmt.Printf("Warning: failed to record reconciliation movement: %v\n", err)
			}

			// Check and update alerts
			updatedItem, _ := s.repo.GetItemByID(ctx, item.ID)
			if updatedItem != nil {
				s.checkAndCreateAlert(ctx, updatedItem)
			}
		}
	}

	// Complete the count
	count.Status = CountStatusCompleted
	count.CompletedAt = &now
	count.CompletedBy = &completedBy
	count.UpdatedAt = now

	if err := s.repo.UpdateCount(ctx, count); err != nil {
		return nil, fmt.Errorf("failed to complete count: %w", err)
	}

	return count, nil
}

// CancelCount cancels an inventory count
func (s *Service) CancelCount(ctx context.Context, countID uuid.UUID) (*InventoryCount, error) {
	count, err := s.repo.GetCountByID(ctx, countID)
	if err != nil {
		return nil, err
	}
	if count == nil {
		return nil, errors.ErrNotFound
	}
	if count.Status == CountStatusCompleted {
		return nil, fmt.Errorf("cannot cancel completed count")
	}

	count.Status = CountStatusCancelled
	count.UpdatedAt = time.Now()

	if err := s.repo.UpdateCount(ctx, count); err != nil {
		return nil, fmt.Errorf("failed to cancel count: %w", err)
	}

	return count, nil
}

// GetMovementsByFestival lists stock movements for a festival
func (s *Service) GetMovementsByFestival(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]StockMovement, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage
	return s.repo.ListMovementsByFestival(ctx, festivalID, offset, perPage)
}

// GetMovementsByStand lists stock movements for a stand
func (s *Service) GetMovementsByStand(ctx context.Context, standID uuid.UUID, page, perPage int) ([]StockMovement, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage
	return s.repo.ListMovementsByStand(ctx, standID, offset, perPage)
}

// GetStockSummary gets the stock summary for a festival
func (s *Service) GetStockSummary(ctx context.Context, festivalID uuid.UUID) (*StockSummary, error) {
	return s.repo.GetStockSummary(ctx, festivalID)
}

// GetStandStockSummary gets the stock summary for a stand
func (s *Service) GetStandStockSummary(ctx context.Context, standID uuid.UUID) (*StockSummary, error) {
	return s.repo.GetStandStockSummary(ctx, standID)
}

// checkAndCreateAlert checks if an alert should be created or resolved
func (s *Service) checkAndCreateAlert(ctx context.Context, item *InventoryItem) error {
	now := time.Now()

	// Check for out of stock
	if item.Quantity == 0 {
		// Check if there's already an active out of stock alert
		existing, _ := s.repo.GetActiveAlertByItem(ctx, item.ID, AlertTypeOutOfStock)
		if existing == nil {
			alert := &StockAlert{
				ID:              uuid.New(),
				InventoryItemID: item.ID,
				ProductID:       item.ProductID,
				StandID:         item.StandID,
				FestivalID:      item.FestivalID,
				Type:            AlertTypeOutOfStock,
				Status:          AlertStatusActive,
				CurrentQty:      item.Quantity,
				ThresholdQty:    0,
				Message:         "Product is out of stock",
				CreatedAt:       now,
				UpdatedAt:       now,
			}
			if err := s.repo.CreateAlert(ctx, alert); err != nil {
				return err
			}
		}

		// Resolve any low stock alert since we're now out of stock
		lowStockAlert, _ := s.repo.GetActiveAlertByItem(ctx, item.ID, AlertTypeLowStock)
		if lowStockAlert != nil {
			s.repo.ResolveAlert(ctx, lowStockAlert.ID)
		}
	} else if item.Quantity <= item.MinThreshold {
		// Low stock - check if there's already an active alert
		existing, _ := s.repo.GetActiveAlertByItem(ctx, item.ID, AlertTypeLowStock)
		if existing == nil {
			alert := &StockAlert{
				ID:              uuid.New(),
				InventoryItemID: item.ID,
				ProductID:       item.ProductID,
				StandID:         item.StandID,
				FestivalID:      item.FestivalID,
				Type:            AlertTypeLowStock,
				Status:          AlertStatusActive,
				CurrentQty:      item.Quantity,
				ThresholdQty:    item.MinThreshold,
				Message:         fmt.Sprintf("Stock is low: %d units remaining (threshold: %d)", item.Quantity, item.MinThreshold),
				CreatedAt:       now,
				UpdatedAt:       now,
			}
			if err := s.repo.CreateAlert(ctx, alert); err != nil {
				return err
			}
		}

		// Resolve any out of stock alert since we now have stock
		outOfStockAlert, _ := s.repo.GetActiveAlertByItem(ctx, item.ID, AlertTypeOutOfStock)
		if outOfStockAlert != nil {
			s.repo.ResolveAlert(ctx, outOfStockAlert.ID)
		}
	} else {
		// Stock is healthy - resolve any active alerts
		lowStockAlert, _ := s.repo.GetActiveAlertByItem(ctx, item.ID, AlertTypeLowStock)
		if lowStockAlert != nil {
			s.repo.ResolveAlert(ctx, lowStockAlert.ID)
		}

		outOfStockAlert, _ := s.repo.GetActiveAlertByItem(ctx, item.ID, AlertTypeOutOfStock)
		if outOfStockAlert != nil {
			s.repo.ResolveAlert(ctx, outOfStockAlert.ID)
		}
	}

	return nil
}
