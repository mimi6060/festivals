package webhook

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/queue"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/rs/zerolog/log"
)

// Service handles webhook business logic
type Service struct {
	repo        Repository
	sender      *Sender
	queueClient *queue.Client
	config      ServiceConfig
}

// ServiceConfig holds configuration for the webhook service
type ServiceConfig struct {
	DefaultMaxRetries     int
	DefaultTimeoutSeconds int
	SecretLength          int
	AllowInsecure         bool // For development
}

// DefaultServiceConfig returns the default service configuration
func DefaultServiceConfig() ServiceConfig {
	return ServiceConfig{
		DefaultMaxRetries:     5,
		DefaultTimeoutSeconds: 30,
		SecretLength:          32,
		AllowInsecure:         false,
	}
}

// NewService creates a new webhook service
func NewService(repo Repository, sender *Sender, queueClient *queue.Client, config ServiceConfig) *Service {
	return &Service{
		repo:        repo,
		sender:      sender,
		queueClient: queueClient,
		config:      config,
	}
}

// ============================================================================
// Webhook Configuration Management
// ============================================================================

// CreateWebhook creates a new webhook configuration
func (s *Service) CreateWebhook(ctx context.Context, festivalID uuid.UUID, req CreateWebhookRequest, createdBy *uuid.UUID) (*WebhookCreatedResponse, error) {
	// Validate event types
	for _, eventType := range req.Events {
		if !eventType.IsValid() {
			return nil, errors.New("INVALID_EVENT_TYPE", fmt.Sprintf("Invalid event type: %s", eventType))
		}
	}

	// Generate signing secret
	secret, err := generateSecret(s.config.SecretLength)
	if err != nil {
		return nil, errors.Wrap(err, "SECRET_GENERATION_FAILED", "Failed to generate webhook secret")
	}

	// Set defaults
	maxRetries := s.config.DefaultMaxRetries
	if req.MaxRetries != nil && *req.MaxRetries > 0 {
		maxRetries = *req.MaxRetries
	}

	timeoutSeconds := s.config.DefaultTimeoutSeconds
	if req.TimeoutSeconds != nil && *req.TimeoutSeconds > 0 {
		timeoutSeconds = *req.TimeoutSeconds
	}

	webhook := &WebhookConfig{
		ID:             uuid.New(),
		FestivalID:     festivalID,
		Name:           req.Name,
		Description:    req.Description,
		URL:            req.URL,
		Secret:         secret,
		Events:         req.Events,
		Status:         WebhookStatusActive,
		Headers:        req.Headers,
		MaxRetries:     maxRetries,
		TimeoutSeconds: timeoutSeconds,
		FailureCount:   0,
		CreatedBy:      createdBy,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}

	if err := s.repo.CreateWebhook(ctx, webhook); err != nil {
		return nil, errors.Wrap(err, "WEBHOOK_CREATE_FAILED", "Failed to create webhook")
	}

	log.Info().
		Str("webhook_id", webhook.ID.String()).
		Str("festival_id", festivalID.String()).
		Str("url", webhook.URL).
		Msg("Webhook created")

	return &WebhookCreatedResponse{
		WebhookConfigResponse: webhook.ToResponse(),
		Secret:                secret,
	}, nil
}

// GetWebhook retrieves a webhook by ID
func (s *Service) GetWebhook(ctx context.Context, id uuid.UUID) (*WebhookConfig, error) {
	webhook, err := s.repo.GetWebhookByID(ctx, id)
	if err != nil {
		return nil, errors.Wrap(err, "WEBHOOK_FETCH_FAILED", "Failed to fetch webhook")
	}
	if webhook == nil {
		return nil, errors.New("WEBHOOK_NOT_FOUND", "Webhook not found")
	}
	return webhook, nil
}

// GetWebhooksByFestival retrieves all webhooks for a festival
func (s *Service) GetWebhooksByFestival(ctx context.Context, festivalID uuid.UUID) ([]WebhookConfig, error) {
	webhooks, err := s.repo.GetWebhooksByFestival(ctx, festivalID)
	if err != nil {
		return nil, errors.Wrap(err, "WEBHOOKS_FETCH_FAILED", "Failed to fetch webhooks")
	}
	return webhooks, nil
}

