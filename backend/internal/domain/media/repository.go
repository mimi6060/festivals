package media

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for media persistence
type Repository interface {
	Create(ctx context.Context, media *Media) error
	GetByID(ctx context.Context, id uuid.UUID) (*Media, error)
	List(ctx context.Context, filter MediaFilter, offset, limit int) ([]Media, int64, error)
	Update(ctx context.Context, media *Media) error
	Delete(ctx context.Context, id uuid.UUID) error
	GetByFestivalID(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Media, int64, error)
	GetByKey(ctx context.Context, bucket, key string) (*Media, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new media repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, media *Media) error {
	return r.db.WithContext(ctx).Create(media).Error
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*Media, error) {
	var media Media
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&media).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get media: %w", err)
	}
	return &media, nil
}

func (r *repository) List(ctx context.Context, filter MediaFilter, offset, limit int) ([]Media, int64, error) {
	var mediaList []Media
	var total int64

	query := r.db.WithContext(ctx).Model(&Media{})

	// Apply filters
	if filter.FestivalID != nil {
		query = query.Where("festival_id = ?", *filter.FestivalID)
	}
	if filter.Type != nil {
		query = query.Where("type = ?", *filter.Type)
	}
	if filter.MimeType != nil {
		query = query.Where("mime_type = ?", *filter.MimeType)
	}
	if filter.UploadedBy != nil {
		query = query.Where("uploaded_by = ?", *filter.UploadedBy)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count media: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&mediaList).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list media: %w", err)
	}

	return mediaList, total, nil
}

func (r *repository) Update(ctx context.Context, media *Media) error {
	return r.db.WithContext(ctx).Save(media).Error
}

func (r *repository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Media{}).Error
}

func (r *repository) GetByFestivalID(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Media, int64, error) {
	var mediaList []Media
	var total int64

	query := r.db.WithContext(ctx).Model(&Media{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count media: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&mediaList).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list media: %w", err)
	}

	return mediaList, total, nil
}

func (r *repository) GetByKey(ctx context.Context, bucket, key string) (*Media, error) {
	var media Media
	err := r.db.WithContext(ctx).Where("bucket = ? AND key = ?", bucket, key).First(&media).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get media by key: %w", err)
	}
	return &media, nil
}
