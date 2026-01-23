package security

import (
	"context"
	"encoding/json"
	"fmt"
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
	WebhookURL string
	Channel    string
}

// HandleAlert sends alert to Slack
func (h *SlackAlertHandler) HandleAlert(ctx context.Context, event *SecurityEvent, threshold string) error {
	// Implementation would use Slack webhook API
	log.Warn().
		Str("threshold", threshold).
		Str("event_type", string(event.Type)).
		Str("ip", event.IPAddress).
		Msg("Security alert triggered (Slack integration not implemented)")
	return nil
}

// EmailAlertHandler sends alerts via email
type EmailAlertHandler struct {
	SMTPHost     string
	SMTPPort     int
	FromAddress  string
	ToAddresses  []string
	TemplatePath string
}

// HandleAlert sends alert via email
func (h *EmailAlertHandler) HandleAlert(ctx context.Context, event *SecurityEvent, threshold string) error {
	// Implementation would use email sending
	log.Warn().
		Str("threshold", threshold).
		Str("event_type", string(event.Type)).
		Str("ip", event.IPAddress).
		Msg("Security alert triggered (Email integration not implemented)")
	return nil
}

// WebhookAlertHandler sends alerts to a webhook
type WebhookAlertHandler struct {
	URL     string
	Headers map[string]string
}

// HandleAlert sends alert to webhook
func (h *WebhookAlertHandler) HandleAlert(ctx context.Context, event *SecurityEvent, threshold string) error {
	// Implementation would make HTTP POST to webhook
	log.Warn().
		Str("threshold", threshold).
		Str("event_type", string(event.Type)).
		Str("ip", event.IPAddress).
		Msg("Security alert triggered (Webhook integration not implemented)")
	return nil
}
