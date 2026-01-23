package webhook

import (
	"time"

	"github.com/google/uuid"
)

// WebhookStatus represents the status of a webhook configuration
type WebhookStatus string

const (
	WebhookStatusActive   WebhookStatus = "ACTIVE"
	WebhookStatusInactive WebhookStatus = "INACTIVE"
	WebhookStatusFailing  WebhookStatus = "FAILING"  // Too many consecutive failures
	WebhookStatusDisabled WebhookStatus = "DISABLED" // Manually disabled by admin
)

// WebhookConfig represents a webhook configuration
type WebhookConfig struct {
	ID              uuid.UUID         `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID      uuid.UUID         `json:"festivalId" gorm:"type:uuid;not null;index"`
	Name            string            `json:"name" gorm:"not null"`
	Description     string            `json:"description"`
	URL             string            `json:"url" gorm:"not null"`
	Secret          string            `json:"-" gorm:"not null"` // Never expose in JSON
	Events          []EventType       `json:"events" gorm:"type:text[];serializer:json"`
	Status          WebhookStatus     `json:"status" gorm:"default:'ACTIVE'"`
	Headers         map[string]string `json:"headers" gorm:"type:jsonb;default:'{}'"`
	MaxRetries      int               `json:"maxRetries" gorm:"default:5"`
	TimeoutSeconds  int               `json:"timeoutSeconds" gorm:"default:30"`
	FailureCount    int               `json:"failureCount" gorm:"default:0"`
	LastTriggeredAt *time.Time        `json:"lastTriggeredAt,omitempty"`
	LastSuccessAt   *time.Time        `json:"lastSuccessAt,omitempty"`
	LastFailureAt   *time.Time        `json:"lastFailureAt,omitempty"`
	CreatedBy       *uuid.UUID        `json:"createdBy,omitempty" gorm:"type:uuid"`
	CreatedAt       time.Time         `json:"createdAt"`
	UpdatedAt       time.Time         `json:"updatedAt"`
}

func (WebhookConfig) TableName() string {
	return "webhook_configs"
}

// IncrementFailure increments the failure count and potentially disables the webhook
func (w *WebhookConfig) IncrementFailure() {
	w.FailureCount++
	now := time.Now().UTC()
	w.LastFailureAt = &now
	w.UpdatedAt = now

	// Disable webhook after too many consecutive failures
	if w.FailureCount >= 10 {
		w.Status = WebhookStatusFailing
	}
}

// ResetFailureCount resets the failure count after a successful delivery
func (w *WebhookConfig) ResetFailureCount() {
	w.FailureCount = 0
	now := time.Now().UTC()
	w.LastSuccessAt = &now
	w.LastTriggeredAt = &now
	w.UpdatedAt = now

	// Restore status if it was failing
	if w.Status == WebhookStatusFailing {
		w.Status = WebhookStatusActive
	}
}

// IsActive checks if the webhook is active and can receive events
func (w *WebhookConfig) IsActive() bool {
	return w.Status == WebhookStatusActive
}

// SubscribesToEvent checks if the webhook subscribes to the given event type
func (w *WebhookConfig) SubscribesToEvent(eventType EventType) bool {
	for _, e := range w.Events {
		if e == eventType {
			return true
		}
	}
	return false
}

// ============================================================================
// Request DTOs
// ============================================================================

// CreateWebhookRequest represents the request to create a webhook
type CreateWebhookRequest struct {
	Name           string            `json:"name" binding:"required,min=1,max=100"`
	Description    string            `json:"description" binding:"max=500"`
	URL            string            `json:"url" binding:"required,url"`
	Events         []EventType       `json:"events" binding:"required,min=1"`
	Headers        map[string]string `json:"headers,omitempty"`
	MaxRetries     *int              `json:"maxRetries,omitempty"`
	TimeoutSeconds *int              `json:"timeoutSeconds,omitempty"`
}

// UpdateWebhookRequest represents the request to update a webhook
type UpdateWebhookRequest struct {
	Name           *string           `json:"name,omitempty" binding:"omitempty,min=1,max=100"`
	Description    *string           `json:"description,omitempty" binding:"omitempty,max=500"`
	URL            *string           `json:"url,omitempty" binding:"omitempty,url"`
	Events         []EventType       `json:"events,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	Status         *WebhookStatus    `json:"status,omitempty"`
	MaxRetries     *int              `json:"maxRetries,omitempty"`
	TimeoutSeconds *int              `json:"timeoutSeconds,omitempty"`
}

// TestWebhookRequest represents a request to send a test webhook
type TestWebhookRequest struct {
	EventType EventType      `json:"eventType" binding:"required"`
	Data      map[string]any `json:"data,omitempty"`
}

// ============================================================================
// Response DTOs
// ============================================================================

