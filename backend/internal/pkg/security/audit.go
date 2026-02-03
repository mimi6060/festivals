package security

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// SecurityEventType defines types of security events
type SecurityEventType string

const (
	// Authentication events
	EventAuthSuccess           SecurityEventType = "AUTH_SUCCESS"
	EventAuthFailure           SecurityEventType = "AUTH_FAILURE"
	EventAuthBruteForce        SecurityEventType = "AUTH_BRUTE_FORCE"
	EventAuthTokenExpired      SecurityEventType = "AUTH_TOKEN_EXPIRED"
	EventAuthTokenInvalid      SecurityEventType = "AUTH_TOKEN_INVALID"
	EventAuthTokenRefresh      SecurityEventType = "AUTH_TOKEN_REFRESH"
	EventAuthLogout            SecurityEventType = "AUTH_LOGOUT"
	EventAuthPasswordChange    SecurityEventType = "AUTH_PASSWORD_CHANGE"
	EventAuthPasswordReset     SecurityEventType = "AUTH_PASSWORD_RESET"
	EventAuth2FAEnabled        SecurityEventType = "AUTH_2FA_ENABLED"
	EventAuth2FADisabled       SecurityEventType = "AUTH_2FA_DISABLED"
	EventAuth2FAFailure        SecurityEventType = "AUTH_2FA_FAILURE"

	// Authorization events
	EventAuthzDenied           SecurityEventType = "AUTHZ_DENIED"
	EventAuthzElevation        SecurityEventType = "AUTHZ_ELEVATION"
	EventAuthzRoleChange       SecurityEventType = "AUTHZ_ROLE_CHANGE"

	// Data events
	EventDataAccess            SecurityEventType = "DATA_ACCESS"
	EventDataModification      SecurityEventType = "DATA_MODIFICATION"
	EventDataDeletion          SecurityEventType = "DATA_DELETION"
	EventDataExport            SecurityEventType = "DATA_EXPORT"
	EventDataEncryption        SecurityEventType = "DATA_ENCRYPTION"
	EventDataDecryption        SecurityEventType = "DATA_DECRYPTION"

	// Attack events
	EventAttackSQLInjection    SecurityEventType = "ATTACK_SQL_INJECTION"
	EventAttackXSS             SecurityEventType = "ATTACK_XSS"
	EventAttackCSRF            SecurityEventType = "ATTACK_CSRF"
	EventAttackPathTraversal   SecurityEventType = "ATTACK_PATH_TRAVERSAL"
	EventAttackCommandInjection SecurityEventType = "ATTACK_COMMAND_INJECTION"
	EventAttackNoSQLInjection  SecurityEventType = "ATTACK_NOSQL_INJECTION"
	EventAttackXXE             SecurityEventType = "ATTACK_XXE"
	EventAttackSSRF            SecurityEventType = "ATTACK_SSRF"
	EventAttackRateLimited     SecurityEventType = "ATTACK_RATE_LIMITED"

	// Session events
	EventSessionCreated        SecurityEventType = "SESSION_CREATED"
	EventSessionDestroyed      SecurityEventType = "SESSION_DESTROYED"
	EventSessionHijack         SecurityEventType = "SESSION_HIJACK"
	EventSessionFixation       SecurityEventType = "SESSION_FIXATION"

	// System events
	EventSystemConfigChange    SecurityEventType = "SYSTEM_CONFIG_CHANGE"
	EventSystemKeyRotation     SecurityEventType = "SYSTEM_KEY_ROTATION"
	EventSystemCertExpiry      SecurityEventType = "SYSTEM_CERT_EXPIRY"
	EventSystemError           SecurityEventType = "SYSTEM_ERROR"

	// API events
	EventAPIKeyCreated         SecurityEventType = "API_KEY_CREATED"
	EventAPIKeyRevoked         SecurityEventType = "API_KEY_REVOKED"
	EventAPIKeyUsed            SecurityEventType = "API_KEY_USED"
	EventAPIRateLimited        SecurityEventType = "API_RATE_LIMITED"
)

// SecurityEventSeverity defines severity levels for security events
type SecurityEventSeverity string

const (
	SeverityDebug    SecurityEventSeverity = "DEBUG"
	SeverityInfo     SecurityEventSeverity = "INFO"
	SeverityWarning  SecurityEventSeverity = "WARNING"
	SeverityError    SecurityEventSeverity = "ERROR"
	SeverityCritical SecurityEventSeverity = "CRITICAL"
)

