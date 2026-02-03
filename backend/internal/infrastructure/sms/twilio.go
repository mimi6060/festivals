package sms

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// TwilioClient handles SMS sending through Twilio
type TwilioClient struct {
	accountSID  string
	authToken   string
	fromNumber  string
	baseURL     string
	httpClient  *http.Client
	rateLimiter *rateLimiter
}

// TwilioConfig holds configuration for the Twilio client
type TwilioConfig struct {
	AccountSID string
	AuthToken  string
	FromNumber string
	Timeout    time.Duration
	RateLimit  int // Messages per second, 0 for no limit
}

// rateLimiter implements token bucket rate limiting
type rateLimiter struct {
	mu       sync.Mutex
	tokens   int
	maxRate  int
	lastTick time.Time
}

// newRateLimiter creates a new rate limiter
func newRateLimiter(rate int) *rateLimiter {
	if rate <= 0 {
		return nil
	}
	return &rateLimiter{
		tokens:   rate,
		maxRate:  rate,
		lastTick: time.Now(),
	}
}

// wait blocks until a token is available
func (r *rateLimiter) wait(ctx context.Context) error {
	if r == nil {
		return nil
	}

	for {
		r.mu.Lock()
		now := time.Now()
		elapsed := now.Sub(r.lastTick)
		if elapsed >= time.Second {
			r.tokens = r.maxRate
			r.lastTick = now
		}

		if r.tokens > 0 {
			r.tokens--
			r.mu.Unlock()
			return nil
		}
		r.mu.Unlock()

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(100 * time.Millisecond):
			continue
		}
	}
}

// NewTwilioClient creates a new Twilio SMS client
func NewTwilioClient(cfg TwilioConfig) *TwilioClient {
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	return &TwilioClient{
		accountSID: cfg.AccountSID,
		authToken:  cfg.AuthToken,
		fromNumber: cfg.FromNumber,
		baseURL:    fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s", cfg.AccountSID),
		httpClient: &http.Client{
			Timeout: timeout,
		},
		rateLimiter: newRateLimiter(cfg.RateLimit),
	}
}

// SendSMSResult represents the result of sending an SMS
type SendSMSResult struct {
	MessageSID string `json:"sid"`
	Status     string `json:"status"`
	To         string `json:"to"`
	From       string `json:"from"`
	Body       string `json:"body"`
	ErrorCode  string `json:"error_code,omitempty"`
	Error      string `json:"error_message,omitempty"`
	Success    bool   `json:"-"`
}

// twilioSendResponse represents Twilio API response
type twilioSendResponse struct {
	SID          string `json:"sid"`
	Status       string `json:"status"`
	To           string `json:"to"`
	From         string `json:"from"`
	Body         string `json:"body"`
	ErrorCode    int    `json:"error_code,omitempty"`
	ErrorMessage string `json:"error_message,omitempty"`
}

// twilioErrorResponse represents Twilio API error
type twilioErrorResponse struct {
	Code     int    `json:"code"`
	Message  string `json:"message"`
	MoreInfo string `json:"more_info"`
	Status   int    `json:"status"`
}

// BalanceResponse represents Twilio account balance
type BalanceResponse struct {
	Currency string  `json:"currency"`
	Balance  float64 `json:"balance"`
}

