package middleware

import (
	"bytes"
	"io"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/audit"
	"github.com/rs/zerolog/log"
)

// AuditConfig holds configuration for the audit middleware
type AuditConfig struct {
	Service           *audit.Service
	SkipPaths         []string          // Paths to skip auditing (e.g., /health, /metrics)
	SkipMethods       []string          // HTTP methods to skip (e.g., GET, OPTIONS)
	SensitiveFields   []string          // Field names to redact in request/response bodies
	LogRequestBody    bool              // Whether to log request bodies
	LogResponseBody   bool              // Whether to log response bodies
	MaxBodyLogSize    int               // Maximum size of body to log (in bytes)
	ResourceMappings  map[string]string // Custom resource name mappings
}

// DefaultAuditConfig returns a default audit configuration
func DefaultAuditConfig(service *audit.Service) AuditConfig {
	return AuditConfig{
		Service: service,
		SkipPaths: []string{
			"/health",
			"/healthz",
			"/ready",
			"/readyz",
			"/metrics",
			"/swagger",
			"/docs",
		},
		SkipMethods:      []string{"OPTIONS"},
		SensitiveFields:  []string{"password", "token", "secret", "api_key", "apiKey", "authorization", "credit_card", "creditCard", "cvv", "ssn"},
		LogRequestBody:   true,
		LogResponseBody:  false,
		MaxBodyLogSize:   4096,
		ResourceMappings: make(map[string]string),
	}
}

// responseWriter wraps gin.ResponseWriter to capture the response
type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *responseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// Audit creates the audit logging middleware
func Audit(cfg AuditConfig) gin.HandlerFunc {
	// Compile skip path patterns
	skipPathPatterns := make([]*regexp.Regexp, 0, len(cfg.SkipPaths))
	for _, path := range cfg.SkipPaths {
		pattern := strings.ReplaceAll(path, "*", ".*")
		if re, err := regexp.Compile("^" + pattern); err == nil {
			skipPathPatterns = append(skipPathPatterns, re)
		}
	}

	// Create a map for faster method lookup
	skipMethods := make(map[string]bool)
	for _, method := range cfg.SkipMethods {
		skipMethods[strings.ToUpper(method)] = true
	}

	return func(c *gin.Context) {
		// Check if this request should be skipped
		if shouldSkipAudit(c.Request.URL.Path, c.Request.Method, skipPathPatterns, skipMethods) {
			c.Next()
			return
		}

		// Capture start time
		startTime := time.Now()

		// Capture request body if configured
		var requestBody []byte
		if cfg.LogRequestBody && c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
			// Truncate if too large
			if len(requestBody) > cfg.MaxBodyLogSize {
				requestBody = requestBody[:cfg.MaxBodyLogSize]
			}
		}

		// Wrap response writer if we need to capture response body
		var rw *responseWriter
		if cfg.LogResponseBody {
			rw = &responseWriter{
				ResponseWriter: c.Writer,
				body:           bytes.NewBufferString(""),
			}
			c.Writer = rw
		}

		// Process request
		c.Next()

		// Skip logging if audit service is not configured
		if cfg.Service == nil {
			return
		}

		// Extract user information from context
		var userID *uuid.UUID
		if uid := GetUserID(c); uid != "" {
			if parsedUID, err := uuid.Parse(uid); err == nil {
				userID = &parsedUID
			}
		}

		// Extract festival ID from context or URL
		var festivalID *uuid.UUID
		if fid := GetFestivalID(c); fid != "" {
			if parsedFID, err := uuid.Parse(fid); err == nil {
				festivalID = &parsedFID
			}
		}
		// Also try to get festival ID from URL parameters
		if festivalID == nil {
			if fid := c.Param("festivalId"); fid != "" {
				if parsedFID, err := uuid.Parse(fid); err == nil {
					festivalID = &parsedFID
				}
			}
		}

		// Determine action based on HTTP method and path
		action := determineAction(c.Request.Method, c.Request.URL.Path)

		// Determine resource from path
		resource, resourceID := extractResourceInfo(c.Request.URL.Path, cfg.ResourceMappings)

		// Build metadata
		metadata := make(map[string]interface{})
		metadata["method"] = c.Request.Method
		metadata["path"] = c.Request.URL.Path
		metadata["status"] = c.Writer.Status()
		metadata["latency_ms"] = time.Since(startTime).Milliseconds()

		if c.Request.URL.RawQuery != "" {
			metadata["query"] = c.Request.URL.RawQuery
		}

		// Add request body to metadata (redacted)
		if len(requestBody) > 0 {
			redactedBody := redactSensitiveFields(string(requestBody), cfg.SensitiveFields)
			metadata["request_body"] = redactedBody
		}

		// Add response body to metadata if configured
		if cfg.LogResponseBody && rw != nil && rw.body.Len() > 0 {
			responseBody := rw.body.String()
			if len(responseBody) > cfg.MaxBodyLogSize {
				responseBody = responseBody[:cfg.MaxBodyLogSize]
			}
			redactedResponse := redactSensitiveFields(responseBody, cfg.SensitiveFields)
			metadata["response_body"] = redactedResponse
		}

		// Add error information if present
		if len(c.Errors) > 0 {
			errors := make([]string, len(c.Errors))
			for i, err := range c.Errors {
				errors[i] = err.Error()
			}
			metadata["errors"] = errors
		}

		// Create audit log entry asynchronously
		cfg.Service.LogActionAsync(c.Request.Context(), audit.CreateAuditLogRequest{
			UserID:     userID,
			FestivalID: festivalID,
			Action:     action,
			Resource:   resource,
			ResourceID: resourceID,
			IP:         c.ClientIP(),
			UserAgent:  c.Request.UserAgent(),
			Metadata:   metadata,
		})
	}
}

