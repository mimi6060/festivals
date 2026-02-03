package nfc

import (
	"context"
	"fmt"
	"time"

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

	// NFCBracelet operations
	CreateBracelet(ctx context.Context, bracelet *NFCBracelet) error
	GetBraceletByID(ctx context.Context, id uuid.UUID) (*NFCBracelet, error)
	GetBraceletByUID(ctx context.Context, uid string) (*NFCBracelet, error)
	GetBraceletsByWallet(ctx context.Context, walletID uuid.UUID) ([]NFCBracelet, error)
	GetBraceletsByUser(ctx context.Context, userID uuid.UUID) ([]NFCBracelet, error)
	GetBraceletsByBatch(ctx context.Context, batchID uuid.UUID) ([]NFCBracelet, error)
	UpdateBracelet(ctx context.Context, bracelet *NFCBracelet) error
	UpdateBraceletStatus(ctx context.Context, id uuid.UUID, status NFCBraceletStatus) error
	ListBraceletsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]NFCBracelet, int64, error)
	GetActiveBracelets(ctx context.Context, festivalID uuid.UUID) ([]NFCBracelet, error)
	GetBraceletsByStatus(ctx context.Context, festivalID uuid.UUID, status NFCBraceletStatus) ([]NFCBracelet, error)
	BulkCreateBracelets(ctx context.Context, bracelets []NFCBracelet) error
	CountBraceletsByStatus(ctx context.Context, festivalID uuid.UUID) (map[NFCBraceletStatus]int, error)

	// NFCBatch operations
	CreateBatch(ctx context.Context, batch *NFCBatch) error
	GetBatchByID(ctx context.Context, id uuid.UUID) (*NFCBatch, error)
	UpdateBatch(ctx context.Context, batch *NFCBatch) error
	ListBatchesByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]NFCBatch, int64, error)
	UpdateBatchCounts(ctx context.Context, batchID uuid.UUID) error

	// Stats operations
	GetBraceletTransactionCount(ctx context.Context, braceletUID string) (int, error)
	GetBraceletTotalSpent(ctx context.Context, braceletUID string) (int64, error)
	GetFestivalNFCStats(ctx context.Context, festivalID uuid.UUID) (*NFCStats, error)
	GetTransactionsByBracelet(ctx context.Context, braceletUID string, offset, limit int) ([]NFCTransaction, int64, error)
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

// NFCBracelet operations

func (r *repository) CreateBracelet(ctx context.Context, bracelet *NFCBracelet) error {
	return r.db.WithContext(ctx).Create(bracelet).Error
}

func (r *repository) GetBraceletByID(ctx context.Context, id uuid.UUID) (*NFCBracelet, error) {
	var bracelet NFCBracelet
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&bracelet).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get NFC bracelet: %w", err)
	}
	return &bracelet, nil
}

func (r *repository) GetBraceletByUID(ctx context.Context, uid string) (*NFCBracelet, error) {
	var bracelet NFCBracelet
	err := r.db.WithContext(ctx).Where("uid = ?", uid).First(&bracelet).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get NFC bracelet by UID: %w", err)
	}
	return &bracelet, nil
}

func (r *repository) GetBraceletsByWallet(ctx context.Context, walletID uuid.UUID) ([]NFCBracelet, error) {
	var bracelets []NFCBracelet
	err := r.db.WithContext(ctx).
		Where("wallet_id = ?", walletID).
		Order("created_at DESC").
		Find(&bracelets).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get NFC bracelets by wallet: %w", err)
	}
	return bracelets, nil
}

func (r *repository) GetBraceletsByUser(ctx context.Context, userID uuid.UUID) ([]NFCBracelet, error) {
	var bracelets []NFCBracelet
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&bracelets).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get NFC bracelets by user: %w", err)
	}
	return bracelets, nil
}

func (r *repository) GetBraceletsByBatch(ctx context.Context, batchID uuid.UUID) ([]NFCBracelet, error) {
	var bracelets []NFCBracelet
	err := r.db.WithContext(ctx).
		Where("batch_id = ?", batchID).
		Order("created_at DESC").
		Find(&bracelets).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get NFC bracelets by batch: %w", err)
	}
	return bracelets, nil
}

func (r *repository) UpdateBracelet(ctx context.Context, bracelet *NFCBracelet) error {
	return r.db.WithContext(ctx).Save(bracelet).Error
}

func (r *repository) UpdateBraceletStatus(ctx context.Context, id uuid.UUID, status NFCBraceletStatus) error {
	return r.db.WithContext(ctx).
		Model(&NFCBracelet{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (r *repository) ListBraceletsByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]NFCBracelet, int64, error) {
	var bracelets []NFCBracelet
	var total int64

	query := r.db.WithContext(ctx).Model(&NFCBracelet{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count NFC bracelets: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&bracelets).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list NFC bracelets: %w", err)
	}

	return bracelets, total, nil
}

func (r *repository) GetActiveBracelets(ctx context.Context, festivalID uuid.UUID) ([]NFCBracelet, error) {
	var bracelets []NFCBracelet
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND status = ?", festivalID, NFCBraceletStatusActive).
		Order("activated_at DESC").
		Find(&bracelets).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get active NFC bracelets: %w", err)
	}
	return bracelets, nil
}

func (r *repository) GetBraceletsByStatus(ctx context.Context, festivalID uuid.UUID, status NFCBraceletStatus) ([]NFCBracelet, error) {
	var bracelets []NFCBracelet
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND status = ?", festivalID, status).
		Order("created_at DESC").
		Find(&bracelets).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get NFC bracelets by status: %w", err)
	}
	return bracelets, nil
}