// SendSMS sends a single SMS message
func (c *TwilioClient) SendSMS(ctx context.Context, to, message string) (*SendSMSResult, error) {
	// Wait for rate limit
	if err := c.rateLimiter.wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limit wait cancelled: %w", err)
	}

	// Normalize phone number
	to = normalizePhoneNumber(to)

	// Build form data
	data := url.Values{}
	data.Set("To", to)
	data.Set("From", c.fromNumber)
	data.Set("Body", message)

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/Messages.json", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", c.basicAuth())

	// Send request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Str("to", to).Msg("Failed to send SMS request")
		return nil, fmt.Errorf("failed to send SMS request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Handle error response
	if resp.StatusCode >= 400 {
		var errResp twilioErrorResponse
		if err := json.Unmarshal(body, &errResp); err != nil {
			log.Error().Err(err).Str("response", string(body)).Msg("Failed to parse Twilio error response")
			return nil, fmt.Errorf("twilio API error: status %d", resp.StatusCode)
		}

		log.Error().
			Int("code", errResp.Code).
			Str("message", errResp.Message).
			Str("to", to).
			Msg("Twilio API error")

		return &SendSMSResult{
			To:        to,
			From:      c.fromNumber,
			Body:      message,
			ErrorCode: fmt.Sprintf("%d", errResp.Code),
			Error:     errResp.Message,
			Success:   false,
		}, fmt.Errorf("twilio error %d: %s", errResp.Code, errResp.Message)
	}

	// Parse success response
	var twilioResp twilioSendResponse
	if err := json.Unmarshal(body, &twilioResp); err != nil {
		log.Error().Err(err).Str("response", string(body)).Msg("Failed to parse Twilio response")
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	log.Info().
		Str("messageSID", twilioResp.SID).
		Str("to", to).
		Str("status", twilioResp.Status).
		Msg("SMS sent successfully")

	return &SendSMSResult{
		MessageSID: twilioResp.SID,
		Status:     twilioResp.Status,
		To:         twilioResp.To,
		From:       twilioResp.From,
		Body:       twilioResp.Body,
		Success:    true,
	}, nil
}

// BulkSMSResult represents the result of sending bulk SMS
type BulkSMSResult struct {
	TotalSent    int               `json:"totalSent"`
	TotalFailed  int               `json:"totalFailed"`
	Results      []*SendSMSResult  `json:"results"`
	FailedErrors map[string]string `json:"failedErrors,omitempty"`
}

// SendBulkSMS sends SMS messages to multiple recipients with throttling
func (c *TwilioClient) SendBulkSMS(ctx context.Context, numbers []string, message string) (*BulkSMSResult, error) {
	result := &BulkSMSResult{
		Results:      make([]*SendSMSResult, 0, len(numbers)),
		FailedErrors: make(map[string]string),
	}

	for _, number := range numbers {
		select {
		case <-ctx.Done():
			log.Warn().Int("sent", result.TotalSent).Int("remaining", len(numbers)-result.TotalSent-result.TotalFailed).Msg("Bulk SMS sending cancelled")
			return result, ctx.Err()
		default:
		}

		smsResult, err := c.SendSMS(ctx, number, message)
		if err != nil {
			result.TotalFailed++
			if smsResult != nil {
				result.Results = append(result.Results, smsResult)
			}
			result.FailedErrors[number] = err.Error()
			log.Error().Err(err).Str("number", number).Msg("Failed to send SMS in bulk")
			continue
		}

		result.TotalSent++
		result.Results = append(result.Results, smsResult)
	}

	log.Info().
		Int("totalSent", result.TotalSent).
		Int("totalFailed", result.TotalFailed).
		Int("total", len(numbers)).
		Msg("Bulk SMS sending completed")

	return result, nil
}

// SendBulkSMSAsync sends SMS messages asynchronously and returns results via channels
func (c *TwilioClient) SendBulkSMSAsync(ctx context.Context, numbers []string, message string, concurrency int) (<-chan *SendSMSResult, <-chan error) {
	if concurrency <= 0 {
		concurrency = 5
	}

	resultChan := make(chan *SendSMSResult, len(numbers))
	errChan := make(chan error, 1)

	go func() {
		defer close(resultChan)
		defer close(errChan)

		sem := make(chan struct{}, concurrency)

		var wg sync.WaitGroup
		for _, number := range numbers {
			select {
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			case sem <- struct{}{}:
			}

			wg.Add(1)
			go func(num string) {
				defer wg.Done()
				defer func() { <-sem }()

				result, err := c.SendSMS(ctx, num, message)
				if err != nil {
					if result == nil {
						result = &SendSMSResult{
							To:      num,
							From:    c.fromNumber,
							Body:    message,
							Error:   err.Error(),
							Success: false,
						}
					}
				}
				resultChan <- result
			}(number)
		}

		wg.Wait()
	}()

	return resultChan, errChan
}

// GetBalance retrieves the current Twilio account balance
func (c *TwilioClient) GetBalance(ctx context.Context) (*BalanceResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/Balance.json", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", c.basicAuth())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get balance: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		var errResp twilioErrorResponse
		if err := json.Unmarshal(body, &errResp); err != nil {
			return nil, fmt.Errorf("twilio API error: status %d", resp.StatusCode)
		}
		return nil, fmt.Errorf("twilio error %d: %s", errResp.Code, errResp.Message)
	}

	// Parse balance response
	var balanceData struct {
		Currency string `json:"currency"`
		Balance  string `json:"balance"`
	}
	if err := json.Unmarshal(body, &balanceData); err != nil {
		return nil, fmt.Errorf("failed to parse balance response: %w", err)
	}

	var balance float64
	fmt.Sscanf(balanceData.Balance, "%f", &balance)

	return &BalanceResponse{
		Currency: balanceData.Currency,
		Balance:  balance,
	}, nil
}

// GetMessageStatus retrieves the status of a sent message
func (c *TwilioClient) GetMessageStatus(ctx context.Context, messageSID string) (*SendSMSResult, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/Messages/"+messageSID+".json", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", c.basicAuth())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get message status: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		var errResp twilioErrorResponse
		if err := json.Unmarshal(body, &errResp); err != nil {
			return nil, fmt.Errorf("twilio API error: status %d", resp.StatusCode)
		}
		return nil, fmt.Errorf("twilio error %d: %s", errResp.Code, errResp.Message)
	}

	var twilioResp twilioSendResponse
	if err := json.Unmarshal(body, &twilioResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &SendSMSResult{
		MessageSID: twilioResp.SID,
		Status:     twilioResp.Status,
		To:         twilioResp.To,
		From:       twilioResp.From,
		Body:       twilioResp.Body,
		Success:    isSuccessStatus(twilioResp.Status),
	}, nil
}

// HealthCheck verifies the connection to Twilio
func (c *TwilioClient) HealthCheck(ctx context.Context) error {
	_, err := c.GetBalance(ctx)
	if err != nil {
		return fmt.Errorf("twilio health check failed: %w", err)
	}
	return nil
}

// basicAuth returns the Basic Auth header value
func (c *TwilioClient) basicAuth() string {
	auth := c.accountSID + ":" + c.authToken
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(auth))
}

// normalizePhoneNumber ensures the phone number is in E.164 format
func normalizePhoneNumber(phone string) string {
	// Remove any whitespace, dashes, or parentheses
	phone = strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' || r == '+' {
			return r
		}
		return -1
	}, phone)

	// Ensure it starts with +
	if !strings.HasPrefix(phone, "+") {
		// Assume it's a US number if no country code
		if len(phone) == 10 {
			phone = "+1" + phone
		} else {
			phone = "+" + phone
		}
	}

	return phone
}

// isSuccessStatus checks if a message status indicates success
func isSuccessStatus(status string) bool {
	successStatuses := map[string]bool{
		"queued":     true,
		"sending":    true,
		"sent":       true,
		"delivered":  true,
		"receiving":  true,
		"received":   true,
		"accepted":   true,
		"scheduled":  true,
		"read":       true,
	}
	return successStatuses[strings.ToLower(status)]
}