// UpdateWebhook updates a webhook configuration
func (s *Service) UpdateWebhook(ctx context.Context, id uuid.UUID, req UpdateWebhookRequest) (*WebhookConfig, error) {
	webhook, err := s.repo.GetWebhookByID(ctx, id)
	if err != nil {
		return nil, errors.Wrap(err, "WEBHOOK_FETCH_FAILED", "Failed to fetch webhook")
	}
	if webhook == nil {
		return nil, errors.New("WEBHOOK_NOT_FOUND", "Webhook not found")
	}

	// Apply updates
	if req.Name != nil {
		webhook.Name = *req.Name
	}
	if req.Description != nil {
		webhook.Description = *req.Description
	}
	if req.URL != nil {
		webhook.URL = *req.URL
	}
	if len(req.Events) > 0 {
		// Validate event types
		for _, eventType := range req.Events {
			if !eventType.IsValid() {
				return nil, errors.New("INVALID_EVENT_TYPE", fmt.Sprintf("Invalid event type: %s", eventType))
			}
		}
		webhook.Events = req.Events
	}
	if req.Headers != nil {
		webhook.Headers = req.Headers
	}
	if req.Status != nil {
		webhook.Status = *req.Status
	}
	if req.MaxRetries != nil {
		webhook.MaxRetries = *req.MaxRetries
	}
	if req.TimeoutSeconds != nil {
		webhook.TimeoutSeconds = *req.TimeoutSeconds
	}

	webhook.UpdatedAt = time.Now().UTC()

	if err := s.repo.UpdateWebhook(ctx, webhook); err != nil {
		return nil, errors.Wrap(err, "WEBHOOK_UPDATE_FAILED", "Failed to update webhook")
	}

	log.Info().
		Str("webhook_id", id.String()).
		Msg("Webhook updated")

	return webhook, nil
}

// DeleteWebhook deletes a webhook configuration
func (s *Service) DeleteWebhook(ctx context.Context, id uuid.UUID) error {
	webhook, err := s.repo.GetWebhookByID(ctx, id)
	if err != nil {
		return errors.Wrap(err, "WEBHOOK_FETCH_FAILED", "Failed to fetch webhook")
	}
	if webhook == nil {
		return errors.New("WEBHOOK_NOT_FOUND", "Webhook not found")
	}

	if err := s.repo.DeleteWebhook(ctx, id); err != nil {
		return errors.Wrap(err, "WEBHOOK_DELETE_FAILED", "Failed to delete webhook")
	}

	log.Info().
		Str("webhook_id", id.String()).
		Msg("Webhook deleted")

	return nil
}

// RegenerateSecret generates a new secret for a webhook
func (s *Service) RegenerateSecret(ctx context.Context, id uuid.UUID) (string, error) {
	webhook, err := s.repo.GetWebhookByID(ctx, id)
	if err != nil {
		return "", errors.Wrap(err, "WEBHOOK_FETCH_FAILED", "Failed to fetch webhook")
	}
	if webhook == nil {
		return "", errors.New("WEBHOOK_NOT_FOUND", "Webhook not found")
	}

	// Generate new secret
	secret, err := generateSecret(s.config.SecretLength)
	if err != nil {
		return "", errors.Wrap(err, "SECRET_GENERATION_FAILED", "Failed to generate webhook secret")
	}

	webhook.Secret = secret
	webhook.UpdatedAt = time.Now().UTC()

	if err := s.repo.UpdateWebhook(ctx, webhook); err != nil {
		return "", errors.Wrap(err, "WEBHOOK_UPDATE_FAILED", "Failed to update webhook")
	}

	log.Info().
		Str("webhook_id", id.String()).
		Msg("Webhook secret regenerated")

	return secret, nil
}

// ============================================================================
// Event Dispatching
// ============================================================================

