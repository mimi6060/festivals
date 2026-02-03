package media

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ArchiveRepository defines the interface for archive/souvenir persistence
type ArchiveRepository interface {
	// MediaItem operations
	CreateMediaItem(ctx context.Context, item *MediaItem) error
	GetMediaItemByID(ctx context.Context, id uuid.UUID) (*MediaItem, error)
	ListMediaItems(ctx context.Context, filter GalleryFilter, offset, limit int) ([]MediaItem, int64, error)
	UpdateMediaItem(ctx context.Context, item *MediaItem) error
	DeleteMediaItem(ctx context.Context, id uuid.UUID) error
	GetMediaItemsByIDs(ctx context.Context, ids []uuid.UUID) ([]MediaItem, error)
	IncrementViewCount(ctx context.Context, id uuid.UUID) error

	// Album operations
	CreateAlbum(ctx context.Context, album *Album) error
	GetAlbumByID(ctx context.Context, id uuid.UUID) (*Album, error)
	ListAlbums(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Album, int64, error)
	UpdateAlbum(ctx context.Context, album *Album) error
	DeleteAlbum(ctx context.Context, id uuid.UUID) error

	// AlbumItem operations
	AddItemToAlbum(ctx context.Context, item *AlbumItem) error
	RemoveItemFromAlbum(ctx context.Context, albumID, mediaItemID uuid.UUID) error
	GetAlbumItems(ctx context.Context, albumID uuid.UUID, offset, limit int) ([]MediaItem, int64, error)
	UpdateAlbumItemCount(ctx context.Context, albumID uuid.UUID) error

	// MediaShare operations
	CreateShare(ctx context.Context, share *MediaShare) error
	GetShareByCode(ctx context.Context, code string) (*MediaShare, error)
	GetSharesByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]MediaShare, int64, error)
	DeleteShare(ctx context.Context, id uuid.UUID) error
	IncrementShareViewCount(ctx context.Context, code string) error

	// MediaLike operations
	CreateLike(ctx context.Context, like *MediaLike) error
	DeleteLike(ctx context.Context, mediaItemID, userID uuid.UUID) error
	GetLikeByUser(ctx context.Context, mediaItemID, userID uuid.UUID) (*MediaLike, error)
	GetLikedMediaByUser(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, offset, limit int) ([]MediaItem, int64, error)
	UpdateLikeCount(ctx context.Context, mediaItemID uuid.UUID) error

	// SouvenirPDF operations
	CreateSouvenirPDF(ctx context.Context, pdf *SouvenirPDF) error
	GetSouvenirPDFByID(ctx context.Context, id uuid.UUID) (*SouvenirPDF, error)
	GetSouvenirPDFByUserAndFestival(ctx context.Context, userID, festivalID uuid.UUID) (*SouvenirPDF, error)
	UpdateSouvenirPDF(ctx context.Context, pdf *SouvenirPDF) error
	ListSouvenirPDFs(ctx context.Context, userID uuid.UUID) ([]SouvenirPDF, error)

	// Moderation operations
	GetPendingModeration(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]MediaItem, int64, error)
	BulkUpdateModerationStatus(ctx context.Context, ids []uuid.UUID, status ModerationStatus, moderatedBy uuid.UUID) error
}

type archiveRepository struct {
	db *gorm.DB
}

// NewArchiveRepository creates a new archive repository
func NewArchiveRepository(db *gorm.DB) ArchiveRepository {
	return &archiveRepository{db: db}
}

// ============================================
// MediaItem operations
// ============================================

func (r *archiveRepository) CreateMediaItem(ctx context.Context, item *MediaItem) error {
	return r.db.WithContext(ctx).Create(item).Error
}

func (r *archiveRepository) GetMediaItemByID(ctx context.Context, id uuid.UUID) (*MediaItem, error) {
	var item MediaItem
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get media item: %w", err)
	}
	return &item, nil
}

func (r *archiveRepository) ListMediaItems(ctx context.Context, filter GalleryFilter, offset, limit int) ([]MediaItem, int64, error) {
	var items []MediaItem
	var total int64

	query := r.db.WithContext(ctx).Model(&MediaItem{})

	// Apply filters
	if filter.FestivalID != nil {
		query = query.Where("festival_id = ?", *filter.FestivalID)
	}
	if filter.Type != nil {
		query = query.Where("type = ?", *filter.Type)
	}
	if filter.Status != nil {
		query = query.Where("status = ?", *filter.Status)
	}
	if filter.UploaderID != nil {
		query = query.Where("uploader_id = ?", *filter.UploaderID)
	}
	if filter.ArtistID != nil {
		query = query.Where("item_metadata->>'artistId' = ?", filter.ArtistID.String())
	}
	if filter.Day != nil {
		query = query.Where("(item_metadata->>'day')::int = ?", *filter.Day)
	}
	if filter.StageName != nil {
		query = query.Where("location->>'stageName' = ?", *filter.StageName)
	}
	if len(filter.Tags) > 0 {
		query = query.Where("tags && ?", filter.Tags)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count media items: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list media items: %w", err)
	}

	return items, total, nil
}

