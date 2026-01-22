package sync

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

type Service struct {
	repo          Repository
	walletRepo    wallet.Repository
	secretKey     []byte
	maxBatchAge   time.Duration // Maximum age for offline transactions
}

func NewService(repo Repository, walletRepo wallet.Repository, secretKey string) *Service {
	return &Service{
		repo:        repo,
		walletRepo:  walletRepo,
		secretKey:   []byte(secretKey),
		maxBatchAge: 24 * time.Hour, // Default: 24 hours
	}
}

// SetMaxBatchAge sets the maximum age for offline transactions
func (s *Service) SetMaxBatchAge(duration time.Duration) {
	s.maxBatchAge = duration
}

// ProcessSyncBatch processes a batch of offline transactions
func (s *Service) ProcessSyncBatch(ctx context.Context, req SubmitBatchRequest) (*SyncResult, error) {
	// Create the batch
	batch := &SyncBatch{
		ID:           uuid.New(),
		DeviceID:     req.DeviceID,
		FestivalID:   req.FestivalID,
		Transactions: req.Transactions,
		Status:       SyncStatusPending,
		CreatedAt:    time.Now(),
	}

	if err := s.repo.CreateBatch(ctx, batch); err != nil {
		return nil, fmt.Errorf("failed to create batch: %w", err)
	}

	// Update status to processing
	if err := s.repo.UpdateBatchStatus(ctx, batch.ID, SyncStatusProcessing, nil); err != nil {
		return nil, fmt.Errorf("failed to update batch status: %w", err)
	}

	// Process each transaction
	result := &SyncResult{
		BatchID:    batch.ID,
		TotalCount: len(req.Transactions),
		Conflicts:  []SyncConflict{},
		Successes:  []SyncSuccess{},
	}

	for _, tx := range req.Transactions {
		// Validate the offline signature
		if err := s.ValidateOfflineSignature(tx); err != nil {
			result.FailedCount++
			result.Conflicts = append(result.Conflicts, SyncConflict{
				LocalID:    tx.LocalID,
				Reason:     fmt.Sprintf("invalid signature: %v", err),
				Resolution: "rejected",
			})
			_ = s.repo.MarkTransactionFailed(ctx, batch.ID, tx.LocalID, err.Error())
			continue
		}

		// Check for duplicate transactions
		isDupe, existingTxID := s.DetectDuplicates(ctx, tx, req.DeviceID)
		if isDupe {
			result.SuccessCount++ // Count as success since it was already processed
			result.Successes = append(result.Successes, SyncSuccess{
				LocalID:    tx.LocalID,
				ServerTxID: *existingTxID,
			})
			continue
		}

		// Validate transaction age
		if time.Since(tx.Timestamp) > s.maxBatchAge {
			result.FailedCount++
			result.Conflicts = append(result.Conflicts, SyncConflict{
				LocalID:    tx.LocalID,
				Reason:     "transaction too old",
				Resolution: "rejected",
			})
			_ = s.repo.MarkTransactionFailed(ctx, batch.ID, tx.LocalID, "transaction exceeds maximum age")
			continue
		}

		// Process the transaction based on type
		serverTxID, err := s.processTransaction(ctx, tx)
		if err != nil {
			result.FailedCount++
			conflict := SyncConflict{
				LocalID: tx.LocalID,
				Reason:  err.Error(),
			}

			// Try to reconcile if possible
			if err == errors.ErrInsufficientBalance {
				reconciled, reconcileErr := s.ReconcileBalance(ctx, tx)
				if reconcileErr == nil && reconciled {
					// Retry after reconciliation
					serverTxID, err = s.processTransaction(ctx, tx)
					if err == nil {
						result.FailedCount--
						result.SuccessCount++
						result.Successes = append(result.Successes, SyncSuccess{
							LocalID:    tx.LocalID,
							ServerTxID: serverTxID,
						})
						_ = s.repo.MarkTransactionProcessed(ctx, batch.ID, tx.LocalID, serverTxID)
						continue
					}
				}
				conflict.Resolution = "insufficient_balance_unresolved"
			}

			result.Conflicts = append(result.Conflicts, conflict)
			_ = s.repo.MarkTransactionFailed(ctx, batch.ID, tx.LocalID, err.Error())
			continue
		}

		result.SuccessCount++
		result.Successes = append(result.Successes, SyncSuccess{
			LocalID:    tx.LocalID,
			ServerTxID: serverTxID,
		})
		_ = s.repo.MarkTransactionProcessed(ctx, batch.ID, tx.LocalID, serverTxID)
	}

	// Determine final status
	if result.FailedCount == 0 {
		result.Status = SyncStatusCompleted
	} else if result.SuccessCount == 0 {
		result.Status = SyncStatusFailed
	} else {
		result.Status = SyncStatusPartial
	}

	result.ProcessedAt = time.Now()

	// Update batch with result
	resultData := &SyncResultData{
		TotalCount:   result.TotalCount,
		SuccessCount: result.SuccessCount,
		FailedCount:  result.FailedCount,
		Conflicts:    result.Conflicts,
		Successes:    result.Successes,
	}
	if err := s.repo.UpdateBatchStatus(ctx, batch.ID, result.Status, resultData); err != nil {
		return nil, fmt.Errorf("failed to update batch result: %w", err)
	}

	return result, nil
}

