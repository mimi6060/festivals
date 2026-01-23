package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

// DeliveryStatus represents the status of a webhook delivery
type DeliveryStatus string

const (
	DeliveryStatusPending   DeliveryStatus = "PENDING"
	DeliveryStatusDelivered DeliveryStatus = "DELIVERED"
	DeliveryStatusFailed    DeliveryStatus = "FAILED"
	DeliveryStatusRetrying  DeliveryStatus = "RETRYING"
)

// WebhookDelivery represents a webhook delivery record
type WebhookDelivery struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	WebhookID     uuid.UUID      `json:"webhookId" gorm:"type:uuid;not null;index"`
	FestivalID    uuid.UUID      `json:"festivalId" gorm:"type:uuid;not null;index"`
	EventID       uuid.UUID      `json:"eventId" gorm:"type:uuid;not null;index"`
	EventType     EventType      `json:"eventType" gorm:"not null;index"`
	URL           string         `json:"url" gorm:"not null"`
	Payload       string         `json:"payload" gorm:"type:text;not null"`
	Signature     string         `json:"signature" gorm:"not null"`
	Status        DeliveryStatus `json:"status" gorm:"default:'PENDING';index"`
	AttemptCount  int            `json:"attemptCount" gorm:"default:0"`
	MaxAttempts   int            `json:"maxAttempts" gorm:"default:5"`
	NextRetryAt   *time.Time     `json:"nextRetryAt,omitempty" gorm:"index"`
	DeliveredAt   *time.Time     `json:"deliveredAt,omitempty"`
	LastError     string         `json:"lastError,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
}

func (WebhookDelivery) TableName() string {
	return "webhook_deliveries"
}

// DeliveryAttempt represents a single delivery attempt
type DeliveryAttempt struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	DeliveryID   uuid.UUID `json:"deliveryId" gorm:"type:uuid;not null;index"`
	AttemptNumber int      `json:"attemptNumber" gorm:"not null"`
	StatusCode   int       `json:"statusCode"`
	ResponseBody string    `json:"responseBody" gorm:"type:text"`
	ResponseTime int64     `json:"responseTime"` // milliseconds
	Success      bool      `json:"success" gorm:"not null"`
	Error        string    `json:"error,omitempty"`
	AttemptedAt  time.Time `json:"attemptedAt"`
}

func (DeliveryAttempt) TableName() string {
	return "webhook_delivery_attempts"
}

// NewWebhookDelivery creates a new webhook delivery
func NewWebhookDelivery(webhookID, festivalID uuid.UUID, event *Event, url, secret string, maxAttempts int) (*WebhookDelivery, error) {
	// Convert event to JSON payload
	payload := event.ToPayload("2024-01-01")
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal event payload: %w", err)
	}

	// Generate signature
	signature := GenerateSignature(payloadBytes, secret, event.Timestamp)

	return &WebhookDelivery{
		ID:           uuid.New(),
		WebhookID:    webhookID,
		FestivalID:   festivalID,
		EventID:      event.ID,
		EventType:    event.Type,
		URL:          url,
		Payload:      string(payloadBytes),
		Signature:    signature,
		Status:       DeliveryStatusPending,
		AttemptCount: 0,
		MaxAttempts:  maxAttempts,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}, nil
}

// GenerateSignature generates an HMAC-SHA256 signature for webhook payload
func GenerateSignature(payload []byte, secret string, timestamp time.Time) string {
	// Create the signed payload: timestamp.payload
	signedPayload := fmt.Sprintf("%d.%s", timestamp.Unix(), string(payload))

	// Generate HMAC-SHA256
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(signedPayload))
	signature := hex.EncodeToString(h.Sum(nil))

	// Return in format: t=timestamp,v1=signature
	return fmt.Sprintf("t=%d,v1=%s", timestamp.Unix(), signature)
}

// VerifySignature verifies a webhook signature
func VerifySignature(payload []byte, signature, secret string, tolerance time.Duration) bool {
	// Parse signature
	var timestamp int64
	var sig string
	_, err := fmt.Sscanf(signature, "t=%d,v1=%s", &timestamp, &sig)
	if err != nil {
		return false
	}

	// Check timestamp tolerance
	signatureTime := time.Unix(timestamp, 0)
	if time.Since(signatureTime) > tolerance {
		return false
	}

	// Regenerate expected signature
	expectedSignedPayload := fmt.Sprintf("%d.%s", timestamp, string(payload))
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(expectedSignedPayload))
	expectedSignature := hex.EncodeToString(h.Sum(nil))

	// Compare signatures using constant-time comparison
	return hmac.Equal([]byte(sig), []byte(expectedSignature))
}

// MarkDelivered marks the delivery as successful
func (d *WebhookDelivery) MarkDelivered() {
	now := time.Now().UTC()
	d.Status = DeliveryStatusDelivered
	d.DeliveredAt = &now
	d.UpdatedAt = now
	d.NextRetryAt = nil
}

// MarkFailed marks the delivery as failed
func (d *WebhookDelivery) MarkFailed(err string) {
	d.Status = DeliveryStatusFailed
	d.LastError = err
	d.UpdatedAt = time.Now().UTC()
	d.NextRetryAt = nil
}

// ScheduleRetry schedules a retry with exponential backoff
func (d *WebhookDelivery) ScheduleRetry(err string) bool {
	d.AttemptCount++
	d.LastError = err
	d.UpdatedAt = time.Now().UTC()

	// Check if max attempts reached
	if d.AttemptCount >= d.MaxAttempts {
		d.Status = DeliveryStatusFailed
		d.NextRetryAt = nil
		return false
	}

	// Calculate next retry time with exponential backoff
	// Base delay: 10 seconds, multiplied by 2^attempt
	// Attempts: 10s, 20s, 40s, 80s, 160s (capped at 5 minutes)
	delay := CalculateBackoff(d.AttemptCount, 10*time.Second, 5*time.Minute, 2.0)
	nextRetry := time.Now().UTC().Add(delay)

	d.Status = DeliveryStatusRetrying
	d.NextRetryAt = &nextRetry

	return true
}

// CalculateBackoff calculates exponential backoff delay
func CalculateBackoff(attempt int, baseDelay, maxDelay time.Duration, multiplier float64) time.Duration {
	// Calculate delay: baseDelay * multiplier^(attempt-1)
	delay := float64(baseDelay) * math.Pow(multiplier, float64(attempt-1))

	// Add jitter (10% random variation) to prevent thundering herd
	jitter := delay * 0.1
	delay = delay + (jitter * (float64(time.Now().UnixNano()%100) / 100.0))

	// Cap at max delay
	if time.Duration(delay) > maxDelay {
		return maxDelay
	}

	return time.Duration(delay)
}

// ShouldRetry checks if the delivery should be retried
func (d *WebhookDelivery) ShouldRetry() bool {
	return d.Status == DeliveryStatusRetrying &&
		d.NextRetryAt != nil &&
		d.NextRetryAt.Before(time.Now().UTC())
}

// CanRetry checks if the delivery has retries remaining
func (d *WebhookDelivery) CanRetry() bool {
	return d.AttemptCount < d.MaxAttempts
}

// NewDeliveryAttempt creates a new delivery attempt record
func NewDeliveryAttempt(deliveryID uuid.UUID, attemptNumber, statusCode int, responseBody string, responseTime int64, success bool, err string) *DeliveryAttempt {
	return &DeliveryAttempt{
		ID:            uuid.New(),
		DeliveryID:    deliveryID,
		AttemptNumber: attemptNumber,
		StatusCode:    statusCode,
		ResponseBody:  responseBody,
		ResponseTime:  responseTime,
		Success:       success,
		Error:         err,
		AttemptedAt:   time.Now().UTC(),
	}
}

// RetryConfig holds configuration for retry behavior
type RetryConfig struct {
	MaxAttempts       int           `json:"maxAttempts"`
	BaseDelay         time.Duration `json:"baseDelay"`
	MaxDelay          time.Duration `json:"maxDelay"`
	BackoffMultiplier float64       `json:"backoffMultiplier"`
}

// DefaultRetryConfig returns the default retry configuration
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:       5,
		BaseDelay:         10 * time.Second,
		MaxDelay:          5 * time.Minute,
		BackoffMultiplier: 2.0,
	}
}

// DeliveryResponse represents the response for a delivery attempt
type DeliveryResponse struct {
	ID            uuid.UUID      `json:"id"`
	WebhookID     uuid.UUID      `json:"webhookId"`
	EventID       uuid.UUID      `json:"eventId"`
	EventType     string         `json:"eventType"`
	Status        DeliveryStatus `json:"status"`
	AttemptCount  int            `json:"attemptCount"`
	MaxAttempts   int            `json:"maxAttempts"`
	NextRetryAt   *string        `json:"nextRetryAt,omitempty"`
	DeliveredAt   *string        `json:"deliveredAt,omitempty"`
	LastError     string         `json:"lastError,omitempty"`
	CreatedAt     string         `json:"createdAt"`
}

// ToResponse converts WebhookDelivery to DeliveryResponse
func (d *WebhookDelivery) ToResponse() DeliveryResponse {
	var nextRetryAt, deliveredAt *string

	if d.NextRetryAt != nil {
		t := d.NextRetryAt.Format(time.RFC3339)
		nextRetryAt = &t
	}

	if d.DeliveredAt != nil {
		t := d.DeliveredAt.Format(time.RFC3339)
		deliveredAt = &t
	}

	return DeliveryResponse{
		ID:           d.ID,
		WebhookID:    d.WebhookID,
		EventID:      d.EventID,
		EventType:    string(d.EventType),
		Status:       d.Status,
		AttemptCount: d.AttemptCount,
		MaxAttempts:  d.MaxAttempts,
		NextRetryAt:  nextRetryAt,
		DeliveredAt:  deliveredAt,
		LastError:    d.LastError,
		CreatedAt:    d.CreatedAt.Format(time.RFC3339),
	}
}

// DeliveryAttemptResponse represents the response for a delivery attempt
type DeliveryAttemptResponse struct {
	ID            uuid.UUID `json:"id"`
	DeliveryID    uuid.UUID `json:"deliveryId"`
	AttemptNumber int       `json:"attemptNumber"`
	StatusCode    int       `json:"statusCode"`
	ResponseTime  int64     `json:"responseTime"`
	Success       bool      `json:"success"`
	Error         string    `json:"error,omitempty"`
	AttemptedAt   string    `json:"attemptedAt"`
}

// ToResponse converts DeliveryAttempt to DeliveryAttemptResponse
func (a *DeliveryAttempt) ToResponse() DeliveryAttemptResponse {
	return DeliveryAttemptResponse{
		ID:            a.ID,
		DeliveryID:    a.DeliveryID,
		AttemptNumber: a.AttemptNumber,
		StatusCode:    a.StatusCode,
		ResponseTime:  a.ResponseTime,
		Success:       a.Success,
		Error:         a.Error,
		AttemptedAt:   a.AttemptedAt.Format(time.RFC3339),
	}
}
