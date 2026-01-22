package payment

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/account"
	"github.com/stripe/stripe-go/v76/accountlink"
	"github.com/stripe/stripe-go/v76/paymentintent"
	"github.com/stripe/stripe-go/v76/transfer"
	"github.com/stripe/stripe-go/v76/webhook"
)

// StripeClient wraps Stripe API operations for Connect integration
type StripeClient struct {
	secretKey      string
	webhookSecret  string
	platformFeePercent int64 // Platform fee in basis points (100 = 1%)
}

// NewStripeClient creates a new Stripe client
func NewStripeClient(secretKey, webhookSecret string) *StripeClient {
	stripe.Key = secretKey
	return &StripeClient{
		secretKey:          secretKey,
		webhookSecret:      webhookSecret,
		platformFeePercent: 100, // 1% default platform fee
	}
}

// CreateConnectAccountParams contains parameters for creating a Connect account
type CreateConnectAccountParams struct {
	FestivalID   uuid.UUID
	FestivalName string
	Email        string
	Country      string // ISO country code (e.g., "BE", "FR", "NL")
}

// CreateConnectAccountResult contains the result of creating a Connect account
type CreateConnectAccountResult struct {
	AccountID string
}

// CreateConnectAccount creates a new Stripe Connect account for a festival
func (c *StripeClient) CreateConnectAccount(ctx context.Context, params CreateConnectAccountParams) (*CreateConnectAccountResult, error) {
	country := params.Country
	if country == "" {
		country = "BE" // Default to Belgium
	}

	accountParams := &stripe.AccountParams{
		Type:    stripe.String(string(stripe.AccountTypeExpress)),
		Country: stripe.String(country),
		Email:   stripe.String(params.Email),
		Capabilities: &stripe.AccountCapabilitiesParams{
			CardPayments: &stripe.AccountCapabilitiesCardPaymentsParams{
				Requested: stripe.Bool(true),
			},
			Transfers: &stripe.AccountCapabilitiesTransfersParams{
				Requested: stripe.Bool(true),
			},
		},
		BusinessProfile: &stripe.AccountBusinessProfileParams{
			Name: stripe.String(params.FestivalName),
			MCC:  stripe.String("7929"), // Entertainment/Ticket Agencies
		},
		Metadata: map[string]string{
			"festival_id":   params.FestivalID.String(),
			"festival_name": params.FestivalName,
		},
	}

	acct, err := account.New(accountParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create Stripe Connect account: %w", err)
	}

	return &CreateConnectAccountResult{
		AccountID: acct.ID,
	}, nil
}

// CreateAccountLinkParams contains parameters for creating an account link
type CreateAccountLinkParams struct {
	AccountID  string
	RefreshURL string
	ReturnURL  string
}

// CreateAccountLinkResult contains the result of creating an account link
type CreateAccountLinkResult struct {
	URL       string
	ExpiresAt int64
}

// CreateAccountLink creates an onboarding link for a Connect account
func (c *StripeClient) CreateAccountLink(ctx context.Context, params CreateAccountLinkParams) (*CreateAccountLinkResult, error) {
	linkParams := &stripe.AccountLinkParams{
		Account:    stripe.String(params.AccountID),
		RefreshURL: stripe.String(params.RefreshURL),
		ReturnURL:  stripe.String(params.ReturnURL),
		Type:       stripe.String(string(stripe.AccountLinkTypeAccountOnboarding)),
	}

	link, err := accountlink.New(linkParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create account link: %w", err)
	}

	return &CreateAccountLinkResult{
		URL:       link.URL,
		ExpiresAt: link.ExpiresAt,
	}, nil
}

// AccountStatus represents the status of a Connect account
type AccountStatus struct {
	AccountID          string
	ChargesEnabled     bool
	PayoutsEnabled     bool
	DetailsSubmitted   bool
	CurrentlyDue       []string
	EventuallyDue      []string
	PastDue            []string
	DisabledReason     string
	PaymentsCapability string
	TransfersCapability string
}

