package payment

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/payment"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// WalletService defines the interface for wallet operations
type WalletService interface {
	TopUpFromPayment(ctx context.Context, walletID uuid.UUID, amount int64, reference string) error
}

// FestivalService defines the interface for festival operations
type FestivalService interface {
	GetByID(ctx context.Context, id uuid.UUID) (FestivalInfo, error)
	UpdateStripeAccountID(ctx context.Context, festivalID uuid.UUID, stripeAccountID string) error
}

// FestivalInfo contains festival information needed for payments
type FestivalInfo struct {
	ID              uuid.UUID
	Name            string
	StripeAccountID string
}

// Service handles payment business logic
type Service struct {
	db             *gorm.DB
	stripeClient   *payment.StripeClient
	walletService  WalletService
	festivalService FestivalService
	baseURL        string
}

// NewService creates a new payment service
func NewService(db *gorm.DB, stripeClient *payment.StripeClient, baseURL string) *Service {
	return &Service{
		db:           db,
		stripeClient: stripeClient,
		baseURL:      baseURL,
	}
}

// SetWalletService sets the wallet service (to avoid circular dependency)
func (s *Service) SetWalletService(ws WalletService) {
	s.walletService = ws
}

// SetFestivalService sets the festival service (to avoid circular dependency)
func (s *Service) SetFestivalService(fs FestivalService) {
	s.festivalService = fs
}

// CreatePaymentIntent creates a new payment intent for wallet top-up
func (s *Service) CreatePaymentIntent(ctx context.Context, festivalID, userID, walletID uuid.UUID, amount int64, currency string, email string) (*PaymentIntent, error) {
	if amount < 100 {
		return nil, errors.New("MINIMUM_AMOUNT", "Minimum amount is 100 cents (1 EUR)")
	}

	if currency == "" {
		currency = "eur"
	}

	// Get festival Stripe account if connected
	var connectedAccount string
	stripeAcct, err := s.GetStripeAccountByFestival(ctx, festivalID)
	if err == nil && stripeAcct != nil && stripeAcct.ChargesEnabled {
		connectedAccount = stripeAcct.StripeAccountID
	}

	// Calculate platform fee
	platformFee := CalculatePlatformFee(amount)

	// Create Stripe payment intent
	result, err := s.stripeClient.CreatePaymentIntent(ctx, payment.CreatePaymentIntentParams{
		Amount:           amount,
		Currency:         currency,
		FestivalID:       festivalID,
		UserID:           userID,
		WalletID:         walletID,
		Description:      fmt.Sprintf("Wallet top-up for festival"),
		CustomerEmail:    email,
		ConnectedAccount: connectedAccount,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create payment intent: %w", err)
	}

	// Create local payment intent record
	pi := &PaymentIntent{
		ID:             uuid.New(),
		StripeIntentID: result.PaymentIntentID,
		FestivalID:     festivalID,
		UserID:         userID,
		WalletID:       walletID,
		Amount:         amount,
		Currency:       currency,
		PlatformFee:    platformFee,
		Status:         PaymentIntentStatusPending,
		ClientSecret:   result.ClientSecret,
		CustomerEmail:  email,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(pi).Error; err != nil {
		return nil, fmt.Errorf("failed to save payment intent: %w", err)
	}

	return pi, nil
}

// GetPaymentIntent retrieves a payment intent by ID
func (s *Service) GetPaymentIntent(ctx context.Context, id uuid.UUID) (*PaymentIntent, error) {
	var pi PaymentIntent
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&pi).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get payment intent: %w", err)
	}
	return &pi, nil
}

// GetPaymentIntentByStripeID retrieves a payment intent by Stripe ID
func (s *Service) GetPaymentIntentByStripeID(ctx context.Context, stripeID string) (*PaymentIntent, error) {
	var pi PaymentIntent
	if err := s.db.WithContext(ctx).Where("stripe_intent_id = ?", stripeID).First(&pi).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get payment intent: %w", err)
	}
	return &pi, nil
}

