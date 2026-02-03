package payment

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/payment"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// StripeService provides higher-level Stripe operations combining
// the infrastructure layer (StripeClient) with domain logic
type StripeService struct {
	db           *gorm.DB
	stripeClient *payment.StripeClient
	baseURL      string
}

// NewStripeService creates a new Stripe service
func NewStripeService(db *gorm.DB, stripeClient *payment.StripeClient, baseURL string) *StripeService {
	return &StripeService{
		db:           db,
		stripeClient: stripeClient,
		baseURL:      baseURL,
	}
}

// RefundPaymentIntent processes a refund for a payment intent
func (s *StripeService) RefundPaymentIntent(ctx context.Context, paymentIntentID uuid.UUID, amount int64, reason string) (*Refund, error) {
	// Get the local payment intent
	var pi PaymentIntent
	if err := s.db.WithContext(ctx).Where("id = ?", paymentIntentID).First(&pi).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get payment intent: %w", err)
	}

	// Validate status
	if pi.Status != PaymentIntentStatusSucceeded {
		return nil, errors.New("INVALID_STATUS", "Can only refund succeeded payments")
	}

	// Determine refund amount
	refundAmount := amount
	if refundAmount == 0 || refundAmount > pi.Amount {
		refundAmount = pi.Amount
	}

	// Create Stripe refund
	result, err := s.stripeClient.CreateRefund(ctx, payment.CreateRefundParams{
		PaymentIntentID: pi.StripeIntentID,
		Amount:          refundAmount,
		Reason:          reason,
		Metadata: map[string]string{
			"local_payment_intent_id": paymentIntentID.String(),
			"festival_id":             pi.FestivalID.String(),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create refund: %w", err)
	}

	// Create local refund record
	refund := &Refund{
		ID:              uuid.New(),
		PaymentIntentID: paymentIntentID,
		StripeRefundID:  result.RefundID,
		Amount:          result.Amount,
		Currency:        result.Currency,
		Status:          RefundStatus(result.Status),
		Reason:          reason,
		CreatedAt:       time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(refund).Error; err != nil {
		log.Error().Err(err).Msg("Failed to save refund record locally")
		// Don't fail the operation - the Stripe refund was successful
	}

	// Update payment intent status if fully refunded
	if refundAmount == pi.Amount {
		pi.Status = PaymentIntentStatusCanceled // or add a REFUNDED status
		pi.UpdatedAt = time.Now()
		if err := s.db.WithContext(ctx).Save(&pi).Error; err != nil {
			log.Error().Err(err).Msg("Failed to update payment intent status")
		}
	}

	log.Info().
		Str("payment_intent_id", paymentIntentID.String()).
		Str("refund_id", result.RefundID).
		Int64("amount", refundAmount).
		Msg("Payment refunded successfully")

	return refund, nil
}

// GetOrCreateStripeCustomer gets or creates a Stripe customer for a user
func (s *StripeService) GetOrCreateStripeCustomer(ctx context.Context, userID uuid.UUID, email, name string) (*StripeCustomer, error) {
	// Check if customer already exists
	var existing StripeCustomer
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&existing).Error; err == nil {
		return &existing, nil
	}

	// Create new Stripe customer
	result, err := s.stripeClient.CreateCustomer(ctx, payment.CreateCustomerParams{
		Email:  email,
		Name:   name,
		UserID: userID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Stripe customer: %w", err)
	}

	// Save locally
	customer := &StripeCustomer{
		ID:               uuid.New(),
		UserID:           userID,
		StripeCustomerID: result.CustomerID,
		Email:            result.Email,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(customer).Error; err != nil {
		return nil, fmt.Errorf("failed to save customer: %w", err)
	}

	return customer, nil
}

// CancelPaymentIntent cancels a pending payment intent
func (s *StripeService) CancelPaymentIntent(ctx context.Context, paymentIntentID uuid.UUID) error {
	// Get the local payment intent
	var pi PaymentIntent
	if err := s.db.WithContext(ctx).Where("id = ?", paymentIntentID).First(&pi).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.ErrNotFound
		}
		return fmt.Errorf("failed to get payment intent: %w", err)
	}

	// Validate status
	if pi.Status != PaymentIntentStatusPending && pi.Status != PaymentIntentStatusRequiresAction {
		return errors.New("INVALID_STATUS", "Can only cancel pending or requires_action payments")
	}

	// Cancel in Stripe
	if err := s.stripeClient.CancelPaymentIntent(ctx, pi.StripeIntentID); err != nil {
		return fmt.Errorf("failed to cancel payment intent: %w", err)
	}

	// Update local status
	pi.Status = PaymentIntentStatusCanceled
	pi.UpdatedAt = time.Now()

	if err := s.db.WithContext(ctx).Save(&pi).Error; err != nil {
		log.Error().Err(err).Msg("Failed to update payment intent status")
	}

	return nil
}

// SyncPaymentIntentStatus syncs the status of a payment intent from Stripe
func (s *StripeService) SyncPaymentIntentStatus(ctx context.Context, paymentIntentID uuid.UUID) (*PaymentIntent, error) {
	// Get the local payment intent
	var pi PaymentIntent
	if err := s.db.WithContext(ctx).Where("id = ?", paymentIntentID).First(&pi).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get payment intent: %w", err)
	}

	// Get status from Stripe
	stripePi, err := s.stripeClient.GetPaymentIntent(ctx, pi.StripeIntentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get payment intent from Stripe: %w", err)
	}

	// Update local status
	oldStatus := pi.Status
	pi.Status = mapStripeStatus(string(stripePi.Status))
	pi.UpdatedAt = time.Now()

	if stripePi.Status == "succeeded" && pi.CompletedAt == nil {
		now := time.Now()
		pi.CompletedAt = &now
	}

	if oldStatus != pi.Status {
		if err := s.db.WithContext(ctx).Save(&pi).Error; err != nil {
			return nil, fmt.Errorf("failed to update payment intent: %w", err)
		}
	}

	return &pi, nil
}