// GetAccountStatus retrieves the status of a Connect account
func (c *StripeClient) GetAccountStatus(ctx context.Context, accountID string) (*AccountStatus, error) {
	acct, err := account.GetByID(accountID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get account status: %w", err)
	}

	status := &AccountStatus{
		AccountID:        acct.ID,
		ChargesEnabled:   acct.ChargesEnabled,
		PayoutsEnabled:   acct.PayoutsEnabled,
		DetailsSubmitted: acct.DetailsSubmitted,
	}

	if acct.Requirements != nil {
		status.CurrentlyDue = acct.Requirements.CurrentlyDue
		status.EventuallyDue = acct.Requirements.EventuallyDue
		status.PastDue = acct.Requirements.PastDue
		status.DisabledReason = string(acct.Requirements.DisabledReason)
	}

	if acct.Capabilities != nil {
		status.PaymentsCapability = string(acct.Capabilities.CardPayments)
		status.TransfersCapability = string(acct.Capabilities.Transfers)
	}

	return status, nil
}

// CreatePaymentIntentParams contains parameters for creating a payment intent
type CreatePaymentIntentParams struct {
	Amount           int64     // Amount in cents
	Currency         string    // Currency code (e.g., "eur")
	FestivalID       uuid.UUID
	UserID           uuid.UUID
	WalletID         uuid.UUID
	Description      string
	CustomerEmail    string
	ConnectedAccount string // Optional: destination account for direct charges
	Metadata         map[string]string
}

// CreatePaymentIntentResult contains the result of creating a payment intent
type CreatePaymentIntentResult struct {
	PaymentIntentID string
	ClientSecret    string
	Amount          int64
	Currency        string
	Status          string
}

// CreatePaymentIntent creates a payment intent for wallet top-up
func (c *StripeClient) CreatePaymentIntent(ctx context.Context, params CreatePaymentIntentParams) (*CreatePaymentIntentResult, error) {
	currency := params.Currency
	if currency == "" {
		currency = "eur"
	}

	metadata := map[string]string{
		"festival_id": params.FestivalID.String(),
		"user_id":     params.UserID.String(),
		"wallet_id":   params.WalletID.String(),
		"type":        "wallet_topup",
	}

	// Merge additional metadata
	for k, v := range params.Metadata {
		metadata[k] = v
	}

	intentParams := &stripe.PaymentIntentParams{
		Amount:      stripe.Int64(params.Amount),
		Currency:    stripe.String(currency),
		Description: stripe.String(params.Description),
		AutomaticPaymentMethods: &stripe.PaymentIntentAutomaticPaymentMethodsParams{
			Enabled: stripe.Bool(true),
		},
		Metadata: metadata,
	}

	if params.CustomerEmail != "" {
		intentParams.ReceiptEmail = stripe.String(params.CustomerEmail)
	}

	// If using Connect with destination charges
	if params.ConnectedAccount != "" {
		// Calculate platform fee (1%)
		platformFee := (params.Amount * c.platformFeePercent) / 10000

		intentParams.ApplicationFeeAmount = stripe.Int64(platformFee)
		intentParams.TransferData = &stripe.PaymentIntentTransferDataParams{
			Destination: stripe.String(params.ConnectedAccount),
		}
	}

	intent, err := paymentintent.New(intentParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create payment intent: %w", err)
	}

	return &CreatePaymentIntentResult{
		PaymentIntentID: intent.ID,
		ClientSecret:    intent.ClientSecret,
		Amount:          intent.Amount,
		Currency:        string(intent.Currency),
		Status:          string(intent.Status),
	}, nil
}

// CreateTransferParams contains parameters for creating a transfer
type CreateTransferParams struct {
	Amount               int64
	Currency             string
	DestinationAccountID string
	Description          string
	SourceTransaction    string // Optional: source charge/payment intent
	FestivalID           uuid.UUID
	Metadata             map[string]string
}

// CreateTransferResult contains the result of creating a transfer
type CreateTransferResult struct {
	TransferID  string
	Amount      int64
	Currency    string
	Destination string
	Created     int64
}

// CreateTransfer creates a transfer to a connected account
func (c *StripeClient) CreateTransfer(ctx context.Context, params CreateTransferParams) (*CreateTransferResult, error) {
	currency := params.Currency
	if currency == "" {
		currency = "eur"
	}

	metadata := map[string]string{
		"festival_id": params.FestivalID.String(),
		"type":        "festival_payout",
	}

	// Merge additional metadata
	for k, v := range params.Metadata {
		metadata[k] = v
	}

	transferParams := &stripe.TransferParams{
		Amount:      stripe.Int64(params.Amount),
		Currency:    stripe.String(currency),
		Destination: stripe.String(params.DestinationAccountID),
		Description: stripe.String(params.Description),
		Metadata:    metadata,
	}

	if params.SourceTransaction != "" {
		transferParams.SourceTransaction = stripe.String(params.SourceTransaction)
	}

	t, err := transfer.New(transferParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create transfer: %w", err)
	}

	return &CreateTransferResult{
		TransferID:  t.ID,
		Amount:      t.Amount,
		Currency:    string(t.Currency),
		Destination: t.Destination.ID,
		Created:     t.Created,
	}, nil
}