// SecurityEvent represents a security audit event
type SecurityEvent struct {
	ID          string                `json:"id"`
	Timestamp   time.Time             `json:"timestamp"`
	Type        SecurityEventType     `json:"type"`
	Severity    SecurityEventSeverity `json:"severity"`
	UserID      string                `json:"user_id,omitempty"`
	SessionID   string                `json:"session_id,omitempty"`
	RequestID   string                `json:"request_id,omitempty"`
	IPAddress   string                `json:"ip_address,omitempty"`
	UserAgent   string                `json:"user_agent,omitempty"`
	Resource    string                `json:"resource,omitempty"`
	Action      string                `json:"action,omitempty"`
	Result      string                `json:"result,omitempty"`
	Details     map[string]interface{} `json:"details,omitempty"`
	StackTrace  string                `json:"stack_trace,omitempty"`
	FestivalID  string                `json:"festival_id,omitempty"`
	TenantID    string                `json:"tenant_id,omitempty"`
}

// SecurityAuditor handles security event logging and alerting
type SecurityAuditor struct {
	logger       zerolog.Logger
	redisClient  *redis.Client
	alertHandlers []AlertHandler
	mu           sync.RWMutex
	eventBuffer  chan *SecurityEvent
	config       AuditConfig
	metrics      *AuditMetrics
}

// AuditConfig holds configuration for the security auditor
type AuditConfig struct {
	// Enable audit logging
	Enabled bool
	// Buffer size for async event processing
	BufferSize int
	// Number of worker goroutines
	Workers int
	// Redis key prefix for audit logs
	RedisKeyPrefix string
	// Retention period for audit logs
	RetentionPeriod time.Duration
	// Alert thresholds
	AlertThresholds AlertThresholds
	// Log to stdout
	LogToStdout bool
	// Log to Redis
	LogToRedis bool
	// Include stack trace for errors
	IncludeStackTrace bool
}

// AlertThresholds defines thresholds for automatic alerting
type AlertThresholds struct {
	// Failed auth attempts before alerting
	FailedAuthAttempts int
	// Failed auth time window
	FailedAuthWindow time.Duration
	// Rate limit hits before alerting
	RateLimitHits int
	// Rate limit time window
	RateLimitWindow time.Duration
	// Attack events before alerting
	AttackEvents int
	// Attack events time window
	AttackWindow time.Duration
}

// AlertHandler is an interface for handling security alerts
type AlertHandler interface {
	HandleAlert(ctx context.Context, event *SecurityEvent, threshold string) error
}

// AuditMetrics tracks audit statistics
type AuditMetrics struct {
	TotalEvents      int64
	EventsByType     map[SecurityEventType]int64
	EventsBySeverity map[SecurityEventSeverity]int64
	mu               sync.RWMutex
}

// DefaultAuditConfig returns default audit configuration
func DefaultAuditConfig() AuditConfig {
	return AuditConfig{
		Enabled:           true,
		BufferSize:        10000,
		Workers:           4,
		RedisKeyPrefix:    "security:audit:",
		RetentionPeriod:   90 * 24 * time.Hour, // 90 days
		LogToStdout:       true,
		LogToRedis:        true,
		IncludeStackTrace: true,
		AlertThresholds: AlertThresholds{
			FailedAuthAttempts: 5,
			FailedAuthWindow:   5 * time.Minute,
			RateLimitHits:      10,
			RateLimitWindow:    1 * time.Minute,
			AttackEvents:       3,
			AttackWindow:       10 * time.Minute,
		},
	}
}

// NewSecurityAuditor creates a new security auditor
func NewSecurityAuditor(config AuditConfig, redisClient *redis.Client) *SecurityAuditor {
	auditor := &SecurityAuditor{
		logger:      log.With().Str("component", "security-auditor").Logger(),
		redisClient: redisClient,
		config:      config,
		eventBuffer: make(chan *SecurityEvent, config.BufferSize),
		metrics: &AuditMetrics{
			EventsByType:     make(map[SecurityEventType]int64),
			EventsBySeverity: make(map[SecurityEventSeverity]int64),
		},
	}

	// Start workers
	for i := 0; i < config.Workers; i++ {
		go auditor.processEvents()
	}

	return auditor
}

// AddAlertHandler adds an alert handler
func (a *SecurityAuditor) AddAlertHandler(handler AlertHandler) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.alertHandlers = append(a.alertHandlers, handler)
}

