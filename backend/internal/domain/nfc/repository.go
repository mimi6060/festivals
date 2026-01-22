package nfc

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	// NFC Tag operations
	Create(ctx context.Context, tag *NFCTag) error
	GetByID(ctx context.Context, id uuid.UUID) (*NFCTag, error)
	GetByUID(ctx context.Context, uid string) (*NFCTag, error)
	GetByWallet(ctx context.Context, walletID uuid.UUID) ([]NFCTag, error)
	Update(ctx context.Context, tag *NFCTag) error
	UpdateStatus(ctx context.Context, id uuid.UUID, status NFCStatus) error
	Delete(ctx context.Context, id uuid.UUID) error

	// Festival-scoped queries
	ListByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]NFCTag, int64, error)
	GetActiveTags(ctx context.Context, festivalID uuid.UUID) ([]NFCTag, error)
	GetTagsByStatus(ctx context.Context, festivalID uuid.UUID, status NFCStatus) ([]NFCTag, error)

	// NFC Transaction operations (for offline sync)
	CreateTransaction(ctx context.Context, tx *NFCTransaction) error
	GetTransactionByID(ctx context.Context, id uuid.UUID) (*NFCTransaction, error)
	GetPendingTransactions(ctx context.Context, festivalID uuid.UUID) ([]NFCTransaction, error)
	UpdateTransactionStatus(ctx context.Context, id uuid.UUID, status NFCTransactionStatus) error
	BulkCreateTransactions(ctx context.Context, txs []NFCTransaction) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, tag *NFCTag) error {
	return r.db.WithContext(ctx).Create(tag).Error
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*NFCTag, error) {
	var tag NFCTag
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&tag).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get NFC tag: %w", err)
	}
	return &tag, nil
}

func (r *repository) GetByUID(ctx context.Context, uid string) (*NFCTag, error) {
	var tag NFCTag
	err := r.db.WithContext(ctx).Where("uid = ?", uid).First(&tag).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get NFC tag by UID: %w", err)
	}
	return &tag, nil
}

func (r *repository) GetByWallet(ctx context.Context, walletID uuid.UUID) ([]NFCTag, error) {
	var tags []NFCTag
	err := r.db.WithContext(ctx).
		Where("wallet_id = ?", walletID).
		Order("created_at DESC").
		Find(&tags).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get NFC tags by wallet: %w", err)
	}
	return tags, nil
}

func (r *repository) Update(ctx context.Context, tag *NFCTag) error {
	return r.db.WithContext(ctx).Save(tag).Error
}

func (r *repository) UpdateStatus(ctx context.Context, id uuid.UUID, status NFCStatus) error {
	return r.db.WithContext(ctx).
		Model(&NFCTag{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (r *repository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&NFCTag{}, "id = ?", id).Error
}

func (r *repository) ListByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]NFCTag, int64, error) {
	var tags []NFCTag
	var total int64

	query := r.db.WithContext(ctx).Model(&NFCTag{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count NFC tags: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&tags).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list NFC tags: %w", err)
	}

	return tags, total, nil
}

func (r *repository) GetActiveTags(ctx context.Context, festivalID uuid.UUID) ([]NFCTag, error) {
	var tags []NFCTag
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND status = ?", festivalID, NFCStatusActive).
		Order("activated_at DESC").
		Find(&tags).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get active NFC tags: %w", err)
	}
	return tags, nil
}

func (r *repository) GetTagsByStatus(ctx context.Context, festivalID uuid.UUID, status NFCStatus) ([]NFCTag, error) {
	var tags []NFCTag
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND status = ?", festivalID, status).
		Order("created_at DESC").
		Find(&tags).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get NFC tags by status: %w", err)
	}
	return tags, nil
}

// NFC Transaction operations

func (r *repository) CreateTransaction(ctx context.Context, tx *NFCTransaction) error {
	return r.db.WithContext(ctx).Create(tx).Error
}

func (r *repository) GetTransactionByID(ctx context.Context, id uuid.UUID) (*NFCTransaction, error) {
	var tx NFCTransaction
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&tx).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get NFC transaction: %w", err)
	}
	return &tx, nil
}

func (r *repository) GetPendingTransactions(ctx context.Context, festivalID uuid.UUID) ([]NFCTransaction, error) {
	var txs []NFCTransaction
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND status = ?", festivalID, NFCTransactionStatusPendingSync).
		Order("processed_at ASC").
		Find(&txs).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get pending NFC transactions: %w", err)
	}
	return txs, nil
}

func (r *repository) UpdateTransactionStatus(ctx context.Context, id uuid.UUID, status NFCTransactionStatus) error {
	return r.db.WithContext(ctx).
		Model(&NFCTransaction{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (r *repository) BulkCreateTransactions(ctx context.Context, txs []NFCTransaction) error {
	if len(txs) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Create(&txs).Error
}
