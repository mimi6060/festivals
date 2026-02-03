package payment

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository handles payment data persistence
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new payment repository
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreatePaymentIntent creates a new payment intent record
func (r *Repository) CreatePaymentIntent(ctx context.Context, pi *PaymentIntent) error {
	return r.db.WithContext(ctx).Create(pi).Error
}

// GetPaymentIntentByID retrieves a payment intent by ID
func (r *Repository) GetPaymentIntentByID(ctx context.Context, id uuid.UUID) (*PaymentIntent, error) {
	var pi PaymentIntent
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&pi).Error; err != nil {
		return nil, err
	}
	return &pi, nil
}

// GetPaymentIntentByStripeID retrieves a payment intent by Stripe ID
func (r *Repository) GetPaymentIntentByStripeID(ctx context.Context, stripeID string) (*PaymentIntent, error) {
	var pi PaymentIntent
	if err := r.db.WithContext(ctx).Where("stripe_intent_id = ?", stripeID).First(&pi).Error; err != nil {
		return nil, err
	}
	return &pi, nil
}

// UpdatePaymentIntent updates a payment intent record
func (r *Repository) UpdatePaymentIntent(ctx context.Context, pi *PaymentIntent) error {
	return r.db.WithContext(ctx).Save(pi).Error
}

// GetPaymentIntentsByUser retrieves payment intents for a user
func (r *Repository) GetPaymentIntentsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]PaymentIntent, int64, error) {
	var payments []PaymentIntent
	var total int64

	query := r.db.WithContext(ctx).Model(&PaymentIntent{}).Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&payments).Error; err != nil {
		return nil, 0, err
	}

	return payments, total, nil
}

// GetPaymentIntentsByFestival retrieves payment intents for a festival
func (r *Repository) GetPaymentIntentsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]PaymentIntent, int64, error) {
	var payments []PaymentIntent
	var total int64

	query := r.db.WithContext(ctx).Model(&PaymentIntent{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&payments).Error; err != nil {
		return nil, 0, err
	}

	return payments, total, nil
}

// CreateStripeAccount creates a new Stripe account record
func (r *Repository) CreateStripeAccount(ctx context.Context, acct *StripeAccount) error {
	return r.db.WithContext(ctx).Create(acct).Error
}

// GetStripeAccountByFestivalID retrieves a Stripe account by festival ID
func (r *Repository) GetStripeAccountByFestivalID(ctx context.Context, festivalID uuid.UUID) (*StripeAccount, error) {
	var acct StripeAccount
	if err := r.db.WithContext(ctx).Where("festival_id = ?", festivalID).First(&acct).Error; err != nil {
		return nil, err
	}
	return &acct, nil
}

// GetStripeAccountByStripeID retrieves a Stripe account by Stripe account ID
func (r *Repository) GetStripeAccountByStripeID(ctx context.Context, stripeAccountID string) (*StripeAccount, error) {
	var acct StripeAccount
	if err := r.db.WithContext(ctx).Where("stripe_account_id = ?", stripeAccountID).First(&acct).Error; err != nil {
		return nil, err
	}
	return &acct, nil
}

// UpdateStripeAccount updates a Stripe account record
func (r *Repository) UpdateStripeAccount(ctx context.Context, acct *StripeAccount) error {
	return r.db.WithContext(ctx).Save(acct).Error
}

// CreateTransfer creates a new transfer record
func (r *Repository) CreateTransfer(ctx context.Context, transfer *Transfer) error {
	return r.db.WithContext(ctx).Create(transfer).Error
}

// GetTransferByID retrieves a transfer by ID
func (r *Repository) GetTransferByID(ctx context.Context, id uuid.UUID) (*Transfer, error) {
	var transfer Transfer
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&transfer).Error; err != nil {
		return nil, err
	}
	return &transfer, nil
}

// GetTransfersByFestival retrieves transfers for a festival
func (r *Repository) GetTransfersByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Transfer, int64, error) {
	var transfers []Transfer
	var total int64

	query := r.db.WithContext(ctx).Model(&Transfer{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&transfers).Error; err != nil {
		return nil, 0, err
	}

	return transfers, total, nil
}

// UpdateTransfer updates a transfer record
func (r *Repository) UpdateTransfer(ctx context.Context, transfer *Transfer) error {
	return r.db.WithContext(ctx).Save(transfer).Error
}

// CreateRefund creates a new refund record
func (r *Repository) CreateRefund(ctx context.Context, refund *Refund) error {
	return r.db.WithContext(ctx).Create(refund).Error
}

// GetRefundByID retrieves a refund by ID
func (r *Repository) GetRefundByID(ctx context.Context, id uuid.UUID) (*Refund, error) {
	var refund Refund
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&refund).Error; err != nil {
		return nil, err
	}
	return &refund, nil
}

// GetRefundsByPaymentIntent retrieves refunds for a payment intent
func (r *Repository) GetRefundsByPaymentIntent(ctx context.Context, paymentIntentID uuid.UUID) ([]Refund, error) {
	var refunds []Refund
	if err := r.db.WithContext(ctx).Where("payment_intent_id = ?", paymentIntentID).Find(&refunds).Error; err != nil {
		return nil, err
	}
	return refunds, nil
}

// CreateStripeCustomer creates a new Stripe customer record
func (r *Repository) CreateStripeCustomer(ctx context.Context, customer *StripeCustomer) error {
	return r.db.WithContext(ctx).Create(customer).Error
}

// GetStripeCustomerByUserID retrieves a Stripe customer by user ID
func (r *Repository) GetStripeCustomerByUserID(ctx context.Context, userID uuid.UUID) (*StripeCustomer, error) {
	var customer StripeCustomer
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&customer).Error; err != nil {
		return nil, err
	}
	return &customer, nil
}

// GetStripeCustomerByStripeID retrieves a Stripe customer by Stripe customer ID
func (r *Repository) GetStripeCustomerByStripeID(ctx context.Context, stripeCustomerID string) (*StripeCustomer, error) {
	var customer StripeCustomer
	if err := r.db.WithContext(ctx).Where("stripe_customer_id = ?", stripeCustomerID).First(&customer).Error; err != nil {
		return nil, err
	}
	return &customer, nil
}
