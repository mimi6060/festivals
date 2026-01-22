package nfc

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

const (
	// Default offline token validity period (15 minutes)
	DefaultOfflineTokenValidity = 15 * time.Minute
	// Default maximum offline transaction amount (50 EUR = 5000 cents)
	DefaultMaxOfflineAmount = 5000
)

type Service struct {
	repo             Repository
	walletRepo       wallet.Repository
	secretKey        []byte
	offlineValidity  time.Duration
	maxOfflineAmount int64
}

func NewService(repo Repository, walletRepo wallet.Repository, secretKey string) *Service {
	return &Service{
		repo:             repo,
		walletRepo:       walletRepo,
		secretKey:        []byte(secretKey),
		offlineValidity:  DefaultOfflineTokenValidity,
		maxOfflineAmount: DefaultMaxOfflineAmount,
	}
}

// SetOfflineConfig sets the offline transaction configuration
func (s *Service) SetOfflineConfig(validity time.Duration, maxAmount int64) {
	s.offlineValidity = validity
	s.maxOfflineAmount = maxAmount
}

// ActivateTag links an NFC tag to a wallet
func (s *Service) ActivateTag(ctx context.Context, req NFCActivationRequest, staffID *uuid.UUID) (*NFCTag, error) {
	// Check if tag already exists
	existingTag, err := s.repo.GetByUID(ctx, req.UID)
	if err != nil {
		return nil, err
	}

	// Verify wallet exists and belongs to the festival
	walletObj, err := s.walletRepo.GetWalletByID(ctx, req.WalletID)
	if err != nil {
		return nil, err
	}
	if walletObj == nil {
		return nil, errors.ErrWalletNotFound
	}
	if walletObj.FestivalID != req.FestivalID {
		return nil, fmt.Errorf("wallet does not belong to this festival")
	}

	now := time.Now()

	if existingTag != nil {
		// Tag exists - check if it can be activated
		if existingTag.Status == NFCStatusActive {
			return nil, fmt.Errorf("NFC tag is already active")
		}
		if existingTag.Status == NFCStatusBlocked {
			return nil, fmt.Errorf("NFC tag is blocked and cannot be activated")
		}

		// Reactivate the tag
		existingTag.WalletID = &req.WalletID
		existingTag.UserID = &walletObj.UserID
		existingTag.Status = NFCStatusActive
		existingTag.ActivatedAt = &now
		existingTag.UpdatedAt = now

		if err := s.repo.Update(ctx, existingTag); err != nil {
			return nil, fmt.Errorf("failed to activate NFC tag: %w", err)
		}

		return existingTag, nil
	}

	// Create new tag
	tag := &NFCTag{
		ID:          uuid.New(),
		UID:         req.UID,
		WalletID:    &req.WalletID,
		UserID:      &walletObj.UserID,
		FestivalID:  req.FestivalID,
		Status:      NFCStatusActive,
		ActivatedAt: &now,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Create(ctx, tag); err != nil {
		return nil, fmt.Errorf("failed to create NFC tag: %w", err)
	}

	return tag, nil
}

// DeactivateTag unlinks an NFC tag from its wallet
func (s *Service) DeactivateTag(ctx context.Context, uid string) (*NFCTag, error) {
	tag, err := s.repo.GetByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if tag == nil {
		return nil, errors.ErrNotFound
	}

	if tag.Status != NFCStatusActive {
		return nil, fmt.Errorf("NFC tag is not active")
	}

	tag.WalletID = nil
	tag.UserID = nil
	tag.Status = NFCStatusUnassigned
	tag.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, tag); err != nil {
		return nil, fmt.Errorf("failed to deactivate NFC tag: %w", err)
	}

	return tag, nil
}

