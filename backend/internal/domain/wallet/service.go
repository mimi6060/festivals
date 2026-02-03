package wallet

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

type Service struct {
	repo            Repository
	secretKey       []byte // For QR code signing
	qrExpirySeconds int64  // QR code expiry time in seconds
}

// DefaultQRExpirySeconds is the default QR code expiry time (24 hours)
// This is appropriate for ticket-based QR codes that need to remain valid for the event duration
const DefaultQRExpirySeconds = 86400 // 24 hours

func NewService(repo Repository, secretKey string) *Service {
	return &Service{
		repo:            repo,
		secretKey:       []byte(secretKey),
		qrExpirySeconds: DefaultQRExpirySeconds,
	}
}

// NewServiceWithConfig creates a new service with configurable QR expiry time
func NewServiceWithConfig(repo Repository, secretKey string, qrExpirySeconds int) *Service {
	expiry := int64(qrExpirySeconds)
	if expiry <= 0 {
		expiry = DefaultQRExpirySeconds
	}
	return &Service{
		repo:            repo,
		secretKey:       []byte(secretKey),
		qrExpirySeconds: expiry,
	}
}

// SetQRExpirySeconds allows updating the QR expiry time
func (s *Service) SetQRExpirySeconds(seconds int) {
	if seconds > 0 {
		s.qrExpirySeconds = int64(seconds)
	}
}

// GetOrCreateWallet gets or creates a wallet for a user in a festival
func (s *Service) GetOrCreateWallet(ctx context.Context, userID, festivalID uuid.UUID) (*Wallet, error) {
	wallet, err := s.repo.GetWalletByUserAndFestival(ctx, userID, festivalID)
	if err != nil {
		return nil, err
	}

	if wallet != nil {
		return wallet, nil
	}

	// Create new wallet
	wallet = &Wallet{
		ID:         uuid.New(),
		UserID:     userID,
		FestivalID: festivalID,
		Balance:    0,
		Status:     WalletStatusActive,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := s.repo.CreateWallet(ctx, wallet); err != nil {
		return nil, fmt.Errorf("failed to create wallet: %w", err)
	}

	return wallet, nil
}

// GetWallet gets a wallet by ID
func (s *Service) GetWallet(ctx context.Context, id uuid.UUID) (*Wallet, error) {
	wallet, err := s.repo.GetWalletByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if wallet == nil {
		return nil, errors.ErrNotFound
	}
	return wallet, nil
}

// GetUserWallets gets all wallets for a user
func (s *Service) GetUserWallets(ctx context.Context, userID uuid.UUID) ([]Wallet, error) {
	return s.repo.GetWalletsByUser(ctx, userID)
}

// TopUp adds funds to a wallet using atomic database transaction
func (s *Service) TopUp(ctx context.Context, walletID uuid.UUID, req TopUpRequest, staffID *uuid.UUID) (*Transaction, error) {
	// Use the repository's atomic top-up operation
	tx := &Transaction{
		ID:        uuid.New(),
		WalletID:  walletID,
		Type:      TransactionTypeTopUp,
		Amount:    req.Amount,
		Reference: req.Reference,
		StaffID:   staffID,
		Metadata: TransactionMeta{
			PaymentMethod: req.PaymentMethod,
		},
		Status:    TransactionStatusCompleted,
		CreatedAt: time.Now(),
	}

	if req.PaymentMethod == "cash" {
		tx.Type = TransactionTypeCashIn
	}

	// Execute atomic top-up operation
	if err := s.repo.TopUpAtomic(ctx, walletID, req.Amount, tx); err != nil {
		return nil, err
	}

	return tx, nil
}

// ProcessPayment processes a payment at a stand
func (s *Service) ProcessPayment(ctx context.Context, req PaymentRequest, staffID uuid.UUID) (*Transaction, error) {
	tx := &Transaction{
		ID:       uuid.New(),
		WalletID: req.WalletID,
		Type:     TransactionTypePurchase,
		StandID:  &req.StandID,
		StaffID:  &staffID,
		Metadata: TransactionMeta{
			ProductIDs: req.ProductIDs,
		},
		Status:    TransactionStatusCompleted,
		CreatedAt: time.Now(),
	}

	if err := s.repo.ProcessPayment(ctx, req.WalletID, req.Amount, tx); err != nil {
		return nil, err
	}

	return tx, nil
}

// RefundTransaction refunds a transaction using atomic database transaction
func (s *Service) RefundTransaction(ctx context.Context, transactionID uuid.UUID, reason string, staffID *uuid.UUID) (*Transaction, error) {
	originalTx, err := s.repo.GetTransactionByID(ctx, transactionID)
	if err != nil {
		return nil, err
	}
	if originalTx == nil {
		return nil, errors.ErrNotFound
	}

	if originalTx.Status != TransactionStatusCompleted {
		return nil, fmt.Errorf("transaction cannot be refunded")
	}

	if originalTx.Type != TransactionTypePurchase {
		return nil, fmt.Errorf("only purchases can be refunded")
	}

	// Calculate refund amount (original amount is negative for purchases)
	refundAmount := -originalTx.Amount

	// Create refund transaction (balances will be set atomically by repository)
	refundTx := &Transaction{
		ID:        uuid.New(),
		WalletID:  originalTx.WalletID,
		Type:      TransactionTypeRefund,
		Amount:    refundAmount,
		Reference: transactionID.String(),
		StandID:   originalTx.StandID,
		StaffID:   staffID,
		Metadata: TransactionMeta{
			Description: reason,
		},
		Status:    TransactionStatusCompleted,
		CreatedAt: time.Now(),
	}

	// Execute atomic refund operation
	if err := s.repo.RefundAtomic(ctx, originalTx.WalletID, refundAmount, refundTx, transactionID); err != nil {
		return nil, err
	}

	return refundTx, nil
}

// GetTransactions gets transactions for a wallet
func (s *Service) GetTransactions(ctx context.Context, walletID uuid.UUID, page, perPage int) ([]Transaction, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetTransactionsByWallet(ctx, walletID, offset, perPage)
}

// QRCodePayload represents the data encoded in a wallet QR code
type QRCodePayload struct {
	WalletID   uuid.UUID `json:"w"`
	FestivalID uuid.UUID `json:"f"`
	Timestamp  int64     `json:"t"`
	Signature  string    `json:"s"`
}

// GenerateQRPayload generates a signed QR code payload for a wallet
func (s *Service) GenerateQRPayload(ctx context.Context, walletID uuid.UUID) (string, error) {
	wallet, err := s.repo.GetWalletByID(ctx, walletID)
	if err != nil {
		return "", err
	}
	if wallet == nil {
		return "", errors.ErrNotFound
	}

	payload := QRCodePayload{
		WalletID:   wallet.ID,
		FestivalID: wallet.FestivalID,
		Timestamp:  time.Now().Unix(),
	}

	// Generate signature
	signature := s.signPayload(payload)
	payload.Signature = signature

	// Encode to JSON
	data, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal QR payload: %w", err)
	}

	// Base64 encode for QR code
	return base64.StdEncoding.EncodeToString(data), nil
}