// WebhookConfigResponse represents the API response for a webhook configuration
type WebhookConfigResponse struct {
	ID              uuid.UUID         `json:"id"`
	FestivalID      uuid.UUID         `json:"festivalId"`
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	URL             string            `json:"url"`
	Events          []EventType       `json:"events"`
	Status          WebhookStatus     `json:"status"`
	Headers         map[string]string `json:"headers,omitempty"`
	MaxRetries      int               `json:"maxRetries"`
	TimeoutSeconds  int               `json:"timeoutSeconds"`
	FailureCount    int               `json:"failureCount"`
	LastTriggeredAt *string           `json:"lastTriggeredAt,omitempty"`
	LastSuccessAt   *string           `json:"lastSuccessAt,omitempty"`
	LastFailureAt   *string           `json:"lastFailureAt,omitempty"`
	CreatedAt       string            `json:"createdAt"`
}

// ToResponse converts WebhookConfig to WebhookConfigResponse
func (w *WebhookConfig) ToResponse() WebhookConfigResponse {
	var lastTriggeredAt, lastSuccessAt, lastFailureAt *string

	if w.LastTriggeredAt != nil {
		t := w.LastTriggeredAt.Format(time.RFC3339)
		lastTriggeredAt = &t
	}
	if w.LastSuccessAt != nil {
		t := w.LastSuccessAt.Format(time.RFC3339)
		lastSuccessAt = &t
	}
	if w.LastFailureAt != nil {
		t := w.LastFailureAt.Format(time.RFC3339)
		lastFailureAt = &t
	}

	return WebhookConfigResponse{
		ID:              w.ID,
		FestivalID:      w.FestivalID,
		Name:            w.Name,
		Description:     w.Description,
		URL:             w.URL,
		Events:          w.Events,
		Status:          w.Status,
		Headers:         w.Headers,
		MaxRetries:      w.MaxRetries,
		TimeoutSeconds:  w.TimeoutSeconds,
		FailureCount:    w.FailureCount,
		LastTriggeredAt: lastTriggeredAt,
		LastSuccessAt:   lastSuccessAt,
		LastFailureAt:   lastFailureAt,
		CreatedAt:       w.CreatedAt.Format(time.RFC3339),
	}
}

// WebhookCreatedResponse includes the secret (only returned on creation)
type WebhookCreatedResponse struct {
	WebhookConfigResponse
	Secret string `json:"secret"` // Only shown once on creation!
}

// WebhookTestResult represents the result of a webhook test
type WebhookTestResult struct {
	Success      bool   `json:"success"`
	StatusCode   int    `json:"statusCode,omitempty"`
	ResponseTime int64  `json:"responseTime"` // milliseconds
	Error        string `json:"error,omitempty"`
}

// WebhookLogEntry represents a log entry for webhook activity
type WebhookLogEntry struct {
	ID           uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	WebhookID    uuid.UUID      `json:"webhookId" gorm:"type:uuid;not null;index"`
	FestivalID   uuid.UUID      `json:"festivalId" gorm:"type:uuid;not null;index"`
	EventType    EventType      `json:"eventType" gorm:"not null;index"`
	Status       DeliveryStatus `json:"status" gorm:"not null;index"`
	StatusCode   *int           `json:"statusCode,omitempty"`
	ResponseTime *int64         `json:"responseTime,omitempty"` // milliseconds
	Error        string         `json:"error,omitempty"`
	AttemptCount int            `json:"attemptCount" gorm:"default:1"`
	Timestamp    time.Time      `json:"timestamp" gorm:"index"`
}

func (WebhookLogEntry) TableName() string {
	return "webhook_logs"
}

// WebhookLogResponse represents the API response for a webhook log entry
type WebhookLogResponse struct {
	ID           uuid.UUID      `json:"id"`
	WebhookID    uuid.UUID      `json:"webhookId"`
	EventType    string         `json:"eventType"`
	Status       DeliveryStatus `json:"status"`
	StatusCode   *int           `json:"statusCode,omitempty"`
	ResponseTime *int64         `json:"responseTime,omitempty"`
	Error        string         `json:"error,omitempty"`
	AttemptCount int            `json:"attemptCount"`
	Timestamp    string         `json:"timestamp"`
}

// ToResponse converts WebhookLogEntry to WebhookLogResponse
func (l *WebhookLogEntry) ToResponse() WebhookLogResponse {
	return WebhookLogResponse{
		ID:           l.ID,
		WebhookID:    l.WebhookID,
		EventType:    string(l.EventType),
		Status:       l.Status,
		StatusCode:   l.StatusCode,
		ResponseTime: l.ResponseTime,
		Error:        l.Error,
		AttemptCount: l.AttemptCount,
		Timestamp:    l.Timestamp.Format(time.RFC3339),
	}
}
