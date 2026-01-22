package api

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
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
	"github.com/rs/zerolog/log"
)

// Service handles API key and webhook business logic
type Service struct {
	repo       Repository
	httpClient *http.Client
}

// NewService creates a new API service
func NewService(repo Repository) *Service {
	return &Service{
		repo: repo,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// =====================
// API Key Methods
// =====================

// GenerateAPIKey creates a new API key with the given permissions
func (s *Service) GenerateAPIKey(ctx context.Context, festivalID uuid.UUID, req CreateAPIKeyRequest, createdBy *uuid.UUID) (*APIKeyCreatedResponse, error) {
	// Generate a random API key
	rawKey, err := generateRandomKey(32)
	if err != nil {
		return nil, fmt.Errorf("failed to generate API key: %w", err)
	}

	// Determine prefix based on environment
	env := req.Environment
	if env == "" {
		env = EnvironmentSandbox
	}

	var prefix string
	if env == EnvironmentProduction {
		prefix = "pk_live_"
	} else {
		prefix = "pk_test_"
	}

	fullKey := prefix + rawKey
	keyHash := hashKey(fullKey)

	// Set default rate limit if not provided
	rateLimit := DefaultRateLimit()
	if req.RateLimit != nil {
		rateLimit = *req.RateLimit
	}

	apiKey := &APIKey{
		ID:          uuid.New(),
		FestivalID:  festivalID,
		Name:        req.Name,
		Description: req.Description,
		Key:         keyHash,
		KeyPrefix:   prefix + rawKey[:8] + "...",
		Permissions: req.Permissions,
		RateLimit:   rateLimit,
		Status:      APIKeyStatusActive,
		Environment: env,
		ExpiresAt:   req.ExpiresAt,
		CreatedBy:   createdBy,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.CreateAPIKey(ctx, apiKey); err != nil {
		return nil, fmt.Errorf("failed to create API key: %w", err)
	}

	// Return response with the full key (only shown once!)
	return &APIKeyCreatedResponse{
		APIKeyResponse: apiKey.ToResponse(),
		Key:            fullKey,
	}, nil
}

// ValidateAPIKey validates an API key and returns the key details
func (s *Service) ValidateAPIKey(ctx context.Context, key string) (*APIKey, error) {
	// Hash the provided key
	keyHash := hashKey(key)

	apiKey, err := s.repo.GetAPIKeyByKey(ctx, keyHash)
	if err != nil {
		return nil, err
	}
	if apiKey == nil {
		return nil, errors.ErrUnauthorized
	}

	// Check if key is expired
	if apiKey.ExpiresAt != nil && apiKey.ExpiresAt.Before(time.Now()) {
		return nil, errors.ErrUnauthorized
	}

	// Update last used timestamp (fire and forget)
	go func() {
		_ = s.repo.UpdateAPIKeyLastUsed(context.Background(), apiKey.ID)
	}()

	return apiKey, nil
}

// GetAPIKey retrieves an API key by ID
func (s *Service) GetAPIKey(ctx context.Context, id uuid.UUID) (*APIKey, error) {
	key, err := s.repo.GetAPIKeyByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if key == nil {
		return nil, errors.ErrNotFound
	}
	return key, nil
}

// ListAPIKeys lists all API keys for a festival
func (s *Service) ListAPIKeys(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]APIKey, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.ListAPIKeys(ctx, festivalID, offset, perPage)
}

// UpdateAPIKey updates an API key
func (s *Service) UpdateAPIKey(ctx context.Context, id uuid.UUID, req UpdateAPIKeyRequest) (*APIKey, error) {
	key, err := s.repo.GetAPIKeyByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if key == nil {
		return nil, errors.ErrNotFound
	}

	if req.Name != nil {
		key.Name = *req.Name
	}
	if req.Description != nil {
		key.Description = *req.Description
	}
	if req.Permissions != nil {
		key.Permissions = req.Permissions
	}
	if req.RateLimit != nil {
		key.RateLimit = *req.RateLimit
	}
	if req.Status != nil {
		key.Status = *req.Status
	}
	if req.ExpiresAt != nil {
		key.ExpiresAt = req.ExpiresAt
	}

	key.UpdatedAt = time.Now()

	if err := s.repo.UpdateAPIKey(ctx, key); err != nil {
		return nil, fmt.Errorf("failed to update API key: %w", err)
	}

	return key, nil
}

// RevokeAPIKey revokes an API key
func (s *Service) RevokeAPIKey(ctx context.Context, id uuid.UUID) error {
	key, err := s.repo.GetAPIKeyByID(ctx, id)
	if err != nil {
		return err
	}
	if key == nil {
		return errors.ErrNotFound
	}

	key.Status = APIKeyStatusRevoked
	key.UpdatedAt = time.Now()

	return s.repo.UpdateAPIKey(ctx, key)
}

// DeleteAPIKey deletes an API key
func (s *Service) DeleteAPIKey(ctx context.Context, id uuid.UUID) error {
	key, err := s.repo.GetAPIKeyByID(ctx, id)
	if err != nil {
		return err
	}
	if key == nil {
		return errors.ErrNotFound
	}
	return s.repo.DeleteAPIKey(ctx, id)
}

// RotateAPIKey generates a new key while keeping the same configuration
func (s *Service) RotateAPIKey(ctx context.Context, id uuid.UUID) (*APIKeyCreatedResponse, error) {
	key, err := s.repo.GetAPIKeyByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if key == nil {
		return nil, errors.ErrNotFound
	}

	// Generate new key
	rawKey, err := generateRandomKey(32)
	if err != nil {
		return nil, fmt.Errorf("failed to generate new API key: %w", err)
	}

	var prefix string
	if key.Environment == EnvironmentProduction {
		prefix = "pk_live_"
	} else {
		prefix = "pk_test_"
	}

	fullKey := prefix + rawKey
	keyHash := hashKey(fullKey)

	key.Key = keyHash
	key.KeyPrefix = prefix + rawKey[:8] + "..."
	key.UpdatedAt = time.Now()

	if err := s.repo.UpdateAPIKey(ctx, key); err != nil {
		return nil, fmt.Errorf("failed to update API key: %w", err)
	}

	return &APIKeyCreatedResponse{
		APIKeyResponse: key.ToResponse(),
		Key:            fullKey,
	}, nil
}

// =====================
// Usage Tracking Methods
// =====================

// TrackUsage records API usage for a key
func (s *Service) TrackUsage(ctx context.Context, keyID, festivalID uuid.UUID, endpoint, method string, statusCode int, bandwidth, responseTime int64) error {
	usage := &APIUsage{
		ID:            uuid.New(),
		APIKeyID:      keyID,
		FestivalID:    festivalID,
		Endpoint:      endpoint,
		Method:        method,
		StatusCode:    statusCode,
		RequestsCount: 1,
		Bandwidth:     bandwidth,
		ResponseTime:  responseTime,
		Period:        time.Now().Format("2006-01-02-15"), // Hourly bucket
		Timestamp:     time.Now(),
		CreatedAt:     time.Now(),
	}

	return s.repo.RecordUsage(ctx, usage)
}

// GetUsageStats retrieves usage statistics for an API key
func (s *Service) GetUsageStats(ctx context.Context, keyID uuid.UUID, period string) (*APIUsageResponse, error) {
	var startDate, endDate time.Time
	now := time.Now()

	switch period {
	case "day":
		startDate = now.AddDate(0, 0, -1)
	case "week":
		startDate = now.AddDate(0, 0, -7)
	case "month":
		startDate = now.AddDate(0, -1, 0)
	case "year":
		startDate = now.AddDate(-1, 0, 0)
	default:
		startDate = now.AddDate(0, 0, -30) // Default to 30 days
	}
	endDate = now

	stats, err := s.repo.GetUsageStats(ctx, keyID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	dailyUsage, err := s.repo.GetDailyUsage(ctx, keyID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	topEndpoints, err := s.repo.GetTopEndpoints(ctx, keyID, startDate, endDate, 10)
	if err != nil {
		return nil, err
	}

	successRate := float64(0)
	if stats.TotalRequests > 0 {
		successRate = float64(stats.SuccessfulCount) / float64(stats.TotalRequests) * 100
	}

	return &APIUsageResponse{
		APIKeyID:        keyID,
		TotalRequests:   stats.TotalRequests,
		TotalBandwidth:  stats.TotalBandwidth,
		AvgResponseTime: stats.AvgResponseTime,
		SuccessRate:     successRate,
		TopEndpoints:    topEndpoints,
		DailyUsage:      dailyUsage,
		Period:          period,
	}, nil
}

// CheckRateLimit checks if an API key is within its rate limit
func (s *Service) CheckRateLimit(ctx context.Context, key *APIKey) (bool, error) {
	if !key.RateLimit.Enabled {
		return true, nil
	}

	// Check per-minute limit
	period := time.Now().Format("2006-01-02-15-04")
	count, err := s.repo.GetRequestCount(ctx, key.ID, period)
	if err != nil {
		return false, err
	}

	if count >= int64(key.RateLimit.RequestsPerMinute) {
		return false, nil
	}

	return true, nil
}

// =====================
// Webhook Methods
// =====================

// RegisterWebhook creates a new webhook
func (s *Service) RegisterWebhook(ctx context.Context, apiKeyID, festivalID uuid.UUID, req CreateWebhookRequest) (*WebhookCreatedResponse, error) {
	// Generate signing secret
	secret, err := generateRandomKey(32)
	if err != nil {
		return nil, fmt.Errorf("failed to generate webhook secret: %w", err)
	}

	webhookSecret := "whsec_" + secret

	retryConfig := DefaultRetryConfig()
	if req.RetryConfig != nil {
		retryConfig = *req.RetryConfig
	}

	webhook := &Webhook{
		ID:          uuid.New(),
		APIKeyID:    apiKeyID,
		FestivalID:  festivalID,
		URL:         req.URL,
		Description: req.Description,
		Events:      req.Events,
		Secret:      webhookSecret,
		Status:      WebhookStatusActive,
		Headers:     req.Headers,
		RetryConfig: retryConfig,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.CreateWebhook(ctx, webhook); err != nil {
		return nil, fmt.Errorf("failed to create webhook: %w", err)
	}

	return &WebhookCreatedResponse{
		WebhookResponse: webhook.ToResponse(),
		Secret:          webhookSecret,
	}, nil
}

// GetWebhook retrieves a webhook by ID
func (s *Service) GetWebhook(ctx context.Context, id uuid.UUID) (*Webhook, error) {
	webhook, err := s.repo.GetWebhookByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if webhook == nil {
		return nil, errors.ErrNotFound
	}
	return webhook, nil
}

// ListWebhooks lists all webhooks for a festival
func (s *Service) ListWebhooks(ctx context.Context, festivalID uuid.UUID, page, perPage int) ([]Webhook, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.ListWebhooks(ctx, festivalID, offset, perPage)
}

// UpdateWebhook updates a webhook
func (s *Service) UpdateWebhook(ctx context.Context, id uuid.UUID, req UpdateWebhookRequest) (*Webhook, error) {
	webhook, err := s.repo.GetWebhookByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if webhook == nil {
		return nil, errors.ErrNotFound
	}

	if req.URL != nil {
		webhook.URL = *req.URL
	}
	if req.Description != nil {
		webhook.Description = *req.Description
	}
	if req.Events != nil {
		webhook.Events = req.Events
	}
	if req.Headers != nil {
		webhook.Headers = req.Headers
	}
	if req.RetryConfig != nil {
		webhook.RetryConfig = *req.RetryConfig
	}
	if req.Status != nil {
		webhook.Status = *req.Status
	}

	webhook.UpdatedAt = time.Now()

	if err := s.repo.UpdateWebhook(ctx, webhook); err != nil {
		return nil, fmt.Errorf("failed to update webhook: %w", err)
	}

	return webhook, nil
}

// DeleteWebhook deletes a webhook
func (s *Service) DeleteWebhook(ctx context.Context, id uuid.UUID) error {
	webhook, err := s.repo.GetWebhookByID(ctx, id)
	if err != nil {
		return err
	}
	if webhook == nil {
		return errors.ErrNotFound
	}
	return s.repo.DeleteWebhook(ctx, id)
}

// GetWebhookDeliveries returns recent deliveries for a webhook
func (s *Service) GetWebhookDeliveries(ctx context.Context, webhookID uuid.UUID, page, perPage int) ([]WebhookDelivery, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.repo.ListWebhookDeliveries(ctx, webhookID, offset, perPage)
}

// TriggerWebhook sends an event to all registered webhooks
func (s *Service) TriggerWebhook(ctx context.Context, festivalID uuid.UUID, eventType WebhookEventType, data any) error {
	webhooks, err := s.repo.ListWebhooksByEvent(ctx, festivalID, eventType)
	if err != nil {
		return err
	}

	if len(webhooks) == 0 {
		return nil
	}

	// Create payload
	payload := WebhookPayload{
		ID:         uuid.New().String(),
		Timestamp:  time.Now().Format(time.RFC3339),
		Event:      eventType,
		FestivalID: festivalID.String(),
		Data:       data,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	// Send to all webhooks (async)
	for _, webhook := range webhooks {
		go s.deliverWebhook(context.Background(), webhook, eventType, payloadBytes)
	}

	return nil
}

// TestWebhook sends a test event to a specific webhook
func (s *Service) TestWebhook(ctx context.Context, webhookID uuid.UUID, req TestWebhookRequest) (*WebhookDelivery, error) {
	webhook, err := s.repo.GetWebhookByID(ctx, webhookID)
	if err != nil {
		return nil, err
	}
	if webhook == nil {
		return nil, errors.ErrNotFound
	}

	// Create test payload
	testData := req.Payload
	if testData == nil {
		testData = map[string]any{
			"test": true,
			"message": "This is a test webhook delivery",
		}
	}

	payload := WebhookPayload{
		ID:         uuid.New().String(),
		Timestamp:  time.Now().Format(time.RFC3339),
		Event:      req.EventType,
		FestivalID: webhook.FestivalID.String(),
		Data:       testData,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	// Deliver synchronously for test
	delivery := s.sendWebhookRequest(*webhook, req.EventType, payloadBytes, 1)

	// Record delivery
	if err := s.repo.CreateWebhookDelivery(ctx, delivery); err != nil {
		log.Error().Err(err).Msg("Failed to record webhook delivery")
	}

	return delivery, nil
}

// deliverWebhook sends a webhook with retry logic
func (s *Service) deliverWebhook(ctx context.Context, webhook Webhook, eventType WebhookEventType, payload []byte) {
	maxRetries := webhook.RetryConfig.MaxRetries
	if maxRetries == 0 {
		maxRetries = 3
	}

	var delivery *WebhookDelivery
	for attempt := 1; attempt <= maxRetries; attempt++ {
		delivery = s.sendWebhookRequest(webhook, eventType, payload, attempt)

		// Record delivery
		if err := s.repo.CreateWebhookDelivery(ctx, delivery); err != nil {
			log.Error().Err(err).Msg("Failed to record webhook delivery")
		}

		if delivery.Success {
			// Reset failure count on success
			_ = s.repo.ResetWebhookFailureCount(ctx, webhook.ID)
			return
		}

		// Wait before retry (exponential backoff)
		if attempt < maxRetries {
			delay := time.Duration(webhook.RetryConfig.RetryDelayMs) * time.Millisecond
			multiplier := webhook.RetryConfig.BackoffMultiplier
			if multiplier == 0 {
				multiplier = 2.0
			}
			for i := 1; i < attempt; i++ {
				delay = time.Duration(float64(delay) * multiplier)
			}
			time.Sleep(delay)
		}
	}

	// All retries failed, increment failure count
	_ = s.repo.IncrementWebhookFailureCount(ctx, webhook.ID)
}

// sendWebhookRequest sends a single webhook request
func (s *Service) sendWebhookRequest(webhook Webhook, eventType WebhookEventType, payload []byte, attempt int) *WebhookDelivery {
	delivery := &WebhookDelivery{
		ID:            uuid.New(),
		WebhookID:     webhook.ID,
		EventType:     eventType,
		Payload:       string(payload),
		AttemptNumber: attempt,
		DeliveredAt:   time.Now(),
	}

	// Create request
	req, err := http.NewRequest("POST", webhook.URL, bytes.NewReader(payload))
	if err != nil {
		delivery.Success = false
		delivery.Error = fmt.Sprintf("failed to create request: %v", err)
		return delivery
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Festivals-Webhook/1.0")
	req.Header.Set("X-Webhook-ID", webhook.ID.String())
	req.Header.Set("X-Webhook-Event", string(eventType))
	req.Header.Set("X-Webhook-Timestamp", time.Now().Format(time.RFC3339))

	// Add signature
	signature := signPayload(payload, webhook.Secret)
	req.Header.Set("X-Webhook-Signature", signature)

	// Add custom headers
	for key, value := range webhook.Headers {
		req.Header.Set(key, value)
	}

	// Send request
	start := time.Now()
	resp, err := s.httpClient.Do(req)
	delivery.Duration = time.Since(start).Milliseconds()

	if err != nil {
		delivery.Success = false
		delivery.Error = fmt.Sprintf("request failed: %v", err)
		return delivery
	}
	defer resp.Body.Close()

	delivery.ResponseCode = resp.StatusCode

	// Read response body (limit to 1KB)
	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	delivery.ResponseBody = string(bodyBytes)

	// Check if successful (2xx status codes)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		delivery.Success = true
	} else {
		delivery.Success = false
		delivery.Error = fmt.Sprintf("received status code %d", resp.StatusCode)
	}

	return delivery
}

// =====================
// Helper Functions
// =====================

// generateRandomKey generates a random hex-encoded key
func generateRandomKey(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// hashKey hashes an API key using SHA-256
func hashKey(key string) string {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}

// signPayload creates an HMAC-SHA256 signature for a payload
func signPayload(payload []byte, secret string) string {
	// Remove the "whsec_" prefix if present
	key := strings.TrimPrefix(secret, "whsec_")
	h := hmac.New(sha256.New, []byte(key))
	h.Write(payload)
	return "sha256=" + hex.EncodeToString(h.Sum(nil))
}

// HasPermission checks if the API key has a specific permission
func (k *APIKey) HasPermission(permission Permission) bool {
	for _, p := range k.Permissions {
		if p == PermissionAll || p == permission {
			return true
		}
	}
	return false
}

// HasAnyPermission checks if the API key has any of the specified permissions
func (k *APIKey) HasAnyPermission(permissions ...Permission) bool {
	for _, permission := range permissions {
		if k.HasPermission(permission) {
			return true
		}
	}
	return false
}
