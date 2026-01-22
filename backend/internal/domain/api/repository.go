package api

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for API key and webhook persistence
type Repository interface {
	// API Keys
	CreateAPIKey(ctx context.Context, key *APIKey) error
	GetAPIKeyByID(ctx context.Context, id uuid.UUID) (*APIKey, error)
	GetAPIKeyByKey(ctx context.Context, keyHash string) (*APIKey, error)
	ListAPIKeys(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]APIKey, int64, error)
	UpdateAPIKey(ctx context.Context, key *APIKey) error
	DeleteAPIKey(ctx context.Context, id uuid.UUID) error
	UpdateAPIKeyLastUsed(ctx context.Context, id uuid.UUID) error

	// Webhooks
	CreateWebhook(ctx context.Context, webhook *Webhook) error
	GetWebhookByID(ctx context.Context, id uuid.UUID) (*Webhook, error)
	ListWebhooks(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Webhook, int64, error)
	ListWebhooksByAPIKey(ctx context.Context, apiKeyID uuid.UUID) ([]Webhook, error)
	ListWebhooksByEvent(ctx context.Context, festivalID uuid.UUID, eventType WebhookEventType) ([]Webhook, error)
	UpdateWebhook(ctx context.Context, webhook *Webhook) error
	DeleteWebhook(ctx context.Context, id uuid.UUID) error
	IncrementWebhookFailureCount(ctx context.Context, id uuid.UUID) error
	ResetWebhookFailureCount(ctx context.Context, id uuid.UUID) error

	// Webhook Deliveries
	CreateWebhookDelivery(ctx context.Context, delivery *WebhookDelivery) error
	ListWebhookDeliveries(ctx context.Context, webhookID uuid.UUID, offset, limit int) ([]WebhookDelivery, int64, error)

	// API Usage
	RecordUsage(ctx context.Context, usage *APIUsage) error
	GetUsageStats(ctx context.Context, apiKeyID uuid.UUID, startDate, endDate time.Time) (*APIUsageAggregate, error)
	GetDailyUsage(ctx context.Context, apiKeyID uuid.UUID, startDate, endDate time.Time) ([]DailyUsageStats, error)
	GetTopEndpoints(ctx context.Context, apiKeyID uuid.UUID, startDate, endDate time.Time, limit int) ([]EndpointStats, error)
	GetRequestCount(ctx context.Context, apiKeyID uuid.UUID, period string) (int64, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new API repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// =====================
// API Keys
// =====================

func (r *repository) CreateAPIKey(ctx context.Context, key *APIKey) error {
	return r.db.WithContext(ctx).Create(key).Error
}

func (r *repository) GetAPIKeyByID(ctx context.Context, id uuid.UUID) (*APIKey, error) {
	var key APIKey
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&key).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get API key: %w", err)
	}
	return &key, nil
}

func (r *repository) GetAPIKeyByKey(ctx context.Context, keyHash string) (*APIKey, error) {
	var key APIKey
	err := r.db.WithContext(ctx).Where("key = ? AND status = ?", keyHash, APIKeyStatusActive).First(&key).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get API key: %w", err)
	}
	return &key, nil
}

func (r *repository) ListAPIKeys(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]APIKey, int64, error) {
	var keys []APIKey
	var total int64

	query := r.db.WithContext(ctx).Model(&APIKey{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count API keys: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&keys).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list API keys: %w", err)
	}

	return keys, total, nil
}

func (r *repository) UpdateAPIKey(ctx context.Context, key *APIKey) error {
	return r.db.WithContext(ctx).Save(key).Error
}

func (r *repository) DeleteAPIKey(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&APIKey{}).Error
}

func (r *repository) UpdateAPIKeyLastUsed(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&APIKey{}).Where("id = ?", id).Update("last_used_at", time.Now()).Error
}

// =====================
// Webhooks
// =====================

func (r *repository) CreateWebhook(ctx context.Context, webhook *Webhook) error {
	return r.db.WithContext(ctx).Create(webhook).Error
}

func (r *repository) GetWebhookByID(ctx context.Context, id uuid.UUID) (*Webhook, error) {
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

func (r *repository) ListWebhooks(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Webhook, int64, error) {
	var webhooks []Webhook
	var total int64

	query := r.db.WithContext(ctx).Model(&Webhook{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count webhooks: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&webhooks).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list webhooks: %w", err)
	}

	return webhooks, total, nil
}

func (r *repository) ListWebhooksByAPIKey(ctx context.Context, apiKeyID uuid.UUID) ([]Webhook, error) {
	var webhooks []Webhook
	err := r.db.WithContext(ctx).Where("api_key_id = ? AND status = ?", apiKeyID, WebhookStatusActive).Find(&webhooks).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list webhooks by API key: %w", err)
	}
	return webhooks, nil
}

func (r *repository) ListWebhooksByEvent(ctx context.Context, festivalID uuid.UUID, eventType WebhookEventType) ([]Webhook, error) {
	var webhooks []Webhook
	// Use PostgreSQL array contains operator
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND status = ? AND ? = ANY(events)", festivalID, WebhookStatusActive, string(eventType)).
		Find(&webhooks).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list webhooks by event: %w", err)
	}
	return webhooks, nil
}

