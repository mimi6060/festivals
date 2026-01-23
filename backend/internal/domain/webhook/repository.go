package webhook

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for webhook data access
type Repository interface {
	// Webhook configuration operations
	GetWebhookByID(ctx context.Context, id uuid.UUID) (*WebhookConfig, error)
	GetWebhooksByFestival(ctx context.Context, festivalID uuid.UUID) ([]WebhookConfig, error)
	GetActiveWebhooksForEvent(ctx context.Context, festivalID uuid.UUID, eventType EventType) ([]WebhookConfig, error)
	CreateWebhook(ctx context.Context, webhook *WebhookConfig) error
	UpdateWebhook(ctx context.Context, webhook *WebhookConfig) error
	DeleteWebhook(ctx context.Context, id uuid.UUID) error

	// Delivery operations
	CreateDelivery(ctx context.Context, delivery *WebhookDelivery) error
	UpdateDelivery(ctx context.Context, delivery *WebhookDelivery) error
	GetDeliveryByID(ctx context.Context, id uuid.UUID) (*WebhookDelivery, error)
	GetDeliveriesByWebhook(ctx context.Context, webhookID uuid.UUID, offset, limit int) ([]WebhookDelivery, int64, error)
	GetPendingDeliveries(ctx context.Context, limit int) ([]WebhookDelivery, error)
	GetDeliveriesForRetry(ctx context.Context, limit int) ([]WebhookDelivery, error)

	// Delivery attempt operations
	CreateDeliveryAttempt(ctx context.Context, attempt *DeliveryAttempt) error
	GetAttemptsByDelivery(ctx context.Context, deliveryID uuid.UUID) ([]DeliveryAttempt, error)

	// Statistics
	GetDeliveryStats(ctx context.Context, webhookID uuid.UUID, since time.Time) (*DeliveryStats, error)
	GetFestivalDeliveryStats(ctx context.Context, festivalID uuid.UUID, since time.Time) (*DeliveryStats, error)

	// Cleanup
	DeleteOldDeliveries(ctx context.Context, olderThan time.Time) (int64, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new webhook repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// ============================================================================
// Webhook Configuration Operations
// ============================================================================

// GetWebhookByID retrieves a webhook by ID
func (r *repository) GetWebhookByID(ctx context.Context, id uuid.UUID) (*WebhookConfig, error) {
	var webhook WebhookConfig
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&webhook).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get webhook: %w", err)
	}
	return &webhook, nil
}

// GetWebhooksByFestival retrieves all webhooks for a festival
func (r *repository) GetWebhooksByFestival(ctx context.Context, festivalID uuid.UUID) ([]WebhookConfig, error) {
	var webhooks []WebhookConfig
	err := r.db.WithContext(ctx).
		Where("festival_id = ?", festivalID).
		Order("created_at DESC").
		Find(&webhooks).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list webhooks: %w", err)
	}
	return webhooks, nil
}

// GetActiveWebhooksForEvent retrieves all active webhooks subscribed to a specific event type
func (r *repository) GetActiveWebhooksForEvent(ctx context.Context, festivalID uuid.UUID, eventType EventType) ([]WebhookConfig, error) {
	var webhooks []WebhookConfig

	// Query for webhooks that:
	// 1. Belong to the festival
	// 2. Are active
	// 3. Subscribe to this event type (stored as JSON array)
	err := r.db.WithContext(ctx).
		Where("festival_id = ?", festivalID).
		Where("status = ?", WebhookStatusActive).
		Where("? = ANY(events)", string(eventType)).
		Find(&webhooks).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get webhooks for event: %w", err)
	}
	return webhooks, nil
}

// CreateWebhook creates a new webhook configuration
func (r *repository) CreateWebhook(ctx context.Context, webhook *WebhookConfig) error {
	return r.db.WithContext(ctx).Create(webhook).Error
}

// UpdateWebhook updates an existing webhook configuration
func (r *repository) UpdateWebhook(ctx context.Context, webhook *WebhookConfig) error {
	return r.db.WithContext(ctx).Save(webhook).Error
}

// DeleteWebhook deletes a webhook by ID
func (r *repository) DeleteWebhook(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&WebhookConfig{}, "id = ?", id).Error
}