// WebhookEvent represents a parsed webhook event
type WebhookEvent struct {
	ID       string
	Type     string
	Created  int64
	Data     json.RawMessage
	Account  string // Connected account ID if applicable
}

// PaymentIntentData represents payment intent data from webhook
type PaymentIntentData struct {
	ID                 string
	Amount             int64
	AmountReceived     int64
	Currency           string
	Status             string
	CustomerEmail      string
	Metadata           map[string]string
	LatestChargeID     string
	ApplicationFeeAmount int64
}

// HandleWebhook parses and validates a webhook request
func (c *StripeClient) HandleWebhook(payload []byte, signature string) (*WebhookEvent, error) {
	event, err := webhook.ConstructEvent(payload, signature, c.webhookSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to verify webhook signature: %w", err)
	}

	return &WebhookEvent{
		ID:      event.ID,
		Type:    string(event.Type),
		Created: event.Created,
		Data:    event.Data.Raw,
		Account: event.Account,
	}, nil
}

// HandleWebhookFromReader parses and validates a webhook request from an io.Reader
func (c *StripeClient) HandleWebhookFromReader(body io.Reader, signature string) (*WebhookEvent, error) {
	payload, err := io.ReadAll(body)
	if err != nil {
		return nil, fmt.Errorf("failed to read webhook body: %w", err)
	}
	return c.HandleWebhook(payload, signature)
}

// ParsePaymentIntentFromWebhook extracts PaymentIntent data from webhook event
func ParsePaymentIntentFromWebhook(data json.RawMessage) (*PaymentIntentData, error) {
	var wrapper struct {
		Object PaymentIntentData `json:"object"`
	}

	// First try direct parsing
	var direct struct {
		ID             string            `json:"id"`
		Amount         int64             `json:"amount"`
		AmountReceived int64             `json:"amount_received"`
		Currency       string            `json:"currency"`
		Status         string            `json:"status"`
		ReceiptEmail   string            `json:"receipt_email"`
		Metadata       map[string]string `json:"metadata"`
		LatestCharge   string            `json:"latest_charge"`
		ApplicationFeeAmount int64       `json:"application_fee_amount"`
	}

	if err := json.Unmarshal(data, &wrapper); err == nil && wrapper.Object.ID != "" {
		return &wrapper.Object, nil
	}

	if err := json.Unmarshal(data, &direct); err != nil {
		return nil, fmt.Errorf("failed to parse payment intent data: %w", err)
	}

	return &PaymentIntentData{
		ID:             direct.ID,
		Amount:         direct.Amount,
		AmountReceived: direct.AmountReceived,
		Currency:       direct.Currency,
		Status:         direct.Status,
		CustomerEmail:  direct.ReceiptEmail,
		Metadata:       direct.Metadata,
		LatestChargeID: direct.LatestCharge,
		ApplicationFeeAmount: direct.ApplicationFeeAmount,
	}, nil
}

// AccountData represents account data from webhook
type AccountData struct {
	ID               string
	ChargesEnabled   bool
	PayoutsEnabled   bool
	DetailsSubmitted bool
}

// ParseAccountFromWebhook extracts Account data from webhook event
func ParseAccountFromWebhook(data json.RawMessage) (*AccountData, error) {
	var acct struct {
		ID               string `json:"id"`
		ChargesEnabled   bool   `json:"charges_enabled"`
		PayoutsEnabled   bool   `json:"payouts_enabled"`
		DetailsSubmitted bool   `json:"details_submitted"`
	}

	if err := json.Unmarshal(data, &acct); err != nil {
		return nil, fmt.Errorf("failed to parse account data: %w", err)
	}

	return &AccountData{
		ID:               acct.ID,
		ChargesEnabled:   acct.ChargesEnabled,
		PayoutsEnabled:   acct.PayoutsEnabled,
		DetailsSubmitted: acct.DetailsSubmitted,
	}, nil
}

// SetPlatformFeePercent sets the platform fee percentage in basis points
func (c *StripeClient) SetPlatformFeePercent(basisPoints int64) {
	c.platformFeePercent = basisPoints
}

// GetPlatformFeePercent returns the current platform fee percentage
func (c *StripeClient) GetPlatformFeePercent() int64 {
	return c.platformFeePercent
}