// shouldSkipAudit checks if the request should be skipped from auditing
func shouldSkipAudit(path, method string, pathPatterns []*regexp.Regexp, skipMethods map[string]bool) bool {
	// Check method
	if skipMethods[strings.ToUpper(method)] {
		return true
	}

	// Check path patterns
	for _, pattern := range pathPatterns {
		if pattern.MatchString(path) {
			return true
		}
	}

	return false
}

// determineAction determines the audit action based on HTTP method and path
func determineAction(method, path string) audit.AuditAction {
	method = strings.ToUpper(method)
	pathLower := strings.ToLower(path)

	// Check for specific action patterns in path
	switch {
	// Authentication
	case strings.Contains(pathLower, "/login"):
		return audit.ActionLogin
	case strings.Contains(pathLower, "/logout"):
		return audit.ActionLogout
	case strings.Contains(pathLower, "/refresh"):
		return audit.ActionTokenRefresh

	// User-specific actions
	case strings.Contains(pathLower, "/ban"):
		return audit.ActionUserBan
	case strings.Contains(pathLower, "/unban"):
		return audit.ActionUserUnban

	// Ticket-specific actions
	case strings.Contains(pathLower, "/validate"):
		return audit.ActionTicketValidate
	case strings.Contains(pathLower, "/transfer"):
		if strings.Contains(pathLower, "/ticket") {
			return audit.ActionTicketTransfer
		}
		return audit.ActionWalletTransfer

	// Wallet-specific actions
	case strings.Contains(pathLower, "/topup") || strings.Contains(pathLower, "/top-up"):
		return audit.ActionWalletTopup
	case strings.Contains(pathLower, "/payment"):
		return audit.ActionWalletPayment

	// Order-specific actions
	case strings.Contains(pathLower, "/cancel"):
		return audit.ActionOrderCancel
	case strings.Contains(pathLower, "/refund"):
		if strings.Contains(pathLower, "/order") {
			return audit.ActionOrderRefund
		} else if strings.Contains(pathLower, "/ticket") {
			return audit.ActionTicketRefund
		}
		return audit.ActionWalletRefund

	// Export actions
	case strings.Contains(pathLower, "/export"):
		return audit.ActionDataExport
	case strings.Contains(pathLower, "/report"):
		return audit.ActionReportGenerate

	// API key actions
	case strings.Contains(pathLower, "/api-key") || strings.Contains(pathLower, "/apikey"):
		if method == "DELETE" {
			return audit.ActionAPIKeyRevoke
		}
		return audit.ActionAPIKeyCreate

	// Settings actions
	case strings.Contains(pathLower, "/settings"):
		return audit.ActionSettingsUpdate
	}

	// Determine resource type from path
	resourceType := extractResourceType(pathLower)

	// Generic CRUD based on method and resource
	switch method {
	case "POST":
		return getCreateAction(resourceType)
	case "PUT", "PATCH":
		return getUpdateAction(resourceType)
	case "DELETE":
		return getDeleteAction(resourceType)
	default:
		return audit.ActionRead
	}
}

