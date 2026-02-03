package api

import (
	"time"

	"github.com/google/uuid"
)

// Permission represents granular API permissions
type Permission string

const (
	PermissionFestivalsRead   Permission = "festivals:read"
	PermissionLineupRead      Permission = "lineup:read"
	PermissionTicketsRead     Permission = "tickets:read"
	PermissionTicketsWrite    Permission = "tickets:write"
	PermissionWalletsRead     Permission = "wallets:read"
	PermissionWalletsWrite    Permission = "wallets:write"
	PermissionWebhooksManage  Permission = "webhooks:manage"
	PermissionStatsRead       Permission = "stats:read"
	PermissionAll             Permission = "*"
)

// AllPermissions returns all available permissions
func AllPermissions() []Permission {
	return []Permission{
		PermissionFestivalsRead,
		PermissionLineupRead,
		PermissionTicketsRead,
		PermissionTicketsWrite,
		PermissionWalletsRead,
		PermissionWalletsWrite,
		PermissionWebhooksManage,
		PermissionStatsRead,
	}
}

// APIKey represents an API key for accessing the public API
type APIKey struct {
	ID          uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID  uuid.UUID    `json:"festivalId" gorm:"type:uuid;not null;index"`
	Name        string       `json:"name" gorm:"not null"`
	Description string       `json:"description"`
	Key         string       `json:"key" gorm:"unique;not null;index"` // Hashed key (prefix stored separately)
	KeyPrefix   string       `json:"keyPrefix" gorm:"not null"`        // First 8 chars for display (e.g., "pk_live_")
	Permissions []Permission `json:"permissions" gorm:"type:text[];serializer:json"`
	RateLimit   RateLimitConfig `json:"rateLimit" gorm:"type:jsonb;default:'{}'"`
	Status      APIKeyStatus `json:"status" gorm:"default:'ACTIVE'"`
	Environment Environment  `json:"environment" gorm:"default:'SANDBOX'"`
	LastUsedAt  *time.Time   `json:"lastUsedAt,omitempty"`
	ExpiresAt   *time.Time   `json:"expiresAt,omitempty"`
	CreatedBy   *uuid.UUID   `json:"createdBy,omitempty" gorm:"type:uuid"`
	CreatedAt   time.Time    `json:"createdAt"`
	UpdatedAt   time.Time    `json:"updatedAt"`
}

func (APIKey) TableName() string {
	return "api_keys"
}

// APIKeyStatus represents the status of an API key
type APIKeyStatus string

const (
	APIKeyStatusActive   APIKeyStatus = "ACTIVE"
	APIKeyStatusInactive APIKeyStatus = "INACTIVE"
	APIKeyStatusRevoked  APIKeyStatus = "REVOKED"
	APIKeyStatusExpired  APIKeyStatus = "EXPIRED"
)

// Environment represents the API environment
type Environment string

const (
	EnvironmentSandbox    Environment = "SANDBOX"
	EnvironmentProduction Environment = "PRODUCTION"
)

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	RequestsPerMinute int  `json:"requestsPerMinute"` // Max requests per minute
	RequestsPerDay    int  `json:"requestsPerDay"`    // Max requests per day
	BurstLimit        int  `json:"burstLimit"`        // Max burst requests
	Enabled           bool `json:"enabled"`           // Whether rate limiting is enabled
}

// DefaultRateLimit returns the default rate limit configuration
func DefaultRateLimit() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerMinute: 60,
		RequestsPerDay:    10000,
		BurstLimit:        10,
		Enabled:           true,
	}
}

// APIUsage tracks API usage statistics
type APIUsage struct {
	ID            uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	APIKeyID      uuid.UUID  `json:"apiKeyId" gorm:"type:uuid;not null;index"`
	FestivalID    uuid.UUID  `json:"festivalId" gorm:"type:uuid;not null;index"`
	Endpoint      string     `json:"endpoint" gorm:"not null"`
	Method        string     `json:"method" gorm:"not null"`
	StatusCode    int        `json:"statusCode"`
	RequestsCount int64      `json:"requestsCount" gorm:"default:1"`
	Bandwidth     int64      `json:"bandwidth"`           // Bytes transferred
	ResponseTime  int64      `json:"responseTime"`        // Milliseconds
	Period        string     `json:"period" gorm:"index"` // Format: 2006-01-02-15 (hourly buckets)
	Timestamp     time.Time  `json:"timestamp"`
	CreatedAt     time.Time  `json:"createdAt"`
}