// GetConnectAccountDashboardLink creates a login link for the Stripe Express dashboard
func (s *StripeService) GetConnectAccountDashboardLink(ctx context.Context, festivalID uuid.UUID) (string, error) {
	// Get the Stripe account for this festival
	var stripeAcct StripeAccount
	if err := s.db.WithContext(ctx).Where("festival_id = ?", festivalID).First(&stripeAcct).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", errors.ErrNotFound
		}
		return "", fmt.Errorf("failed to get stripe account: %w", err)
	}

	// Note: For Express accounts, we use Account Links for onboarding
	// For dashboard access, the user logs in directly at https://connect.stripe.com
	// We return the onboarding URL if setup is incomplete, otherwise return the dashboard URL
	if !stripeAcct.ChargesEnabled || !stripeAcct.PayoutsEnabled {
		return fmt.Sprintf("%s/festivals/%s/stripe/setup", s.baseURL, festivalID), nil
	}

	// Return Stripe Express dashboard URL
	return "https://connect.stripe.com/express_login", nil
}

// Refund represents a refund record
type Refund struct {
	ID              uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	PaymentIntentID uuid.UUID    `json:"paymentIntentId" gorm:"type:uuid;not null;index"`
	StripeRefundID  string       `json:"stripeRefundId" gorm:"not null;uniqueIndex"`
	Amount          int64        `json:"amount" gorm:"not null"`
	Currency        string       `json:"currency" gorm:"default:'eur'"`
	Status          RefundStatus `json:"status" gorm:"default:'PENDING'"`
	Reason          string       `json:"reason,omitempty"`
	CreatedAt       time.Time    `json:"createdAt"`
}

func (Refund) TableName() string {
	return "refunds"
}

// RefundStatus represents the status of a refund
type RefundStatus string

const (
	RefundStatusPending   RefundStatus = "pending"
	RefundStatusSucceeded RefundStatus = "succeeded"
	RefundStatusFailed    RefundStatus = "failed"
	RefundStatusCanceled  RefundStatus = "canceled"
)

// StripeCustomer represents a Stripe customer linked to a user
type StripeCustomer struct {
	ID               uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID           uuid.UUID `json:"userId" gorm:"type:uuid;not null;uniqueIndex"`
	StripeCustomerID string    `json:"stripeCustomerId" gorm:"not null;uniqueIndex"`
	Email            string    `json:"email,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

func (StripeCustomer) TableName() string {
	return "stripe_customers"
}

// mapStripeStatus maps Stripe status to local status
func mapStripeStatus(stripeStatus string) PaymentIntentStatus {
	switch stripeStatus {
	case "requires_payment_method", "requires_confirmation":
		return PaymentIntentStatusPending
	case "requires_action":
		return PaymentIntentStatusRequiresAction
	case "processing":
		return PaymentIntentStatusProcessing
	case "succeeded":
		return PaymentIntentStatusSucceeded
	case "canceled":
		return PaymentIntentStatusCanceled
	default:
		return PaymentIntentStatusPending
	}
}
