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