func (r *archiveRepository) UpdateMediaItem(ctx context.Context, item *MediaItem) error {
	return r.db.WithContext(ctx).Save(item).Error
}

func (r *archiveRepository) DeleteMediaItem(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&MediaItem{}).Error
}

func (r *archiveRepository) GetMediaItemsByIDs(ctx context.Context, ids []uuid.UUID) ([]MediaItem, error) {
	var items []MediaItem
	err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get media items by IDs: %w", err)
	}
	return items, nil
}

func (r *archiveRepository) IncrementViewCount(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&MediaItem{}).
		Where("id = ?", id).
		UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
}

// ============================================
// Album operations
// ============================================

func (r *archiveRepository) CreateAlbum(ctx context.Context, album *Album) error {
	return r.db.WithContext(ctx).Create(album).Error
}

func (r *archiveRepository) GetAlbumByID(ctx context.Context, id uuid.UUID) (*Album, error) {
	var album Album
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&album).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get album: %w", err)
	}
	return &album, nil
}

func (r *archiveRepository) ListAlbums(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Album, int64, error) {
	var albums []Album
	var total int64

	query := r.db.WithContext(ctx).Model(&Album{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count albums: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("sort_order ASC, created_at DESC").Find(&albums).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list albums: %w", err)
	}

	return albums, total, nil
}

func (r *archiveRepository) UpdateAlbum(ctx context.Context, album *Album) error {
	return r.db.WithContext(ctx).Save(album).Error
}

func (r *archiveRepository) DeleteAlbum(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Delete album items first
		if err := tx.Where("album_id = ?", id).Delete(&AlbumItem{}).Error; err != nil {
			return err
		}
		// Delete album
		return tx.Where("id = ?", id).Delete(&Album{}).Error
	})
}

// ============================================
// AlbumItem operations
// ============================================

func (r *archiveRepository) AddItemToAlbum(ctx context.Context, item *AlbumItem) error {
	return r.db.WithContext(ctx).Create(item).Error
}

func (r *archiveRepository) RemoveItemFromAlbum(ctx context.Context, albumID, mediaItemID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("album_id = ? AND media_item_id = ?", albumID, mediaItemID).
		Delete(&AlbumItem{}).Error
}

func (r *archiveRepository) GetAlbumItems(ctx context.Context, albumID uuid.UUID, offset, limit int) ([]MediaItem, int64, error) {
	var items []MediaItem
	var total int64

	// Count total
	countQuery := r.db.WithContext(ctx).Model(&AlbumItem{}).Where("album_id = ?", albumID)
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count album items: %w", err)
	}

	// Get items with join
	err := r.db.WithContext(ctx).
		Table("media_items").
		Joins("INNER JOIN album_items ON album_items.media_item_id = media_items.id").
		Where("album_items.album_id = ?", albumID).
		Order("album_items.sort_order ASC").
		Offset(offset).Limit(limit).
		Find(&items).Error

	if err != nil {
		return nil, 0, fmt.Errorf("failed to get album items: %w", err)
	}

	return items, total, nil
}

func (r *archiveRepository) UpdateAlbumItemCount(ctx context.Context, albumID uuid.UUID) error {
	var count int64
	if err := r.db.WithContext(ctx).Model(&AlbumItem{}).Where("album_id = ?", albumID).Count(&count).Error; err != nil {
		return err
	}
	return r.db.WithContext(ctx).Model(&Album{}).Where("id = ?", albumID).Update("item_count", count).Error
}

// ============================================
// MediaShare operations
// ============================================

func (r *archiveRepository) CreateShare(ctx context.Context, share *MediaShare) error {
	return r.db.WithContext(ctx).Create(share).Error
}

func (r *archiveRepository) GetShareByCode(ctx context.Context, code string) (*MediaShare, error) {
	var share MediaShare
	err := r.db.WithContext(ctx).Where("share_code = ?", code).First(&share).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get share: %w", err)
	}
	return &share, nil
}

