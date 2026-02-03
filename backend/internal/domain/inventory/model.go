package inventory

import (
	"time"

	"github.com/google/uuid"
)

// InventoryItem represents the stock level for a product at a stand
type InventoryItem struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ProductID      uuid.UUID `json:"productId" gorm:"type:uuid;not null;uniqueIndex:idx_inventory_product_stand"`
	StandID        uuid.UUID `json:"standId" gorm:"type:uuid;not null;uniqueIndex:idx_inventory_product_stand;index"`
	FestivalID     uuid.UUID `json:"festivalId" gorm:"type:uuid;not null;index"`
	Quantity       int       `json:"quantity" gorm:"not null;default:0"`
	MinThreshold   int       `json:"minThreshold" gorm:"not null;default:10"` // Alert threshold
	MaxCapacity    *int      `json:"maxCapacity,omitempty"`                   // Maximum storage capacity
	LastRestockAt  *time.Time `json:"lastRestockAt,omitempty"`
	LastCountAt    *time.Time `json:"lastCountAt,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

func (InventoryItem) TableName() string {
	return "inventory_items"
}

// MovementType represents the type of stock movement
type MovementType string

const (
	MovementTypeIn         MovementType = "IN"         // Stock received
	MovementTypeOut        MovementType = "OUT"        // Stock sold/used
	MovementTypeAdjustment MovementType = "ADJUSTMENT" // Manual adjustment
	MovementTypeTransfer   MovementType = "TRANSFER"   // Transfer between stands
	MovementTypeLoss       MovementType = "LOSS"       // Lost/damaged stock
	MovementTypeReturn     MovementType = "RETURN"     // Customer return
)

// StockMovement represents a change in stock level
type StockMovement struct {
	ID              uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	InventoryItemID uuid.UUID    `json:"inventoryItemId" gorm:"type:uuid;not null;index"`
	ProductID       uuid.UUID    `json:"productId" gorm:"type:uuid;not null;index"`
	StandID         uuid.UUID    `json:"standId" gorm:"type:uuid;not null;index"`
	FestivalID      uuid.UUID    `json:"festivalId" gorm:"type:uuid;not null;index"`
	Type            MovementType `json:"type" gorm:"not null"`
	Quantity        int          `json:"quantity" gorm:"not null"` // Positive for IN, negative for OUT
	PreviousQty     int          `json:"previousQty" gorm:"not null"`
	NewQty          int          `json:"newQty" gorm:"not null"`
	Reason          string       `json:"reason,omitempty"`
	Reference       string       `json:"reference,omitempty"` // Order ID, transfer ID, etc.
	PerformedBy     uuid.UUID    `json:"performedBy" gorm:"type:uuid;not null"`
	PerformedByName string       `json:"performedByName" gorm:"not null"`
	CreatedAt       time.Time    `json:"createdAt"`
}

func (StockMovement) TableName() string {
	return "stock_movements"
}

// AlertType represents the type of stock alert
type AlertType string

const (
	AlertTypeLowStock  AlertType = "LOW_STOCK"  // Below minimum threshold
	AlertTypeOutOfStock AlertType = "OUT_OF_STOCK" // Zero stock
	AlertTypeOverStock  AlertType = "OVER_STOCK"  // Above maximum capacity
)

// AlertStatus represents the status of an alert
type AlertStatus string

const (
	AlertStatusActive      AlertStatus = "ACTIVE"
	AlertStatusAcknowledged AlertStatus = "ACKNOWLEDGED"
	AlertStatusResolved    AlertStatus = "RESOLVED"
)

// StockAlert represents an inventory alert
type StockAlert struct {
	ID              uuid.UUID   `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	InventoryItemID uuid.UUID   `json:"inventoryItemId" gorm:"type:uuid;not null;index"`
	ProductID       uuid.UUID   `json:"productId" gorm:"type:uuid;not null;index"`
	StandID         uuid.UUID   `json:"standId" gorm:"type:uuid;not null;index"`
	FestivalID      uuid.UUID   `json:"festivalId" gorm:"type:uuid;not null;index"`
	Type            AlertType   `json:"type" gorm:"not null"`
	Status          AlertStatus `json:"status" gorm:"default:'ACTIVE'"`
	CurrentQty      int         `json:"currentQty" gorm:"not null"`
	ThresholdQty    int         `json:"thresholdQty" gorm:"not null"`
	Message         string      `json:"message" gorm:"not null"`
	AcknowledgedBy  *uuid.UUID  `json:"acknowledgedBy,omitempty" gorm:"type:uuid"`
	AcknowledgedAt  *time.Time  `json:"acknowledgedAt,omitempty"`
	ResolvedAt      *time.Time  `json:"resolvedAt,omitempty"`
	CreatedAt       time.Time   `json:"createdAt"`
	UpdatedAt       time.Time   `json:"updatedAt"`
}

