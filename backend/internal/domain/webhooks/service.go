package webhooks

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/rs/zerolog/log"
)

// Service provides webhook management operations
type Service struct {
	repo       Repository
	httpClient *http.Client
}

// NewService creates a new webhooks service
func NewService(repo Repository) *Service {
	return &Service{
		repo: repo,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// CreateWebhook creates a new webhook
func (s *Service) CreateWebhook(ctx context.Context, festivalID uuid.UUID, req CreateWebhookRequest) (*Webhook, error) {
	// Validate events
	for _, event := range req.Events {
		if !IsValidEvent(event) {
			return nil, errors.ValidationErr("Invalid event: "+event, nil)
		}
	}

	// Generate secret for signing
	secretBytes := make([]byte, 32)
	if _, err := rand.Read(secretBytes); err != nil {
		return nil, fmt.Errorf("failed to generate secret: %w", err)
	}
	secret := "whsec_" + hex.EncodeToString(secretBytes)

	webhook := &Webhook{
		ID:         uuid.New(),
		FestivalID: festivalID,
		Name:       req.Name,
		URL:        req.URL,
		Events:     req.Events,
		Secret:     secret,
		IsActive:   true,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := s.repo.CreateWebhook(ctx, webhook); err != nil {
		return nil, fmt.Errorf("failed to create webhook: %w", err)
	}

	return webhook, nil
}

// GetWebhook returns a webhook by ID
func (s *Service) GetWebhook(ctx context.Context, id uuid.UUID) (*Webhook, error) {
	webhook, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if webhook == nil {
		return nil, errors.ErrNotFound
	}
	return webhook, nil
}

// ListWebhooks returns all webhooks for a festival
func (s *Service) ListWebhooks(ctx context.Context, festivalID uuid.UUID) ([]Webhook, error) {
	return s.repo.GetByFestival(ctx, festivalID)
}

// UpdateWebhook updates a webhook
func (s *Service) UpdateWebhook(ctx context.Context, id uuid.UUID, req UpdateWebhookRequest) (*Webhook, error) {
	webhook, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if webhook == nil {
		return nil, errors.ErrNotFound
	}

	// Apply updates
	if req.Name != nil {
		webhook.Name = *req.Name
	}
	if req.URL != nil {
		webhook.URL = *req.URL
	}
	if len(req.Events) > 0 {
		// Validate events
		for _, event := range req.Events {
			if !IsValidEvent(event) {
				return nil, errors.ValidationErr("Invalid event: "+event, nil)
			}
		}
		webhook.Events = req.Events
	}
	if req.IsActive != nil {
		webhook.IsActive = *req.IsActive
	}

	webhook.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, webhook); err != nil {
		return nil, fmt.Errorf("failed to update webhook: %w", err)
	}

	return webhook, nil
}

// DeleteWebhook deletes a webhook and its delivery logs
func (s *Service) DeleteWebhook(ctx context.Context, id uuid.UUID) error {
	webhook, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if webhook == nil {
		return errors.ErrNotFound
	}

	return s.repo.Delete(ctx, id)
}

// TriggerWebhook sends an event to all matching webhooks asynchronously
func (s *Service) TriggerWebhook(ctx context.Context, festivalID uuid.UUID, event string, data interface{}) {
	go func() {
		// Use background context since the original may be cancelled
		bgCtx := context.Background()

		webhooks, err := s.repo.GetActiveByFestivalAndEvent(bgCtx, festivalID, event)
		if err != nil {
			log.Error().Err(err).Str("event", event).Msg("Failed to get webhooks for event")
			return
		}

		for _, webhook := range webhooks {
			go s.deliverWebhook(bgCtx, &webhook, event, data)
		}
	}()
}

// deliverWebhook sends a single webhook delivery
func (s *Service) deliverWebhook(ctx context.Context, webhook *Webhook, event string, data interface{}) {
	startTime := time.Now()

	// Create payload
	payload := WebhookPayload{
		ID:         uuid.New().String(),
		Event:      event,
		FestivalID: webhook.FestivalID.String(),
		Timestamp:  time.Now().Format(time.RFC3339),
		Data:       data,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal webhook payload")
		return
	}

	// Create signature
	signature := s.signPayload(webhook.Secret, payloadBytes)

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhook.URL, bytes.NewReader(payloadBytes))
	if err != nil {
		s.recordDelivery(ctx, webhook.ID, event, string(payloadBytes), nil, nil, time.Since(startTime), false, err.Error())
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Signature", signature)
	req.Header.Set("X-Webhook-Event", event)
	req.Header.Set("X-Webhook-ID", payload.ID)

	// Send request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.recordDelivery(ctx, webhook.ID, event, string(payloadBytes), nil, nil, time.Since(startTime), false, err.Error())
		return
	}
	defer resp.Body.Close()

	// Read response body (limit to 10KB)
	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 10*1024))
	bodyStr := string(bodyBytes)

	// Record delivery
	success := resp.StatusCode >= 200 && resp.StatusCode < 300
	var errMsg string
	if !success {
		errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}
	s.recordDelivery(ctx, webhook.ID, event, string(payloadBytes), &resp.StatusCode, &bodyStr, time.Since(startTime), success, errMsg)
}

