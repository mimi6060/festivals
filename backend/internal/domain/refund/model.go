package refund

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// RefundStatus represents the status of a refund request
type RefundStatus string

const (
	RefundStatusPending    RefundStatus = "PENDING"
	RefundStatusApproved   RefundStatus = "APPROVED"
	RefundStatusProcessing RefundStatus = "PROCESSING"
	RefundStatusCompleted  RefundStatus = "COMPLETED"
	RefundStatusRejected   RefundStatus = "REJECTED"
)

// RefundPolicy represents the refund policy for a festival
type RefundPolicy string

const (
	RefundPolicyAuto   RefundPolicy = "AUTO"   // Automatically process refunds
	RefundPolicyManual RefundPolicy = "MANUAL" // Require admin approval
	RefundPolicyNone   RefundPolicy = "NONE"   // No refunds allowed
)

// BankDetails holds the bank account information for refund transfers
type BankDetails struct {
	IBAN          string `json:"iban" gorm:"column:iban"`
	BIC           string `json:"bic" gorm:"column:bic"`
	AccountHolder string `json:"accountHolder" gorm:"column:account_holder"`
}

// RefundRequest represents a user's request for a refund of their wallet balance
type RefundRequest struct {
	ID            uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	WalletID      uuid.UUID    `json:"walletId" gorm:"type:uuid;not null;index"`
	UserID        uuid.UUID    `json:"userId" gorm:"type:uuid;not null;index"`
	FestivalID    uuid.UUID    `json:"festivalId" gorm:"type:uuid;not null;index"`
	Amount        int64        `json:"amount" gorm:"not null"`                    // Amount in cents to be refunded
	NetAmount     int64        `json:"netAmount" gorm:"not null"`                 // Amount after fees deduction
	Fee           int64        `json:"fee" gorm:"default:0"`                      // Fee amount in cents
	Reason        string       `json:"reason" gorm:"type:text"`                   // User's reason for refund
	BankDetails   BankDetails  `json:"bankDetails" gorm:"embedded"`               // Bank account details
	Status        RefundStatus `json:"status" gorm:"default:'PENDING';not null"`  // Current status
	PaymentMethod string       `json:"paymentMethod" gorm:"default:'bank_transfer'"` // stripe, bank_transfer
	StripeRefundID string      `json:"stripeRefundId,omitempty" gorm:"column:stripe_refund_id"` // Stripe refund ID if applicable
	ProcessedBy   *uuid.UUID   `json:"processedBy,omitempty" gorm:"type:uuid"`    // Admin who processed the refund
	ProcessedAt   *time.Time   `json:"processedAt,omitempty"`                     // When the refund was processed
	RejectionNote string       `json:"rejectionNote,omitempty" gorm:"type:text"`  // Reason for rejection
	CreatedAt     time.Time    `json:"createdAt"`
	UpdatedAt     time.Time    `json:"updatedAt"`
}

func (RefundRequest) TableName() string {
	return "refund_requests"
}

// CreateRefundInput represents the input for creating a refund request
type CreateRefundInput struct {
	WalletID    uuid.UUID   `json:"walletId" binding:"required"`
	Amount      int64       `json:"amount" binding:"required,min=1"`
	Reason      string      `json:"reason"`
	BankDetails BankDetails `json:"bankDetails" binding:"required"`
}

// ApproveRefundInput represents the input for approving a refund
type ApproveRefundInput struct {
	Note string `json:"note"`
}

// RejectRefundInput represents the input for rejecting a refund
type RejectRefundInput struct {
	Reason string `json:"reason" binding:"required"`
}

// ProcessRefundInput represents the input for processing a refund
type ProcessRefundInput struct {
	PaymentMethod  string `json:"paymentMethod" binding:"required,oneof=stripe bank_transfer"`
	StripeRefundID string `json:"stripeRefundId,omitempty"`
}

// RefundResponse represents the API response for a refund request
type RefundResponse struct {
	ID            uuid.UUID    `json:"id"`
	WalletID      uuid.UUID    `json:"walletId"`
	UserID        uuid.UUID    `json:"userId"`
	FestivalID    uuid.UUID    `json:"festivalId"`
	Amount        int64        `json:"amount"`
	AmountDisplay string       `json:"amountDisplay"`
	NetAmount     int64        `json:"netAmount"`
	NetDisplay    string       `json:"netDisplay"`
	Fee           int64        `json:"fee"`
	FeeDisplay    string       `json:"feeDisplay"`
	Reason        string       `json:"reason"`
	BankDetails   BankDetails  `json:"bankDetails"`
	Status        RefundStatus `json:"status"`
	PaymentMethod string       `json:"paymentMethod"`
	ProcessedBy   *uuid.UUID   `json:"processedBy,omitempty"`
	ProcessedAt   *string      `json:"processedAt,omitempty"`
	RejectionNote string       `json:"rejectionNote,omitempty"`
	CreatedAt     string       `json:"createdAt"`
	UpdatedAt     string       `json:"updatedAt"`
}

// ToResponse converts a RefundRequest to a RefundResponse
func (r *RefundRequest) ToResponse() RefundResponse {
	resp := RefundResponse{
		ID:            r.ID,
		WalletID:      r.WalletID,
		UserID:        r.UserID,
		FestivalID:    r.FestivalID,
		Amount:        r.Amount,
		AmountDisplay: formatCents(r.Amount),
		NetAmount:     r.NetAmount,
		NetDisplay:    formatCents(r.NetAmount),
		Fee:           r.Fee,
		FeeDisplay:    formatCents(r.Fee),
		Reason:        r.Reason,
		BankDetails:   r.BankDetails,
		Status:        r.Status,
		PaymentMethod: r.PaymentMethod,
		ProcessedBy:   r.ProcessedBy,
		RejectionNote: r.RejectionNote,
		CreatedAt:     r.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     r.UpdatedAt.Format(time.RFC3339),
	}

	if r.ProcessedAt != nil {
		formatted := r.ProcessedAt.Format(time.RFC3339)
		resp.ProcessedAt = &formatted
	}

	return resp
}

// formatCents formats an amount in cents to a display string
func formatCents(cents int64) string {
	euros := float64(cents) / 100
	if euros == float64(int64(euros)) {
		return formatFloat(euros, 0) + " EUR"
	}
	return formatFloat(euros, 2) + " EUR"
}

func formatFloat(val float64, decimals int) string {
	if decimals == 0 {
		return fmt.Sprintf("%.0f", val)
	}
	return fmt.Sprintf("%.2f", val)
}

// FestivalRefundConfig holds refund configuration for a festival
type FestivalRefundConfig struct {
	Policy        RefundPolicy `json:"policy"`
	FeePercentage float64      `json:"feePercentage"` // Fee percentage (0-100)
	MinAmount     int64        `json:"minAmount"`     // Minimum refund amount in cents
	MaxAmount     int64        `json:"maxAmount"`     // Maximum refund amount in cents (0 = no limit)
}

// DefaultRefundConfig returns the default refund configuration
func DefaultRefundConfig() FestivalRefundConfig {
	return FestivalRefundConfig{
		Policy:        RefundPolicyManual,
		FeePercentage: 0,
		MinAmount:     100, // 1 EUR minimum
		MaxAmount:     0,   // No maximum
	}
}
