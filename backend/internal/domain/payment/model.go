package payment

import (
	"time"

	"github.com/google/uuid"
)

// PaymentIntent represents a payment intent for wallet top-up
type PaymentIntent struct {
	ID              uuid.UUID           `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	StripeIntentID  string              `json:"stripeIntentId" gorm:"not null;uniqueIndex"`
	FestivalID      uuid.UUID           `json:"festivalId" gorm:"type:uuid;not null;index"`
	UserID          uuid.UUID           `json:"userId" gorm:"type:uuid;not null;index"`
	WalletID        uuid.UUID           `json:"walletId" gorm:"type:uuid;not null;index"`
	Amount          int64               `json:"amount" gorm:"not null"` // Amount in cents
	Currency        string              `json:"currency" gorm:"default:'eur'"`
	PlatformFee     int64               `json:"platformFee" gorm:"default:0"` // Platform fee in cents
	Status          PaymentIntentStatus `json:"status" gorm:"default:'PENDING'"`
	ClientSecret    string              `json:"-" gorm:"-"` // Only returned during creation, not stored
	CustomerEmail   string              `json:"customerEmail,omitempty"`
	FailureReason   string              `json:"failureReason,omitempty"`
	CompletedAt     *time.Time          `json:"completedAt,omitempty"`
	CreatedAt       time.Time           `json:"createdAt"`
	UpdatedAt       time.Time           `json:"updatedAt"`
}

func (PaymentIntent) TableName() string {
	return "payment_intents"
}

// PaymentIntentStatus represents the status of a payment intent
type PaymentIntentStatus string

const (
	PaymentIntentStatusPending            PaymentIntentStatus = "PENDING"
	PaymentIntentStatusProcessing         PaymentIntentStatus = "PROCESSING"
	PaymentIntentStatusRequiresAction     PaymentIntentStatus = "REQUIRES_ACTION"
	PaymentIntentStatusSucceeded          PaymentIntentStatus = "SUCCEEDED"
	PaymentIntentStatusFailed             PaymentIntentStatus = "FAILED"
	PaymentIntentStatusCanceled           PaymentIntentStatus = "CANCELED"
)

// StripeAccount represents a Stripe Connect account linked to a festival
type StripeAccount struct {
	ID               uuid.UUID            `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID       uuid.UUID            `json:"festivalId" gorm:"type:uuid;not null;uniqueIndex"`
	StripeAccountID  string               `json:"stripeAccountId" gorm:"not null;uniqueIndex"`
	Email            string               `json:"email"`
	Country          string               `json:"country" gorm:"default:'BE'"`
	ChargesEnabled   bool                 `json:"chargesEnabled" gorm:"default:false"`
	PayoutsEnabled   bool                 `json:"payoutsEnabled" gorm:"default:false"`
	DetailsSubmitted bool                 `json:"detailsSubmitted" gorm:"default:false"`
	OnboardingStatus OnboardingStatus     `json:"onboardingStatus" gorm:"default:'PENDING'"`
	DisabledReason   string               `json:"disabledReason,omitempty"`
	CreatedAt        time.Time            `json:"createdAt"`
	UpdatedAt        time.Time            `json:"updatedAt"`
}

func (StripeAccount) TableName() string {
	return "stripe_accounts"
}

// OnboardingStatus represents the Stripe Connect onboarding status
type OnboardingStatus string

const (
	OnboardingStatusPending    OnboardingStatus = "PENDING"
	OnboardingStatusInProgress OnboardingStatus = "IN_PROGRESS"
	OnboardingStatusComplete   OnboardingStatus = "COMPLETE"
	OnboardingStatusRestricted OnboardingStatus = "RESTRICTED"
)

