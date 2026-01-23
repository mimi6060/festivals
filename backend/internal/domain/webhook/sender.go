package webhook

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// Sender handles HTTP delivery of webhooks
type Sender struct {
	client        *http.Client
	timeout       time.Duration
	userAgent     string
	allowInsecure bool
}

// SenderConfig holds configuration for the webhook sender
type SenderConfig struct {
	Timeout           time.Duration
	MaxIdleConns      int
	IdleConnTimeout   time.Duration
	TLSHandshakeTimeout time.Duration
	UserAgent         string
	AllowInsecure     bool // Allow self-signed certificates (for development)
}

// DefaultSenderConfig returns the default sender configuration
func DefaultSenderConfig() SenderConfig {
	return SenderConfig{
		Timeout:             30 * time.Second,
		MaxIdleConns:        100,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		UserAgent:           "Festivals-Webhook/1.0",
		AllowInsecure:       false,
	}
}

// NewSender creates a new webhook sender
func NewSender(cfg SenderConfig) *Sender {
	transport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          cfg.MaxIdleConns,
		MaxIdleConnsPerHost:   10,
		IdleConnTimeout:       cfg.IdleConnTimeout,
		TLSHandshakeTimeout:   cfg.TLSHandshakeTimeout,
		ExpectContinueTimeout: 1 * time.Second,
		ForceAttemptHTTP2:     true,
	}

	if cfg.AllowInsecure {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}

	return &Sender{
		client: &http.Client{
			Transport: transport,
			Timeout:   cfg.Timeout,
			// Don't follow redirects for webhooks
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		timeout:       cfg.Timeout,
		userAgent:     cfg.UserAgent,
		allowInsecure: cfg.AllowInsecure,
	}
}

// SendResult represents the result of a webhook delivery attempt
type SendResult struct {
	StatusCode   int
	ResponseBody string
	ResponseTime time.Duration
	Success      bool
	Error        error
}

// Send delivers a webhook to the specified URL
func (s *Sender) Send(ctx context.Context, delivery *WebhookDelivery, customHeaders map[string]string) *SendResult {
	start := time.Now()

	// Validate URL
	if err := s.validateURL(delivery.URL); err != nil {
		return &SendResult{
			Success:      false,
			Error:        err,
			ResponseTime: time.Since(start),
		}
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, delivery.URL, bytes.NewBufferString(delivery.Payload))
	if err != nil {
		return &SendResult{
			Success:      false,
			Error:        fmt.Errorf("failed to create request: %w", err),
			ResponseTime: time.Since(start),
		}
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", s.userAgent)
	req.Header.Set("X-Webhook-Signature", delivery.Signature)
	req.Header.Set("X-Webhook-Event-ID", delivery.EventID.String())
	req.Header.Set("X-Webhook-Event-Type", string(delivery.EventType))
	req.Header.Set("X-Webhook-Delivery-ID", delivery.ID.String())
	req.Header.Set("X-Webhook-Timestamp", fmt.Sprintf("%d", delivery.CreatedAt.Unix()))

	// Add custom headers
	for key, value := range customHeaders {
		req.Header.Set(key, value)
	}

	// Send request
	resp, err := s.client.Do(req)
	responseTime := time.Since(start)

	if err != nil {
		log.Error().
			Err(err).
			Str("url", delivery.URL).
			Str("event_type", string(delivery.EventType)).
			Str("delivery_id", delivery.ID.String()).
			Dur("response_time", responseTime).
			Msg("Webhook delivery failed")

		return &SendResult{
			Success:      false,
			Error:        fmt.Errorf("request failed: %w", err),
			ResponseTime: responseTime,
		}
	}
	defer resp.Body.Close()

	// Read response body (limit to 64KB)
	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		bodyBytes = []byte(fmt.Sprintf("failed to read response: %v", err))
	}
	responseBody := string(bodyBytes)

	// Consider 2xx status codes as success
	success := resp.StatusCode >= 200 && resp.StatusCode < 300

	log.Info().
		Str("url", delivery.URL).
		Str("event_type", string(delivery.EventType)).
		Str("delivery_id", delivery.ID.String()).
		Int("status_code", resp.StatusCode).
		Bool("success", success).
		Dur("response_time", responseTime).
		Msg("Webhook delivery attempt completed")

	result := &SendResult{
		StatusCode:   resp.StatusCode,
		ResponseBody: responseBody,
		ResponseTime: responseTime,
		Success:      success,
	}

	if !success {
		result.Error = fmt.Errorf("non-2xx status code: %d", resp.StatusCode)
	}

	return result
}

// validateURL validates the webhook URL
func (s *Sender) validateURL(url string) error {
	// Check for valid URL schemes
	if !strings.HasPrefix(url, "https://") && !strings.HasPrefix(url, "http://") {
		return fmt.Errorf("invalid URL scheme: must be http or https")
	}

	// In production, require HTTPS unless AllowInsecure is set
	if !s.allowInsecure && !strings.HasPrefix(url, "https://") {
		return fmt.Errorf("HTTPS required for webhook URLs")
	}

	// Block private/internal IPs (basic check)
	if s.isPrivateURL(url) {
		return fmt.Errorf("webhook URLs to private networks are not allowed")
	}

	return nil
}

// isPrivateURL checks if the URL points to a private/internal network
func (s *Sender) isPrivateURL(url string) bool {
	// Extract host from URL
	host := strings.TrimPrefix(url, "https://")
	host = strings.TrimPrefix(host, "http://")
	host = strings.Split(host, "/")[0]
	host = strings.Split(host, ":")[0]

	// Check for localhost
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return !s.allowInsecure // Allow in development mode
	}

	// Check for private IP ranges
	ip := net.ParseIP(host)
	if ip == nil {
		// It's a hostname, we'll let it through (DNS validation happens on connection)
		return false
	}

	// Check RFC 1918 private ranges
	privateRanges := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"169.254.0.0/16", // Link-local
		"fc00::/7",       // IPv6 private
		"fe80::/10",      // IPv6 link-local
	}

	for _, cidr := range privateRanges {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}
		if network.Contains(ip) {
			return !s.allowInsecure
		}
	}

	return false
}

// Close closes the sender's HTTP client
func (s *Sender) Close() {
	s.client.CloseIdleConnections()
}

// SendWithRetry sends a webhook with automatic retry logic
func (s *Sender) SendWithRetry(ctx context.Context, delivery *WebhookDelivery, customHeaders map[string]string, config RetryConfig) (*SendResult, int) {
	var lastResult *SendResult
	attempts := 0

	for attempts < config.MaxAttempts {
		attempts++

		// Check context cancellation
		select {
		case <-ctx.Done():
			return &SendResult{
				Success:      false,
				Error:        ctx.Err(),
				ResponseTime: 0,
			}, attempts
		default:
		}

		// Send webhook
		lastResult = s.Send(ctx, delivery, customHeaders)

		if lastResult.Success {
			return lastResult, attempts
		}

		// If this was the last attempt, don't wait
		if attempts >= config.MaxAttempts {
			break
		}

		// Calculate backoff delay
		delay := CalculateBackoff(attempts, config.BaseDelay, config.MaxDelay, config.BackoffMultiplier)

		log.Debug().
			Str("delivery_id", delivery.ID.String()).
			Int("attempt", attempts).
			Dur("retry_delay", delay).
			Msg("Scheduling webhook retry")

		// Wait before retry
		select {
		case <-ctx.Done():
			return &SendResult{
				Success:      false,
				Error:        ctx.Err(),
				ResponseTime: 0,
			}, attempts
		case <-time.After(delay):
			// Continue to retry
		}
	}

	return lastResult, attempts
}
