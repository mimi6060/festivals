package order

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Order represents a purchase order at a stand
type Order struct {
	ID            uuid.UUID   `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID    uuid.UUID   `json:"festivalId" gorm:"type:uuid;not null;index"`
	UserID        uuid.UUID   `json:"userId" gorm:"type:uuid;not null;index"`
	WalletID      uuid.UUID   `json:"walletId" gorm:"type:uuid;not null;index"`
	StandID       uuid.UUID   `json:"standId" gorm:"type:uuid;not null;index"`
	Items         OrderItems  `json:"items" gorm:"type:jsonb;not null"`
	TotalAmount   int64       `json:"totalAmount" gorm:"not null"` // Total amount in cents
	Status        OrderStatus `json:"status" gorm:"default:'PENDING'"`
	PaymentMethod string      `json:"paymentMethod" gorm:"not null"` // wallet, cash, card
	TransactionID *uuid.UUID  `json:"transactionId,omitempty" gorm:"type:uuid"` // Linked wallet transaction
	StaffID       *uuid.UUID  `json:"staffId,omitempty" gorm:"type:uuid"` // Staff who processed the order
	Notes         string      `json:"notes,omitempty"`
	CreatedAt     time.Time   `json:"createdAt"`
	UpdatedAt     time.Time   `json:"updatedAt"`
}

func (Order) TableName() string {
	return "orders"
}

// OrderItem represents an item in an order
type OrderItem struct {
	ProductID   uuid.UUID `json:"productId"`
	ProductName string    `json:"productName"`
	Quantity    int       `json:"quantity"`
	UnitPrice   int64     `json:"unitPrice"`   // Price per unit in cents
	TotalPrice  int64     `json:"totalPrice"`  // Total price for this item (quantity * unitPrice)
}

// OrderItems is a slice of OrderItem that implements GORM's Scanner and Valuer interfaces
type OrderItems []OrderItem

func (oi OrderItems) Value() (driver.Value, error) {
	if oi == nil {
		return "[]", nil
	}
	return json.Marshal(oi)
}

func (oi *OrderItems) Scan(value interface{}) error {
	if value == nil {
		*oi = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to scan OrderItems: expected []byte, got %T", value)
	}

	return json.Unmarshal(bytes, oi)
}

// OrderStatus represents the status of an order
type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "PENDING"
	OrderStatusPaid      OrderStatus = "PAID"
	OrderStatusCancelled OrderStatus = "CANCELLED"
	OrderStatusRefunded  OrderStatus = "REFUNDED"
)

// PaymentMethod constants
const (
	PaymentMethodWallet = "wallet"
	PaymentMethodCash   = "cash"
	PaymentMethodCard   = "card"
)

// CreateOrderRequest represents the request to create an order
type CreateOrderRequest struct {
	StandID       uuid.UUID          `json:"standId" binding:"required"`
	Items         []OrderItemRequest `json:"items" binding:"required,min=1"`
	PaymentMethod string             `json:"paymentMethod" binding:"required,oneof=wallet cash card"`
	Notes         string             `json:"notes,omitempty"`
}

// OrderItemRequest represents an item in a create order request
type OrderItemRequest struct {
	ProductID uuid.UUID `json:"productId" binding:"required"`
	Quantity  int       `json:"quantity" binding:"required,min=1"`
}

// ProcessPaymentRequest represents the request to process payment for an order
type ProcessPaymentRequest struct {
	OrderID       uuid.UUID `json:"orderId" binding:"required"`
	PaymentMethod string    `json:"paymentMethod" binding:"required,oneof=wallet cash card"`
	WalletID      uuid.UUID `json:"walletId,omitempty"` // Required if payment method is wallet
}

// CancelOrderRequest represents the request to cancel an order
type CancelOrderRequest struct {
	Reason string `json:"reason,omitempty"`
}

// RefundOrderRequest represents the request to refund an order
type RefundOrderRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// OrderListRequest represents query parameters for listing orders
type OrderListRequest struct {
	Page       int         `form:"page" binding:"min=1"`
	PerPage    int         `form:"per_page" binding:"min=1,max=100"`
	Status     OrderStatus `form:"status,omitempty"`
	StandID    uuid.UUID   `form:"stand_id,omitempty"`
	StartDate  *time.Time  `form:"start_date,omitempty"`
	EndDate    *time.Time  `form:"end_date,omitempty"`
}

// OrderResponse represents the API response for an order
type OrderResponse struct {
	ID              uuid.UUID           `json:"id"`
	FestivalID      uuid.UUID           `json:"festivalId"`
	UserID          uuid.UUID           `json:"userId"`
	WalletID        uuid.UUID           `json:"walletId"`
	StandID         uuid.UUID           `json:"standId"`
	Items           []OrderItemResponse `json:"items"`
	TotalAmount     int64               `json:"totalAmount"`
	TotalDisplay    string              `json:"totalDisplay"`
	Status          OrderStatus         `json:"status"`
	PaymentMethod   string              `json:"paymentMethod"`
	TransactionID   *uuid.UUID          `json:"transactionId,omitempty"`
	StaffID         *uuid.UUID          `json:"staffId,omitempty"`
	Notes           string              `json:"notes,omitempty"`
	CreatedAt       string              `json:"createdAt"`
	UpdatedAt       string              `json:"updatedAt"`
}

// OrderItemResponse represents an item in an order response
type OrderItemResponse struct {
	ProductID    uuid.UUID `json:"productId"`
	ProductName  string    `json:"productName"`
	Quantity     int       `json:"quantity"`
	UnitPrice    int64     `json:"unitPrice"`
	UnitDisplay  string    `json:"unitDisplay"`
	TotalPrice   int64     `json:"totalPrice"`
	TotalDisplay string    `json:"totalDisplay"`
}

func (o *Order) ToResponse(exchangeRate float64, currencyName string) OrderResponse {
	items := make([]OrderItemResponse, len(o.Items))
	for i, item := range o.Items {
		items[i] = OrderItemResponse{
			ProductID:    item.ProductID,
			ProductName:  item.ProductName,
			Quantity:     item.Quantity,
			UnitPrice:    item.UnitPrice,
			UnitDisplay:  formatPrice(float64(item.UnitPrice)*exchangeRate, currencyName),
			TotalPrice:   item.TotalPrice,
			TotalDisplay: formatPrice(float64(item.TotalPrice)*exchangeRate, currencyName),
		}
	}

	return OrderResponse{
		ID:            o.ID,
		FestivalID:    o.FestivalID,
		UserID:        o.UserID,
		WalletID:      o.WalletID,
		StandID:       o.StandID,
		Items:         items,
		TotalAmount:   o.TotalAmount,
		TotalDisplay:  formatPrice(float64(o.TotalAmount)*exchangeRate, currencyName),
		Status:        o.Status,
		PaymentMethod: o.PaymentMethod,
		TransactionID: o.TransactionID,
		StaffID:       o.StaffID,
		Notes:         o.Notes,
		CreatedAt:     o.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     o.UpdatedAt.Format(time.RFC3339),
	}
}

// OrderStandStats represents aggregated order statistics for a stand
type OrderStandStats struct {
	StandID       uuid.UUID `json:"standId"`
	TotalOrders   int64     `json:"totalOrders"`
	TotalRevenue  int64     `json:"totalRevenue"`
	AverageOrder  int64     `json:"averageOrder"`
	PaidOrders    int64     `json:"paidOrders"`
	CancelledOrders int64   `json:"cancelledOrders"`
	RefundedOrders  int64   `json:"refundedOrders"`
}

func formatPrice(tokens float64, currencyName string) string {
	if tokens == float64(int64(tokens)) {
		return fmt.Sprintf("%.0f %s", tokens, currencyName)
	}
	return fmt.Sprintf("%.2f %s", tokens, currencyName)
}