func (r *repository) BulkCreateBracelets(ctx context.Context, bracelets []NFCBracelet) error {
	if len(bracelets) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(&bracelets, 100).Error
}

func (r *repository) CountBraceletsByStatus(ctx context.Context, festivalID uuid.UUID) (map[NFCBraceletStatus]int, error) {
	type statusCount struct {
		Status NFCBraceletStatus
		Count  int
	}
	var results []statusCount

	err := r.db.WithContext(ctx).
		Model(&NFCBracelet{}).
		Select("status, count(*) as count").
		Where("festival_id = ?", festivalID).
		Group("status").
		Scan(&results).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count NFC bracelets by status: %w", err)
	}

	counts := make(map[NFCBraceletStatus]int)
	for _, r := range results {
		counts[r.Status] = r.Count
	}
	return counts, nil
}

// NFCBatch operations

func (r *repository) CreateBatch(ctx context.Context, batch *NFCBatch) error {
	return r.db.WithContext(ctx).Create(batch).Error
}

func (r *repository) GetBatchByID(ctx context.Context, id uuid.UUID) (*NFCBatch, error) {
	var batch NFCBatch
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&batch).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get NFC batch: %w", err)
	}
	return &batch, nil
}

func (r *repository) UpdateBatch(ctx context.Context, batch *NFCBatch) error {
	return r.db.WithContext(ctx).Save(batch).Error
}

func (r *repository) ListBatchesByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]NFCBatch, int64, error) {
	var batches []NFCBatch
	var total int64

	query := r.db.WithContext(ctx).Model(&NFCBatch{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count NFC batches: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&batches).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list NFC batches: %w", err)
	}

	return batches, total, nil
}

func (r *repository) UpdateBatchCounts(ctx context.Context, batchID uuid.UUID) error {
	return r.db.WithContext(ctx).Exec(`
		UPDATE nfc_batches SET
			total_count = (SELECT COUNT(*) FROM nfc_bracelets WHERE batch_id = ?),
			active_count = (SELECT COUNT(*) FROM nfc_bracelets WHERE batch_id = ? AND status = 'ACTIVE'),
			blocked_count = (SELECT COUNT(*) FROM nfc_bracelets WHERE batch_id = ? AND status IN ('BLOCKED', 'LOST')),
			updated_at = NOW()
		WHERE id = ?
	`, batchID, batchID, batchID, batchID).Error
}

// Stats operations

func (r *repository) GetBraceletTransactionCount(ctx context.Context, braceletUID string) (int, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&NFCTransaction{}).
		Where("nfc_uid = ?", braceletUID).
		Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("failed to count bracelet transactions: %w", err)
	}
	return int(count), nil
}

func (r *repository) GetBraceletTotalSpent(ctx context.Context, braceletUID string) (int64, error) {
	var total int64
	err := r.db.WithContext(ctx).
		Model(&NFCTransaction{}).
		Where("nfc_uid = ? AND amount < 0", braceletUID).
		Select("COALESCE(SUM(ABS(amount)), 0)").
		Scan(&total).Error
	if err != nil {
		return 0, fmt.Errorf("failed to get bracelet total spent: %w", err)
	}
	return total, nil
}

func (r *repository) GetFestivalNFCStats(ctx context.Context, festivalID uuid.UUID) (*NFCStats, error) {
	stats := &NFCStats{}

	// Get bracelet counts by status
	counts, err := r.CountBraceletsByStatus(ctx, festivalID)
	if err != nil {
		return nil, err
	}

	stats.TotalBracelets = 0
	for _, count := range counts {
		stats.TotalBracelets += count
	}
	stats.ActiveBracelets = counts[NFCBraceletStatusActive]
	stats.UnassignedBracelets = counts[NFCBraceletStatusUnassigned]
	stats.BlockedBracelets = counts[NFCBraceletStatusBlocked]
	stats.LostBracelets = counts[NFCBraceletStatusLost]

	// Get total transactions and volume
	var txStats struct {
		Count  int
		Volume int64
	}
	err = r.db.WithContext(ctx).
		Model(&NFCTransaction{}).
		Where("festival_id = ?", festivalID).
		Select("COUNT(*) as count, COALESCE(SUM(ABS(amount)), 0) as volume").
		Scan(&txStats).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction stats: %w", err)
	}
	stats.TotalTransactions = txStats.Count
	stats.TotalVolume = txStats.Volume

	// Get today's transactions
	today := time.Now().Truncate(24 * time.Hour)
	var todayStats struct {
		Count  int
		Volume int64
	}
	err = r.db.WithContext(ctx).
		Model(&NFCTransaction{}).
		Where("festival_id = ? AND processed_at >= ?", festivalID, today).
		Select("COUNT(*) as count, COALESCE(SUM(ABS(amount)), 0) as volume").
		Scan(&todayStats).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get today's transaction stats: %w", err)
	}
	stats.TodayTransactions = todayStats.Count
	stats.TodayVolume = todayStats.Volume

	return stats, nil
}

func (r *repository) GetTransactionsByBracelet(ctx context.Context, braceletUID string, offset, limit int) ([]NFCTransaction, int64, error) {
	var transactions []NFCTransaction
	var total int64

	query := r.db.WithContext(ctx).Model(&NFCTransaction{}).Where("nfc_uid = ?", braceletUID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count bracelet transactions: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("processed_at DESC").Find(&transactions).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list bracelet transactions: %w", err)
	}

	return transactions, total, nil
}
