package wallet

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Wallet represents a user's wallet for a specific festival
type Wallet struct {
	ID         uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID     uuid.UUID    `json:"userId" gorm:"type:uuid;not null;index"`
	FestivalID uuid.UUID    `json:"festivalId" gorm:"type:uuid;not null;index"`
	Balance    int64        `json:"balance" gorm:"default:0"` // Balance in cents (smallest currency unit)
	Status     WalletStatus `json:"status" gorm:"default:'ACTIVE'"`
	CreatedAt  time.Time    `json:"createdAt"`
	UpdatedAt  time.Time    `json:"updatedAt"`
}

func (Wallet) TableName() string {
	return "wallets"
}

type WalletStatus string

const (
	WalletStatusActive   WalletStatus = "ACTIVE"
	WalletStatusFrozen   WalletStatus = "FROZEN"
	WalletStatusClosed   WalletStatus = "CLOSED"
)

// Transaction represents a wallet transaction
type Transaction struct {
	ID            uuid.UUID         `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	WalletID      uuid.UUID         `json:"walletId" gorm:"type:uuid;not null;index"`
	Type          TransactionType   `json:"type" gorm:"not null"`
	Amount        int64             `json:"amount" gorm:"not null"` // Amount in cents (positive for credit, negative for debit)
	BalanceBefore int64             `json:"balanceBefore" gorm:"not null"`
	BalanceAfter  int64             `json:"balanceAfter" gorm:"not null"`
	Reference     string            `json:"reference,omitempty"`     // External reference (Stripe payment ID, etc.)
	StandID       *uuid.UUID        `json:"standId,omitempty" gorm:"type:uuid"`
	StaffID       *uuid.UUID        `json:"staffId,omitempty" gorm:"type:uuid"` // Staff who processed the transaction
	Metadata      TransactionMeta   `json:"metadata" gorm:"type:jsonb;default:'{}'"`
	Status        TransactionStatus `json:"status" gorm:"default:'COMPLETED'"`
	CreatedAt     time.Time         `json:"createdAt"`
}

func (Transaction) TableName() string {
	return "transactions"
}

type TransactionType string

const (
	TransactionTypeTopUp    TransactionType = "TOP_UP"    // Online top-up
	TransactionTypeCashIn   TransactionType = "CASH_IN"   // Cash top-up at booth
	TransactionTypePurchase TransactionType = "PURCHASE"  // Payment at stand
	TransactionTypeRefund   TransactionType = "REFUND"    // Refund from stand/admin
	TransactionTypeTransfer TransactionType = "TRANSFER"  // P2P transfer
	TransactionTypeCashOut  TransactionType = "CASH_OUT"  // Withdrawal/refund at end
)

type TransactionStatus string

const (
	TransactionStatusPending   TransactionStatus = "PENDING"
	TransactionStatusCompleted TransactionStatus = "COMPLETED"
	TransactionStatusFailed    TransactionStatus = "FAILED"
	TransactionStatusRefunded  TransactionStatus = "REFUNDED"
)

type TransactionMeta struct {
	Description   string   `json:"description,omitempty"`
	ProductIDs    []string `json:"productIds,omitempty"`
	PaymentMethod string   `json:"paymentMethod,omitempty"` // card, cash, transfer
	DeviceID      string   `json:"deviceId,omitempty"`
	Location      string   `json:"location,omitempty"`
}

// TopUpRequest represents a request to top up a wallet
type TopUpRequest struct {
	Amount        int64  `json:"amount" binding:"required,min=100"` // Minimum 1€ = 100 cents
	PaymentMethod string `json:"paymentMethod" binding:"required,oneof=card cash"`
	Reference     string `json:"reference,omitempty"`
}

// PaymentRequest represents a payment request from a stand
type PaymentRequest struct {
	WalletID   uuid.UUID `json:"walletId" binding:"required"`
	Amount     int64     `json:"amount" binding:"required,min=1"`
	StandID    uuid.UUID `json:"standId" binding:"required"`
	ProductIDs []string  `json:"productIds,omitempty"`
}

// RefundRequest represents a refund request
type RefundRequest struct {
	TransactionID uuid.UUID `json:"transactionId" binding:"required"`
	Reason        string    `json:"reason"`
}

// WalletResponse represents the API response for a wallet
type WalletResponse struct {
	ID              uuid.UUID    `json:"id"`
	UserID          uuid.UUID    `json:"userId"`
	FestivalID      uuid.UUID    `json:"festivalId"`
	Balance         int64        `json:"balance"`
	BalanceDisplay  string       `json:"balanceDisplay"` // Formatted balance for display
	Status          WalletStatus `json:"status"`
	CreatedAt       string       `json:"createdAt"`
	UpdatedAt       string       `json:"updatedAt"`
}

func (w *Wallet) ToResponse(exchangeRate float64, currencyName string) WalletResponse {
	// Convert cents to tokens using exchange rate
	tokens := float64(w.Balance) * exchangeRate
	balanceDisplay := formatTokens(tokens, currencyName)

	return WalletResponse{
		ID:             w.ID,
		UserID:         w.UserID,
		FestivalID:     w.FestivalID,
		Balance:        w.Balance,
		BalanceDisplay: balanceDisplay,
		Status:         w.Status,
		CreatedAt:      w.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      w.UpdatedAt.Format(time.RFC3339),
	}
}

// TransactionResponse represents the API response for a transaction
type TransactionResponse struct {
	ID            uuid.UUID         `json:"id"`
	WalletID      uuid.UUID         `json:"walletId"`
	Type          TransactionType   `json:"type"`
	Amount        int64             `json:"amount"`
	AmountDisplay string            `json:"amountDisplay"`
	BalanceBefore int64             `json:"balanceBefore"`
	BalanceAfter  int64             `json:"balanceAfter"`
	Reference     string            `json:"reference,omitempty"`
	StandID       *uuid.UUID        `json:"standId,omitempty"`
	StaffID       *uuid.UUID        `json:"staffId,omitempty"`
	Metadata      TransactionMeta   `json:"metadata"`
	Status        TransactionStatus `json:"status"`
	CreatedAt     string            `json:"createdAt"`
}

func (t *Transaction) ToResponse(exchangeRate float64, currencyName string) TransactionResponse {
	tokens := float64(t.Amount) * exchangeRate
	amountDisplay := formatTokens(tokens, currencyName)

	return TransactionResponse{
		ID:            t.ID,
		WalletID:      t.WalletID,
		Type:          t.Type,
		Amount:        t.Amount,
		AmountDisplay: amountDisplay,
		BalanceBefore: t.BalanceBefore,
		BalanceAfter:  t.BalanceAfter,
		Reference:     t.Reference,
		StandID:       t.StandID,
		StaffID:       t.StaffID,
		Metadata:      t.Metadata,
		Status:        t.Status,
		CreatedAt:     t.CreatedAt.Format(time.RFC3339),
	}
}

func formatTokens(tokens float64, currencyName string) string {
	if tokens == float64(int64(tokens)) {
		return fmt.Sprintf("%.0f %s", tokens, currencyName)
	}
	return fmt.Sprintf("%.2f %s", tokens, currencyName)
}