// DispatchEvent sends an event to all subscribed webhooks
func (s *Service) DispatchEvent(ctx context.Context, event *Event) error {
	// Get all active webhooks subscribed to this event type
	webhooks, err := s.repo.GetActiveWebhooksForEvent(ctx, event.FestivalID, event.Type)
	if err != nil {
		return errors.Wrap(err, "WEBHOOKS_FETCH_FAILED", "Failed to fetch webhooks for event")
	}

	if len(webhooks) == 0 {
		log.Debug().
			Str("event_type", string(event.Type)).
			Str("festival_id", event.FestivalID.String()).
			Msg("No webhooks subscribed to event")
		return nil
	}

	log.Info().
		Str("event_type", string(event.Type)).
		Str("event_id", event.ID.String()).
		Int("webhook_count", len(webhooks)).
		Msg("Dispatching event to webhooks")

	// Create deliveries for each webhook
	for _, webhook := range webhooks {
		if err := s.createDelivery(ctx, &webhook, event); err != nil {
			log.Error().
				Err(err).
				Str("webhook_id", webhook.ID.String()).
				Str("event_id", event.ID.String()).
				Msg("Failed to create delivery")
			continue
		}
	}

	return nil
}

// createDelivery creates a delivery record and enqueues it for async processing
func (s *Service) createDelivery(ctx context.Context, webhook *WebhookConfig, event *Event) error {
	// Create delivery record
	delivery, err := NewWebhookDelivery(
		webhook.ID,
		webhook.FestivalID,
		event,
		webhook.URL,
		webhook.Secret,
		webhook.MaxRetries,
	)
	if err != nil {
		return fmt.Errorf("failed to create delivery: %w", err)
	}

	// Save delivery to database
	if err := s.repo.CreateDelivery(ctx, delivery); err != nil {
		return fmt.Errorf("failed to save delivery: %w", err)
	}

	// Enqueue for async processing
	if err := s.enqueueDelivery(ctx, delivery.ID); err != nil {
		log.Error().
			Err(err).
			Str("delivery_id", delivery.ID.String()).
			Msg("Failed to enqueue delivery, will be picked up by retry worker")
	}

	return nil
}

// ProcessDelivery processes a single delivery (called by async worker)
func (s *Service) ProcessDelivery(ctx context.Context, deliveryID uuid.UUID) error {
	// Get delivery
	delivery, err := s.repo.GetDeliveryByID(ctx, deliveryID)
	if err != nil {
		return fmt.Errorf("failed to get delivery: %w", err)
	}
	if delivery == nil {
		return fmt.Errorf("delivery not found: %s", deliveryID)
	}

	// Get webhook config for custom headers
	webhook, err := s.repo.GetWebhookByID(ctx, delivery.WebhookID)
	if err != nil {
		return fmt.Errorf("failed to get webhook: %w", err)
	}
	if webhook == nil {
		delivery.MarkFailed("webhook not found")
		_ = s.repo.UpdateDelivery(ctx, delivery)
		return fmt.Errorf("webhook not found: %s", delivery.WebhookID)
	}

	// Check if webhook is still active
	if !webhook.IsActive() {
		delivery.MarkFailed("webhook is not active")
		_ = s.repo.UpdateDelivery(ctx, delivery)
		return nil
	}

	// Send the webhook
	result := s.sender.Send(ctx, delivery, webhook.Headers)

	// Record the attempt
	attempt := NewDeliveryAttempt(
		delivery.ID,
		delivery.AttemptCount+1,
		result.StatusCode,
		result.ResponseBody,
		result.ResponseTime.Milliseconds(),
		result.Success,
		"",
	)
	if result.Error != nil {
		attempt.Error = result.Error.Error()
	}
	_ = s.repo.CreateDeliveryAttempt(ctx, attempt)

	// Update delivery status
	if result.Success {
		delivery.MarkDelivered()
		webhook.ResetFailureCount()
	} else {
		errMsg := "unknown error"
		if result.Error != nil {
			errMsg = result.Error.Error()
		}

		if delivery.ScheduleRetry(errMsg) {
			// Enqueue for retry
			if err := s.enqueueDeliveryAt(ctx, delivery.ID, *delivery.NextRetryAt); err != nil {
				log.Error().
					Err(err).
					Str("delivery_id", delivery.ID.String()).
					Msg("Failed to enqueue retry")
			}
		} else {
			// Max retries reached
			webhook.IncrementFailure()
		}
	}

	// Save updates
	if err := s.repo.UpdateDelivery(ctx, delivery); err != nil {
		log.Error().Err(err).Str("delivery_id", delivery.ID.String()).Msg("Failed to update delivery")
	}
	if err := s.repo.UpdateWebhook(ctx, webhook); err != nil {
		log.Error().Err(err).Str("webhook_id", webhook.ID.String()).Msg("Failed to update webhook")
	}

	return nil
}