// Transfer represents a transfer to a connected account
type Transfer struct {
	ID                   uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	StripeTransferID     string         `json:"stripeTransferId" gorm:"not null;uniqueIndex"`
	FestivalID           uuid.UUID      `json:"festivalId" gorm:"type:uuid;not null;index"`
	StripeAccountID      string         `json:"stripeAccountId" gorm:"not null"`
	Amount               int64          `json:"amount" gorm:"not null"` // Amount in cents
	Currency             string         `json:"currency" gorm:"default:'eur'"`
	Description          string         `json:"description,omitempty"`
	SourceTransactionID  string         `json:"sourceTransactionId,omitempty"`
	Status               TransferStatus `json:"status" gorm:"default:'PENDING'"`
	CreatedAt            time.Time      `json:"createdAt"`
}

func (Transfer) TableName() string {
	return "transfers"
}

// TransferStatus represents the status of a transfer
type TransferStatus string

const (
	TransferStatusPending  TransferStatus = "PENDING"
	TransferStatusPaid     TransferStatus = "PAID"
	TransferStatusFailed   TransferStatus = "FAILED"
	TransferStatusReversed TransferStatus = "REVERSED"
)

// Webhook event types for Stripe
const (
	// Payment Intent events
	WebhookEventPaymentIntentSucceeded         = "payment_intent.succeeded"
	WebhookEventPaymentIntentFailed            = "payment_intent.payment_failed"
	WebhookEventPaymentIntentCanceled          = "payment_intent.canceled"
	WebhookEventPaymentIntentProcessing        = "payment_intent.processing"
	WebhookEventPaymentIntentRequiresAction    = "payment_intent.requires_action"
	WebhookEventPaymentIntentCreated           = "payment_intent.created"

	// Account events (for Connect)
	WebhookEventAccountUpdated                 = "account.updated"
	WebhookEventAccountApplicationAuthorized   = "account.application.authorized"
	WebhookEventAccountApplicationDeauthorized = "account.application.deauthorized"

	// Transfer events
	WebhookEventTransferCreated                = "transfer.created"
	WebhookEventTransferFailed                 = "transfer.failed"
	WebhookEventTransferPaid                   = "transfer.paid"
	WebhookEventTransferReversed               = "transfer.reversed"

	// Charge events
	WebhookEventChargeSucceeded                = "charge.succeeded"
	WebhookEventChargeFailed                   = "charge.failed"
	WebhookEventChargeRefunded                 = "charge.refunded"
)

// CreatePaymentIntentRequest represents a request to create a payment intent
type CreatePaymentIntentRequest struct {
	Amount    int64  `json:"amount" binding:"required,min=100"` // Minimum 1 EUR = 100 cents
	WalletID  string `json:"walletId" binding:"required,uuid"`
	Currency  string `json:"currency,omitempty"`
}

// CreatePaymentIntentResponse represents the response for creating a payment intent
type CreatePaymentIntentResponse struct {
	ID           uuid.UUID           `json:"id"`
	ClientSecret string              `json:"clientSecret"`
	Amount       int64               `json:"amount"`
	Currency     string              `json:"currency"`
	Status       PaymentIntentStatus `json:"status"`
}

// ConnectAccountRequest represents a request to create/link a Stripe Connect account
type ConnectAccountRequest struct {
	Email   string `json:"email" binding:"required,email"`
	Country string `json:"country,omitempty"` // ISO country code
}

// ConnectAccountResponse represents the response for Connect account operations
type ConnectAccountResponse struct {
	AccountID        string           `json:"accountId"`
	OnboardingURL    string           `json:"onboardingUrl,omitempty"`
	OnboardingExpiry int64            `json:"onboardingExpiry,omitempty"`
	Status           OnboardingStatus `json:"status"`
	ChargesEnabled   bool             `json:"chargesEnabled"`
	PayoutsEnabled   bool             `json:"payoutsEnabled"`
}

