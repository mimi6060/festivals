package festival

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	Create(ctx context.Context, festival *Festival) error
	GetByID(ctx context.Context, id uuid.UUID) (*Festival, error)
	GetBySlug(ctx context.Context, slug string) (*Festival, error)
	List(ctx context.Context, offset, limit int) ([]Festival, int64, error)
	Update(ctx context.Context, festival *Festival) error
	Delete(ctx context.Context, id uuid.UUID) error
	ExistsBySlug(ctx context.Context, slug string) (bool, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, festival *Festival) error {
	return r.db.WithContext(ctx).Create(festival).Error
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*Festival, error) {
	var festival Festival
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&festival).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get festival: %w", err)
	}
	return &festival, nil
}

func (r *repository) GetBySlug(ctx context.Context, slug string) (*Festival, error) {
	var festival Festival
	err := r.db.WithContext(ctx).Where("slug = ?", slug).First(&festival).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get festival: %w", err)
	}
	return &festival, nil
}

func (r *repository) List(ctx context.Context, offset, limit int) ([]Festival, int64, error) {
	var festivals []Festival
	var total int64

	query := r.db.WithContext(ctx).Model(&Festival{})

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count festivals: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&festivals).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list festivals: %w", err)
	}

	return festivals, total, nil
}

func (r *repository) Update(ctx context.Context, festival *Festival) error {
	return r.db.WithContext(ctx).Save(festival).Error
}

func (r *repository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Festival{}).Error
}

func (r *repository) ExistsBySlug(ctx context.Context, slug string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&Festival{}).Where("slug = ?", slug).Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("failed to check slug existence: %w", err)
	}
	return count > 0, nil
}