// ProcessWebhook handles incoming Stripe webhooks
func (s *Service) ProcessWebhook(ctx context.Context, event *payment.WebhookEvent) error {
	log.Info().
		Str("event_id", event.ID).
		Str("event_type", event.Type).
		Str("account", event.Account).
		Msg("Processing Stripe webhook")

	switch event.Type {
	case WebhookEventPaymentIntentSucceeded:
		return s.handlePaymentIntentSucceeded(ctx, event)
	case WebhookEventPaymentIntentFailed:
		return s.handlePaymentIntentFailed(ctx, event)
	case WebhookEventPaymentIntentCanceled:
		return s.handlePaymentIntentCanceled(ctx, event)
	case WebhookEventPaymentIntentProcessing:
		return s.handlePaymentIntentProcessing(ctx, event)
	case WebhookEventAccountUpdated:
		return s.handleAccountUpdated(ctx, event)
	case WebhookEventTransferCreated:
		return s.handleTransferCreated(ctx, event)
	case WebhookEventTransferFailed:
		return s.handleTransferFailed(ctx, event)
	default:
		log.Debug().Str("event_type", event.Type).Msg("Unhandled webhook event type")
		return nil
	}
}

func (s *Service) handlePaymentIntentSucceeded(ctx context.Context, event *payment.WebhookEvent) error {
	piData, err := payment.ParsePaymentIntentFromWebhook(event.Data)
	if err != nil {
		return fmt.Errorf("failed to parse payment intent: %w", err)
	}

	// Get local payment intent
	pi, err := s.GetPaymentIntentByStripeID(ctx, piData.ID)
	if err != nil {
		if err == errors.ErrNotFound {
			log.Warn().Str("stripe_id", piData.ID).Msg("Payment intent not found in database")
			return nil
		}
		return err
	}

	// Update status
	now := time.Now()
	pi.Status = PaymentIntentStatusSucceeded
	pi.CompletedAt = &now
	pi.UpdatedAt = now

	if err := s.db.WithContext(ctx).Save(pi).Error; err != nil {
		return fmt.Errorf("failed to update payment intent: %w", err)
	}

	// Credit wallet
	if s.walletService != nil {
		if err := s.walletService.TopUpFromPayment(ctx, pi.WalletID, pi.Amount, pi.StripeIntentID); err != nil {
			log.Error().Err(err).
				Str("wallet_id", pi.WalletID.String()).
				Int64("amount", pi.Amount).
				Msg("Failed to credit wallet after successful payment")
			return fmt.Errorf("failed to credit wallet: %w", err)
		}
	}

	log.Info().
		Str("payment_intent_id", pi.ID.String()).
		Int64("amount", pi.Amount).
		Msg("Payment succeeded and wallet credited")

	return nil
}

func (s *Service) handlePaymentIntentFailed(ctx context.Context, event *payment.WebhookEvent) error {
	piData, err := payment.ParsePaymentIntentFromWebhook(event.Data)
	if err != nil {
		return fmt.Errorf("failed to parse payment intent: %w", err)
	}

	pi, err := s.GetPaymentIntentByStripeID(ctx, piData.ID)
	if err != nil {
		if err == errors.ErrNotFound {
			return nil
		}
		return err
	}

	pi.Status = PaymentIntentStatusFailed
	pi.UpdatedAt = time.Now()

	if err := s.db.WithContext(ctx).Save(pi).Error; err != nil {
		return fmt.Errorf("failed to update payment intent: %w", err)
	}

	log.Info().
		Str("payment_intent_id", pi.ID.String()).
		Msg("Payment intent failed")

	return nil
}