// LogEvent logs a security event
func (a *SecurityAuditor) LogEvent(ctx context.Context, event *SecurityEvent) {
	if !a.config.Enabled {
		return
	}

	// Ensure ID and timestamp
	if event.ID == "" {
		event.ID = uuid.New().String()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	// Add stack trace for errors if configured
	if a.config.IncludeStackTrace && event.Severity == SeverityError || event.Severity == SeverityCritical {
		if event.StackTrace == "" {
			event.StackTrace = getStackTrace()
		}
	}

	// Send to buffer (non-blocking)
	select {
	case a.eventBuffer <- event:
	default:
		// Buffer full, log synchronously
		a.processEvent(ctx, event)
	}
}

// processEvents processes events from the buffer
func (a *SecurityAuditor) processEvents() {
	ctx := context.Background()
	for event := range a.eventBuffer {
		a.processEvent(ctx, event)
	}
}

// processEvent processes a single event
func (a *SecurityAuditor) processEvent(ctx context.Context, event *SecurityEvent) {
	// Update metrics
	a.updateMetrics(event)

	// Log to stdout
	if a.config.LogToStdout {
		a.logToStdout(event)
	}

	// Log to Redis
	if a.config.LogToRedis && a.redisClient != nil {
		a.logToRedis(ctx, event)
	}

	// Check for alerts
	a.checkAlerts(ctx, event)
}

// updateMetrics updates audit metrics
func (a *SecurityAuditor) updateMetrics(event *SecurityEvent) {
	a.metrics.mu.Lock()
	defer a.metrics.mu.Unlock()

	a.metrics.TotalEvents++
	a.metrics.EventsByType[event.Type]++
	a.metrics.EventsBySeverity[event.Severity]++
}

// logToStdout logs event to stdout using zerolog
func (a *SecurityAuditor) logToStdout(event *SecurityEvent) {
	logEvent := a.logger.With().
		Str("event_id", event.ID).
		Str("event_type", string(event.Type)).
		Str("severity", string(event.Severity)).
		Time("event_time", event.Timestamp).
		Logger()

	if event.UserID != "" {
		logEvent = logEvent.With().Str("user_id", event.UserID).Logger()
	}
	if event.IPAddress != "" {
		logEvent = logEvent.With().Str("ip_address", event.IPAddress).Logger()
	}
	if event.RequestID != "" {
		logEvent = logEvent.With().Str("request_id", event.RequestID).Logger()
	}
	if event.Resource != "" {
		logEvent = logEvent.With().Str("resource", event.Resource).Logger()
	}
	if event.Action != "" {
		logEvent = logEvent.With().Str("action", event.Action).Logger()
	}
	if event.FestivalID != "" {
		logEvent = logEvent.With().Str("festival_id", event.FestivalID).Logger()
	}

	message := fmt.Sprintf("Security Event: %s", event.Type)
	if event.Result != "" {
		message = fmt.Sprintf("%s - %s", message, event.Result)
	}

	switch event.Severity {
	case SeverityDebug:
		logEvent.Debug().Fields(event.Details).Msg(message)
	case SeverityInfo:
		logEvent.Info().Fields(event.Details).Msg(message)
	case SeverityWarning:
		logEvent.Warn().Fields(event.Details).Msg(message)
	case SeverityError:
		logEvent.Error().Fields(event.Details).Msg(message)
	case SeverityCritical:
		logEvent.Error().Str("critical", "true").Fields(event.Details).Msg(message)
	}
}

// logToRedis stores event in Redis
func (a *SecurityAuditor) logToRedis(ctx context.Context, event *SecurityEvent) {
	data, err := json.Marshal(event)
	if err != nil {
		a.logger.Error().Err(err).Msg("Failed to marshal security event")
		return
	}

	// Store in sorted set by timestamp
	key := a.config.RedisKeyPrefix + "events"
	score := float64(event.Timestamp.UnixNano())

	pipe := a.redisClient.Pipeline()

	// Add to main events list
	pipe.ZAdd(ctx, key, redis.Z{Score: score, Member: string(data)})

	// Add to type-specific list
	typeKey := a.config.RedisKeyPrefix + "events:" + string(event.Type)
	pipe.ZAdd(ctx, typeKey, redis.Z{Score: score, Member: event.ID})

	// Add to user-specific list if user ID is present
	if event.UserID != "" {
		userKey := a.config.RedisKeyPrefix + "user:" + event.UserID
		pipe.ZAdd(ctx, userKey, redis.Z{Score: score, Member: event.ID})
	}

	// Add to IP-specific list
	if event.IPAddress != "" {
		ipKey := a.config.RedisKeyPrefix + "ip:" + event.IPAddress
		pipe.ZAdd(ctx, ipKey, redis.Z{Score: score, Member: event.ID})
	}

	// Set expiration for the event data
	eventKey := a.config.RedisKeyPrefix + "event:" + event.ID
	pipe.Set(ctx, eventKey, string(data), a.config.RetentionPeriod)

	_, err = pipe.Exec(ctx)
	if err != nil {
		a.logger.Error().Err(err).Msg("Failed to store security event in Redis")
	}
}

// checkAlerts checks if event should trigger alerts
func (a *SecurityAuditor) checkAlerts(ctx context.Context, event *SecurityEvent) {
	if len(a.alertHandlers) == 0 {
		return
	}

	var threshold string

	switch event.Type {
	case EventAuthFailure, EventAuthBruteForce:
		threshold = "failed_auth"
		if a.shouldAlert(ctx, event.IPAddress, "auth_failures", a.config.AlertThresholds.FailedAuthAttempts, a.config.AlertThresholds.FailedAuthWindow) {
			a.triggerAlert(ctx, event, threshold)
		}

	case EventAttackRateLimited, EventAPIRateLimited:
		threshold = "rate_limit"
		if a.shouldAlert(ctx, event.IPAddress, "rate_limits", a.config.AlertThresholds.RateLimitHits, a.config.AlertThresholds.RateLimitWindow) {
			a.triggerAlert(ctx, event, threshold)
		}

	case EventAttackSQLInjection, EventAttackXSS, EventAttackCSRF, EventAttackPathTraversal,
		EventAttackCommandInjection, EventAttackNoSQLInjection, EventAttackXXE, EventAttackSSRF:
		threshold = "attack"
		if a.shouldAlert(ctx, event.IPAddress, "attacks", a.config.AlertThresholds.AttackEvents, a.config.AlertThresholds.AttackWindow) {
			a.triggerAlert(ctx, event, threshold)
		}

	case EventSessionHijack, EventSessionFixation:
		// Always alert on session attacks
		threshold = "session_attack"
		a.triggerAlert(ctx, event, threshold)

	case EventAuthzElevation:
		// Always alert on privilege escalation
		threshold = "privilege_escalation"
		a.triggerAlert(ctx, event, threshold)
	}
}

// shouldAlert checks if alert threshold has been exceeded
func (a *SecurityAuditor) shouldAlert(ctx context.Context, identifier, category string, threshold int, window time.Duration) bool {
	if a.redisClient == nil {
		return false
	}

	key := fmt.Sprintf("%salert:%s:%s", a.config.RedisKeyPrefix, category, identifier)
	count, err := a.redisClient.Incr(ctx, key).Result()
	if err != nil {
		return false
	}

	// Set expiration on first increment
	if count == 1 {
		a.redisClient.Expire(ctx, key, window)
	}

	return count >= int64(threshold)
}

// triggerAlert triggers an alert through all handlers
func (a *SecurityAuditor) triggerAlert(ctx context.Context, event *SecurityEvent, threshold string) {
	a.mu.RLock()
	handlers := a.alertHandlers
	a.mu.RUnlock()

	for _, handler := range handlers {
		go func(h AlertHandler) {
			if err := h.HandleAlert(ctx, event, threshold); err != nil {
				a.logger.Error().Err(err).Str("threshold", threshold).Msg("Failed to handle alert")
			}
		}(handler)
	}
}

// GetMetrics returns current audit metrics
func (a *SecurityAuditor) GetMetrics() *AuditMetrics {
	a.metrics.mu.RLock()
	defer a.metrics.mu.RUnlock()

	// Return a copy
	metrics := &AuditMetrics{
		TotalEvents:      a.metrics.TotalEvents,
		EventsByType:     make(map[SecurityEventType]int64),
		EventsBySeverity: make(map[SecurityEventSeverity]int64),
	}

	for k, v := range a.metrics.EventsByType {
		metrics.EventsByType[k] = v
	}
	for k, v := range a.metrics.EventsBySeverity {
		metrics.EventsBySeverity[k] = v
	}

	return metrics
}

// QueryEvents queries security events from Redis
func (a *SecurityAuditor) QueryEvents(ctx context.Context, filter EventFilter) ([]SecurityEvent, error) {
	if a.redisClient == nil {
		return nil, nil
	}

	var key string
	if filter.Type != "" {
		key = a.config.RedisKeyPrefix + "events:" + string(filter.Type)
	} else if filter.UserID != "" {
		key = a.config.RedisKeyPrefix + "user:" + filter.UserID
	} else if filter.IPAddress != "" {
		key = a.config.RedisKeyPrefix + "ip:" + filter.IPAddress
	} else {
		key = a.config.RedisKeyPrefix + "events"
	}

	// Query by time range
	minScore := "-inf"
	maxScore := "+inf"
	if !filter.StartTime.IsZero() {
		minScore = fmt.Sprintf("%d", filter.StartTime.UnixNano())
	}
	if !filter.EndTime.IsZero() {
		maxScore = fmt.Sprintf("%d", filter.EndTime.UnixNano())
	}

	results, err := a.redisClient.ZRangeByScore(ctx, key, &redis.ZRangeBy{
		Min:    minScore,
		Max:    maxScore,
		Offset: int64(filter.Offset),
		Count:  int64(filter.Limit),
	}).Result()

	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}

	var events []SecurityEvent
	for _, result := range results {
		var event SecurityEvent
		if err := json.Unmarshal([]byte(result), &event); err != nil {
			continue
		}
		events = append(events, event)
	}

	return events, nil
}