func (StockAlert) TableName() string {
	return "stock_alerts"
}

// CountStatus represents the status of an inventory count
type CountStatus string

const (
	CountStatusPending    CountStatus = "PENDING"
	CountStatusInProgress CountStatus = "IN_PROGRESS"
	CountStatusCompleted  CountStatus = "COMPLETED"
	CountStatusCancelled  CountStatus = "CANCELLED"
)

// InventoryCount represents a periodic inventory count session
type InventoryCount struct {
	ID          uuid.UUID   `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	StandID     uuid.UUID   `json:"standId" gorm:"type:uuid;not null;index"`
	FestivalID  uuid.UUID   `json:"festivalId" gorm:"type:uuid;not null;index"`
	Status      CountStatus `json:"status" gorm:"default:'PENDING'"`
	StartedAt   *time.Time  `json:"startedAt,omitempty"`
	CompletedAt *time.Time  `json:"completedAt,omitempty"`
	StartedBy   *uuid.UUID  `json:"startedBy,omitempty" gorm:"type:uuid"`
	CompletedBy *uuid.UUID  `json:"completedBy,omitempty" gorm:"type:uuid"`
	Notes       string      `json:"notes,omitempty"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
}

func (InventoryCount) TableName() string {
	return "inventory_counts"
}

// InventoryCountItem represents a single item in an inventory count
type InventoryCountItem struct {
	ID               uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CountID          uuid.UUID  `json:"countId" gorm:"type:uuid;not null;index"`
	InventoryItemID  uuid.UUID  `json:"inventoryItemId" gorm:"type:uuid;not null"`
	ProductID        uuid.UUID  `json:"productId" gorm:"type:uuid;not null"`
	ExpectedQty      int        `json:"expectedQty" gorm:"not null"` // System quantity
	CountedQty       *int       `json:"countedQty,omitempty"`        // Actual counted
	Variance         *int       `json:"variance,omitempty"`          // countedQty - expectedQty
	Notes            string     `json:"notes,omitempty"`
	CountedAt        *time.Time `json:"countedAt,omitempty"`
	CountedBy        *uuid.UUID `json:"countedBy,omitempty" gorm:"type:uuid"`
	ReconciliationID *uuid.UUID `json:"reconciliationId,omitempty" gorm:"type:uuid"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

func (InventoryCountItem) TableName() string {
	return "inventory_count_items"
}

// Request/Response DTOs

// CreateInventoryItemRequest represents the request to create an inventory item
type CreateInventoryItemRequest struct {
	ProductID    uuid.UUID `json:"productId" binding:"required"`
	StandID      uuid.UUID `json:"standId" binding:"required"`
	FestivalID   uuid.UUID `json:"festivalId" binding:"required"`
	Quantity     int       `json:"quantity" binding:"min=0"`
	MinThreshold int       `json:"minThreshold" binding:"min=0"`
	MaxCapacity  *int      `json:"maxCapacity,omitempty"`
}

// UpdateInventoryItemRequest represents the request to update an inventory item
type UpdateInventoryItemRequest struct {
	MinThreshold *int `json:"minThreshold,omitempty"`
	MaxCapacity  *int `json:"maxCapacity,omitempty"`
}

// AdjustStockRequest represents the request to adjust stock
type AdjustStockRequest struct {
	ProductID uuid.UUID    `json:"productId" binding:"required"`
	StandID   uuid.UUID    `json:"standId" binding:"required"`
	Delta     int          `json:"delta" binding:"required"`
	Type      MovementType `json:"type" binding:"required"`
	Reason    string       `json:"reason,omitempty"`
	Reference string       `json:"reference,omitempty"`
}

// RecordSaleRequest represents the request to record a sale
type RecordSaleRequest struct {
	ProductID uuid.UUID `json:"productId" binding:"required"`
	StandID   uuid.UUID `json:"standId" binding:"required"`
	Quantity  int       `json:"quantity" binding:"required,min=1"`
	OrderID   string    `json:"orderId,omitempty"`
}

// CreateCountRequest represents the request to create an inventory count
type CreateCountRequest struct {
	StandID    uuid.UUID `json:"standId" binding:"required"`
	FestivalID uuid.UUID `json:"festivalId" binding:"required"`
	Notes      string    `json:"notes,omitempty"`
}

// CountItemRequest represents a single item count
type CountItemRequest struct {
	InventoryItemID uuid.UUID `json:"inventoryItemId" binding:"required"`
	CountedQty      int       `json:"countedQty" binding:"min=0"`
	Notes           string    `json:"notes,omitempty"`
}

// ReconcileCountRequest represents the request to reconcile an inventory count
type ReconcileCountRequest struct {
	Items []CountItemRequest `json:"items" binding:"required,min=1"`
}

// InventoryItemResponse represents the API response for an inventory item
type InventoryItemResponse struct {
	ID            uuid.UUID  `json:"id"`
	ProductID     uuid.UUID  `json:"productId"`
	ProductName   string     `json:"productName,omitempty"`
	ProductSKU    string     `json:"productSku,omitempty"`
	StandID       uuid.UUID  `json:"standId"`
	StandName     string     `json:"standName,omitempty"`
	FestivalID    uuid.UUID  `json:"festivalId"`
	Quantity      int        `json:"quantity"`
	MinThreshold  int        `json:"minThreshold"`
	MaxCapacity   *int       `json:"maxCapacity,omitempty"`
	IsLowStock    bool       `json:"isLowStock"`
	IsOutOfStock  bool       `json:"isOutOfStock"`
	LastRestockAt *time.Time `json:"lastRestockAt,omitempty"`
	LastCountAt   *time.Time `json:"lastCountAt,omitempty"`
	CreatedAt     string     `json:"createdAt"`
	UpdatedAt     string     `json:"updatedAt"`
}

func (i *InventoryItem) ToResponse(productName, productSKU, standName string) InventoryItemResponse {
	return InventoryItemResponse{
		ID:            i.ID,
		ProductID:     i.ProductID,
		ProductName:   productName,
		ProductSKU:    productSKU,
		StandID:       i.StandID,
		StandName:     standName,
		FestivalID:    i.FestivalID,
		Quantity:      i.Quantity,
		MinThreshold:  i.MinThreshold,
		MaxCapacity:   i.MaxCapacity,
		IsLowStock:    i.Quantity > 0 && i.Quantity <= i.MinThreshold,
		IsOutOfStock:  i.Quantity == 0,
		LastRestockAt: i.LastRestockAt,
		LastCountAt:   i.LastCountAt,
		CreatedAt:     i.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     i.UpdatedAt.Format(time.RFC3339),
	}
}

// StockMovementResponse represents the API response for a stock movement
type StockMovementResponse struct {
	ID              uuid.UUID    `json:"id"`
	InventoryItemID uuid.UUID    `json:"inventoryItemId"`
	ProductID       uuid.UUID    `json:"productId"`
	ProductName     string       `json:"productName,omitempty"`
	StandID         uuid.UUID    `json:"standId"`
	StandName       string       `json:"standName,omitempty"`
	Type            MovementType `json:"type"`
	Quantity        int          `json:"quantity"`
	PreviousQty     int          `json:"previousQty"`
	NewQty          int          `json:"newQty"`
	Reason          string       `json:"reason,omitempty"`
	Reference       string       `json:"reference,omitempty"`
	PerformedBy     uuid.UUID    `json:"performedBy"`
	PerformedByName string       `json:"performedByName"`
	CreatedAt       string       `json:"createdAt"`
}

func (m *StockMovement) ToResponse(productName, standName string) StockMovementResponse {
	return StockMovementResponse{
		ID:              m.ID,
		InventoryItemID: m.InventoryItemID,
		ProductID:       m.ProductID,
		ProductName:     productName,
		StandID:         m.StandID,
		StandName:       standName,
		Type:            m.Type,
		Quantity:        m.Quantity,
		PreviousQty:     m.PreviousQty,
		NewQty:          m.NewQty,
		Reason:          m.Reason,
		Reference:       m.Reference,
		PerformedBy:     m.PerformedBy,
		PerformedByName: m.PerformedByName,
		CreatedAt:       m.CreatedAt.Format(time.RFC3339),
	}
}

// StockAlertResponse represents the API response for a stock alert
type StockAlertResponse struct {
	ID              uuid.UUID   `json:"id"`
	InventoryItemID uuid.UUID   `json:"inventoryItemId"`
	ProductID       uuid.UUID   `json:"productId"`
	ProductName     string      `json:"productName,omitempty"`
	StandID         uuid.UUID   `json:"standId"`
	StandName       string      `json:"standName,omitempty"`
	Type            AlertType   `json:"type"`
	Status          AlertStatus `json:"status"`
	CurrentQty      int         `json:"currentQty"`
	ThresholdQty    int         `json:"thresholdQty"`
	Message         string      `json:"message"`
	AcknowledgedBy  *uuid.UUID  `json:"acknowledgedBy,omitempty"`
	AcknowledgedAt  *time.Time  `json:"acknowledgedAt,omitempty"`
	ResolvedAt      *time.Time  `json:"resolvedAt,omitempty"`
	CreatedAt       string      `json:"createdAt"`
}

func (a *StockAlert) ToResponse(productName, standName string) StockAlertResponse {
	return StockAlertResponse{
		ID:              a.ID,
		InventoryItemID: a.InventoryItemID,
		ProductID:       a.ProductID,
		ProductName:     productName,
		StandID:         a.StandID,
		StandName:       standName,
		Type:            a.Type,
		Status:          a.Status,
		CurrentQty:      a.CurrentQty,
		ThresholdQty:    a.ThresholdQty,
		Message:         a.Message,
		AcknowledgedBy:  a.AcknowledgedBy,
		AcknowledgedAt:  a.AcknowledgedAt,
		ResolvedAt:      a.ResolvedAt,
		CreatedAt:       a.CreatedAt.Format(time.RFC3339),
	}
}

// InventoryCountResponse represents the API response for an inventory count
type InventoryCountResponse struct {
	ID          uuid.UUID            `json:"id"`
	StandID     uuid.UUID            `json:"standId"`
	StandName   string               `json:"standName,omitempty"`
	FestivalID  uuid.UUID            `json:"festivalId"`
	Status      CountStatus          `json:"status"`
	StartedAt   *time.Time           `json:"startedAt,omitempty"`
	CompletedAt *time.Time           `json:"completedAt,omitempty"`
	Notes       string               `json:"notes,omitempty"`
	ItemCount   int                  `json:"itemCount"`
	CountedCount int                 `json:"countedCount"`
	VarianceCount int                `json:"varianceCount"`
	CreatedAt   string               `json:"createdAt"`
}

func (c *InventoryCount) ToResponse(standName string, itemCount, countedCount, varianceCount int) InventoryCountResponse {
	return InventoryCountResponse{
		ID:            c.ID,
		StandID:       c.StandID,
		StandName:     standName,
		FestivalID:    c.FestivalID,
		Status:        c.Status,
		StartedAt:     c.StartedAt,
		CompletedAt:   c.CompletedAt,
		Notes:         c.Notes,
		ItemCount:     itemCount,
		CountedCount:  countedCount,
		VarianceCount: varianceCount,
		CreatedAt:     c.CreatedAt.Format(time.RFC3339),
	}
}

// InventoryCountItemResponse represents the API response for a count item
type InventoryCountItemResponse struct {
	ID              uuid.UUID  `json:"id"`
	CountID         uuid.UUID  `json:"countId"`
	InventoryItemID uuid.UUID  `json:"inventoryItemId"`
	ProductID       uuid.UUID  `json:"productId"`
	ProductName     string     `json:"productName,omitempty"`
	ProductSKU      string     `json:"productSku,omitempty"`
	ExpectedQty     int        `json:"expectedQty"`
	CountedQty      *int       `json:"countedQty,omitempty"`
	Variance        *int       `json:"variance,omitempty"`
	Notes           string     `json:"notes,omitempty"`
	CountedAt       *time.Time `json:"countedAt,omitempty"`
	CreatedAt       string     `json:"createdAt"`
}

func (ci *InventoryCountItem) ToResponse(productName, productSKU string) InventoryCountItemResponse {
	return InventoryCountItemResponse{
		ID:              ci.ID,
		CountID:         ci.CountID,
		InventoryItemID: ci.InventoryItemID,
		ProductID:       ci.ProductID,
		ProductName:     productName,
		ProductSKU:      productSKU,
		ExpectedQty:     ci.ExpectedQty,
		CountedQty:      ci.CountedQty,
		Variance:        ci.Variance,
		Notes:           ci.Notes,
		CountedAt:       ci.CountedAt,
		CreatedAt:       ci.CreatedAt.Format(time.RFC3339),
	}
}

// StockSummary represents a summary of stock for a stand or festival
type StockSummary struct {
	TotalItems      int `json:"totalItems"`
	TotalQuantity   int `json:"totalQuantity"`
	LowStockCount   int `json:"lowStockCount"`
	OutOfStockCount int `json:"outOfStockCount"`
	ActiveAlerts    int `json:"activeAlerts"`
}