func (s *Service) handlePaymentIntentCanceled(ctx context.Context, event *payment.WebhookEvent) error {
	piData, err := payment.ParsePaymentIntentFromWebhook(event.Data)
	if err != nil {
		return fmt.Errorf("failed to parse payment intent: %w", err)
	}

	pi, err := s.GetPaymentIntentByStripeID(ctx, piData.ID)
	if err != nil {
		if err == errors.ErrNotFound {
			return nil
		}
		return err
	}

	pi.Status = PaymentIntentStatusCanceled
	pi.UpdatedAt = time.Now()

	if err := s.db.WithContext(ctx).Save(pi).Error; err != nil {
		return fmt.Errorf("failed to update payment intent: %w", err)
	}

	return nil
}

func (s *Service) handlePaymentIntentProcessing(ctx context.Context, event *payment.WebhookEvent) error {
	piData, err := payment.ParsePaymentIntentFromWebhook(event.Data)
	if err != nil {
		return fmt.Errorf("failed to parse payment intent: %w", err)
	}

	pi, err := s.GetPaymentIntentByStripeID(ctx, piData.ID)
	if err != nil {
		if err == errors.ErrNotFound {
			return nil
		}
		return err
	}

	pi.Status = PaymentIntentStatusProcessing
	pi.UpdatedAt = time.Now()

	if err := s.db.WithContext(ctx).Save(pi).Error; err != nil {
		return fmt.Errorf("failed to update payment intent: %w", err)
	}

	return nil
}

func (s *Service) handleAccountUpdated(ctx context.Context, event *payment.WebhookEvent) error {
	acctData, err := payment.ParseAccountFromWebhook(event.Data)
	if err != nil {
		return fmt.Errorf("failed to parse account data: %w", err)
	}

	// Update local Stripe account record
	var stripeAcct StripeAccount
	if err := s.db.WithContext(ctx).Where("stripe_account_id = ?", acctData.ID).First(&stripeAcct).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Warn().Str("account_id", acctData.ID).Msg("Stripe account not found in database")
			return nil
		}
		return fmt.Errorf("failed to get stripe account: %w", err)
	}

	stripeAcct.ChargesEnabled = acctData.ChargesEnabled
	stripeAcct.PayoutsEnabled = acctData.PayoutsEnabled
	stripeAcct.DetailsSubmitted = acctData.DetailsSubmitted
	stripeAcct.UpdatedAt = time.Now()

	// Update onboarding status
	if acctData.ChargesEnabled && acctData.PayoutsEnabled {
		stripeAcct.OnboardingStatus = OnboardingStatusComplete
	} else if acctData.DetailsSubmitted {
		stripeAcct.OnboardingStatus = OnboardingStatusInProgress
	}

	if err := s.db.WithContext(ctx).Save(&stripeAcct).Error; err != nil {
		return fmt.Errorf("failed to update stripe account: %w", err)
	}

	log.Info().
		Str("account_id", acctData.ID).
		Bool("charges_enabled", acctData.ChargesEnabled).
		Bool("payouts_enabled", acctData.PayoutsEnabled).
		Msg("Stripe account updated")

	return nil
}

func (s *Service) handleTransferCreated(ctx context.Context, event *payment.WebhookEvent) error {
	var transferData struct {
		ID          string `json:"id"`
		Amount      int64  `json:"amount"`
		Currency    string `json:"currency"`
		Destination string `json:"destination"`
	}

	if err := json.Unmarshal(event.Data, &transferData); err != nil {
		return fmt.Errorf("failed to parse transfer data: %w", err)
	}

	log.Info().
		Str("transfer_id", transferData.ID).
		Int64("amount", transferData.Amount).
		Str("destination", transferData.Destination).
		Msg("Transfer created")

	return nil
}

func (s *Service) handleTransferFailed(ctx context.Context, event *payment.WebhookEvent) error {
	var transferData struct {
		ID string `json:"id"`
	}

	if err := json.Unmarshal(event.Data, &transferData); err != nil {
		return fmt.Errorf("failed to parse transfer data: %w", err)
	}

	// Update transfer status if exists
	if err := s.db.WithContext(ctx).Model(&Transfer{}).
		Where("stripe_transfer_id = ?", transferData.ID).
		Update("status", TransferStatusFailed).Error; err != nil {
		log.Warn().Err(err).Str("transfer_id", transferData.ID).Msg("Failed to update transfer status")
	}

	return nil
}

