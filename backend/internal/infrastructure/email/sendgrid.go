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

	"github.com/rs/zerolog/log"
)

// SendGridClient handles email sending through SendGrid
type SendGridClient struct {
	apiKey     string
	httpClient *http.Client
	fromEmail  string
	fromName   string
	maxRetries int
	retryDelay time.Duration
}

// SendGridConfig holds configuration for the SendGrid client
type SendGridConfig struct {
	APIKey     string
	FromEmail  string
	FromName   string
	Timeout    time.Duration
	MaxRetries int
	RetryDelay time.Duration
}

// NewSendGridClient creates a new SendGrid email client
func NewSendGridClient(cfg SendGridConfig) *SendGridClient {
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

	return &SendGridClient{
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

// sendGridRequest represents the SendGrid API v3 mail send request
type sendGridRequest struct {
	Personalizations []sendGridPersonalization `json:"personalizations"`
	From             sendGridEmail             `json:"from"`
	ReplyTo          *sendGridEmail            `json:"reply_to,omitempty"`
	Subject          string                    `json:"subject"`
	Content          []sendGridContent         `json:"content"`
	Attachments      []sendGridAttachment      `json:"attachments,omitempty"`
	Categories       []string                  `json:"categories,omitempty"`
	CustomArgs       map[string]string         `json:"custom_args,omitempty"`
}

type sendGridPersonalization struct {
	To      []sendGridEmail   `json:"to"`
	CC      []sendGridEmail   `json:"cc,omitempty"`
	BCC     []sendGridEmail   `json:"bcc,omitempty"`
	Subject string            `json:"subject,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
}

type sendGridEmail struct {
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type sendGridContent struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type sendGridAttachment struct {
	Content     string `json:"content"` // Base64 encoded
	Type        string `json:"type"`
	Filename    string `json:"filename"`
	Disposition string `json:"disposition,omitempty"`
	ContentID   string `json:"content_id,omitempty"`
}

// sendGridErrorResponse represents SendGrid API error response
type sendGridErrorResponse struct {
	Errors []sendGridError `json:"errors"`
}

type sendGridError struct {
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
	Help    string `json:"help,omitempty"`
}

// SendEmail sends an email with the given parameters
func (c *SendGridClient) SendEmail(ctx context.Context, to, subject, htmlBody, textBody string) (*SendEmailResult, error) {
	return c.SendEmailMultiple(ctx, []string{to}, subject, htmlBody, textBody)
}

// SendEmailMultiple sends an email to multiple recipients
func (c *SendGridClient) SendEmailMultiple(ctx context.Context, to []string, subject, htmlBody, textBody string) (*SendEmailResult, error) {
	toEmails := make([]sendGridEmail, len(to))
	for i, email := range to {
		toEmails[i] = sendGridEmail{Email: email}
	}

	req := sendGridRequest{
		Personalizations: []sendGridPersonalization{
			{
				To: toEmails,
			},
		},
		From: sendGridEmail{
			Email: c.fromEmail,
			Name:  c.fromName,
		},
		Subject: subject,
		Content: []sendGridContent{},
	}

	// Add plain text content if provided
	if textBody != "" {
		req.Content = append(req.Content, sendGridContent{
			Type:  "text/plain",
			Value: textBody,
		})
	}

	// Add HTML content if provided
	if htmlBody != "" {
		req.Content = append(req.Content, sendGridContent{
			Type:  "text/html",
			Value: htmlBody,
		})
	}

	return c.sendRequest(ctx, req)
}

// SendEmailWithAttachments sends an email with attachments
func (c *SendGridClient) SendEmailWithAttachments(ctx context.Context, emailReq SendEmailRequest) (*SendEmailResult, error) {
	toEmails := make([]sendGridEmail, len(emailReq.To))
	for i, email := range emailReq.To {
		toEmails[i] = sendGridEmail{Email: email}
	}

	ccEmails := make([]sendGridEmail, len(emailReq.CC))
	for i, email := range emailReq.CC {
		ccEmails[i] = sendGridEmail{Email: email}
	}

	bccEmails := make([]sendGridEmail, len(emailReq.BCC))
	for i, email := range emailReq.BCC {
		bccEmails[i] = sendGridEmail{Email: email}
	}

	from := c.fromEmail
	fromName := c.fromName
	if emailReq.From != "" {
		from = emailReq.From
		fromName = ""
	}

	req := sendGridRequest{
		Personalizations: []sendGridPersonalization{
			{
				To:      toEmails,
				CC:      ccEmails,
				BCC:     bccEmails,
				Headers: emailReq.Headers,
			},
		},
		From: sendGridEmail{
			Email: from,
			Name:  fromName,
		},
		Subject: emailReq.Subject,
		Content: []sendGridContent{},
	}

	// Add plain text content if provided
	if emailReq.TextBody != "" {
		req.Content = append(req.Content, sendGridContent{
			Type:  "text/plain",
			Value: emailReq.TextBody,
		})
	}

	// Add HTML content if provided
	if emailReq.HTMLBody != "" {
		req.Content = append(req.Content, sendGridContent{
			Type:  "text/html",
			Value: emailReq.HTMLBody,
		})
	}

	// Add attachments
	for _, att := range emailReq.Attachments {
		req.Attachments = append(req.Attachments, sendGridAttachment{
			Content:  att.Data,
			Type:     att.ContentType,
			Filename: att.Name,
		})
	}

	// Add tag as category
	if emailReq.Tag != "" {
		req.Categories = []string{emailReq.Tag}
	}

	return c.sendRequest(ctx, req)
}

// sendRequest makes the actual HTTP request to SendGrid with retry logic
func (c *SendGridClient) sendRequest(ctx context.Context, req sendGridRequest) (*SendEmailResult, error) {
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
				Msg("Retrying SendGrid email send after delay")

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

		// Check if error is retryable
		if !isSendGridRetryableError(err) {
			log.Error().Err(err).Msg("Non-retryable SendGrid error, not retrying")
			return result, err
		}

		log.Warn().
			Err(err).
			Int("attempt", attempt+1).
			Int("maxRetries", c.maxRetries).
			Msg("SendGrid email send attempt failed")
	}

	return nil, fmt.Errorf("failed to send email via SendGrid after %d retries: %w", c.maxRetries, lastErr)
}

// doSendRequest performs a single HTTP request to SendGrid
func (c *SendGridClient) doSendRequest(ctx context.Context, body []byte, req sendGridRequest) (*SendEmailResult, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.sendgrid.com/v3/mail/send", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		log.Error().Err(err).Msg("Failed to send SendGrid email request")
		return nil, &sendGridRetryableError{err: fmt.Errorf("failed to send request: %w", err)}
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// SendGrid returns 202 Accepted on success
	if resp.StatusCode == http.StatusAccepted {
		// Extract message ID from headers
		messageID := resp.Header.Get("X-Message-Id")

		log.Info().
			Str("messageId", messageID).
			Interface("to", req.Personalizations[0].To).
			Str("subject", req.Subject).
			Msg("Email sent successfully via SendGrid")

		return &SendEmailResult{
			MessageID: messageID,
			Success:   true,
		}, nil
	}

	// Check for server errors (5xx) which are retryable
	if resp.StatusCode >= 500 {
		log.Error().
			Int("statusCode", resp.StatusCode).
			Str("response", string(respBody)).
			Msg("SendGrid server error")
		return nil, &sendGridRetryableError{err: fmt.Errorf("sendgrid server error: status %d", resp.StatusCode)}
	}

	// Check for rate limiting (429) which is retryable
	if resp.StatusCode == http.StatusTooManyRequests {
		log.Warn().
			Int("statusCode", resp.StatusCode).
			Msg("SendGrid rate limit exceeded")
		return nil, &sendGridRetryableError{err: fmt.Errorf("sendgrid rate limit exceeded")}
	}

	// Parse error response
	var errResp sendGridErrorResponse
	if err := json.Unmarshal(respBody, &errResp); err != nil {
		log.Error().Err(err).Str("response", string(respBody)).Msg("Failed to parse SendGrid error response")
		return &SendEmailResult{
			Success: false,
			Error:   fmt.Sprintf("sendgrid API error: status %d", resp.StatusCode),
		}, fmt.Errorf("sendgrid API error: status %d", resp.StatusCode)
	}

	errorMsg := "unknown error"
	if len(errResp.Errors) > 0 {
		errorMsg = errResp.Errors[0].Message
	}

	log.Error().
		Int("statusCode", resp.StatusCode).
		Str("error", errorMsg).
		Str("response", string(respBody)).
		Msg("SendGrid API returned error")

	return &SendEmailResult{
		Success: false,
		Error:   fmt.Sprintf("sendgrid API error: %s", errorMsg),
	}, fmt.Errorf("sendgrid API error: %s", errorMsg)
}

// HealthCheck verifies the connection to SendGrid by validating API key
func (c *SendGridClient) HealthCheck(ctx context.Context) error {
	// SendGrid doesn't have a dedicated health endpoint, but we can check API key validity
	// by making a request to the user profile endpoint
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.sendgrid.com/v3/user/profile", nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("sendgrid health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("sendgrid API key is invalid")
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("sendgrid health check returned status %d", resp.StatusCode)
	}

	return nil
}

// sendGridRetryableError wraps errors that should be retried
type sendGridRetryableError struct {
	err error
}

func (e *sendGridRetryableError) Error() string {
	return e.err.Error()
}

func (e *sendGridRetryableError) Unwrap() error {
	return e.err
}

// isSendGridRetryableError checks if an error should be retried
func isSendGridRetryableError(err error) bool {
	if err == nil {
		return false
	}
	var retryable *sendGridRetryableError
	return errors.As(err, &retryable)
}
