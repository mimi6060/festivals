package refund

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

// Service handles refund business logic
type Service struct {
	repo          Repository
	walletRepo    wallet.Repository
	refundConfigs map[uuid.UUID]FestivalRefundConfig // Festival-specific configs
}

// NewService creates a new refund service
func NewService(repo Repository, walletRepo wallet.Repository) *Service {
	return &Service{
		repo:          repo,
		walletRepo:    walletRepo,
		refundConfigs: make(map[uuid.UUID]FestivalRefundConfig),
	}
}

// SetFestivalConfig sets the refund configuration for a festival
func (s *Service) SetFestivalConfig(festivalID uuid.UUID, config FestivalRefundConfig) {
	s.refundConfigs[festivalID] = config
}

// GetFestivalConfig gets the refund configuration for a festival
func (s *Service) GetFestivalConfig(festivalID uuid.UUID) FestivalRefundConfig {
	if config, ok := s.refundConfigs[festivalID]; ok {
		return config
	}
	return DefaultRefundConfig()
}

// RequestRefund creates a new refund request from a user
func (s *Service) RequestRefund(ctx context.Context, userID uuid.UUID, input CreateRefundInput) (*RefundRequest, error) {
	// Get the wallet
	w, err := s.walletRepo.GetWalletByID(ctx, input.WalletID)
	if err != nil {
		return nil, fmt.Errorf("failed to get wallet: %w", err)
	}
	if w == nil {
		return nil, errors.ErrWalletNotFound
	}

	// Verify wallet belongs to user
	if w.UserID != userID {
		return nil, errors.ErrForbidden
	}

	// Check wallet has sufficient balance
	if w.Balance < input.Amount {
		return nil, errors.ErrInsufficientBalance
	}

	// Get festival refund config
	config := s.GetFestivalConfig(w.FestivalID)

	// Check refund policy
	if config.Policy == RefundPolicyNone {
		return nil, errors.New("REFUND_NOT_ALLOWED", "Refunds are not allowed for this festival")
	}

	// Validate amount against config
	if input.Amount < config.MinAmount {
		return nil, errors.New("AMOUNT_TOO_LOW", fmt.Sprintf("Minimum refund amount is %d cents", config.MinAmount))
	}
	if config.MaxAmount > 0 && input.Amount > config.MaxAmount {
		return nil, errors.New("AMOUNT_TOO_HIGH", fmt.Sprintf("Maximum refund amount is %d cents", config.MaxAmount))
	}

	// Check for existing pending refund on this wallet
	existingRefunds, err := s.repo.GetRefundsByWallet(ctx, input.WalletID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing refunds: %w", err)
	}
	for _, r := range existingRefunds {
		if r.Status == RefundStatusPending || r.Status == RefundStatusApproved || r.Status == RefundStatusProcessing {
			return nil, errors.New("REFUND_IN_PROGRESS", "A refund is already in progress for this wallet")
		}
	}

	// Calculate refund amount after fees
	fee, netAmount := s.CalculateRefundAmount(input.Amount, config.FeePercentage)

	// Validate bank details
	if input.BankDetails.IBAN == "" || input.BankDetails.AccountHolder == "" {
		return nil, errors.New("INVALID_BANK_DETAILS", "IBAN and account holder are required")
	}

	now := time.Now()
	refund := &RefundRequest{
		ID:          uuid.New(),
		WalletID:    input.WalletID,
		UserID:      userID,
		FestivalID:  w.FestivalID,
		Amount:      input.Amount,
		NetAmount:   netAmount,
		Fee:         fee,
		Reason:      input.Reason,
		BankDetails: input.BankDetails,
		Status:      RefundStatusPending,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	// For auto policy, automatically approve the refund
	if config.Policy == RefundPolicyAuto {
		refund.Status = RefundStatusApproved
	}

	if err := s.repo.Create(ctx, refund); err != nil {
		return nil, fmt.Errorf("failed to create refund request: %w", err)
	}

	return refund, nil
}

// ApproveRefund approves a pending refund request (admin action)
func (s *Service) ApproveRefund(ctx context.Context, refundID uuid.UUID, adminID uuid.UUID, input ApproveRefundInput) (*RefundRequest, error) {
	refund, err := s.repo.GetByID(ctx, refundID)
	if err != nil {
		return nil, err
	}
	if refund == nil {
		return nil, errors.ErrNotFound
	}

	if refund.Status != RefundStatusPending {
		return nil, errors.New("INVALID_STATUS", "Only pending refunds can be approved")
	}

	now := time.Now()
	updates := map[string]interface{}{
		"processed_by": adminID,
		"updated_at":   now,
	}

	if err := s.repo.UpdateStatus(ctx, refundID, RefundStatusApproved, updates); err != nil {
		return nil, err
	}

	refund.Status = RefundStatusApproved
	refund.ProcessedBy = &adminID
	refund.UpdatedAt = now

	return refund, nil
}

// RejectRefund rejects a pending refund request (admin action)
func (s *Service) RejectRefund(ctx context.Context, refundID uuid.UUID, adminID uuid.UUID, input RejectRefundInput) (*RefundRequest, error) {
	refund, err := s.repo.GetByID(ctx, refundID)
	if err != nil {
		return nil, err
	}
	if refund == nil {
		return nil, errors.ErrNotFound
	}

	if refund.Status != RefundStatusPending && refund.Status != RefundStatusApproved {
		return nil, errors.New("INVALID_STATUS", "This refund cannot be rejected")
	}

	now := time.Now()
	updates := map[string]interface{}{
		"processed_by":   adminID,
		"rejection_note": input.Reason,
		"processed_at":   now,
		"updated_at":     now,
	}

	if err := s.repo.UpdateStatus(ctx, refundID, RefundStatusRejected, updates); err != nil {
		return nil, err
	}

	refund.Status = RefundStatusRejected
	refund.ProcessedBy = &adminID
	refund.RejectionNote = input.Reason
	refund.ProcessedAt = &now
	refund.UpdatedAt = now

	return refund, nil
}

// ProcessRefund processes an approved refund (via Stripe or bank transfer)
func (s *Service) ProcessRefund(ctx context.Context, refundID uuid.UUID, adminID uuid.UUID, input ProcessRefundInput) (*RefundRequest, error) {
	refund, err := s.repo.GetByID(ctx, refundID)
	if err != nil {
		return nil, err
	}
	if refund == nil {
		return nil, errors.ErrNotFound
	}

	if refund.Status != RefundStatusApproved {
		return nil, errors.New("INVALID_STATUS", "Only approved refunds can be processed")
	}

	// Update status to processing
	now := time.Now()
	updates := map[string]interface{}{
		"payment_method": input.PaymentMethod,
		"updated_at":     now,
	}

	if err := s.repo.UpdateStatus(ctx, refundID, RefundStatusProcessing, updates); err != nil {
		return nil, err
	}

	// Get the wallet to deduct the balance
	w, err := s.walletRepo.GetWalletByID(ctx, refund.WalletID)
	if err != nil {
		return nil, fmt.Errorf("failed to get wallet: %w", err)
	}
	if w == nil {
		return nil, errors.ErrWalletNotFound
	}

	// Verify wallet still has sufficient balance
	if w.Balance < refund.Amount {
		// Rollback status
		s.repo.UpdateStatus(ctx, refundID, RefundStatusApproved, map[string]interface{}{"updated_at": time.Now()})
		return nil, errors.ErrInsufficientBalance
	}

	// Process based on payment method
	var stripeRefundID string
	switch input.PaymentMethod {
	case "stripe":
		// In production, this would call Stripe API
		// stripeRefund, err := stripe.Refunds.New(&stripe.RefundParams{...})
		stripeRefundID = input.StripeRefundID
		if stripeRefundID == "" {
			// Simulate Stripe refund ID for now
			stripeRefundID = "re_" + uuid.New().String()[:24]
		}
	case "bank_transfer":
		// In production, this would initiate a bank transfer
		// For now, we just mark it as processed
	}

	// Deduct from wallet balance
	w.Balance -= refund.Amount
	w.UpdatedAt = time.Now()
	if err := s.walletRepo.UpdateWallet(ctx, w); err != nil {
		// Rollback status
		s.repo.UpdateStatus(ctx, refundID, RefundStatusApproved, map[string]interface{}{"updated_at": time.Now()})
		return nil, fmt.Errorf("failed to update wallet balance: %w", err)
	}

	// Create a cash out transaction
	tx := &wallet.Transaction{
		ID:            uuid.New(),
		WalletID:      w.ID,
		Type:          wallet.TransactionTypeCashOut,
		Amount:        -refund.Amount,
		BalanceBefore: w.Balance + refund.Amount,
		BalanceAfter:  w.Balance,
		Reference:     refund.ID.String(),
		Metadata: wallet.TransactionMeta{
			Description:   "Refund processed",
			PaymentMethod: input.PaymentMethod,
		},
		Status:    wallet.TransactionStatusCompleted,
		CreatedAt: time.Now(),
	}
	if err := s.walletRepo.CreateTransaction(ctx, tx); err != nil {
		return nil, fmt.Errorf("failed to create transaction: %w", err)
	}

	// Mark refund as completed
	completedAt := time.Now()
	completedUpdates := map[string]interface{}{
		"stripe_refund_id": stripeRefundID,
		"processed_by":     adminID,
		"processed_at":     completedAt,
		"updated_at":       completedAt,
	}

	if err := s.repo.UpdateStatus(ctx, refundID, RefundStatusCompleted, completedUpdates); err != nil {
		return nil, err
	}

	refund.Status = RefundStatusCompleted
	refund.PaymentMethod = input.PaymentMethod
	refund.StripeRefundID = stripeRefundID
	refund.ProcessedBy = &adminID
	refund.ProcessedAt = &completedAt
	refund.UpdatedAt = completedAt

	return refund, nil
}

// AutoProcessRefunds automatically processes all approved refunds for festivals with auto policy
func (s *Service) AutoProcessRefunds(ctx context.Context) (int, error) {
	processed := 0

	// Get all approved refunds
	offset := 0
	limit := 100

	for {
		refunds, total, err := s.repo.List(ctx, offset, limit)
		if err != nil {
			return processed, fmt.Errorf("failed to list refunds: %w", err)
		}

		for _, refund := range refunds {
			if refund.Status != RefundStatusApproved {
				continue
			}

			// Check if festival has auto policy
			config := s.GetFestivalConfig(refund.FestivalID)
			if config.Policy != RefundPolicyAuto {
				continue
			}

			// Process the refund
			systemID := uuid.Nil // System processing
			_, err := s.ProcessRefund(ctx, refund.ID, systemID, ProcessRefundInput{
				PaymentMethod: "bank_transfer",
			})
			if err != nil {
				// Log error but continue processing other refunds
				fmt.Printf("Failed to auto-process refund %s: %v\n", refund.ID, err)
				continue
			}
			processed++
		}

		offset += limit
		if int64(offset) >= total {
			break
		}
	}

	return processed, nil
}

// CalculateRefundAmount calculates the net refund amount after deducting fees
func (s *Service) CalculateRefundAmount(amount int64, feePercentage float64) (fee int64, netAmount int64) {
	if feePercentage <= 0 {
		return 0, amount
	}

	fee = int64(float64(amount) * (feePercentage / 100))
	netAmount = amount - fee
	return fee, netAmount
}

// GetRefund retrieves a refund request by ID
func (s *Service) GetRefund(ctx context.Context, id uuid.UUID) (*RefundRequest, error) {
	refund, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if refund == nil {
		return nil, errors.ErrNotFound
	}
	return refund, nil
}

// GetUserRefunds retrieves all refund requests for a user
func (s *Service) GetUserRefunds(ctx context.Context, userID uuid.UUID, page, perPage int) ([]RefundRequest, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.GetRefundsByUser(ctx, userID, offset, perPage)
}

// GetFestivalRefunds retrieves all refund requests for a festival (admin)
func (s *Service) GetFestivalRefunds(ctx context.Context, festivalID uuid.UUID, status *RefundStatus, page, perPage int) ([]RefundRequest, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.GetRefundsByFestival(ctx, festivalID, status, offset, perPage)
}

// GetPendingRefunds retrieves all pending refund requests
func (s *Service) GetPendingRefunds(ctx context.Context, page, perPage int) ([]RefundRequest, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.GetPendingRefunds(ctx, offset, perPage)
}