func (r *repository) UpdateWebhook(ctx context.Context, webhook *Webhook) error {
	return r.db.WithContext(ctx).Save(webhook).Error
}

func (r *repository) DeleteWebhook(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Webhook{}).Error
}

func (r *repository) IncrementWebhookFailureCount(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&Webhook{}).
		Where("id = ?", id).
		UpdateColumns(map[string]interface{}{
			"failure_count":     gorm.Expr("failure_count + 1"),
			"last_triggered_at": time.Now(),
		}).Error
}

func (r *repository) ResetWebhookFailureCount(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&Webhook{}).
		Where("id = ?", id).
		UpdateColumns(map[string]interface{}{
			"failure_count":     0,
			"last_triggered_at": time.Now(),
		}).Error
}

// =====================
// Webhook Deliveries
// =====================

func (r *repository) CreateWebhookDelivery(ctx context.Context, delivery *WebhookDelivery) error {
	return r.db.WithContext(ctx).Create(delivery).Error
}

func (r *repository) ListWebhookDeliveries(ctx context.Context, webhookID uuid.UUID, offset, limit int) ([]WebhookDelivery, int64, error) {
	var deliveries []WebhookDelivery
	var total int64

	query := r.db.WithContext(ctx).Model(&WebhookDelivery{}).Where("webhook_id = ?", webhookID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count webhook deliveries: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("delivered_at DESC").Find(&deliveries).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list webhook deliveries: %w", err)
	}

	return deliveries, total, nil
}

// =====================
// API Usage
// =====================

func (r *repository) RecordUsage(ctx context.Context, usage *APIUsage) error {
	return r.db.WithContext(ctx).Create(usage).Error
}

func (r *repository) GetUsageStats(ctx context.Context, apiKeyID uuid.UUID, startDate, endDate time.Time) (*APIUsageAggregate, error) {
	var result APIUsageAggregate

	err := r.db.WithContext(ctx).Model(&APIUsage{}).
		Select(`
			api_key_id,
			SUM(requests_count) as total_requests,
			SUM(bandwidth) as total_bandwidth,
			AVG(response_time) as avg_response_time,
			SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN requests_count ELSE 0 END) as successful_count,
			SUM(CASE WHEN status_code >= 400 THEN requests_count ELSE 0 END) as error_count,
			COUNT(DISTINCT endpoint) as unique_endpoints
		`).
		Where("api_key_id = ? AND timestamp BETWEEN ? AND ?", apiKeyID, startDate, endDate).
		Group("api_key_id").
		Scan(&result).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return &APIUsageAggregate{APIKeyID: apiKeyID}, nil
		}
		return nil, fmt.Errorf("failed to get usage stats: %w", err)
	}

	return &result, nil
}

func (r *repository) GetDailyUsage(ctx context.Context, apiKeyID uuid.UUID, startDate, endDate time.Time) ([]DailyUsageStats, error) {
	var results []DailyUsageStats

	err := r.db.WithContext(ctx).Model(&APIUsage{}).
		Select(`
			DATE(timestamp) as date,
			SUM(requests_count) as request_count,
			SUM(bandwidth) as bandwidth,
			SUM(CASE WHEN status_code >= 400 THEN requests_count ELSE 0 END) as error_count
		`).
		Where("api_key_id = ? AND timestamp BETWEEN ? AND ?", apiKeyID, startDate, endDate).
		Group("DATE(timestamp)").
		Order("date ASC").
		Scan(&results).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get daily usage: %w", err)
	}

	return results, nil
}

func (r *repository) GetTopEndpoints(ctx context.Context, apiKeyID uuid.UUID, startDate, endDate time.Time, limit int) ([]EndpointStats, error) {
	var results []EndpointStats

	err := r.db.WithContext(ctx).Model(&APIUsage{}).
		Select(`
			endpoint,
			method,
			SUM(requests_count) as request_count,
			AVG(response_time) as avg_response_time,
			(SUM(CASE WHEN status_code >= 400 THEN requests_count ELSE 0 END)::float / NULLIF(SUM(requests_count), 0)) * 100 as error_rate
		`).
		Where("api_key_id = ? AND timestamp BETWEEN ? AND ?", apiKeyID, startDate, endDate).
		Group("endpoint, method").
		Order("request_count DESC").
		Limit(limit).
		Scan(&results).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get top endpoints: %w", err)
	}

	return results, nil
}

func (r *repository) GetRequestCount(ctx context.Context, apiKeyID uuid.UUID, period string) (int64, error) {
	var count int64

	err := r.db.WithContext(ctx).Model(&APIUsage{}).
		Where("api_key_id = ? AND period = ?", apiKeyID, period).
		Select("COALESCE(SUM(requests_count), 0)").
		Scan(&count).Error

	if err != nil {
		return 0, fmt.Errorf("failed to get request count: %w", err)
	}

	return count, nil
}