// BlockTag blocks an NFC tag (lost/stolen/suspicious activity)
func (s *Service) BlockTag(ctx context.Context, uid string, req NFCBlockRequest) (*NFCTag, error) {
	tag, err := s.repo.GetByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if tag == nil {
		return nil, errors.ErrNotFound
	}

	if tag.Status == NFCStatusBlocked {
		return nil, fmt.Errorf("NFC tag is already blocked")
	}

	now := time.Now()
	tag.Status = NFCStatusBlocked
	tag.BlockedAt = &now
	tag.BlockReason = req.Reason
	tag.UpdatedAt = now

	if err := s.repo.Update(ctx, tag); err != nil {
		return nil, fmt.Errorf("failed to block NFC tag: %w", err)
	}

	return tag, nil
}

// UnblockTag unblocks a previously blocked NFC tag
func (s *Service) UnblockTag(ctx context.Context, uid string) (*NFCTag, error) {
	tag, err := s.repo.GetByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if tag == nil {
		return nil, errors.ErrNotFound
	}

	if tag.Status != NFCStatusBlocked && tag.Status != NFCStatusLost {
		return nil, fmt.Errorf("NFC tag is not blocked")
	}

	// Restore to active if it has a wallet, otherwise unassigned
	if tag.WalletID != nil {
		tag.Status = NFCStatusActive
	} else {
		tag.Status = NFCStatusUnassigned
	}
	tag.BlockedAt = nil
	tag.BlockReason = ""
	tag.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, tag); err != nil {
		return nil, fmt.Errorf("failed to unblock NFC tag: %w", err)
	}

	return tag, nil
}

// TransferTag transfers an NFC tag to a new wallet
func (s *Service) TransferTag(ctx context.Context, uid string, req NFCTransferRequest) (*NFCTag, error) {
	tag, err := s.repo.GetByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if tag == nil {
		return nil, errors.ErrNotFound
	}

	if tag.Status == NFCStatusBlocked {
		return nil, fmt.Errorf("cannot transfer a blocked NFC tag")
	}

	// Verify new wallet exists and belongs to the same festival
	newWallet, err := s.walletRepo.GetWalletByID(ctx, req.NewWalletID)
	if err != nil {
		return nil, err
	}
	if newWallet == nil {
		return nil, errors.ErrWalletNotFound
	}
	if newWallet.FestivalID != tag.FestivalID {
		return nil, fmt.Errorf("new wallet does not belong to the same festival")
	}

	now := time.Now()
	tag.WalletID = &req.NewWalletID
	tag.UserID = &newWallet.UserID
	tag.Status = NFCStatusActive
	tag.ActivatedAt = &now
	tag.UpdatedAt = now

	if err := s.repo.Update(ctx, tag); err != nil {
		return nil, fmt.Errorf("failed to transfer NFC tag: %w", err)
	}

	return tag, nil
}

// GetTag retrieves an NFC tag by its UID
func (s *Service) GetTag(ctx context.Context, uid string) (*NFCTag, error) {
	tag, err := s.repo.GetByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if tag == nil {
		return nil, errors.ErrNotFound
	}
	return tag, nil
}

// GetTagsByWallet retrieves all NFC tags linked to a wallet
func (s *Service) GetTagsByWallet(ctx context.Context, walletID uuid.UUID) ([]NFCTag, error) {
	return s.repo.GetByWallet(ctx, walletID)
}

// ListFestivalTags retrieves all NFC tags for a festival with pagination
func (s *Service) ListFestivalTags(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]NFCTag, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListByFestival(ctx, festivalID, offset, perPage)
}

// GetActiveTags retrieves all active NFC tags for a festival
func (s *Service) GetActiveTags(ctx context.Context, festivalID uuid.UUID) ([]NFCTag, error) {
	return s.repo.GetActiveTags(ctx, festivalID)
}