// TestWebhook sends a test event to a webhook
func (s *Service) TestWebhook(ctx context.Context, id uuid.UUID, req TestWebhookRequest) (*WebhookTestResult, error) {
	webhook, err := s.repo.GetWebhookByID(ctx, id)
	if err != nil {
		return nil, errors.Wrap(err, "WEBHOOK_FETCH_FAILED", "Failed to fetch webhook")
	}
	if webhook == nil {
		return nil, errors.New("WEBHOOK_NOT_FOUND", "Webhook not found")
	}

	// Create test event
	data := req.Data
	if data == nil {
		data = map[string]any{
			"test": true,
			"message": "This is a test webhook event",
		}
	}

	event := NewEvent(req.EventType, webhook.FestivalID, data)

	// Create delivery
	delivery, err := NewWebhookDelivery(
		webhook.ID,
		webhook.FestivalID,
		event,
		webhook.URL,
		webhook.Secret,
		1, // Only one attempt for test
	)
	if err != nil {
		return nil, errors.Wrap(err, "DELIVERY_CREATE_FAILED", "Failed to create test delivery")
	}

	// Send synchronously for test
	result := s.sender.Send(ctx, delivery, webhook.Headers)

	testResult := &WebhookTestResult{
		Success:      result.Success,
		StatusCode:   result.StatusCode,
		ResponseTime: result.ResponseTime.Milliseconds(),
	}

	if result.Error != nil {
		testResult.Error = result.Error.Error()
	}

	log.Info().
		Str("webhook_id", id.String()).
		Bool("success", result.Success).
		Int("status_code", result.StatusCode).
		Msg("Webhook test completed")

	return testResult, nil
}

// ============================================================================
// Delivery Management
// ============================================================================

// GetDeliveries retrieves deliveries for a webhook with pagination
func (s *Service) GetDeliveries(ctx context.Context, webhookID uuid.UUID, page, perPage int) ([]WebhookDelivery, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetDeliveriesByWebhook(ctx, webhookID, offset, perPage)
}

// GetDeliveryAttempts retrieves all attempts for a delivery
func (s *Service) GetDeliveryAttempts(ctx context.Context, deliveryID uuid.UUID) ([]DeliveryAttempt, error) {
	return s.repo.GetAttemptsByDelivery(ctx, deliveryID)
}

// RetryDelivery manually retries a failed delivery
func (s *Service) RetryDelivery(ctx context.Context, deliveryID uuid.UUID) error {
	delivery, err := s.repo.GetDeliveryByID(ctx, deliveryID)
	if err != nil {
		return errors.Wrap(err, "DELIVERY_FETCH_FAILED", "Failed to fetch delivery")
	}
	if delivery == nil {
		return errors.New("DELIVERY_NOT_FOUND", "Delivery not found")
	}

	if delivery.Status == DeliveryStatusDelivered {
		return errors.New("DELIVERY_ALREADY_DELIVERED", "Delivery was already successful")
	}

	// Reset for retry
	delivery.Status = DeliveryStatusPending
	delivery.AttemptCount = 0
	delivery.NextRetryAt = nil
	delivery.LastError = ""
	delivery.UpdatedAt = time.Now().UTC()

	if err := s.repo.UpdateDelivery(ctx, delivery); err != nil {
		return errors.Wrap(err, "DELIVERY_UPDATE_FAILED", "Failed to update delivery")
	}

	// Enqueue for immediate processing
	if err := s.enqueueDelivery(ctx, deliveryID); err != nil {
		return errors.Wrap(err, "DELIVERY_ENQUEUE_FAILED", "Failed to enqueue delivery")
	}

	log.Info().
		Str("delivery_id", deliveryID.String()).
		Msg("Delivery manually retried")

	return nil
}