func (APIUsage) TableName() string {
	return "api_usage"
}

// APIUsageAggregate represents aggregated usage statistics
type APIUsageAggregate struct {
	APIKeyID         uuid.UUID `json:"apiKeyId"`
	TotalRequests    int64     `json:"totalRequests"`
	TotalBandwidth   int64     `json:"totalBandwidth"`
	AvgResponseTime  float64   `json:"avgResponseTime"`
	SuccessfulCount  int64     `json:"successfulCount"`
	ErrorCount       int64     `json:"errorCount"`
	UniqueEndpoints  int       `json:"uniqueEndpoints"`
	Period           string    `json:"period"`
}

// WebhookEventType represents the type of webhook event
type WebhookEventType string

const (
	WebhookEventTicketSold       WebhookEventType = "ticket.sold"
	WebhookEventTicketScanned    WebhookEventType = "ticket.scanned"
	WebhookEventTicketTransferred WebhookEventType = "ticket.transferred"
	WebhookEventWalletTopUp      WebhookEventType = "wallet.topup"
	WebhookEventWalletTransaction WebhookEventType = "wallet.transaction"
	WebhookEventRefundRequested  WebhookEventType = "refund.requested"
	WebhookEventRefundProcessed  WebhookEventType = "refund.processed"
	WebhookEventFestivalUpdated  WebhookEventType = "festival.updated"
	WebhookEventLineupChanged    WebhookEventType = "lineup.changed"
)

// AllWebhookEvents returns all available webhook event types
func AllWebhookEvents() []WebhookEventType {
	return []WebhookEventType{
		WebhookEventTicketSold,
		WebhookEventTicketScanned,
		WebhookEventTicketTransferred,
		WebhookEventWalletTopUp,
		WebhookEventWalletTransaction,
		WebhookEventRefundRequested,
		WebhookEventRefundProcessed,
		WebhookEventFestivalUpdated,
		WebhookEventLineupChanged,
	}
}

// Webhook represents a webhook configuration
type Webhook struct {
	ID          uuid.UUID          `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	APIKeyID    uuid.UUID          `json:"apiKeyId" gorm:"type:uuid;not null;index"`
	FestivalID  uuid.UUID          `json:"festivalId" gorm:"type:uuid;not null;index"`
	URL         string             `json:"url" gorm:"not null"`
	Description string             `json:"description"`
	Events      []WebhookEventType `json:"events" gorm:"type:text[];serializer:json"`
	Secret      string             `json:"secret" gorm:"not null"` // Signing secret
	Status      WebhookStatus      `json:"status" gorm:"default:'ACTIVE'"`
	Headers     map[string]string  `json:"headers" gorm:"type:jsonb;default:'{}'"` // Custom headers
	RetryConfig RetryConfig        `json:"retryConfig" gorm:"type:jsonb;default:'{}'"`
	LastTriggeredAt *time.Time     `json:"lastTriggeredAt,omitempty"`
	FailureCount    int            `json:"failureCount" gorm:"default:0"`
	CreatedAt   time.Time          `json:"createdAt"`
	UpdatedAt   time.Time          `json:"updatedAt"`
}

func (Webhook) TableName() string {
	return "webhooks"
}

// WebhookStatus represents the status of a webhook
type WebhookStatus string

const (
	WebhookStatusActive   WebhookStatus = "ACTIVE"
	WebhookStatusInactive WebhookStatus = "INACTIVE"
	WebhookStatusFailing  WebhookStatus = "FAILING"  // Too many failures
	WebhookStatusDisabled WebhookStatus = "DISABLED" // Manually disabled
)

// RetryConfig holds webhook retry configuration
type RetryConfig struct {
	MaxRetries      int   `json:"maxRetries"`      // Max retry attempts
	RetryDelayMs    int64 `json:"retryDelayMs"`    // Initial delay between retries
	BackoffMultiplier float64 `json:"backoffMultiplier"` // Exponential backoff multiplier
}

// DefaultRetryConfig returns the default retry configuration
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:      3,
		RetryDelayMs:    1000,
		BackoffMultiplier: 2.0,
	}
}

// WebhookDelivery tracks webhook delivery attempts
type WebhookDelivery struct {
	ID           uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	WebhookID    uuid.UUID       `json:"webhookId" gorm:"type:uuid;not null;index"`
	EventType    WebhookEventType `json:"eventType" gorm:"not null"`
	Payload      string          `json:"payload" gorm:"type:text;not null"` // JSON payload
	ResponseCode int             `json:"responseCode"`
	ResponseBody string          `json:"responseBody" gorm:"type:text"`
	Duration     int64           `json:"duration"` // Milliseconds
	Success      bool            `json:"success" gorm:"not null"`
	Error        string          `json:"error,omitempty"`
	AttemptNumber int            `json:"attemptNumber" gorm:"default:1"`
	DeliveredAt  time.Time       `json:"deliveredAt"`
}

func (WebhookDelivery) TableName() string {
	return "webhook_deliveries"
}

// =====================
// Request DTOs
// =====================

// CreateAPIKeyRequest represents the request to create an API key
type CreateAPIKeyRequest struct {
	Name        string       `json:"name" binding:"required"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions" binding:"required,min=1"`
	RateLimit   *RateLimitConfig `json:"rateLimit"`
	Environment Environment  `json:"environment"`
	ExpiresAt   *time.Time   `json:"expiresAt"`
}