func (r *archiveRepository) GetSharesByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]MediaShare, int64, error) {
	var shares []MediaShare
	var total int64

	query := r.db.WithContext(ctx).Model(&MediaShare{}).Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count shares: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&shares).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list shares: %w", err)
	}

	return shares, total, nil
}

func (r *archiveRepository) DeleteShare(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&MediaShare{}).Error
}

func (r *archiveRepository) IncrementShareViewCount(ctx context.Context, code string) error {
	return r.db.WithContext(ctx).Model(&MediaShare{}).
		Where("share_code = ?", code).
		UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
}

// ============================================
// MediaLike operations
// ============================================

func (r *archiveRepository) CreateLike(ctx context.Context, like *MediaLike) error {
	return r.db.WithContext(ctx).Create(like).Error
}

func (r *archiveRepository) DeleteLike(ctx context.Context, mediaItemID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("media_item_id = ? AND user_id = ?", mediaItemID, userID).
		Delete(&MediaLike{}).Error
}

func (r *archiveRepository) GetLikeByUser(ctx context.Context, mediaItemID, userID uuid.UUID) (*MediaLike, error) {
	var like MediaLike
	err := r.db.WithContext(ctx).
		Where("media_item_id = ? AND user_id = ?", mediaItemID, userID).
		First(&like).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get like: %w", err)
	}
	return &like, nil
}

func (r *archiveRepository) GetLikedMediaByUser(ctx context.Context, userID uuid.UUID, festivalID *uuid.UUID, offset, limit int) ([]MediaItem, int64, error) {
	var items []MediaItem
	var total int64

	query := r.db.WithContext(ctx).
		Table("media_items").
		Joins("INNER JOIN media_likes ON media_likes.media_item_id = media_items.id").
		Where("media_likes.user_id = ?", userID)

	if festivalID != nil {
		query = query.Where("media_items.festival_id = ?", *festivalID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count liked media: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("media_likes.created_at DESC").Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to get liked media: %w", err)
	}

	return items, total, nil
}

func (r *archiveRepository) UpdateLikeCount(ctx context.Context, mediaItemID uuid.UUID) error {
	var count int64
	if err := r.db.WithContext(ctx).Model(&MediaLike{}).Where("media_item_id = ?", mediaItemID).Count(&count).Error; err != nil {
		return err
	}
	return r.db.WithContext(ctx).Model(&MediaItem{}).Where("id = ?", mediaItemID).Update("like_count", count).Error
}

// ============================================
// SouvenirPDF operations
// ============================================

func (r *archiveRepository) CreateSouvenirPDF(ctx context.Context, pdf *SouvenirPDF) error {
	return r.db.WithContext(ctx).Create(pdf).Error
}

func (r *archiveRepository) GetSouvenirPDFByID(ctx context.Context, id uuid.UUID) (*SouvenirPDF, error) {
	var pdf SouvenirPDF
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&pdf).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get souvenir PDF: %w", err)
	}
	return &pdf, nil
}

func (r *archiveRepository) GetSouvenirPDFByUserAndFestival(ctx context.Context, userID, festivalID uuid.UUID) (*SouvenirPDF, error) {
	var pdf SouvenirPDF
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND festival_id = ? AND status = 'COMPLETED'", userID, festivalID).
		Order("created_at DESC").
		First(&pdf).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get souvenir PDF: %w", err)
	}
	return &pdf, nil
}

func (r *archiveRepository) UpdateSouvenirPDF(ctx context.Context, pdf *SouvenirPDF) error {
	return r.db.WithContext(ctx).Save(pdf).Error
}

func (r *archiveRepository) ListSouvenirPDFs(ctx context.Context, userID uuid.UUID) ([]SouvenirPDF, error) {
	var pdfs []SouvenirPDF
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&pdfs).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list souvenir PDFs: %w", err)
	}
	return pdfs, nil
}

// ============================================
// Moderation operations
// ============================================

func (r *archiveRepository) GetPendingModeration(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]MediaItem, int64, error) {
	var items []MediaItem
	var total int64

	query := r.db.WithContext(ctx).Model(&MediaItem{}).
		Where("festival_id = ? AND status = ?", festivalID, ModerationStatusPending)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count pending moderation: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at ASC").Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list pending moderation: %w", err)
	}

	return items, total, nil
}

func (r *archiveRepository) BulkUpdateModerationStatus(ctx context.Context, ids []uuid.UUID, status ModerationStatus, moderatedBy uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&MediaItem{}).
		Where("id IN ?", ids).
		Updates(map[string]interface{}{
			"status":       status,
			"moderated_by": moderatedBy,
			"moderated_at": gorm.Expr("NOW()"),
		}).Error
}