// ============================================================================
// Delivery Operations
// ============================================================================

// CreateDelivery creates a new webhook delivery record
func (r *repository) CreateDelivery(ctx context.Context, delivery *WebhookDelivery) error {
	return r.db.WithContext(ctx).Create(delivery).Error
}

// UpdateDelivery updates a webhook delivery record
func (r *repository) UpdateDelivery(ctx context.Context, delivery *WebhookDelivery) error {
	return r.db.WithContext(ctx).Save(delivery).Error
}

// GetDeliveryByID retrieves a delivery by ID
func (r *repository) GetDeliveryByID(ctx context.Context, id uuid.UUID) (*WebhookDelivery, error) {
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

// GetDeliveriesByWebhook retrieves deliveries for a specific webhook with pagination
func (r *repository) GetDeliveriesByWebhook(ctx context.Context, webhookID uuid.UUID, offset, limit int) ([]WebhookDelivery, int64, error) {
	var deliveries []WebhookDelivery
	var total int64

	query := r.db.WithContext(ctx).Model(&WebhookDelivery{}).Where("webhook_id = ?", webhookID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count deliveries: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&deliveries).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list deliveries: %w", err)
	}

	return deliveries, total, nil
}

// GetPendingDeliveries retrieves pending deliveries for processing
func (r *repository) GetPendingDeliveries(ctx context.Context, limit int) ([]WebhookDelivery, error) {
	var deliveries []WebhookDelivery
	err := r.db.WithContext(ctx).
		Where("status = ?", DeliveryStatusPending).
		Order("created_at ASC").
		Limit(limit).
		Find(&deliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get pending deliveries: %w", err)
	}
	return deliveries, nil
}

// GetDeliveriesForRetry retrieves deliveries that are due for retry
func (r *repository) GetDeliveriesForRetry(ctx context.Context, limit int) ([]WebhookDelivery, error) {
	var deliveries []WebhookDelivery
	err := r.db.WithContext(ctx).
		Where("status = ?", DeliveryStatusRetrying).
		Where("next_retry_at <= ?", time.Now().UTC()).
		Order("next_retry_at ASC").
		Limit(limit).
		Find(&deliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get deliveries for retry: %w", err)
	}
	return deliveries, nil
}

// ============================================================================
// Delivery Attempt Operations
// ============================================================================

// CreateDeliveryAttempt creates a new delivery attempt record
func (r *repository) CreateDeliveryAttempt(ctx context.Context, attempt *DeliveryAttempt) error {
	return r.db.WithContext(ctx).Create(attempt).Error
}

// GetAttemptsByDelivery retrieves all attempts for a delivery
func (r *repository) GetAttemptsByDelivery(ctx context.Context, deliveryID uuid.UUID) ([]DeliveryAttempt, error) {
	var attempts []DeliveryAttempt
	err := r.db.WithContext(ctx).
		Where("delivery_id = ?", deliveryID).
		Order("attempt_number ASC").
		Find(&attempts).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get delivery attempts: %w", err)
	}
	return attempts, nil
}

// ============================================================================
// Statistics
// ============================================================================

// DeliveryStats holds delivery statistics
type DeliveryStats struct {
	TotalDeliveries    int64   `json:"totalDeliveries"`
	SuccessfulDeliveries int64 `json:"successfulDeliveries"`
	FailedDeliveries   int64   `json:"failedDeliveries"`
	PendingDeliveries  int64   `json:"pendingDeliveries"`
	RetryingDeliveries int64   `json:"retryingDeliveries"`
	AverageAttempts    float64 `json:"averageAttempts"`
	SuccessRate        float64 `json:"successRate"`
}