// StripeAccountStatusResponse represents the detailed status of a Stripe account
type StripeAccountStatusResponse struct {
	AccountID          string           `json:"accountId"`
	OnboardingStatus   OnboardingStatus `json:"onboardingStatus"`
	ChargesEnabled     bool             `json:"chargesEnabled"`
	PayoutsEnabled     bool             `json:"payoutsEnabled"`
	DetailsSubmitted   bool             `json:"detailsSubmitted"`
	CurrentlyDue       []string         `json:"currentlyDue,omitempty"`
	EventuallyDue      []string         `json:"eventuallyDue,omitempty"`
	PastDue            []string         `json:"pastDue,omitempty"`
	DisabledReason     string           `json:"disabledReason,omitempty"`
	PaymentsCapability string           `json:"paymentsCapability,omitempty"`
	TransfersCapability string          `json:"transfersCapability,omitempty"`
}

// WebhookPayload represents the incoming webhook payload
type WebhookPayload struct {
	Type    string      `json:"type"`
	Data    interface{} `json:"data"`
	Account string      `json:"account,omitempty"` // Connected account ID
}

// PaymentIntentResponse represents a full payment intent response
type PaymentIntentResponse struct {
	ID             uuid.UUID           `json:"id"`
	StripeIntentID string              `json:"stripeIntentId"`
	FestivalID     uuid.UUID           `json:"festivalId"`
	UserID         uuid.UUID           `json:"userId"`
	WalletID       uuid.UUID           `json:"walletId"`
	Amount         int64               `json:"amount"`
	AmountDisplay  string              `json:"amountDisplay"`
	Currency       string              `json:"currency"`
	Status         PaymentIntentStatus `json:"status"`
	CreatedAt      string              `json:"createdAt"`
	CompletedAt    string              `json:"completedAt,omitempty"`
}

func (pi *PaymentIntent) ToResponse() PaymentIntentResponse {
	resp := PaymentIntentResponse{
		ID:             pi.ID,
		StripeIntentID: pi.StripeIntentID,
		FestivalID:     pi.FestivalID,
		UserID:         pi.UserID,
		WalletID:       pi.WalletID,
		Amount:         pi.Amount,
		AmountDisplay:  formatAmount(pi.Amount, pi.Currency),
		Currency:       pi.Currency,
		Status:         pi.Status,
		CreatedAt:      pi.CreatedAt.Format(time.RFC3339),
	}

	if pi.CompletedAt != nil {
		resp.CompletedAt = pi.CompletedAt.Format(time.RFC3339)
	}

	return resp
}

func formatAmount(amount int64, currency string) string {
	// Convert cents to main unit
	mainUnit := float64(amount) / 100

	symbol := "EUR"
	switch currency {
	case "eur":
		symbol = "EUR"
	case "usd":
		symbol = "USD"
	case "gbp":
		symbol = "GBP"
	}

	return formatCurrency(mainUnit, symbol)
}

func formatCurrency(amount float64, symbol string) string {
	if amount == float64(int64(amount)) {
		return formatFloat(amount, 0) + " " + symbol
	}
	return formatFloat(amount, 2) + " " + symbol
}

func formatFloat(f float64, decimals int) string {
	if decimals == 0 {
		return formatIntPart(int64(f))
	}
	return formatIntPart(int64(f)) + formatDecimalPart(f, decimals)
}

func formatIntPart(i int64) string {
	if i < 0 {
		return "-" + formatIntPart(-i)
	}
	if i < 1000 {
		return intToString(i)
	}
	return formatIntPart(i/1000) + "," + padZeros(i%1000, 3)
}

func formatDecimalPart(f float64, decimals int) string {
	frac := f - float64(int64(f))
	if frac < 0 {
		frac = -frac
	}
	for i := 0; i < decimals; i++ {
		frac *= 10
	}
	return "." + padZeros(int64(frac+0.5), decimals)
}

func intToString(i int64) string {
	if i == 0 {
		return "0"
	}
	result := ""
	for i > 0 {
		result = string(rune('0'+i%10)) + result
		i /= 10
	}
	return result
}

func padZeros(i int64, width int) string {
	s := intToString(i)
	for len(s) < width {
		s = "0" + s
	}
	return s
}
