package sync

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	// Batch operations
	CreateBatch(ctx context.Context, batch *SyncBatch) error
	GetBatchByID(ctx context.Context, id uuid.UUID) (*SyncBatch, error)
	UpdateBatchStatus(ctx context.Context, id uuid.UUID, status SyncStatus, result *SyncResultData) error
	GetPendingBatches(ctx context.Context, festivalID uuid.UUID) ([]SyncBatch, error)
	GetPendingBatchesByDevice(ctx context.Context, deviceID string) ([]SyncBatch, error)

	// Transaction tracking
	MarkTransactionProcessed(ctx context.Context, batchID uuid.UUID, localID string, serverTxID uuid.UUID) error
	MarkTransactionFailed(ctx context.Context, batchID uuid.UUID, localID string, errorMsg string) error

	// Duplicate detection
	FindExistingTransaction(ctx context.Context, localID string, deviceID string) (*SyncBatch, *OfflineTransaction, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) CreateBatch(ctx context.Context, batch *SyncBatch) error {
	return r.db.WithContext(ctx).Create(batch).Error
}

func (r *repository) GetBatchByID(ctx context.Context, id uuid.UUID) (*SyncBatch, error) {
	var batch SyncBatch
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&batch).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get batch: %w", err)
	}
	return &batch, nil
}

func (r *repository) UpdateBatchStatus(ctx context.Context, id uuid.UUID, status SyncStatus, result *SyncResultData) error {
	updates := map[string]interface{}{
		"status": status,
	}

	if status == SyncStatusCompleted || status == SyncStatusFailed || status == SyncStatusPartial {
		now := time.Now()
		updates["processed_at"] = &now
	}

	if result != nil {
		updates["result"] = result
	}

	return r.db.WithContext(ctx).
		Model(&SyncBatch{}).
		Where("id = ?", id).
		Updates(updates).Error
}

func (r *repository) GetPendingBatches(ctx context.Context, festivalID uuid.UUID) ([]SyncBatch, error) {
	var batches []SyncBatch
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND status IN ?", festivalID, []SyncStatus{SyncStatusPending, SyncStatusProcessing}).
		Order("created_at ASC").
		Find(&batches).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get pending batches: %w", err)
	}
	return batches, nil
}

func (r *repository) GetPendingBatchesByDevice(ctx context.Context, deviceID string) ([]SyncBatch, error) {
	var batches []SyncBatch
	err := r.db.WithContext(ctx).
		Where("device_id = ? AND status IN ?", deviceID, []SyncStatus{SyncStatusPending, SyncStatusProcessing}).
		Order("created_at ASC").
		Find(&batches).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get pending batches for device: %w", err)
	}
	return batches, nil
}

func (r *repository) MarkTransactionProcessed(ctx context.Context, batchID uuid.UUID, localID string, serverTxID uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var batch SyncBatch
		if err := tx.Where("id = ?", batchID).First(&batch).Error; err != nil {
			return fmt.Errorf("failed to get batch: %w", err)
		}

		// Update the transaction in the slice
		updated := false
		for i := range batch.Transactions {
			if batch.Transactions[i].LocalID == localID {
				batch.Transactions[i].Processed = true
				batch.Transactions[i].ServerTxID = &serverTxID
				updated = true
				break
			}
		}

		if !updated {
			return fmt.Errorf("transaction with local ID %s not found in batch", localID)
		}

		return tx.Model(&batch).Update("transactions", batch.Transactions).Error
	})
}

func (r *repository) MarkTransactionFailed(ctx context.Context, batchID uuid.UUID, localID string, errorMsg string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var batch SyncBatch
		if err := tx.Where("id = ?", batchID).First(&batch).Error; err != nil {
			return fmt.Errorf("failed to get batch: %w", err)
		}

		// Update the transaction in the slice
		updated := false
		for i := range batch.Transactions {
			if batch.Transactions[i].LocalID == localID {
				batch.Transactions[i].Processed = true
				batch.Transactions[i].Error = errorMsg
				updated = true
				break
			}
		}

		if !updated {
			return fmt.Errorf("transaction with local ID %s not found in batch", localID)
		}

		return tx.Model(&batch).Update("transactions", batch.Transactions).Error
	})
}

func (r *repository) FindExistingTransaction(ctx context.Context, localID string, deviceID string) (*SyncBatch, *OfflineTransaction, error) {
	var batches []SyncBatch
	err := r.db.WithContext(ctx).
		Where("device_id = ?", deviceID).
		Order("created_at DESC").
		Find(&batches).Error
	if err != nil {
		return nil, nil, fmt.Errorf("failed to search for existing transaction: %w", err)
	}

	for _, batch := range batches {
		for i := range batch.Transactions {
			if batch.Transactions[i].LocalID == localID {
				return &batch, &batch.Transactions[i], nil
			}
		}
	}

	return nil, nil, nil
}
