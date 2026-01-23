package webhook

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// EventType represents the type of webhook event
type EventType string

const (
	// Order events
	EventOrderCreated  EventType = "order.created"
	EventOrderPaid     EventType = "order.paid"
	EventOrderRefunded EventType = "order.refunded"

	// Wallet events
	EventWalletTopUp   EventType = "wallet.topup"
	EventWalletPayment EventType = "wallet.payment"

	// Ticket events
	EventTicketScanned     EventType = "ticket.scanned"
	EventTicketTransferred EventType = "ticket.transferred"

	// Inventory events
	EventInventoryLowStock EventType = "inventory.low_stock"
)

// AllEventTypes returns all available webhook event types
func AllEventTypes() []EventType {
	return []EventType{
		EventOrderCreated,
		EventOrderPaid,
		EventOrderRefunded,
		EventWalletTopUp,
		EventWalletPayment,
		EventTicketScanned,
		EventTicketTransferred,
		EventInventoryLowStock,
	}
}

// IsValid checks if the event type is valid
func (e EventType) IsValid() bool {
	for _, t := range AllEventTypes() {
		if t == e {
			return true
		}
	}
	return false
}

// String returns the string representation of the event type
func (e EventType) String() string {
	return string(e)
}

// Category returns the category of the event (order, wallet, ticket, inventory)
func (e EventType) Category() string {
	switch e {
	case EventOrderCreated, EventOrderPaid, EventOrderRefunded:
		return "order"
	case EventWalletTopUp, EventWalletPayment:
		return "wallet"
	case EventTicketScanned, EventTicketTransferred:
		return "ticket"
	case EventInventoryLowStock:
		return "inventory"
	default:
		return "unknown"
	}
}

// Event represents a webhook event to be delivered
type Event struct {
	ID         uuid.UUID   `json:"id"`
	Type       EventType   `json:"type"`
	FestivalID uuid.UUID   `json:"festivalId"`
	Timestamp  time.Time   `json:"timestamp"`
	Data       interface{} `json:"data"`
}

// NewEvent creates a new webhook event
func NewEvent(eventType EventType, festivalID uuid.UUID, data interface{}) *Event {
	return &Event{
		ID:         uuid.New(),
		Type:       eventType,
		FestivalID: festivalID,
		Timestamp:  time.Now().UTC(),
		Data:       data,
	}
}

// ToJSON converts the event to JSON bytes
func (e *Event) ToJSON() ([]byte, error) {
	return json.Marshal(e)
}

// EventPayload represents the standard webhook payload structure
type EventPayload struct {
	ID         string      `json:"id"`
	Type       string      `json:"type"`
	FestivalID string      `json:"festival_id"`
	Timestamp  string      `json:"timestamp"`
	APIVersion string      `json:"api_version"`
	Data       interface{} `json:"data"`
}

// ToPayload converts an Event to the standard EventPayload format
func (e *Event) ToPayload(apiVersion string) *EventPayload {
	return &EventPayload{
		ID:         e.ID.String(),
		Type:       string(e.Type),
		FestivalID: e.FestivalID.String(),
		Timestamp:  e.Timestamp.Format(time.RFC3339),
		APIVersion: apiVersion,
		Data:       e.Data,
	}
}

// ============================================================================
// Event Data Structures
// ============================================================================

// OrderCreatedData contains data for order.created events
type OrderCreatedData struct {
	OrderID       string    `json:"order_id"`
	UserID        string    `json:"user_id"`
	TotalAmount   int64     `json:"total_amount"`
	Currency      string    `json:"currency"`
	Items         []OrderItem `json:"items"`
	CreatedAt     string    `json:"created_at"`
}

// OrderItem represents an item in an order
type OrderItem struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	Quantity    int    `json:"quantity"`
	UnitPrice   int64  `json:"unit_price"`
	TotalPrice  int64  `json:"total_price"`
}

// OrderPaidData contains data for order.paid events
type OrderPaidData struct {
	OrderID       string `json:"order_id"`
	UserID        string `json:"user_id"`
	TotalAmount   int64  `json:"total_amount"`
	Currency      string `json:"currency"`
	PaymentMethod string `json:"payment_method"`
	PaymentRef    string `json:"payment_reference"`
	PaidAt        string `json:"paid_at"`
}

// OrderRefundedData contains data for order.refunded events
type OrderRefundedData struct {
	OrderID       string `json:"order_id"`
	UserID        string `json:"user_id"`
	RefundID      string `json:"refund_id"`
	RefundAmount  int64  `json:"refund_amount"`
	Currency      string `json:"currency"`
	Reason        string `json:"reason"`
	RefundedAt    string `json:"refunded_at"`
}

// WalletTopUpData contains data for wallet.topup events
type WalletTopUpData struct {
	WalletID      string `json:"wallet_id"`
	UserID        string `json:"user_id"`
	Amount        int64  `json:"amount"`
	Currency      string `json:"currency"`
	NewBalance    int64  `json:"new_balance"`
	PaymentMethod string `json:"payment_method"`
	TransactionID string `json:"transaction_id"`
	ToppedUpAt    string `json:"topped_up_at"`
}

// WalletPaymentData contains data for wallet.payment events
type WalletPaymentData struct {
	WalletID      string `json:"wallet_id"`
	UserID        string `json:"user_id"`
	Amount        int64  `json:"amount"`
	Currency      string `json:"currency"`
	NewBalance    int64  `json:"new_balance"`
	StandID       string `json:"stand_id"`
	StandName     string `json:"stand_name"`
	TransactionID string `json:"transaction_id"`
	PaidAt        string `json:"paid_at"`
}

// TicketScannedData contains data for ticket.scanned events
type TicketScannedData struct {
	TicketID     string `json:"ticket_id"`
	TicketCode   string `json:"ticket_code"`
	TicketType   string `json:"ticket_type"`
	UserID       string `json:"user_id"`
	HolderName   string `json:"holder_name"`
	ScanType     string `json:"scan_type"` // ENTRY, EXIT, CHECK
	ScanResult   string `json:"scan_result"` // SUCCESS, FAILED, ALREADY_USED, EXPIRED
	Location     string `json:"location"`
	ScannedBy    string `json:"scanned_by"`
	ScannedAt    string `json:"scanned_at"`
}

// TicketTransferredData contains data for ticket.transferred events
type TicketTransferredData struct {
	TicketID       string `json:"ticket_id"`
	TicketCode     string `json:"ticket_code"`
	TicketType     string `json:"ticket_type"`
	FromUserID     string `json:"from_user_id"`
	FromUserEmail  string `json:"from_user_email"`
	ToUserID       string `json:"to_user_id,omitempty"`
	ToUserEmail    string `json:"to_user_email"`
	ToUserName     string `json:"to_user_name"`
	TransferCount  int    `json:"transfer_count"`
	TransferredAt  string `json:"transferred_at"`
}

// InventoryLowStockData contains data for inventory.low_stock events
type InventoryLowStockData struct {
	ProductID      string `json:"product_id"`
	ProductName    string `json:"product_name"`
	ProductSKU     string `json:"product_sku"`
	StandID        string `json:"stand_id"`
	StandName      string `json:"stand_name"`
	CurrentStock   int    `json:"current_stock"`
	MinThreshold   int    `json:"min_threshold"`
	AlertType      string `json:"alert_type"` // LOW_STOCK, OUT_OF_STOCK
	AlertedAt      string `json:"alerted_at"`
}
