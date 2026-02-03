package apikeys

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type postgresRepository struct {
	db *gorm.DB
}

// NewRepository creates a new PostgreSQL repository for API keys
func NewRepository(db *gorm.DB) Repository {
	return &postgresRepository{db: db}
}

func (r *postgresRepository) CreateAPIKey(ctx context.Context, apiKey *APIKey) error {
	return r.db.WithContext(ctx).Create(apiKey).Error
}

func (r *postgresRepository) GetByID(ctx context.Context, id uuid.UUID) (*APIKey, error) {
	var apiKey APIKey
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&apiKey).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get API key: %w", err)
	}
	return &apiKey, nil
}

func (r *postgresRepository) GetByKeyHash(ctx context.Context, keyHash string) (*APIKey, error) {
	var apiKey APIKey
	err := r.db.WithContext(ctx).Where("key_hash = ? AND is_revoked = false", keyHash).First(&apiKey).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get API key by hash: %w", err)
	}
	return &apiKey, nil
}

func (r *postgresRepository) GetByFestival(ctx context.Context, festivalID uuid.UUID) ([]APIKey, error) {
	var apiKeys []APIKey
	err := r.db.WithContext(ctx).
		Where("festival_id = ?", festivalID).
		Order("created_at DESC").
		Find(&apiKeys).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list API keys: %w", err)
	}
	return apiKeys, nil
}

func (r *postgresRepository) UpdateLastUsed(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&APIKey{}).
		Where("id = ?", id).
		Update("last_used_at", time.Now()).Error
}

func (r *postgresRepository) RevokeKey(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&APIKey{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"is_revoked": true,
			"updated_at": time.Now(),
		}).Error
}

func (r *postgresRepository) DeleteKey(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&APIKey{}).Error
}

func (r *postgresRepository) Update(ctx context.Context, apiKey *APIKey) error {
	apiKey.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(apiKey).Error
}