// ValidateQRPayload validates a QR code payload
func (s *Service) ValidateQRPayload(ctx context.Context, encoded string) (*QRCodePayload, error) {
	// Decode base64
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("invalid QR code format")
	}

	// Parse JSON
	var payload QRCodePayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("invalid QR code data")
	}

	// Check timestamp using configurable expiry time
	// Default is 24 hours (86400 seconds), suitable for ticket QR codes
	// that need to remain valid for the duration of an event
	if time.Now().Unix()-payload.Timestamp > s.qrExpirySeconds {
		return nil, fmt.Errorf("QR code expired")
	}

	// Verify signature
	expectedSig := s.signPayload(QRCodePayload{
		WalletID:   payload.WalletID,
		FestivalID: payload.FestivalID,
		Timestamp:  payload.Timestamp,
	})

	if payload.Signature != expectedSig {
		return nil, fmt.Errorf("invalid QR code signature")
	}

	return &payload, nil
}

func (s *Service) signPayload(payload QRCodePayload) string {
	data := fmt.Sprintf("%s:%s:%d", payload.WalletID, payload.FestivalID, payload.Timestamp)
	h := hmac.New(sha256.New, s.secretKey)
	h.Write([]byte(data))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// FreezeWallet freezes a wallet (admin action)
func (s *Service) FreezeWallet(ctx context.Context, walletID uuid.UUID) (*Wallet, error) {
	wallet, err := s.repo.GetWalletByID(ctx, walletID)
	if err != nil {
		return nil, err
	}
	if wallet == nil {
		return nil, errors.ErrNotFound
	}

	wallet.Status = WalletStatusFrozen
	wallet.UpdatedAt = time.Now()

	if err := s.repo.UpdateWallet(ctx, wallet); err != nil {
		return nil, fmt.Errorf("failed to freeze wallet: %w", err)
	}

	return wallet, nil
}

// UnfreezeWallet unfreezes a wallet (admin action)
func (s *Service) UnfreezeWallet(ctx context.Context, walletID uuid.UUID) (*Wallet, error) {
	wallet, err := s.repo.GetWalletByID(ctx, walletID)
	if err != nil {
		return nil, err
	}
	if wallet == nil {
		return nil, errors.ErrNotFound
	}

	wallet.Status = WalletStatusActive
	wallet.UpdatedAt = time.Now()

	if err := s.repo.UpdateWallet(ctx, wallet); err != nil {
		return nil, fmt.Errorf("failed to unfreeze wallet: %w", err)
	}

	return wallet, nil
}

// TopUpFromPayment adds funds to a wallet from a successful Stripe payment
// This method is called by the payment service when a payment is confirmed
// Uses atomic database transaction to ensure consistency
func (s *Service) TopUpFromPayment(ctx context.Context, walletID uuid.UUID, amount int64, reference string) error {
	// Create transaction (balances will be set atomically by repository)
	tx := &Transaction{
		ID:        uuid.New(),
		WalletID:  walletID,
		Type:      TransactionTypeTopUp,
		Amount:    amount,
		Reference: reference,
		Metadata: TransactionMeta{
			PaymentMethod: "stripe",
			Description:   "Stripe payment: " + reference,
		},
		Status:    TransactionStatusCompleted,
		CreatedAt: time.Now(),
	}

	// Execute atomic top-up operation
	return s.repo.TopUpAtomic(ctx, walletID, amount, tx)
}