// ValidateTagForPayment validates if an NFC tag can be used for payment
func (s *Service) ValidateTagForPayment(ctx context.Context, uid string, amount int64) (*NFCValidationResponse, error) {
	tag, err := s.repo.GetByUID(ctx, uid)
	if err != nil {
		return nil, err
	}

	response := &NFCValidationResponse{
		Valid: false,
	}

	if tag == nil {
		response.Message = "NFC tag not found"
		return response, nil
	}

	response.Status = tag.Status

	if tag.Status != NFCStatusActive {
		response.Message = fmt.Sprintf("NFC tag is %s", tag.Status)
		return response, nil
	}

	if tag.WalletID == nil {
		response.Message = "NFC tag is not linked to a wallet"
		return response, nil
	}

	// Get wallet to check balance
	walletObj, err := s.walletRepo.GetWalletByID(ctx, *tag.WalletID)
	if err != nil {
		return nil, err
	}
	if walletObj == nil {
		response.Message = "Linked wallet not found"
		return response, nil
	}

	if walletObj.Status != wallet.WalletStatusActive {
		response.Message = "Wallet is not active"
		return response, nil
	}

	if walletObj.Balance < amount {
		response.WalletID = tag.WalletID
		response.Balance = walletObj.Balance
		response.Message = "Insufficient balance"
		return response, nil
	}

	// Tag is valid for payment
	response.Valid = true
	response.WalletID = tag.WalletID
	response.Balance = walletObj.Balance
	response.Message = "OK"

	return response, nil
}

// GenerateOfflineToken generates a signed token for offline transactions
func (s *Service) GenerateOfflineToken(ctx context.Context, uid string) (*OfflineTokenResponse, error) {
	tag, err := s.repo.GetByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if tag == nil {
		return nil, errors.ErrNotFound
	}

	if tag.Status != NFCStatusActive {
		return nil, fmt.Errorf("NFC tag is not active")
	}

	if tag.WalletID == nil {
		return nil, fmt.Errorf("NFC tag is not linked to a wallet")
	}

	// Get wallet balance
	walletObj, err := s.walletRepo.GetWalletByID(ctx, *tag.WalletID)
	if err != nil {
		return nil, err
	}
	if walletObj == nil {
		return nil, errors.ErrWalletNotFound
	}

	validUntil := time.Now().Add(s.offlineValidity)

	// Calculate max offline amount (minimum of configured max and current balance)
	maxAmount := s.maxOfflineAmount
	if walletObj.Balance < maxAmount {
		maxAmount = walletObj.Balance
	}

	token := OfflineToken{
		WalletID:   *tag.WalletID,
		FestivalID: tag.FestivalID,
		NFCUID:     tag.UID,
		MaxAmount:  maxAmount,
		Balance:    walletObj.Balance,
		ValidUntil: validUntil.Unix(),
	}

	// Generate signature
	token.Signature = s.signToken(token)

	// Encode to JSON then base64
	tokenJSON, err := json.Marshal(token)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal offline token: %w", err)
	}

	encodedToken := base64.StdEncoding.EncodeToString(tokenJSON)

	return &OfflineTokenResponse{
		Token:      encodedToken,
		ValidUntil: validUntil,
		MaxAmount:  maxAmount,
	}, nil
}

// ValidateOfflineToken validates an offline token
func (s *Service) ValidateOfflineToken(ctx context.Context, encodedToken string) (*OfflineToken, error) {
	// Decode base64
	tokenJSON, err := base64.StdEncoding.DecodeString(encodedToken)
	if err != nil {
		return nil, fmt.Errorf("invalid token format")
	}

	// Parse JSON
	var token OfflineToken
	if err := json.Unmarshal(tokenJSON, &token); err != nil {
		return nil, fmt.Errorf("invalid token data")
	}

	// Check expiration
	if time.Now().Unix() > token.ValidUntil {
		return nil, fmt.Errorf("token expired")
	}

	// Verify signature
	expectedSig := s.signToken(OfflineToken{
		WalletID:   token.WalletID,
		FestivalID: token.FestivalID,
		NFCUID:     token.NFCUID,
		MaxAmount:  token.MaxAmount,
		Balance:    token.Balance,
		ValidUntil: token.ValidUntil,
	})

	if token.Signature != expectedSig {
		return nil, fmt.Errorf("invalid token signature")
	}

	return &token, nil
}

