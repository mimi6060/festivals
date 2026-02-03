package webhooks

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type postgresRepository struct {
	db *gorm.DB
}

// NewRepository creates a new PostgreSQL repository for webhooks
func NewRepository(db *gorm.DB) Repository {
	return &postgresRepository{db: db}
}

func (r *postgresRepository) CreateWebhook(ctx context.Context, webhook *Webhook) error {
	return r.db.WithContext(ctx).Create(webhook).Error
}

func (r *postgresRepository) GetByID(ctx context.Context, id uuid.UUID) (*Webhook, error) {
	var webhook Webhook
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&webhook).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get webhook: %w", err)
	}
	return &webhook, nil
}

func (r *postgresRepository) GetByFestival(ctx context.Context, festivalID uuid.UUID) ([]Webhook, error) {
	var webhooks []Webhook
	err := r.db.WithContext(ctx).
		Where("festival_id = ?", festivalID).
		Order("created_at DESC").
		Find(&webhooks).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list webhooks: %w", err)
	}
	return webhooks, nil
}

func (r *postgresRepository) GetActiveByFestivalAndEvent(ctx context.Context, festivalID uuid.UUID, event string) ([]Webhook, error) {
	var webhooks []Webhook
	// Get webhooks that are active and either have the specific event or the wildcard event
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND is_active = true AND (? = ANY(events) OR '*' = ANY(events))", festivalID, event).
		Find(&webhooks).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get webhooks for event: %w", err)
	}
	return webhooks, nil
}

func (r *postgresRepository) Update(ctx context.Context, webhook *Webhook) error {
	return r.db.WithContext(ctx).Save(webhook).Error
}

func (r *postgresRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Delete deliveries first
	if err := r.db.WithContext(ctx).Where("webhook_id = ?", id).Delete(&WebhookDelivery{}).Error; err != nil {
		return fmt.Errorf("failed to delete webhook deliveries: %w", err)
	}
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Webhook{}).Error
}

func (r *postgresRepository) CreateDelivery(ctx context.Context, delivery *WebhookDelivery) error {
	return r.db.WithContext(ctx).Create(delivery).Error
}

func (r *postgresRepository) GetDeliveriesByWebhook(ctx context.Context, webhookID uuid.UUID, limit, offset int) ([]WebhookDelivery, int64, error) {
	var deliveries []WebhookDelivery
	var total int64

	query := r.db.WithContext(ctx).Model(&WebhookDelivery{}).Where("webhook_id = ?", webhookID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count deliveries: %w", err)
	}

	if err := query.
		Order("delivered_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&deliveries).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list deliveries: %w", err)
	}

	return deliveries, total, nil
}

func (r *postgresRepository) GetDeliveryByID(ctx context.Context, id uuid.UUID) (*WebhookDelivery, error) {
	var delivery WebhookDelivery
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&delivery).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get delivery: %w", err)
	}
	return &delivery, nil
}