// EventFilter defines filters for querying events
type EventFilter struct {
	Type      SecurityEventType
	UserID    string
	IPAddress string
	StartTime time.Time
	EndTime   time.Time
	Severity  SecurityEventSeverity
	Offset    int
	Limit     int
}

// Close closes the auditor
func (a *SecurityAuditor) Close() {
	close(a.eventBuffer)
}

// ============================================================================
// Helper Functions
// ============================================================================

// getStackTrace returns the current stack trace
func getStackTrace() string {
	buf := make([]byte, 4096)
	n := runtime.Stack(buf, false)
	return string(buf[:n])
}

// NewSecurityEventFromRequest creates a security event from an HTTP request
func NewSecurityEventFromRequest(r *http.Request, eventType SecurityEventType, severity SecurityEventSeverity) *SecurityEvent {
	return &SecurityEvent{
		ID:        uuid.New().String(),
		Timestamp: time.Now(),
		Type:      eventType,
		Severity:  severity,
		IPAddress: getClientIP(r),
		UserAgent: r.UserAgent(),
		Resource:  r.URL.Path,
		Action:    r.Method,
	}
}

// getClientIP extracts client IP from request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// Take the first IP
		ips := splitAndTrim(xff, ",")
		if len(ips) > 0 {
			return ips[0]
		}
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