// CalculatePlatformFee calculates the 1% platform fee
func CalculatePlatformFee(amount int64) int64 {
	// 1% platform fee
	return (amount * 100) / 10000 // 100 basis points = 1%
}

// CreateStripeConnectAccount creates a Stripe Connect account for a festival
func (s *Service) CreateStripeConnectAccount(ctx context.Context, festivalID uuid.UUID, festivalName, email, country string) (*StripeAccount, string, error) {
	// Check if account already exists
	existing, _ := s.GetStripeAccountByFestival(ctx, festivalID)
	if existing != nil {
		return nil, "", errors.New("ACCOUNT_EXISTS", "Stripe account already exists for this festival")
	}

	// Create Stripe Connect account
	result, err := s.stripeClient.CreateConnectAccount(ctx, payment.CreateConnectAccountParams{
		FestivalID:   festivalID,
		FestivalName: festivalName,
		Email:        email,
		Country:      country,
	})
	if err != nil {
		return nil, "", fmt.Errorf("failed to create Stripe account: %w", err)
	}

	// Create onboarding link
	linkResult, err := s.stripeClient.CreateAccountLink(ctx, payment.CreateAccountLinkParams{
		AccountID:  result.AccountID,
		RefreshURL: fmt.Sprintf("%s/festivals/%s/stripe/refresh", s.baseURL, festivalID),
		ReturnURL:  fmt.Sprintf("%s/festivals/%s/stripe/return", s.baseURL, festivalID),
	})
	if err != nil {
		return nil, "", fmt.Errorf("failed to create account link: %w", err)
	}

	// Save account to database
	stripeAcct := &StripeAccount{
		ID:               uuid.New(),
		FestivalID:       festivalID,
		StripeAccountID:  result.AccountID,
		Email:            email,
		Country:          country,
		OnboardingStatus: OnboardingStatusPending,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(stripeAcct).Error; err != nil {
		return nil, "", fmt.Errorf("failed to save stripe account: %w", err)
	}

	// Update festival with Stripe account ID
	if s.festivalService != nil {
		if err := s.festivalService.UpdateStripeAccountID(ctx, festivalID, result.AccountID); err != nil {
			log.Warn().Err(err).Msg("Failed to update festival with Stripe account ID")
		}
	}

	return stripeAcct, linkResult.URL, nil
}

// GetStripeAccountByFestival retrieves the Stripe account for a festival
func (s *Service) GetStripeAccountByFestival(ctx context.Context, festivalID uuid.UUID) (*StripeAccount, error) {
	var stripeAcct StripeAccount
	if err := s.db.WithContext(ctx).Where("festival_id = ?", festivalID).First(&stripeAcct).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get stripe account: %w", err)
	}
	return &stripeAcct, nil
}

// GetStripeAccountStatus gets the current status from Stripe
func (s *Service) GetStripeAccountStatus(ctx context.Context, festivalID uuid.UUID) (*payment.AccountStatus, error) {
	stripeAcct, err := s.GetStripeAccountByFestival(ctx, festivalID)
	if err != nil {
		return nil, err
	}

	status, err := s.stripeClient.GetAccountStatus(ctx, stripeAcct.StripeAccountID)
	if err != nil {
		return nil, fmt.Errorf("failed to get account status: %w", err)
	}

	// Update local record
	stripeAcct.ChargesEnabled = status.ChargesEnabled
	stripeAcct.PayoutsEnabled = status.PayoutsEnabled
	stripeAcct.DetailsSubmitted = status.DetailsSubmitted
	stripeAcct.DisabledReason = status.DisabledReason
	stripeAcct.UpdatedAt = time.Now()

	if status.ChargesEnabled && status.PayoutsEnabled {
		stripeAcct.OnboardingStatus = OnboardingStatusComplete
	} else if status.DetailsSubmitted {
		stripeAcct.OnboardingStatus = OnboardingStatusInProgress
	} else if status.DisabledReason != "" {
		stripeAcct.OnboardingStatus = OnboardingStatusRestricted
	}

	if err := s.db.WithContext(ctx).Save(stripeAcct).Error; err != nil {
		log.Warn().Err(err).Msg("Failed to update stripe account status in database")
	}

	return status, nil
}