// extractResourceType extracts the resource type from a path
func extractResourceType(path string) string {
	segments := strings.Split(strings.Trim(path, "/"), "/")
	for _, segment := range segments {
		switch segment {
		case "users":
			return "user"
		case "festivals":
			return "festival"
		case "tickets":
			return "ticket"
		case "wallets":
			return "wallet"
		case "orders":
			return "order"
		case "stands":
			return "stand"
		case "products":
			return "product"
		case "artists":
			return "artist"
		case "stages":
			return "stage"
		}
	}
	return "resource"
}

// getCreateAction returns the appropriate create action for a resource type
func getCreateAction(resourceType string) audit.AuditAction {
	switch resourceType {
	case "user":
		return audit.ActionUserCreate
	case "festival":
		return audit.ActionFestivalCreate
	case "ticket":
		return audit.ActionTicketCreate
	case "wallet":
		return audit.ActionWalletCreate
	case "order":
		return audit.ActionOrderCreate
	case "stand":
		return audit.ActionStandCreate
	case "product":
		return audit.ActionProductCreate
	case "artist":
		return audit.ActionArtistCreate
	case "stage":
		return audit.ActionStageCreate
	default:
		return audit.ActionCreate
	}
}

// getUpdateAction returns the appropriate update action for a resource type
func getUpdateAction(resourceType string) audit.AuditAction {
	switch resourceType {
	case "user":
		return audit.ActionUserUpdate
	case "festival":
		return audit.ActionFestivalUpdate
	case "ticket":
		return audit.ActionTicketUpdate
	case "order":
		return audit.ActionOrderUpdate
	case "stand":
		return audit.ActionStandUpdate
	case "product":
		return audit.ActionProductUpdate
	case "artist":
		return audit.ActionArtistUpdate
	case "stage":
		return audit.ActionStageUpdate
	default:
		return audit.ActionUpdate
	}
}

// getDeleteAction returns the appropriate delete action for a resource type
func getDeleteAction(resourceType string) audit.AuditAction {
	switch resourceType {
	case "user":
		return audit.ActionUserDelete
	case "festival":
		return audit.ActionFestivalDelete
	case "stand":
		return audit.ActionStandDelete
	case "product":
		return audit.ActionProductDelete
	case "artist":
		return audit.ActionArtistDelete
	case "stage":
		return audit.ActionStageDelete
	default:
		return audit.ActionDelete
	}
}

// extractResourceInfo extracts resource name and ID from a URL path
func extractResourceInfo(path string, mappings map[string]string) (resource, resourceID string) {
	segments := strings.Split(strings.Trim(path, "/"), "/")

	// Skip version prefix if present (e.g., /v1/...)
	if len(segments) > 0 && (segments[0] == "v1" || segments[0] == "v2" || segments[0] == "api") {
		segments = segments[1:]
	}

	// Find the main resource
	for i := 0; i < len(segments); i++ {
		segment := segments[i]

		// Skip known non-resource segments
		if segment == "api" || segment == "v1" || segment == "v2" || segment == "public" || segment == "admin" {
			continue
		}

		// Check if this is a known resource
		if isResource(segment) {
			resource = singularize(segment)

			// Check for custom mapping
			if mapped, ok := mappings[resource]; ok {
				resource = mapped
			}

			// Look for resource ID (next segment that looks like a UUID or ID)
			if i+1 < len(segments) {
				nextSegment := segments[i+1]
				if isResourceID(nextSegment) {
					resourceID = nextSegment
				}
			}
			break
		}
	}

	if resource == "" {
		resource = "unknown"
	}

	return resource, resourceID
}

