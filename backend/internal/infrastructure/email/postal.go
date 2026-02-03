package email

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mimi6060/festivals/backend/internal/domain/notification"
	"github.com/rs/zerolog/log"
)

// Verify PostalClient implements notification.EmailClient interface
var _ notification.EmailClient = (*PostalClient)(nil)

// PostalClient handles email sending through Postal mail server
type PostalClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	fromEmail  string
	fromName   string
	maxRetries int
	retryDelay time.Duration
}

// PostalConfig holds configuration for the Postal client
type PostalConfig struct {
	BaseURL    string
	APIKey     string
	FromEmail  string
	FromName   string
	Timeout    time.Duration
	MaxRetries int
	RetryDelay time.Duration
}

// NewPostalClient creates a new Postal email client
func NewPostalClient(cfg PostalConfig) *PostalClient {
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	maxRetries := cfg.MaxRetries
	if maxRetries == 0 {
		maxRetries = 3
	}

	retryDelay := cfg.RetryDelay
	if retryDelay == 0 {
		retryDelay = 1 * time.Second
	}

	return &PostalClient{
		baseURL:    cfg.BaseURL,
		apiKey:     cfg.APIKey,
		fromEmail:  cfg.FromEmail,
		fromName:   cfg.FromName,
		maxRetries: maxRetries,
		retryDelay: retryDelay,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// SendEmailRequest represents a request to send an email
type SendEmailRequest struct {
	To          []string          `json:"to"`
	CC          []string          `json:"cc,omitempty"`
	BCC         []string          `json:"bcc,omitempty"`
	From        string            `json:"from"`
	Subject     string            `json:"subject"`
	HTMLBody    string            `json:"html_body,omitempty"`
	TextBody    string            `json:"plain_body,omitempty"`
	Attachments []Attachment      `json:"attachments,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	Tag         string            `json:"tag,omitempty"`
}

// Attachment represents an email attachment
type Attachment struct {
	Name        string `json:"name"`
	ContentType string `json:"content_type"`
	Data        string `json:"data"` // Base64 encoded
}

// postalSendRequest is the Postal API request format
type postalSendRequest struct {
	To          []string          `json:"to"`
	CC          []string          `json:"cc,omitempty"`
	BCC         []string          `json:"bcc,omitempty"`
	From        string            `json:"from"`
	Sender      string            `json:"sender,omitempty"`
	Subject     string            `json:"subject"`
	Tag         string            `json:"tag,omitempty"`
	ReplyTo     string            `json:"reply_to,omitempty"`
	PlainBody   string            `json:"plain_body,omitempty"`
	HTMLBody    string            `json:"html_body,omitempty"`
	Attachments []Attachment      `json:"attachments,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
}

// postalResponse is the Postal API response format
type postalResponse struct {
	Status    string `json:"status"`
	Time      float64 `json:"time"`
	Flags     interface{} `json:"flags"`
	Data      postalResponseData `json:"data"`
}

type postalResponseData struct {
	MessageID string                 `json:"message_id"`
	Messages  map[string]interface{} `json:"messages"`
}

// SendEmail sends an email with the given parameters (implements notification.EmailClient)
func (c *PostalClient) SendEmail(ctx context.Context, to, subject, htmlBody, textBody string) (*notification.EmailSendResult, error) {
	return c.SendEmailMultiple(ctx, []string{to}, subject, htmlBody, textBody)
}

// SendEmailMultiple sends an email to multiple recipients
func (c *PostalClient) SendEmailMultiple(ctx context.Context, to []string, subject, htmlBody, textBody string) (*notification.EmailSendResult, error) {
	from := c.fromEmail
	if c.fromName != "" {
		from = fmt.Sprintf("%s <%s>", c.fromName, c.fromEmail)
	}

	req := postalSendRequest{
		To:        to,
		From:      from,
		Subject:   subject,
		HTMLBody:  htmlBody,
		PlainBody: textBody,
	}

	return c.sendRequest(ctx, req)
}

// SendEmailWithAttachments sends an email with attachments (implements notification.EmailClient)
func (c *PostalClient) SendEmailWithAttachments(ctx context.Context, req notification.EmailSendRequest) (*notification.EmailSendResult, error) {
	from := req.From
	if from == "" {
		from = c.fromEmail
		if c.fromName != "" {
			from = fmt.Sprintf("%s <%s>", c.fromName, c.fromEmail)
		}
	}

	// Convert domain attachments to internal format
	attachments := make([]Attachment, len(req.Attachments))
	for i, a := range req.Attachments {
		attachments[i] = Attachment{
			Name:        a.Name,
			ContentType: a.ContentType,
			Data:        a.Data,
		}
	}

	postalReq := postalSendRequest{
		To:          req.To,
		CC:          req.CC,
		BCC:         req.BCC,
		From:        from,
		Subject:     req.Subject,
		HTMLBody:    req.HTMLBody,
		PlainBody:   req.TextBody,
		Attachments: attachments,
		Headers:     req.Headers,
		Tag:         req.Tag,
	}

	return c.sendRequest(ctx, postalReq)
}

// TemplatedEmailRequest represents a request to send a templated email
type TemplatedEmailRequest struct {
	To         string
	TemplateID string
	Variables  map[string]interface{}
	Tag        string
}

// SendTemplatedEmail sends an email using a pre-defined template
// Note: This method is designed to work with an external template system
// For Go template-based emails, use the notification service directly
func (c *PostalClient) SendTemplatedEmail(ctx context.Context, to, templateID string, variables map[string]interface{}) (*notification.EmailSendResult, error) {
	// Postal doesn't have native template support, so this would typically
	// integrate with an external template service or use Go templates
	// This is a placeholder that logs the intent - actual implementation
	// should use the notification service which renders Go templates

	log.Warn().
		Str("to", to).
		Str("templateId", templateID).
		Msg("SendTemplatedEmail called - use notification service for Go template rendering")

	return &notification.EmailSendResult{
		Success: false,
		Error:   "use notification service for template rendering",
	}, fmt.Errorf("SendTemplatedEmail should be called through notification service")
}

// sendRequest makes the actual HTTP request to Postal with retry logic
func (c *PostalClient) sendRequest(ctx context.Context, req postalSendRequest) (*notification.EmailSendResult, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff with jitter
			delay := c.retryDelay * time.Duration(1<<uint(attempt-1))
			log.Warn().
				Int("attempt", attempt).
				Dur("delay", delay).
				Strs("to", req.To).
				Msg("Retrying email send after delay")

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}

		result, err := c.doSendRequest(ctx, body, req)
		if err == nil {
			return result, nil
		}

		lastErr = err

		// Don't retry on context cancellation or non-retryable errors
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		// Check if error is retryable (network errors, 5xx responses)
		if !isRetryableError(err) {
			log.Error().Err(err).Msg("Non-retryable email error, not retrying")
			return result, err
		}

		log.Warn().
			Err(err).
			Int("attempt", attempt+1).
			Int("maxRetries", c.maxRetries).
			Msg("Email send attempt failed")
	}

	return nil, fmt.Errorf("failed to send email after %d retries: %w", c.maxRetries, lastErr)
}