func (s *Service) signToken(token OfflineToken) string {
	data := fmt.Sprintf("%s:%s:%s:%d:%d:%d",
		token.WalletID, token.FestivalID, token.NFCUID,
		token.MaxAmount, token.Balance, token.ValidUntil)
	h := hmac.New(sha256.New, s.secretKey)
	h.Write([]byte(data))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// RegisterTag registers a new NFC tag without activating it
func (s *Service) RegisterTag(ctx context.Context, uid string, festivalID uuid.UUID) (*NFCTag, error) {
	// Check if tag already exists
	existingTag, err := s.repo.GetByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if existingTag != nil {
		return nil, errors.ErrAlreadyExists
	}

	now := time.Now()
	tag := &NFCTag{
		ID:         uuid.New(),
		UID:        uid,
		FestivalID: festivalID,
		Status:     NFCStatusUnassigned,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := s.repo.Create(ctx, tag); err != nil {
		return nil, fmt.Errorf("failed to register NFC tag: %w", err)
	}

	return tag, nil
}

// BulkRegisterTags registers multiple NFC tags at once
func (s *Service) BulkRegisterTags(ctx context.Context, uids []string, festivalID uuid.UUID) ([]NFCTag, error) {
	now := time.Now()
	tags := make([]NFCTag, len(uids))

	for i, uid := range uids {
		tags[i] = NFCTag{
			ID:         uuid.New(),
			UID:        uid,
			FestivalID: festivalID,
			Status:     NFCStatusUnassigned,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
	}

	for _, tag := range tags {
		if err := s.repo.Create(ctx, &tag); err != nil {
			return nil, fmt.Errorf("failed to register NFC tag %s: %w", tag.UID, err)
		}
	}

	return tags, nil
}

// SyncOfflineTransaction syncs an offline transaction to the server
func (s *Service) SyncOfflineTransaction(ctx context.Context, tx *NFCTransaction) error {
	// Validate the offline token
	_, err := s.ValidateOfflineToken(ctx, tx.OfflineToken)
	if err != nil {
		tx.Status = NFCTransactionStatusRejected
		if createErr := s.repo.CreateTransaction(ctx, tx); createErr != nil {
			return fmt.Errorf("failed to record rejected transaction: %w", createErr)
		}
		return fmt.Errorf("invalid offline token: %w", err)
	}

	// Verify the NFC tag is still valid
	tag, err := s.repo.GetByUID(ctx, tx.NFCUID)
	if err != nil {
		return err
	}
	if tag == nil || tag.Status != NFCStatusActive {
		tx.Status = NFCTransactionStatusFailed
		if createErr := s.repo.CreateTransaction(ctx, tx); createErr != nil {
			return fmt.Errorf("failed to record failed transaction: %w", createErr)
		}
		return fmt.Errorf("NFC tag is no longer valid")
	}

	// Record the transaction for processing by wallet service
	tx.Status = NFCTransactionStatusPendingSync
	if err := s.repo.CreateTransaction(ctx, tx); err != nil {
		return fmt.Errorf("failed to create offline transaction: %w", err)
	}

	return nil
}

// ActivateBracelet activates a bracelet and links it to a wallet and user
func (s *Service) ActivateBracelet(ctx context.Context, uid string, userID, walletID uuid.UUID, staffID *uuid.UUID) (*NFCBracelet, error) {
	// Check if bracelet exists
	bracelet, err := s.repo.GetBraceletByUID(ctx, uid)
	if err != nil {
		return nil, err
	}

	// Verify wallet exists and get festival ID
	walletObj, err := s.walletRepo.GetWalletByID(ctx, walletID)
	if err != nil {
		return nil, err
	}
	if walletObj == nil {
		return nil, errors.ErrWalletNotFound
	}

	now := time.Now()

	if bracelet != nil {
		// Bracelet exists - check if it can be activated
		if bracelet.Status == NFCBraceletStatusActive {
			return nil, fmt.Errorf("bracelet is already active")
		}
		if bracelet.Status == NFCBraceletStatusBlocked {
			return nil, fmt.Errorf("bracelet is blocked and cannot be activated")
		}

		// Reactivate the bracelet
		bracelet.WalletID = &walletID
		bracelet.UserID = &userID
		bracelet.Status = NFCBraceletStatusActive
		bracelet.ActivatedAt = &now
		bracelet.ActivatedBy = staffID
		bracelet.UpdatedAt = now

		if err := s.repo.UpdateBracelet(ctx, bracelet); err != nil {
			return nil, fmt.Errorf("failed to activate bracelet: %w", err)
		}

		// Update batch counts if bracelet belongs to a batch
		if bracelet.BatchID != nil {
			_ = s.repo.UpdateBatchCounts(ctx, *bracelet.BatchID)
		}

		return bracelet, nil
	}

	// Create new bracelet
	bracelet = &NFCBracelet{
		ID:          uuid.New(),
		UID:         uid,
		WalletID:    &walletID,
		UserID:      &userID,
		FestivalID:  walletObj.FestivalID,
		Status:      NFCBraceletStatusActive,
		ActivatedAt: &now,
		ActivatedBy: staffID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.CreateBracelet(ctx, bracelet); err != nil {
		return nil, fmt.Errorf("failed to create bracelet: %w", err)
	}

	return bracelet, nil
}

// DeactivateBracelet deactivates a bracelet
func (s *Service) DeactivateBracelet(ctx context.Context, uid string) (*NFCBracelet, error) {
	bracelet, err := s.repo.GetBraceletByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if bracelet == nil {
		return nil, errors.ErrNotFound
	}

	if bracelet.Status != NFCBraceletStatusActive {
		return nil, fmt.Errorf("bracelet is not active")
	}

	bracelet.WalletID = nil
	bracelet.UserID = nil
	bracelet.Status = NFCBraceletStatusUnassigned
	bracelet.UpdatedAt = time.Now()

	if err := s.repo.UpdateBracelet(ctx, bracelet); err != nil {
		return nil, fmt.Errorf("failed to deactivate bracelet: %w", err)
	}

	// Update batch counts if bracelet belongs to a batch
	if bracelet.BatchID != nil {
		_ = s.repo.UpdateBatchCounts(ctx, *bracelet.BatchID)
	}

	return bracelet, nil
}

// GetBraceletInfo retrieves detailed information about a bracelet
func (s *Service) GetBraceletInfo(ctx context.Context, uid string) (*NFCBraceletInfo, error) {
	bracelet, err := s.repo.GetBraceletByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if bracelet == nil {
		return nil, errors.ErrNotFound
	}

	info := &NFCBraceletInfo{
		Bracelet: bracelet.ToResponse(),
		IsActive: bracelet.Status == NFCBraceletStatusActive,
	}

	// Get wallet balance if bracelet is linked
	if bracelet.WalletID != nil {
		walletObj, err := s.walletRepo.GetWalletByID(ctx, *bracelet.WalletID)
		if err == nil && walletObj != nil {
			info.WalletBalance = walletObj.Balance
		}
	}

	// Get transaction stats
	txCount, err := s.repo.GetBraceletTransactionCount(ctx, uid)
	if err == nil {
		info.TransactionCount = txCount
	}

	totalSpent, err := s.repo.GetBraceletTotalSpent(ctx, uid)
	if err == nil {
		info.TotalSpent = totalSpent
	}

	// Get last transaction
	transactions, _, err := s.repo.GetTransactionsByBracelet(ctx, uid, 0, 1)
	if err == nil && len(transactions) > 0 {
		info.LastTransaction = &transactions[0].ProcessedAt
	}

	return info, nil
}

// ProcessNFCPayment processes a payment using an NFC bracelet
func (s *Service) ProcessNFCPayment(ctx context.Context, uid string, amount int64, standID *uuid.UUID, staffID *uuid.UUID, deviceID string) (*NFCPaymentResponse, error) {
	// Get bracelet
	bracelet, err := s.repo.GetBraceletByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if bracelet == nil {
		return &NFCPaymentResponse{
			Success: false,
			Message: "Bracelet not found",
		}, nil
	}

	if bracelet.Status != NFCBraceletStatusActive {
		return &NFCPaymentResponse{
			Success: false,
			Message: fmt.Sprintf("Bracelet is %s", bracelet.Status),
		}, nil
	}

	if bracelet.WalletID == nil {
		return &NFCPaymentResponse{
			Success: false,
			Message: "Bracelet is not linked to a wallet",
		}, nil
	}

	// Get wallet
	walletObj, err := s.walletRepo.GetWalletByID(ctx, *bracelet.WalletID)
	if err != nil {
		return nil, err
	}
	if walletObj == nil {
		return &NFCPaymentResponse{
			Success: false,
			Message: "Wallet not found",
		}, nil
	}

	// Check balance
	if walletObj.Balance < amount {
		return &NFCPaymentResponse{
			Success:    false,
			NewBalance: walletObj.Balance,
			Message:    "Insufficient balance",
		}, nil
	}

	// Create NFC transaction record
	now := time.Now()
	nfcTx := &NFCTransaction{
		ID:          uuid.New(),
		NFCUID:      uid,
		WalletID:    *bracelet.WalletID,
		FestivalID:  bracelet.FestivalID,
		Amount:      -amount, // Negative for payments
		StandID:     standID,
		StaffID:     staffID,
		DeviceID:    deviceID,
		ProcessedAt: now,
		Status:      NFCTransactionStatusSynced,
		CreatedAt:   now,
	}

	if err := s.repo.CreateTransaction(ctx, nfcTx); err != nil {
		return nil, fmt.Errorf("failed to create NFC transaction: %w", err)
	}

	// Deduct from wallet (in a real implementation, this would use wallet service)
	newBalance := walletObj.Balance - amount

	// Update bracelet last used
	bracelet.LastUsedAt = &now
	bracelet.UpdatedAt = now
	_ = s.repo.UpdateBracelet(ctx, bracelet)

	return &NFCPaymentResponse{
		Success:       true,
		TransactionID: &nfcTx.ID,
		NewBalance:    newBalance,
		Message:       "Payment successful",
	}, nil
}

// BatchActivate activates multiple bracelets for a festival
func (s *Service) BatchActivate(ctx context.Context, uids []string, festivalID uuid.UUID, staffID uuid.UUID) ([]NFCBracelet, error) {
	now := time.Now()
	bracelets := make([]NFCBracelet, 0, len(uids))

	for _, uid := range uids {
		// Check if bracelet already exists
		existing, err := s.repo.GetBraceletByUID(ctx, uid)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			// Skip existing bracelets
			continue
		}

		bracelet := NFCBracelet{
			ID:         uuid.New(),
			UID:        uid,
			FestivalID: festivalID,
			Status:     NFCBraceletStatusUnassigned,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		bracelets = append(bracelets, bracelet)
	}

	if len(bracelets) > 0 {
		if err := s.repo.BulkCreateBracelets(ctx, bracelets); err != nil {
			return nil, fmt.Errorf("failed to bulk create bracelets: %w", err)
		}
	}

	return bracelets, nil
}

// TransferBalance transfers balance from one bracelet to another (for lost/replacement scenarios)
func (s *Service) TransferBalance(ctx context.Context, fromUID, toUID string) (*NFCTransferBalanceResponse, error) {
	// Get source bracelet
	fromBracelet, err := s.repo.GetBraceletByUID(ctx, fromUID)
	if err != nil {
		return nil, err
	}
	if fromBracelet == nil {
		return &NFCTransferBalanceResponse{
			Success: false,
			Message: "Source bracelet not found",
		}, nil
	}

	// Get target bracelet
	toBracelet, err := s.repo.GetBraceletByUID(ctx, toUID)
	if err != nil {
		return nil, err
	}
	if toBracelet == nil {
		return &NFCTransferBalanceResponse{
			Success: false,
			Message: "Target bracelet not found",
		}, nil
	}

	if fromBracelet.WalletID == nil {
		return &NFCTransferBalanceResponse{
			Success: false,
			Message: "Source bracelet has no wallet",
		}, nil
	}

	// Get source wallet balance
	fromWallet, err := s.walletRepo.GetWalletByID(ctx, *fromBracelet.WalletID)
	if err != nil {
		return nil, err
	}
	if fromWallet == nil {
		return &NFCTransferBalanceResponse{
			Success: false,
			Message: "Source wallet not found",
		}, nil
	}

	transferAmount := fromWallet.Balance

	// Link target bracelet to the same wallet
	now := time.Now()
	toBracelet.WalletID = fromBracelet.WalletID
	toBracelet.UserID = fromBracelet.UserID
	toBracelet.Status = NFCBraceletStatusActive
	toBracelet.ActivatedAt = &now
	toBracelet.UpdatedAt = now
	toBracelet.Metadata.ReplacementFor = fromBracelet.UID

	if err := s.repo.UpdateBracelet(ctx, toBracelet); err != nil {
		return nil, fmt.Errorf("failed to update target bracelet: %w", err)
	}

	// Mark source bracelet as replaced
	fromBracelet.Status = NFCBraceletStatusReplaced
	fromBracelet.UpdatedAt = now
	if err := s.repo.UpdateBracelet(ctx, fromBracelet); err != nil {
		return nil, fmt.Errorf("failed to update source bracelet: %w", err)
	}

	// Update batch counts
	if fromBracelet.BatchID != nil {
		_ = s.repo.UpdateBatchCounts(ctx, *fromBracelet.BatchID)
	}
	if toBracelet.BatchID != nil {
		_ = s.repo.UpdateBatchCounts(ctx, *toBracelet.BatchID)
	}

	return &NFCTransferBalanceResponse{
		Success:           true,
		TransferredAmount: transferAmount,
		FromNewBalance:    0,
		ToNewBalance:      transferAmount,
		Message:           "Balance transferred successfully",
	}, nil
}

// CreateBatch creates a new batch of bracelets
func (s *Service) CreateBatch(ctx context.Context, festivalID uuid.UUID, req NFCBatchCreateRequest, staffID uuid.UUID) (*NFCBatch, error) {
	now := time.Now()

	// Create the batch
	batch := &NFCBatch{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		Name:        req.Name,
		Description: req.Description,
		TotalCount:  len(req.UIDs),
		Status:      NFCBatchStatusPending,
		ImportedBy:  staffID,
		ImportedAt:  now,
		Notes:       req.Notes,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.CreateBatch(ctx, batch); err != nil {
		return nil, fmt.Errorf("failed to create batch: %w", err)
	}

	// Create bracelets for the batch
	bracelets := make([]NFCBracelet, 0, len(req.UIDs))
	for _, uid := range req.UIDs {
		bracelet := NFCBracelet{
			ID:         uuid.New(),
			UID:        uid,
			FestivalID: festivalID,
			BatchID:    &batch.ID,
			Status:     NFCBraceletStatusUnassigned,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		bracelets = append(bracelets, bracelet)
	}

	if err := s.repo.BulkCreateBracelets(ctx, bracelets); err != nil {
		return nil, fmt.Errorf("failed to create bracelets for batch: %w", err)
	}

	return batch, nil
}

// GetBatch retrieves a batch by ID
func (s *Service) GetBatch(ctx context.Context, id uuid.UUID) (*NFCBatch, error) {
	batch, err := s.repo.GetBatchByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if batch == nil {
		return nil, errors.ErrNotFound
	}
	return batch, nil
}

// ListBatches lists batches for a festival
func (s *Service) ListBatches(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]NFCBatch, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListBatchesByFestival(ctx, festivalID, offset, perPage)
}

// ActivateBatch activates a batch (marks it as active)
func (s *Service) ActivateBatch(ctx context.Context, batchID uuid.UUID) (*NFCBatch, error) {
	batch, err := s.repo.GetBatchByID(ctx, batchID)
	if err != nil {
		return nil, err
	}
	if batch == nil {
		return nil, errors.ErrNotFound
	}

	if batch.Status != NFCBatchStatusPending {
		return nil, fmt.Errorf("batch is not in pending status")
	}

	now := time.Now()
	batch.Status = NFCBatchStatusActive
	batch.ActivatedAt = &now
	batch.UpdatedAt = now

	if err := s.repo.UpdateBatch(ctx, batch); err != nil {
		return nil, fmt.Errorf("failed to activate batch: %w", err)
	}

	return batch, nil
}

// GetNFCStats retrieves NFC statistics for a festival
func (s *Service) GetNFCStats(ctx context.Context, festivalID uuid.UUID) (*NFCStats, error) {
	return s.repo.GetFestivalNFCStats(ctx, festivalID)
}

// ListBracelets lists bracelets for a festival
func (s *Service) ListBracelets(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]NFCBracelet, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.ListBraceletsByFestival(ctx, festivalID, offset, perPage)
}

// GetBraceletTransactions retrieves transactions for a bracelet
func (s *Service) GetBraceletTransactions(ctx context.Context, uid string, page, perPage int) ([]NFCTransaction, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetTransactionsByBracelet(ctx, uid, offset, perPage)
}

// BlockBracelet blocks a bracelet
func (s *Service) BlockBracelet(ctx context.Context, uid string, reason string) (*NFCBracelet, error) {
	bracelet, err := s.repo.GetBraceletByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if bracelet == nil {
		return nil, errors.ErrNotFound
	}

	if bracelet.Status == NFCBraceletStatusBlocked {
		return nil, fmt.Errorf("bracelet is already blocked")
	}

	now := time.Now()
	bracelet.Status = NFCBraceletStatusBlocked
	bracelet.BlockedAt = &now
	bracelet.BlockReason = reason
	bracelet.UpdatedAt = now

	if err := s.repo.UpdateBracelet(ctx, bracelet); err != nil {
		return nil, fmt.Errorf("failed to block bracelet: %w", err)
	}

	// Update batch counts
	if bracelet.BatchID != nil {
		_ = s.repo.UpdateBatchCounts(ctx, *bracelet.BatchID)
	}

	return bracelet, nil
}

// ReportLost reports a bracelet as lost
func (s *Service) ReportLost(ctx context.Context, uid string) (*NFCBracelet, error) {
	bracelet, err := s.repo.GetBraceletByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if bracelet == nil {
		return nil, errors.ErrNotFound
	}

	now := time.Now()
	bracelet.Status = NFCBraceletStatusLost
	bracelet.BlockedAt = &now
	bracelet.BlockReason = "Reported as lost"
	bracelet.UpdatedAt = now

	if err := s.repo.UpdateBracelet(ctx, bracelet); err != nil {
		return nil, fmt.Errorf("failed to report bracelet as lost: %w", err)
	}

	// Update batch counts
	if bracelet.BatchID != nil {
		_ = s.repo.UpdateBatchCounts(ctx, *bracelet.BatchID)
	}

	return bracelet, nil
}