// processTransaction processes a single offline transaction
func (s *Service) processTransaction(ctx context.Context, tx OfflineTransaction) (uuid.UUID, error) {
	switch tx.Type {
	case TransactionTypePurchase:
		return s.processPurchase(ctx, tx)
	case TransactionTypeRefund:
		return s.processRefund(ctx, tx)
	case TransactionTypeTopUp, TransactionTypeCashIn:
		return s.processTopUp(ctx, tx)
	default:
		return uuid.Nil, fmt.Errorf("unknown transaction type: %s", tx.Type)
	}
}

func (s *Service) processPurchase(ctx context.Context, tx OfflineTransaction) (uuid.UUID, error) {
	walletTx := &wallet.Transaction{
		ID:       uuid.New(),
		WalletID: tx.WalletID,
		Type:     wallet.TransactionTypePurchase,
		StandID:  tx.StandID,
		StaffID:  &tx.StaffID,
		Metadata: wallet.TransactionMeta{
			ProductIDs: tx.ProductIDs,
			DeviceID:   tx.LocalID, // Store local ID for tracing
		},
		Status:    wallet.TransactionStatusCompleted,
		CreatedAt: tx.Timestamp, // Preserve original timestamp
	}

	if err := s.walletRepo.ProcessPayment(ctx, tx.WalletID, tx.Amount, walletTx); err != nil {
		if err.Error() == "insufficient balance" {
			return uuid.Nil, errors.ErrInsufficientBalance
		}
		return uuid.Nil, fmt.Errorf("failed to process purchase: %w", err)
	}

	return walletTx.ID, nil
}

func (s *Service) processRefund(ctx context.Context, tx OfflineTransaction) (uuid.UUID, error) {
	// Get wallet
	w, err := s.walletRepo.GetWalletByID(ctx, tx.WalletID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to get wallet: %w", err)
	}
	if w == nil {
		return uuid.Nil, errors.ErrWalletNotFound
	}

	// Create refund transaction
	refundTx := &wallet.Transaction{
		ID:            uuid.New(),
		WalletID:      tx.WalletID,
		Type:          wallet.TransactionTypeRefund,
		Amount:        tx.Amount, // Positive for refund
		BalanceBefore: w.Balance,
		BalanceAfter:  w.Balance + tx.Amount,
		StandID:       tx.StandID,
		StaffID:       &tx.StaffID,
		Metadata: wallet.TransactionMeta{
			DeviceID:    tx.LocalID,
			Description: "Offline refund",
		},
		Status:    wallet.TransactionStatusCompleted,
		CreatedAt: tx.Timestamp,
	}

	// Update wallet balance
	w.Balance += tx.Amount
	w.UpdatedAt = time.Now()

	if err := s.walletRepo.UpdateWallet(ctx, w); err != nil {
		return uuid.Nil, fmt.Errorf("failed to update wallet: %w", err)
	}

	if err := s.walletRepo.CreateTransaction(ctx, refundTx); err != nil {
		return uuid.Nil, fmt.Errorf("failed to create refund transaction: %w", err)
	}

	return refundTx.ID, nil
}