// doSendRequest performs a single HTTP request to Postal
func (c *PostalClient) doSendRequest(ctx context.Context, body []byte, req postalSendRequest) (*notification.EmailSendResult, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/v1/send/message", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Server-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		log.Error().Err(err).Msg("Failed to send email request")
		return nil, &retryableError{err: fmt.Errorf("failed to send request: %w", err)}
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check for server errors (5xx) which are retryable
	if resp.StatusCode >= 500 {
		log.Error().
			Int("statusCode", resp.StatusCode).
			Str("response", string(respBody)).
			Msg("Postal server error")
		return nil, &retryableError{err: fmt.Errorf("postal server error: status %d", resp.StatusCode)}
	}

	var postalResp postalResponse
	if err := json.Unmarshal(respBody, &postalResp); err != nil {
		log.Error().Err(err).Str("response", string(respBody)).Msg("Failed to parse Postal response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if postalResp.Status != "success" {
		log.Error().
			Str("status", postalResp.Status).
			Str("response", string(respBody)).
			Msg("Postal API returned error")
		return &notification.EmailSendResult{
			Success: false,
			Error:   fmt.Sprintf("postal API error: %s", postalResp.Status),
		}, fmt.Errorf("postal API error: %s", postalResp.Status)
	}

	log.Info().
		Str("messageId", postalResp.Data.MessageID).
		Strs("to", req.To).
		Str("subject", req.Subject).
		Msg("Email sent successfully")

	return &notification.EmailSendResult{
		MessageID: postalResp.Data.MessageID,
		Success:   true,
	}, nil
}

// retryableError wraps errors that should be retried
type retryableError struct {
	err error
}

func (e *retryableError) Error() string {
	return e.err.Error()
}

func (e *retryableError) Unwrap() error {
	return e.err
}

// isRetryableError checks if an error should be retried
func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	var retryable *retryableError
	return errors.As(err, &retryable)
}

// HealthCheck verifies the connection to Postal
func (c *PostalClient) HealthCheck(ctx context.Context) error {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/health", nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	httpReq.Header.Set("X-Server-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("postal health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("postal health check returned status %d", resp.StatusCode)
	}

	return nil
}