// GetDeliveryStats retrieves delivery statistics for a webhook
func (r *repository) GetDeliveryStats(ctx context.Context, webhookID uuid.UUID, since time.Time) (*DeliveryStats, error) {
	var stats DeliveryStats

	// Get counts by status
	err := r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("webhook_id = ?", webhookID).
		Where("created_at >= ?", since).
		Count(&stats.TotalDeliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get total count: %w", err)
	}

	err = r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("webhook_id = ?", webhookID).
		Where("created_at >= ?", since).
		Where("status = ?", DeliveryStatusDelivered).
		Count(&stats.SuccessfulDeliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get success count: %w", err)
	}

	err = r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("webhook_id = ?", webhookID).
		Where("created_at >= ?", since).
		Where("status = ?", DeliveryStatusFailed).
		Count(&stats.FailedDeliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get failed count: %w", err)
	}

	err = r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("webhook_id = ?", webhookID).
		Where("created_at >= ?", since).
		Where("status = ?", DeliveryStatusPending).
		Count(&stats.PendingDeliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get pending count: %w", err)
	}

	err = r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("webhook_id = ?", webhookID).
		Where("created_at >= ?", since).
		Where("status = ?", DeliveryStatusRetrying).
		Count(&stats.RetryingDeliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get retrying count: %w", err)
	}

	// Calculate average attempts
	var avgAttempts float64
	r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("webhook_id = ?", webhookID).
		Where("created_at >= ?", since).
		Select("COALESCE(AVG(attempt_count), 0)").
		Scan(&avgAttempts)
	stats.AverageAttempts = avgAttempts

	// Calculate success rate
	if stats.TotalDeliveries > 0 {
		stats.SuccessRate = float64(stats.SuccessfulDeliveries) / float64(stats.TotalDeliveries) * 100
	}

	return &stats, nil
}

// GetFestivalDeliveryStats retrieves delivery statistics for all webhooks in a festival
func (r *repository) GetFestivalDeliveryStats(ctx context.Context, festivalID uuid.UUID, since time.Time) (*DeliveryStats, error) {
	var stats DeliveryStats

	// Get counts by status
	err := r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("festival_id = ?", festivalID).
		Where("created_at >= ?", since).
		Count(&stats.TotalDeliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get total count: %w", err)
	}

	err = r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("festival_id = ?", festivalID).
		Where("created_at >= ?", since).
		Where("status = ?", DeliveryStatusDelivered).
		Count(&stats.SuccessfulDeliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get success count: %w", err)
	}

	err = r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("festival_id = ?", festivalID).
		Where("created_at >= ?", since).
		Where("status = ?", DeliveryStatusFailed).
		Count(&stats.FailedDeliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get failed count: %w", err)
	}

	err = r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("festival_id = ?", festivalID).
		Where("created_at >= ?", since).
		Where("status = ?", DeliveryStatusPending).
		Count(&stats.PendingDeliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get pending count: %w", err)
	}

	err = r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("festival_id = ?", festivalID).
		Where("created_at >= ?", since).
		Where("status = ?", DeliveryStatusRetrying).
		Count(&stats.RetryingDeliveries).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get retrying count: %w", err)
	}

	// Calculate average attempts
	var avgAttempts float64
	r.db.WithContext(ctx).Model(&WebhookDelivery{}).
		Where("festival_id = ?", festivalID).
		Where("created_at >= ?", since).
		Select("COALESCE(AVG(attempt_count), 0)").
		Scan(&avgAttempts)
	stats.AverageAttempts = avgAttempts

	// Calculate success rate
	if stats.TotalDeliveries > 0 {
		stats.SuccessRate = float64(stats.SuccessfulDeliveries) / float64(stats.TotalDeliveries) * 100
	}

	return &stats, nil
}

// ============================================================================
// Cleanup
// ============================================================================

// DeleteOldDeliveries deletes delivery records older than the specified time
func (r *repository) DeleteOldDeliveries(ctx context.Context, olderThan time.Time) (int64, error) {
	// First delete old attempts
	result := r.db.WithContext(ctx).
		Where("attempted_at < ?", olderThan).
		Delete(&DeliveryAttempt{})
	if result.Error != nil {
		return 0, fmt.Errorf("failed to delete old attempts: %w", result.Error)
	}

	// Then delete old deliveries
	result = r.db.WithContext(ctx).
		Where("created_at < ?", olderThan).
		Where("status IN ?", []DeliveryStatus{DeliveryStatusDelivered, DeliveryStatusFailed}).
		Delete(&WebhookDelivery{})
	if result.Error != nil {
		return 0, fmt.Errorf("failed to delete old deliveries: %w", result.Error)
	}

	return result.RowsAffected, nil
}