// UpdateAPIKeyRequest represents the request to update an API key
type UpdateAPIKeyRequest struct {
	Name        *string          `json:"name,omitempty"`
	Description *string          `json:"description,omitempty"`
	Permissions []Permission     `json:"permissions,omitempty"`
	RateLimit   *RateLimitConfig `json:"rateLimit,omitempty"`
	Status      *APIKeyStatus    `json:"status,omitempty"`
	ExpiresAt   *time.Time       `json:"expiresAt,omitempty"`
}

// CreateWebhookRequest represents the request to create a webhook
type CreateWebhookRequest struct {
	URL         string             `json:"url" binding:"required,url"`
	Description string             `json:"description"`
	Events      []WebhookEventType `json:"events" binding:"required,min=1"`
	Headers     map[string]string  `json:"headers"`
	RetryConfig *RetryConfig       `json:"retryConfig"`
}

// UpdateWebhookRequest represents the request to update a webhook
type UpdateWebhookRequest struct {
	URL         *string            `json:"url,omitempty" binding:"omitempty,url"`
	Description *string            `json:"description,omitempty"`
	Events      []WebhookEventType `json:"events,omitempty"`
	Headers     map[string]string  `json:"headers,omitempty"`
	RetryConfig *RetryConfig       `json:"retryConfig,omitempty"`
	Status      *WebhookStatus     `json:"status,omitempty"`
}

// TestWebhookRequest represents a request to test a webhook
type TestWebhookRequest struct {
	EventType WebhookEventType `json:"eventType" binding:"required"`
	Payload   map[string]any   `json:"payload"`
}

// =====================
// Response DTOs
// =====================