// isResource checks if a path segment is a known resource name
func isResource(segment string) bool {
	resources := map[string]bool{
		"users":         true,
		"festivals":     true,
		"tickets":       true,
		"wallets":       true,
		"orders":        true,
		"stands":        true,
		"products":      true,
		"artists":       true,
		"stages":        true,
		"transactions":  true,
		"notifications": true,
		"settings":      true,
		"reports":       true,
		"analytics":     true,
		"audit":         true,
		"audit-logs":    true,
		"api-keys":      true,
		"roles":         true,
		"permissions":   true,
	}
	return resources[segment]
}

// isResourceID checks if a segment looks like a resource ID
func isResourceID(segment string) bool {
	// Check if it's a UUID
	if _, err := uuid.Parse(segment); err == nil {
		return true
	}

	// Check if it's a numeric ID
	for _, c := range segment {
		if c < '0' || c > '9' {
			return false
		}
	}
	return len(segment) > 0
}

// singularize converts plural resource names to singular
func singularize(plural string) string {
	mappings := map[string]string{
		"users":         "user",
		"festivals":     "festival",
		"tickets":       "ticket",
		"wallets":       "wallet",
		"orders":        "order",
		"stands":        "stand",
		"products":      "product",
		"artists":       "artist",
		"stages":        "stage",
		"transactions":  "transaction",
		"notifications": "notification",
		"settings":      "settings",
		"reports":       "report",
		"analytics":     "analytics",
		"audit-logs":    "audit_log",
		"api-keys":      "api_key",
		"roles":         "role",
		"permissions":   "permission",
	}
	if singular, ok := mappings[plural]; ok {
		return singular
	}
	// Remove trailing 's' as a fallback
	if strings.HasSuffix(plural, "s") {
		return plural[:len(plural)-1]
	}
	return plural
}

// redactSensitiveFields redacts sensitive information from a string
func redactSensitiveFields(content string, sensitiveFields []string) string {
	redacted := content
	for _, field := range sensitiveFields {
		// Redact JSON fields
		patterns := []string{
			`"` + field + `"\s*:\s*"[^"]*"`,
			`"` + field + `"\s*:\s*[0-9]+`,
			field + `=[^&\s]*`,
		}
		for _, pattern := range patterns {
			if re, err := regexp.Compile("(?i)" + pattern); err == nil {
				redacted = re.ReplaceAllString(redacted, `"`+field+`":"[REDACTED]"`)
			}
		}
	}
	return redacted
}

// AuditAction is a convenience middleware for manually logging specific actions
func AuditAction(service *audit.Service, action audit.AuditAction, resource string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Store the action details in context for later use
		c.Set("audit_action", action)
		c.Set("audit_resource", resource)

		c.Next()

		// Log the action after the request is processed
		if service == nil {
			return
		}

		var userID *uuid.UUID
		if uid := GetUserID(c); uid != "" {
			if parsedUID, err := uuid.Parse(uid); err == nil {
				userID = &parsedUID
			}
		}

		var festivalID *uuid.UUID
		if fid := GetFestivalID(c); fid != "" {
			if parsedFID, err := uuid.Parse(fid); err == nil {
				festivalID = &parsedFID
			}
		}

		resourceID := c.Param("id")
		if resourceID == "" {
			resourceID = c.Param("resourceId")
		}

		service.LogActionAsync(c.Request.Context(), audit.CreateAuditLogRequest{
			UserID:     userID,
			FestivalID: festivalID,
			Action:     action,
			Resource:   resource,
			ResourceID: resourceID,
			IP:         c.ClientIP(),
			UserAgent:  c.Request.UserAgent(),
			Metadata: map[string]interface{}{
				"method": c.Request.Method,
				"path":   c.Request.URL.Path,
				"status": c.Writer.Status(),
			},
		})
	}
}

// LogSecurityEvent logs a security-related event
func LogSecurityEvent(service *audit.Service, c *gin.Context, action audit.AuditAction, details map[string]interface{}) {
	if service == nil {
		log.Warn().Msg("Audit service is nil, skipping security event logging")
		return
	}

	var userID *uuid.UUID
	if uid := GetUserID(c); uid != "" {
		if parsedUID, err := uuid.Parse(uid); err == nil {
			userID = &parsedUID
		}
	}

	service.LogActionAsync(c.Request.Context(), audit.CreateAuditLogRequest{
		UserID:    userID,
		Action:    action,
		Resource:  "security",
		IP:        c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
		Metadata:  details,
	})
}