// signPayload creates an HMAC-SHA256 signature for the payload
func (s *Service) signPayload(secret string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// recordDelivery saves a webhook delivery record
func (s *Service) recordDelivery(ctx context.Context, webhookID uuid.UUID, event, payload string, responseCode *int, responseBody *string, duration time.Duration, success bool, errMsg string) {
	durationMs := int(duration.Milliseconds())
	delivery := &WebhookDelivery{
		ID:           uuid.New(),
		WebhookID:    webhookID,
		Event:        event,
		Payload:      payload,
		ResponseCode: responseCode,
		ResponseBody: responseBody,
		Duration:     &durationMs,
		Success:      success,
		DeliveredAt:  time.Now(),
	}

	if errMsg != "" {
		delivery.Error = &errMsg
	}

	if err := s.repo.CreateDelivery(ctx, delivery); err != nil {
		log.Error().Err(err).Msg("Failed to record webhook delivery")
	}
}

// GetDeliveryLogs returns delivery logs for a webhook
func (s *Service) GetDeliveryLogs(ctx context.Context, webhookID uuid.UUID, page, perPage int) ([]WebhookDelivery, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetDeliveriesByWebhook(ctx, webhookID, perPage, offset)
}

// TestWebhook sends a test event to a webhook
func (s *Service) TestWebhook(ctx context.Context, id uuid.UUID, req TestWebhookRequest) (*WebhookDelivery, error) {
	webhook, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if webhook == nil {
		return nil, errors.ErrNotFound
	}

	event := req.Event
	if event == "" {
		event = "test.ping"
	}

	data := req.Payload
	if data == nil {
		data = map[string]interface{}{
			"message": "This is a test webhook delivery",
			"test":    true,
		}
	}

	startTime := time.Now()

	// Create payload
	payload := WebhookPayload{
		ID:         uuid.New().String(),
		Event:      event,
		FestivalID: webhook.FestivalID.String(),
		Timestamp:  time.Now().Format(time.RFC3339),
		Data:       data,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create signature
	signature := s.signPayload(webhook.Secret, payloadBytes)

	// Create request
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, webhook.URL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Webhook-Signature", signature)
	httpReq.Header.Set("X-Webhook-Event", event)
	httpReq.Header.Set("X-Webhook-ID", payload.ID)

	// Send request
	resp, err := s.httpClient.Do(httpReq)
	duration := time.Since(startTime)
	durationMs := int(duration.Milliseconds())

	delivery := &WebhookDelivery{
		ID:          uuid.New(),
		WebhookID:   webhook.ID,
		Event:       event,
		Payload:     string(payloadBytes),
		Duration:    &durationMs,
		DeliveredAt: time.Now(),
	}

	if err != nil {
		errStr := err.Error()
		delivery.Success = false
		delivery.Error = &errStr
	} else {
		defer resp.Body.Close()
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 10*1024))
		bodyStr := string(bodyBytes)

		delivery.ResponseCode = &resp.StatusCode
		delivery.ResponseBody = &bodyStr
		delivery.Success = resp.StatusCode >= 200 && resp.StatusCode < 300

		if !delivery.Success {
			errStr := fmt.Sprintf("HTTP %d", resp.StatusCode)
			delivery.Error = &errStr
		}
	}

	// Save delivery record
	if err := s.repo.CreateDelivery(ctx, delivery); err != nil {
		log.Error().Err(err).Msg("Failed to record test webhook delivery")
	}

	return delivery, nil
}

// RegenerateSecret generates a new secret for a webhook
func (s *Service) RegenerateSecret(ctx context.Context, id uuid.UUID) (*Webhook, error) {
	webhook, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if webhook == nil {
		return nil, errors.ErrNotFound
	}

	// Generate new secret
	secretBytes := make([]byte, 32)
	if _, err := rand.Read(secretBytes); err != nil {
		return nil, fmt.Errorf("failed to generate secret: %w", err)
	}
	webhook.Secret = "whsec_" + hex.EncodeToString(secretBytes)
	webhook.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, webhook); err != nil {
		return nil, fmt.Errorf("failed to update webhook: %w", err)
	}

	return webhook, nil
}