// APIKeyResponse represents the API response for an API key (without the full key)
type APIKeyResponse struct {
	ID          uuid.UUID       `json:"id"`
	FestivalID  uuid.UUID       `json:"festivalId"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	KeyPrefix   string          `json:"keyPrefix"`
	Permissions []Permission    `json:"permissions"`
	RateLimit   RateLimitConfig `json:"rateLimit"`
	Status      APIKeyStatus    `json:"status"`
	Environment Environment     `json:"environment"`
	LastUsedAt  *string         `json:"lastUsedAt,omitempty"`
	ExpiresAt   *string         `json:"expiresAt,omitempty"`
	CreatedAt   string          `json:"createdAt"`
}

func (k *APIKey) ToResponse() APIKeyResponse {
	var lastUsedAt, expiresAt *string
	if k.LastUsedAt != nil {
		t := k.LastUsedAt.Format(time.RFC3339)
		lastUsedAt = &t
	}
	if k.ExpiresAt != nil {
		t := k.ExpiresAt.Format(time.RFC3339)
		expiresAt = &t
	}

	return APIKeyResponse{
		ID:          k.ID,
		FestivalID:  k.FestivalID,
		Name:        k.Name,
		Description: k.Description,
		KeyPrefix:   k.KeyPrefix,
		Permissions: k.Permissions,
		RateLimit:   k.RateLimit,
		Status:      k.Status,
		Environment: k.Environment,
		LastUsedAt:  lastUsedAt,
		ExpiresAt:   expiresAt,
		CreatedAt:   k.CreatedAt.Format(time.RFC3339),
	}
}

// APIKeyCreatedResponse includes the full key (only returned on creation)
type APIKeyCreatedResponse struct {
	APIKeyResponse
	Key string `json:"key"` // Full API key (only shown once!)
}

// WebhookResponse represents the API response for a webhook
type WebhookResponse struct {
	ID              uuid.UUID          `json:"id"`
	APIKeyID        uuid.UUID          `json:"apiKeyId"`
	FestivalID      uuid.UUID          `json:"festivalId"`
	URL             string             `json:"url"`
	Description     string             `json:"description"`
	Events          []WebhookEventType `json:"events"`
	Status          WebhookStatus      `json:"status"`
	Headers         map[string]string  `json:"headers,omitempty"`
	RetryConfig     RetryConfig        `json:"retryConfig"`
	LastTriggeredAt *string            `json:"lastTriggeredAt,omitempty"`
	FailureCount    int                `json:"failureCount"`
	CreatedAt       string             `json:"createdAt"`
}

func (w *Webhook) ToResponse() WebhookResponse {
	var lastTriggeredAt *string
	if w.LastTriggeredAt != nil {
		t := w.LastTriggeredAt.Format(time.RFC3339)
		lastTriggeredAt = &t
	}

	return WebhookResponse{
		ID:              w.ID,
		APIKeyID:        w.APIKeyID,
		FestivalID:      w.FestivalID,
		URL:             w.URL,
		Description:     w.Description,
		Events:          w.Events,
		Status:          w.Status,
		Headers:         w.Headers,
		RetryConfig:     w.RetryConfig,
		LastTriggeredAt: lastTriggeredAt,
		FailureCount:    w.FailureCount,
		CreatedAt:       w.CreatedAt.Format(time.RFC3339),
	}
}

// WebhookCreatedResponse includes the signing secret (only returned on creation)
type WebhookCreatedResponse struct {
	WebhookResponse
	Secret string `json:"secret"` // Signing secret (only shown once!)
}

// APIUsageResponse represents usage statistics
type APIUsageResponse struct {
	APIKeyID        uuid.UUID          `json:"apiKeyId"`
	TotalRequests   int64              `json:"totalRequests"`
	TotalBandwidth  int64              `json:"totalBandwidth"`
	AvgResponseTime float64            `json:"avgResponseTime"`
	SuccessRate     float64            `json:"successRate"`
	TopEndpoints    []EndpointStats    `json:"topEndpoints"`
	DailyUsage      []DailyUsageStats  `json:"dailyUsage"`
	Period          string             `json:"period"`
}

// EndpointStats represents statistics for a specific endpoint
type EndpointStats struct {
	Endpoint        string  `json:"endpoint"`
	Method          string  `json:"method"`
	RequestCount    int64   `json:"requestCount"`
	AvgResponseTime float64 `json:"avgResponseTime"`
	ErrorRate       float64 `json:"errorRate"`
}

// DailyUsageStats represents daily usage breakdown
type DailyUsageStats struct {
	Date          string  `json:"date"`
	RequestCount  int64   `json:"requestCount"`
	Bandwidth     int64   `json:"bandwidth"`
	ErrorCount    int64   `json:"errorCount"`
}

// WebhookDeliveryResponse represents a webhook delivery attempt
type WebhookDeliveryResponse struct {
	ID            uuid.UUID        `json:"id"`
	WebhookID     uuid.UUID        `json:"webhookId"`
	EventType     WebhookEventType `json:"eventType"`
	ResponseCode  int              `json:"responseCode"`
	Duration      int64            `json:"duration"`
	Success       bool             `json:"success"`
	Error         string           `json:"error,omitempty"`
	AttemptNumber int              `json:"attemptNumber"`
	DeliveredAt   string           `json:"deliveredAt"`
}

func (d *WebhookDelivery) ToResponse() WebhookDeliveryResponse {
	return WebhookDeliveryResponse{
		ID:            d.ID,
		WebhookID:     d.WebhookID,
		EventType:     d.EventType,
		ResponseCode:  d.ResponseCode,
		Duration:      d.Duration,
		Success:       d.Success,
		Error:         d.Error,
		AttemptNumber: d.AttemptNumber,
		DeliveredAt:   d.DeliveredAt.Format(time.RFC3339),
	}
}

// WebhookPayload represents the structure of webhook payloads
type WebhookPayload struct {
	ID         string           `json:"id"`         // Unique delivery ID
	Timestamp  string           `json:"timestamp"`  // ISO 8601 timestamp
	Event      WebhookEventType `json:"event"`      // Event type
	FestivalID string           `json:"festivalId"` // Festival ID
	Data       any              `json:"data"`       // Event-specific data
}