func (s *Service) processTopUp(ctx context.Context, tx OfflineTransaction) (uuid.UUID, error) {
	// Get wallet
	w, err := s.walletRepo.GetWalletByID(ctx, tx.WalletID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to get wallet: %w", err)
	}
	if w == nil {
		return uuid.Nil, errors.ErrWalletNotFound
	}

	// Determine transaction type
	txType := wallet.TransactionTypeTopUp
	if tx.Type == TransactionTypeCashIn {
		txType = wallet.TransactionTypeCashIn
	}

	// Create top-up transaction
	topUpTx := &wallet.Transaction{
		ID:            uuid.New(),
		WalletID:      tx.WalletID,
		Type:          txType,
		Amount:        tx.Amount,
		BalanceBefore: w.Balance,
		BalanceAfter:  w.Balance + tx.Amount,
		StaffID:       &tx.StaffID,
		Metadata: wallet.TransactionMeta{
			PaymentMethod: "cash",
			DeviceID:      tx.LocalID,
		},
		Status:    wallet.TransactionStatusCompleted,
		CreatedAt: tx.Timestamp,
	}

	// Update wallet balance
	w.Balance += tx.Amount
	w.UpdatedAt = time.Now()

	if err := s.walletRepo.UpdateWallet(ctx, w); err != nil {
		return uuid.Nil, fmt.Errorf("failed to update wallet: %w", err)
	}

	if err := s.walletRepo.CreateTransaction(ctx, topUpTx); err != nil {
		return uuid.Nil, fmt.Errorf("failed to create top-up transaction: %w", err)
	}

	return topUpTx.ID, nil
}

// ValidateOfflineSignature validates the cryptographic signature of an offline transaction
func (s *Service) ValidateOfflineSignature(tx OfflineTransaction) error {
	if tx.Signature == "" {
		return fmt.Errorf("missing signature")
	}

	// Recreate the expected signature
	expectedSig := s.generateSignature(tx)

	// Compare signatures
	if !hmac.Equal([]byte(tx.Signature), []byte(expectedSig)) {
		return fmt.Errorf("signature mismatch")
	}

	return nil
}

// generateSignature generates the expected signature for an offline transaction
func (s *Service) generateSignature(tx OfflineTransaction) string {
	// Create deterministic data string
	data := fmt.Sprintf("%s:%s:%d:%s:%d",
		tx.LocalID,
		tx.WalletID.String(),
		tx.Amount,
		tx.Type,
		tx.Timestamp.Unix(),
	)

	h := hmac.New(sha256.New, s.secretKey)
	h.Write([]byte(data))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// GenerateOfflineSignature generates a signature for a device to use offline
// This should be called when device goes offline to pre-sign transaction templates
func (s *Service) GenerateOfflineSignature(localID string, walletID uuid.UUID, amount int64, txType TransactionType, timestamp time.Time) string {
	tx := OfflineTransaction{
		LocalID:   localID,
		WalletID:  walletID,
		Amount:    amount,
		Type:      txType,
		Timestamp: timestamp,
	}
	return s.generateSignature(tx)
}

// DetectDuplicates checks if a transaction has already been processed
func (s *Service) DetectDuplicates(ctx context.Context, tx OfflineTransaction, deviceID string) (bool, *uuid.UUID) {
	batch, existingTx, err := s.repo.FindExistingTransaction(ctx, tx.LocalID, deviceID)
	if err != nil || batch == nil || existingTx == nil {
		return false, nil
	}

	// If the transaction was already processed successfully
	if existingTx.Processed && existingTx.ServerTxID != nil && existingTx.Error == "" {
		return true, existingTx.ServerTxID
	}

	return false, nil
}

// ReconcileBalance attempts to reconcile a balance discrepancy
// This handles cases where the offline balance doesn't match the server balance
func (s *Service) ReconcileBalance(ctx context.Context, tx OfflineTransaction) (bool, error) {
	w, err := s.walletRepo.GetWalletByID(ctx, tx.WalletID)
	if err != nil {
		return false, fmt.Errorf("failed to get wallet: %w", err)
	}
	if w == nil {
		return false, errors.ErrWalletNotFound
	}

	// For purchases, check if the balance is now sufficient
	// (other online transactions may have added funds)
	if tx.Type == TransactionTypePurchase {
		if w.Balance >= tx.Amount {
			return true, nil
		}
		// Balance still insufficient
		return false, errors.ErrInsufficientBalance
	}

	// For refunds and top-ups, they should always succeed
	// as they add money to the wallet
	if tx.Type == TransactionTypeRefund || tx.Type == TransactionTypeTopUp || tx.Type == TransactionTypeCashIn {
		return true, nil
	}

	return false, nil
}

// GetBatch retrieves a batch by ID
func (s *Service) GetBatch(ctx context.Context, id uuid.UUID) (*SyncBatch, error) {
	batch, err := s.repo.GetBatchByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if batch == nil {
		return nil, errors.ErrNotFound
	}
	return batch, nil
}

// GetPendingBatches retrieves pending batches for a device
func (s *Service) GetPendingBatches(ctx context.Context, deviceID string) ([]SyncBatch, error) {
	return s.repo.GetPendingBatchesByDevice(ctx, deviceID)
}