// CreateOnboardingLink creates a new onboarding link for an existing account
func (s *Service) CreateOnboardingLink(ctx context.Context, festivalID uuid.UUID) (string, error) {
	stripeAcct, err := s.GetStripeAccountByFestival(ctx, festivalID)
	if err != nil {
		return "", err
	}

	linkResult, err := s.stripeClient.CreateAccountLink(ctx, payment.CreateAccountLinkParams{
		AccountID:  stripeAcct.StripeAccountID,
		RefreshURL: fmt.Sprintf("%s/festivals/%s/stripe/refresh", s.baseURL, festivalID),
		ReturnURL:  fmt.Sprintf("%s/festivals/%s/stripe/return", s.baseURL, festivalID),
	})
	if err != nil {
		return "", fmt.Errorf("failed to create account link: %w", err)
	}

	return linkResult.URL, nil
}

// TransferToFestival transfers funds to a festival's connected account
func (s *Service) TransferToFestival(ctx context.Context, festivalID uuid.UUID, amount int64, description string, sourceTransaction string) (*Transfer, error) {
	stripeAcct, err := s.GetStripeAccountByFestival(ctx, festivalID)
	if err != nil {
		return nil, err
	}

	if !stripeAcct.ChargesEnabled || !stripeAcct.PayoutsEnabled {
		return nil, errors.New("ACCOUNT_NOT_READY", "Festival Stripe account is not fully enabled")
	}

	// Create transfer via Stripe
	result, err := s.stripeClient.CreateTransfer(ctx, payment.CreateTransferParams{
		Amount:               amount,
		Currency:             "eur",
		DestinationAccountID: stripeAcct.StripeAccountID,
		Description:          description,
		SourceTransaction:    sourceTransaction,
		FestivalID:           festivalID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create transfer: %w", err)
	}

	// Save transfer record
	transfer := &Transfer{
		ID:                  uuid.New(),
		StripeTransferID:    result.TransferID,
		FestivalID:          festivalID,
		StripeAccountID:     stripeAcct.StripeAccountID,
		Amount:              result.Amount,
		Currency:            result.Currency,
		Description:         description,
		SourceTransactionID: sourceTransaction,
		Status:              TransferStatusPending,
		CreatedAt:           time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(transfer).Error; err != nil {
		return nil, fmt.Errorf("failed to save transfer: %w", err)
	}

	return transfer, nil
}

// GetTransfersByFestival retrieves all transfers for a festival
func (s *Service) GetTransfersByFestival(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]Transfer, int64, error) {
	var transfers []Transfer
	var total int64

	query := s.db.WithContext(ctx).Model(&Transfer{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count transfers: %w", err)
	}

	offset := (page - 1) * perPage
	if err := query.Offset(offset).Limit(perPage).Order("created_at DESC").Find(&transfers).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to get transfers: %w", err)
	}

	return transfers, total, nil
}

// GetPaymentsByUser retrieves payment intents for a user
func (s *Service) GetPaymentsByUser(ctx context.Context, userID uuid.UUID, page, perPage int) ([]PaymentIntent, int64, error) {
	var payments []PaymentIntent
	var total int64

	query := s.db.WithContext(ctx).Model(&PaymentIntent{}).Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count payments: %w", err)
	}

	offset := (page - 1) * perPage
	if err := query.Offset(offset).Limit(perPage).Order("created_at DESC").Find(&payments).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to get payments: %w", err)
	}

	return payments, total, nil
}