// splitAndTrim splits a string and trims whitespace from each part
func splitAndTrim(s, sep string) []string {
	var result []string
	for _, part := range splitString(s, sep) {
		trimmed := trimString(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func splitString(s, sep string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(s)-len(sep); i++ {
		if s[i:i+len(sep)] == sep {
			result = append(result, s[start:i])
			start = i + len(sep)
		}
	}
	result = append(result, s[start:])
	return result
}

func trimString(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}

// ============================================================================
// Common Alert Handlers
// ============================================================================

// SlackAlertHandler sends alerts to Slack
type SlackAlertHandler struct {
	WebhookURL   string
	Channel      string
	AdminBaseURL string
	rateLimiter  *alertRateLimiter
}

// alertRateLimiter tracks rate limiting for alert types
type alertRateLimiter struct {
	lastAlertTimes map[string]time.Time
	mu             sync.RWMutex
	minInterval    time.Duration
}

// newAlertRateLimiter creates a new rate limiter with the specified minimum interval
func newAlertRateLimiter(minInterval time.Duration) *alertRateLimiter {
	return &alertRateLimiter{
		lastAlertTimes: make(map[string]time.Time),
		minInterval:    minInterval,
	}
}

// shouldAlert checks if an alert should be sent based on rate limiting
func (r *alertRateLimiter) shouldAlert(alertType string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	lastTime, exists := r.lastAlertTimes[alertType]
	now := time.Now()

	if !exists || now.Sub(lastTime) >= r.minInterval {
		r.lastAlertTimes[alertType] = now
		return true
	}
	return false
}

// NewSlackAlertHandler creates a new Slack alert handler with rate limiting
func NewSlackAlertHandler(webhookURL, channel, adminBaseURL string) *SlackAlertHandler {
	return &SlackAlertHandler{
		WebhookURL:   webhookURL,
		Channel:      channel,
		AdminBaseURL: adminBaseURL,
		rateLimiter:  newAlertRateLimiter(1 * time.Minute), // Max 1 alert per minute per type
	}
}

// HandleAlert sends alert to Slack
func (h *SlackAlertHandler) HandleAlert(ctx context.Context, event *SecurityEvent, threshold string) error {
	if h.WebhookURL == "" {
		return fmt.Errorf("slack webhook URL not configured")
	}

	// Check rate limiting (max 1 alert per minute for same type)
	alertKey := fmt.Sprintf("%s:%s", event.Type, event.IPAddress)
	if !h.rateLimiter.shouldAlert(alertKey) {
		log.Debug().
			Str("event_type", string(event.Type)).
			Str("ip", event.IPAddress).
			Msg("Slack alert rate limited")
		return nil
	}

	// Build Slack message with blocks
	message := h.buildSlackMessage(event, threshold)

	body, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal slack message: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.WebhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create slack request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send slack alert: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("slack webhook returned status %d: %s", resp.StatusCode, string(respBody))
	}

	log.Info().
		Str("event_type", string(event.Type)).
		Str("threshold", threshold).
		Str("ip", event.IPAddress).
		Msg("Slack security alert sent")

	return nil
}

// buildSlackMessage creates a Slack message with blocks
func (h *SlackAlertHandler) buildSlackMessage(event *SecurityEvent, threshold string) map[string]interface{} {
	// Determine severity emoji and color
	severityEmoji := ":warning:"
	color := "#FFA500" // orange
	switch event.Severity {
	case SeverityCritical:
		severityEmoji = ":rotating_light:"
		color = "#FF0000" // red
	case SeverityError:
		severityEmoji = ":x:"
		color = "#DC3545" // dark red
	case SeverityWarning:
		severityEmoji = ":warning:"
		color = "#FFC107" // yellow
	case SeverityInfo:
		severityEmoji = ":information_source:"
		color = "#17A2B8" // blue
	}

	// Build admin link
	adminLink := ""
	if h.AdminBaseURL != "" && event.FestivalID != "" {
		adminLink = fmt.Sprintf("%s/festivals/%s/security", h.AdminBaseURL, event.FestivalID)
	}

	// Build description text
	description := fmt.Sprintf("*Type:* %s\n*Threshold:* %s\n*IP Address:* %s",
		event.Type, threshold, event.IPAddress)

	if event.UserID != "" {
		description += fmt.Sprintf("\n*User ID:* %s", event.UserID)
	}
	if event.Resource != "" {
		description += fmt.Sprintf("\n*Resource:* %s %s", event.Action, event.Resource)
	}
	if event.Result != "" {
		description += fmt.Sprintf("\n*Result:* %s", event.Result)
	}

	blocks := []map[string]interface{}{
		{
			"type": "header",
			"text": map[string]interface{}{
				"type":  "plain_text",
				"text":  fmt.Sprintf("%s Security Alert: %s", severityEmoji, event.Type),
				"emoji": true,
			},
		},
		{
			"type": "section",
			"text": map[string]interface{}{
				"type": "mrkdwn",
				"text": description,
			},
		},
		{
			"type": "context",
			"elements": []map[string]interface{}{
				{
					"type": "mrkdwn",
					"text": fmt.Sprintf("*Severity:* %s | *Timestamp:* %s", event.Severity, event.Timestamp.Format(time.RFC3339)),
				},
			},
		},
	}

	// Add admin link button if available
	if adminLink != "" {
		blocks = append(blocks, map[string]interface{}{
			"type": "actions",
			"elements": []map[string]interface{}{
				{
					"type": "button",
					"text": map[string]interface{}{
						"type":  "plain_text",
						"text":  "View in Admin",
						"emoji": true,
					},
					"url": adminLink,
				},
			},
		})
	}

	message := map[string]interface{}{
		"blocks": blocks,
		"attachments": []map[string]interface{}{
			{
				"color": color,
			},
		},
	}

	if h.Channel != "" {
		message["channel"] = h.Channel
	}

	return message
}

// EmailAlertHandler sends alerts via email
type EmailAlertHandler struct {
	EmailClient  EmailSender
	ToAddresses  []string
	FromAddress  string
	AdminBaseURL string
}

// EmailSender interface for sending emails
type EmailSender interface {
	SendEmailMultiple(ctx context.Context, to []string, subject, htmlBody, textBody string) (interface{}, error)
}

// NewEmailAlertHandler creates a new email alert handler
func NewEmailAlertHandler(emailClient EmailSender, toAddresses []string, fromAddress, adminBaseURL string) *EmailAlertHandler {
	return &EmailAlertHandler{
		EmailClient:  emailClient,
		ToAddresses:  toAddresses,
		FromAddress:  fromAddress,
		AdminBaseURL: adminBaseURL,
	}
}

// HandleAlert sends alert via email
func (h *EmailAlertHandler) HandleAlert(ctx context.Context, event *SecurityEvent, threshold string) error {
	if h.EmailClient == nil {
		return fmt.Errorf("email client not configured")
	}
	if len(h.ToAddresses) == 0 {
		return fmt.Errorf("no recipient email addresses configured")
	}

	subject := fmt.Sprintf("[%s] Security Alert: %s", event.Severity, event.Type)
	htmlBody := h.buildHTMLEmail(event, threshold)
	textBody := h.buildTextEmail(event, threshold)

	_, err := h.EmailClient.SendEmailMultiple(ctx, h.ToAddresses, subject, htmlBody, textBody)
	if err != nil {
		return fmt.Errorf("failed to send email alert: %w", err)
	}

	log.Info().
		Str("event_type", string(event.Type)).
		Str("threshold", threshold).
		Strs("recipients", h.ToAddresses).
		Msg("Email security alert sent")

	return nil
}

// buildHTMLEmail creates an HTML email with alert details
func (h *EmailAlertHandler) buildHTMLEmail(event *SecurityEvent, threshold string) string {
	// Determine severity badge color
	badgeColor := "#FFC107" // yellow
	switch event.Severity {
	case SeverityCritical:
		badgeColor = "#DC3545" // red
	case SeverityError:
		badgeColor = "#E74C3C" // dark red
	case SeverityWarning:
		badgeColor = "#FFC107" // yellow
	case SeverityInfo:
		badgeColor = "#17A2B8" // blue
	}

	// Build admin link
	adminLink := ""
	if h.AdminBaseURL != "" && event.FestivalID != "" {
		adminLink = fmt.Sprintf("%s/festivals/%s/security", h.AdminBaseURL, event.FestivalID)
	}

	// Build recommended actions based on event type
	recommendedActions := h.getRecommendedActions(event)

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Alert</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h1 style="margin: 0 0 10px 0; color: #333;">Security Alert</h1>
        <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; background-color: %s; color: white; font-weight: bold; font-size: 14px;">%s</span>
    </div>

    <div style="background-color: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">Alert Details</h2>
        <table style="width: 100%%; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 140px;">Alert Type:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">%s</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Threshold:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">%s</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Timestamp:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">%s</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">IP Address:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">%s</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">User ID:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">%s</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Resource:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">%s %s</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; font-weight: bold;">Result:</td>
                <td style="padding: 8px 0;">%s</td>
            </tr>
        </table>
    </div>

    <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #856404;">Recommended Actions</h3>
        <ul style="margin: 0; padding-left: 20px;">
            %s
        </ul>
    </div>

    %s

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
        <p>This is an automated security alert. Please do not reply to this email.</p>
        <p>Event ID: %s</p>
    </div>
</body>
</html>`,
		badgeColor,
		event.Severity,
		event.Type,
		threshold,
		event.Timestamp.Format("2006-01-02 15:04:05 MST"),
		event.IPAddress,
		event.UserID,
		event.Action,
		event.Resource,
		event.Result,
		recommendedActions,
		h.buildAdminLinkHTML(adminLink),
		event.ID,
	)

	return html
}

// buildAdminLinkHTML creates the admin link section if available
func (h *EmailAlertHandler) buildAdminLinkHTML(adminLink string) string {
	if adminLink == "" {
		return ""
	}
	return fmt.Sprintf(`<div style="text-align: center; margin-bottom: 20px;">
        <a href="%s" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">View in Admin Dashboard</a>
    </div>`, adminLink)
}

// getRecommendedActions returns recommended actions based on event type
func (h *EmailAlertHandler) getRecommendedActions(event *SecurityEvent) string {
	actions := []string{}

	switch event.Type {
	case EventAuthBruteForce, EventAuthFailure:
		actions = []string{
			"<li>Review the IP address for suspicious activity</li>",
			"<li>Consider temporarily blocking the IP address</li>",
			"<li>Check if the targeted user account should be locked</li>",
			"<li>Review recent login attempts for this user</li>",
		}
	case EventAttackSQLInjection, EventAttackXSS, EventAttackCSRF:
		actions = []string{
			"<li>Block the source IP address immediately</li>",
			"<li>Review application logs for additional attack attempts</li>",
			"<li>Verify WAF rules are properly configured</li>",
			"<li>Check for any successful data exfiltration</li>",
		}
	case EventSessionHijack, EventSessionFixation:
		actions = []string{
			"<li>Invalidate all sessions for the affected user</li>",
			"<li>Force password reset for the affected user</li>",
			"<li>Review session management implementation</li>",
			"<li>Check for unauthorized access to user data</li>",
		}
	case EventAuthzElevation:
		actions = []string{
			"<li>Review the privilege escalation attempt details</li>",
			"<li>Audit user permissions and role assignments</li>",
			"<li>Check for unauthorized changes to user roles</li>",
			"<li>Review authorization middleware configuration</li>",
		}
	default:
		actions = []string{
			"<li>Review the security event details</li>",
			"<li>Check for related events in the audit log</li>",
			"<li>Assess potential impact on the system</li>",
			"<li>Take appropriate remediation steps</li>",
		}
	}

	result := ""
	for _, action := range actions {
		result += action + "\n"
	}
	return result
}

// buildTextEmail creates a plain text email with alert details
func (h *EmailAlertHandler) buildTextEmail(event *SecurityEvent, threshold string) string {
	adminLink := ""
	if h.AdminBaseURL != "" && event.FestivalID != "" {
		adminLink = fmt.Sprintf("\nAdmin Dashboard: %s/festivals/%s/security\n", h.AdminBaseURL, event.FestivalID)
	}

	return fmt.Sprintf(`SECURITY ALERT - %s

Severity: %s
Alert Type: %s
Threshold: %s
Timestamp: %s

Details:
- IP Address: %s
- User ID: %s
- Resource: %s %s
- Result: %s
%s
Event ID: %s

This is an automated security alert. Please do not reply to this email.
`,
		event.Type,
		event.Severity,
		event.Type,
		threshold,
		event.Timestamp.Format("2006-01-02 15:04:05 MST"),
		event.IPAddress,
		event.UserID,
		event.Action,
		event.Resource,
		event.Result,
		adminLink,
		event.ID,
	)
}

// WebhookAlertHandler sends alerts to a webhook with HMAC signature
type WebhookAlertHandler struct {
	URLs       []string
	Secret     string
	Headers    map[string]string
	MaxRetries int
}

// NewWebhookAlertHandler creates a new webhook alert handler
func NewWebhookAlertHandler(urls []string, secret string, headers map[string]string) *WebhookAlertHandler {
	return &WebhookAlertHandler{
		URLs:       urls,
		Secret:     secret,
		Headers:    headers,
		MaxRetries: 3,
	}
}

// HandleAlert sends alert to webhook with retry logic
func (h *WebhookAlertHandler) HandleAlert(ctx context.Context, event *SecurityEvent, threshold string) error {
	if len(h.URLs) == 0 {
		return fmt.Errorf("no webhook URLs configured")
	}

	payload := h.buildWebhookPayload(event, threshold)
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	// Send to all configured webhook URLs
	var lastErr error
	for _, url := range h.URLs {
		if err := h.sendWithRetry(ctx, url, body); err != nil {
			log.Error().Err(err).Str("url", url).Msg("Failed to send webhook alert")
			lastErr = err
		} else {
			log.Info().
				Str("url", url).
				Str("event_type", string(event.Type)).
				Str("threshold", threshold).
				Msg("Webhook security alert sent")
		}
	}

	return lastErr
}

// buildWebhookPayload creates the webhook payload
func (h *WebhookAlertHandler) buildWebhookPayload(event *SecurityEvent, threshold string) map[string]interface{} {
	return map[string]interface{}{
		"version":   "1.0",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"event": map[string]interface{}{
			"id":         event.ID,
			"type":       event.Type,
			"severity":   event.Severity,
			"threshold":  threshold,
			"timestamp":  event.Timestamp.Format(time.RFC3339),
			"ip_address": event.IPAddress,
			"user_id":    event.UserID,
			"session_id": event.SessionID,
			"request_id": event.RequestID,
			"resource":   event.Resource,
			"action":     event.Action,
			"result":     event.Result,
			"user_agent": event.UserAgent,
			"details":    event.Details,
		},
		"context": map[string]interface{}{
			"festival_id": event.FestivalID,
			"tenant_id":   event.TenantID,
		},
	}
}

// sendWithRetry sends the webhook with exponential backoff retry
func (h *WebhookAlertHandler) sendWithRetry(ctx context.Context, url string, body []byte) error {
	var lastErr error

	for attempt := 0; attempt < h.MaxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 1s, 2s, 4s
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}
		}

		err := h.sendRequest(ctx, url, body)
		if err == nil {
			return nil
		}

		lastErr = err
		log.Warn().
			Err(err).
			Str("url", url).
			Int("attempt", attempt+1).
			Int("max_retries", h.MaxRetries).
			Msg("Webhook request failed, retrying")
	}

	return fmt.Errorf("webhook failed after %d attempts: %w", h.MaxRetries, lastErr)
}

// sendRequest sends a single webhook request with HMAC signature
func (h *WebhookAlertHandler) sendRequest(ctx context.Context, url string, body []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Timestamp", fmt.Sprintf("%d", time.Now().Unix()))

	// Add HMAC signature if secret is configured
	if h.Secret != "" {
		signature := h.computeHMACSignature(body)
		req.Header.Set("X-Webhook-Signature", signature)
	}

	// Add custom headers
	for key, value := range h.Headers {
		req.Header.Set(key, value)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("webhook returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// computeHMACSignature computes HMAC-SHA256 signature for the payload
func (h *WebhookAlertHandler) computeHMACSignature(body []byte) string {
	mac := hmac.New(sha256.New, []byte(h.Secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}