// ============================================================================
// Statistics
// ============================================================================

// GetWebhookStats retrieves statistics for a webhook
func (s *Service) GetWebhookStats(ctx context.Context, webhookID uuid.UUID, since time.Time) (*DeliveryStats, error) {
	return s.repo.GetDeliveryStats(ctx, webhookID, since)
}

// GetFestivalWebhookStats retrieves statistics for all webhooks in a festival
func (s *Service) GetFestivalWebhookStats(ctx context.Context, festivalID uuid.UUID, since time.Time) (*DeliveryStats, error) {
	return s.repo.GetFestivalDeliveryStats(ctx, festivalID, since)
}

// ============================================================================
// Background Jobs
// ============================================================================

// ProcessPendingDeliveries processes pending deliveries (called by scheduled worker)
func (s *Service) ProcessPendingDeliveries(ctx context.Context, limit int) error {
	deliveries, err := s.repo.GetPendingDeliveries(ctx, limit)
	if err != nil {
		return fmt.Errorf("failed to get pending deliveries: %w", err)
	}

	for _, delivery := range deliveries {
		if err := s.enqueueDelivery(ctx, delivery.ID); err != nil {
			log.Error().
				Err(err).
				Str("delivery_id", delivery.ID.String()).
				Msg("Failed to enqueue pending delivery")
		}
	}

	return nil
}

// ProcessRetryDeliveries processes deliveries due for retry (called by scheduled worker)
func (s *Service) ProcessRetryDeliveries(ctx context.Context, limit int) error {
	deliveries, err := s.repo.GetDeliveriesForRetry(ctx, limit)
	if err != nil {
		return fmt.Errorf("failed to get deliveries for retry: %w", err)
	}

	for _, delivery := range deliveries {
		if err := s.enqueueDelivery(ctx, delivery.ID); err != nil {
			log.Error().
				Err(err).
				Str("delivery_id", delivery.ID.String()).
				Msg("Failed to enqueue retry delivery")
		}
	}

	return nil
}

// CleanupOldDeliveries removes old delivery records (called by scheduled worker)
func (s *Service) CleanupOldDeliveries(ctx context.Context, retentionDays int) (int64, error) {
	olderThan := time.Now().UTC().AddDate(0, 0, -retentionDays)
	deleted, err := s.repo.DeleteOldDeliveries(ctx, olderThan)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup old deliveries: %w", err)
	}

	if deleted > 0 {
		log.Info().
			Int64("deleted", deleted).
			Int("retention_days", retentionDays).
			Msg("Cleaned up old webhook deliveries")
	}

	return deleted, nil
}

// ============================================================================
// Helpers
// ============================================================================

// generateSecret generates a cryptographically secure random secret
func generateSecret(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "whsec_" + hex.EncodeToString(bytes), nil
}

// enqueueDelivery enqueues a delivery for immediate processing
func (s *Service) enqueueDelivery(ctx context.Context, deliveryID uuid.UUID) error {
	if s.queueClient == nil {
		// Fallback to synchronous processing if no queue client
		return s.ProcessDelivery(ctx, deliveryID)
	}

	task := NewWebhookDeliveryTask(deliveryID)
	_, err := s.queueClient.EnqueueTask(ctx, task)
	return err
}

// enqueueDeliveryAt enqueues a delivery for processing at a specific time
func (s *Service) enqueueDeliveryAt(ctx context.Context, deliveryID uuid.UUID, processAt time.Time) error {
	if s.queueClient == nil {
		return nil // Can't schedule without queue
	}

	task := NewWebhookDeliveryTask(deliveryID)
	_, err := s.queueClient.EnqueueScheduled(ctx, task, processAt)
	return err
}
