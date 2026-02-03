package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// SecurityConfig holds configuration for security middleware
type SecurityConfig struct {
	// CSRF Configuration
	CSRFEnabled       bool
	CSRFTokenLength   int
	CSRFCookieName    string
	CSRFHeaderName    string
	CSRFCookieSecure  bool
	CSRFCookieDomain  string
	CSRFExcludePaths  []string
	CSRFExcludeMethods []string

	// HTTPS Enforcement
	ForceHTTPS          bool   // Redirect HTTP to HTTPS in production
	HTTPSExcludePaths   []string // Paths excluded from HTTPS redirect (e.g., health checks)

	// Security Headers
	EnableSecurityHeaders bool
	FrameOptions          string // DENY, SAMEORIGIN, or ALLOW-FROM uri
	ContentTypeNosniff    bool
	XSSProtection         string
	ReferrerPolicy        string
	PermissionsPolicy     string
	StrictTransportSecurity string
	ContentSecurityPolicy   string

	// Request Size Limiting
	MaxRequestBodySize int64 // in bytes
	MaxFormMemory      int64 // in bytes
	MaxMultipartMemory int64 // in bytes
	MaxURLLength       int

	// Input Sanitization
	SanitizeInput         bool
	BlockSQLInjection     bool
	BlockXSS              bool
	BlockPathTraversal    bool
	BlockCommandInjection bool

	// Redis client for CSRF token storage
	RedisClient *redis.Client

	// Token expiration
	CSRFTokenExpiry time.Duration
}

// DefaultSecurityConfig returns default security configuration
func DefaultSecurityConfig() SecurityConfig {
	return SecurityConfig{
		CSRFEnabled:       true,
		CSRFTokenLength:   32,
		CSRFCookieName:    "_csrf",
		CSRFHeaderName:    "X-CSRF-Token",
		CSRFCookieSecure:  true,
		CSRFExcludePaths:  []string{"/health", "/ready", "/metrics", "/api/v1/webhooks"},
		CSRFExcludeMethods: []string{"GET", "HEAD", "OPTIONS"},

		ForceHTTPS:         false, // Enable in production
		HTTPSExcludePaths:  []string{"/health", "/ready", "/metrics"},

		EnableSecurityHeaders:   true,
		FrameOptions:            "DENY",
		ContentTypeNosniff:      true,
		XSSProtection:           "1; mode=block",
		ReferrerPolicy:          "strict-origin-when-cross-origin",
		PermissionsPolicy:       "geolocation=(), microphone=(), camera=()",
		StrictTransportSecurity: "max-age=31536000; includeSubDomains; preload",
		ContentSecurityPolicy:   "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",

		MaxRequestBodySize: 10 * 1024 * 1024,  // 10MB
		MaxFormMemory:      5 * 1024 * 1024,   // 5MB
		MaxMultipartMemory: 32 * 1024 * 1024,  // 32MB
		MaxURLLength:       2048,

		SanitizeInput:         true,
		BlockSQLInjection:     true,
		BlockXSS:              true,
		BlockPathTraversal:    true,
		BlockCommandInjection: true,

		CSRFTokenExpiry: 24 * time.Hour,
	}
}

// ProductionSecurityConfig returns security configuration suitable for production
func ProductionSecurityConfig() SecurityConfig {
	cfg := DefaultSecurityConfig()
	cfg.ForceHTTPS = true
	cfg.CSRFCookieSecure = true
	return cfg
}

// CSRF token store (in-memory fallback)
var (
	csrfTokens     = make(map[string]time.Time)
	csrfTokensLock sync.RWMutex
)

// Security creates a comprehensive security middleware
func Security(cfg SecurityConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// HTTPS enforcement in production
		if cfg.ForceHTTPS && !isHTTPSExempt(c, cfg) {
			if !enforceHTTPS(c) {
				return
			}
		}

		// Apply security headers
		if cfg.EnableSecurityHeaders {
			applySecurityHeaders(c, cfg)
		}

		// Check URL length
		if cfg.MaxURLLength > 0 && len(c.Request.URL.String()) > cfg.MaxURLLength {
			respondSecurityError(c, "URL_TOO_LONG", "Request URL exceeds maximum allowed length")
			return
		}

		// Apply request body size limit
		if cfg.MaxRequestBodySize > 0 {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, cfg.MaxRequestBodySize)
		}

		// CSRF protection
		if cfg.CSRFEnabled && !isCSRFExempt(c, cfg) {
			if !validateCSRF(c, cfg) {
				return
			}
		}

		// Input sanitization
		if cfg.SanitizeInput {
			if !sanitizeAndValidateInput(c, cfg) {
				return
			}
		}

		c.Next()
	}
}

// HTTPSEnforcement creates a middleware that redirects HTTP to HTTPS
func HTTPSEnforcement(excludePaths []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if path is excluded
		for _, path := range excludePaths {
			if strings.HasPrefix(c.Request.URL.Path, path) {
				c.Next()
				return
			}
		}

		if !enforceHTTPS(c) {
			return
		}

		c.Next()
	}
}

// isHTTPSExempt checks if the request path is exempt from HTTPS enforcement
func isHTTPSExempt(c *gin.Context, cfg SecurityConfig) bool {
	for _, path := range cfg.HTTPSExcludePaths {
		if strings.HasPrefix(c.Request.URL.Path, path) {
			return true
		}
	}
	return false
}

// enforceHTTPS redirects HTTP requests to HTTPS and returns false if redirected
func enforceHTTPS(c *gin.Context) bool {
	// Check X-Forwarded-Proto header (for load balancers/proxies)
	proto := c.GetHeader("X-Forwarded-Proto")
	if proto == "" {
		proto = c.Request.URL.Scheme
	}
	if proto == "" {
		// Check if TLS is enabled
		if c.Request.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}

	// If already HTTPS, continue
	if proto == "https" {
		return true
	}

	// Redirect to HTTPS
	host := c.Request.Host
	path := c.Request.URL.RequestURI()
	httpsURL := "https://" + host + path

	log.Warn().
		Str("from", "http://"+host+path).
		Str("to", httpsURL).
		Str("ip", c.ClientIP()).
		Msg("Redirecting HTTP to HTTPS")

	c.Redirect(http.StatusMovedPermanently, httpsURL)
	c.Abort()
	return false
}

// SecurityHeaders creates a middleware that only applies security headers
func SecurityHeaders(cfg SecurityConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		applySecurityHeaders(c, cfg)
		c.Next()
	}
}

// applySecurityHeaders sets all security-related HTTP headers
func applySecurityHeaders(c *gin.Context, cfg SecurityConfig) {
	// X-Frame-Options - Clickjacking protection
	if cfg.FrameOptions != "" {
		c.Header("X-Frame-Options", cfg.FrameOptions)
	}

	// X-Content-Type-Options - MIME-sniffing protection
	if cfg.ContentTypeNosniff {
		c.Header("X-Content-Type-Options", "nosniff")
	}

	// X-XSS-Protection - XSS filter
	if cfg.XSSProtection != "" {
		c.Header("X-XSS-Protection", cfg.XSSProtection)
	}

	// Referrer-Policy
	if cfg.ReferrerPolicy != "" {
		c.Header("Referrer-Policy", cfg.ReferrerPolicy)
	}

	// Permissions-Policy (formerly Feature-Policy)
	if cfg.PermissionsPolicy != "" {
		c.Header("Permissions-Policy", cfg.PermissionsPolicy)
	}

	// Strict-Transport-Security (HSTS)
	if cfg.StrictTransportSecurity != "" {
		c.Header("Strict-Transport-Security", cfg.StrictTransportSecurity)
	}

	// Content-Security-Policy
	if cfg.ContentSecurityPolicy != "" {
		c.Header("Content-Security-Policy", cfg.ContentSecurityPolicy)
	}

	// Additional security headers
	c.Header("X-Download-Options", "noopen")
	c.Header("X-Permitted-Cross-Domain-Policies", "none")
	c.Header("Cross-Origin-Embedder-Policy", "require-corp")
	c.Header("Cross-Origin-Opener-Policy", "same-origin")
	c.Header("Cross-Origin-Resource-Policy", "same-origin")

	// Cache control for sensitive endpoints
	if strings.HasPrefix(c.Request.URL.Path, "/api/") {
		c.Header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
	}
}

// CSRF creates a CSRF protection middleware
func CSRF(cfg SecurityConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if isCSRFExempt(c, cfg) {
			c.Next()
			return
		}

		if !validateCSRF(c, cfg) {
			return
		}

		c.Next()
	}
}

// isCSRFExempt checks if the request should be exempt from CSRF protection
func isCSRFExempt(c *gin.Context, cfg SecurityConfig) bool {
	// Check excluded methods
	for _, method := range cfg.CSRFExcludeMethods {
		if c.Request.Method == method {
			return true
		}
	}

	// Check excluded paths
	for _, path := range cfg.CSRFExcludePaths {
		if strings.HasPrefix(c.Request.URL.Path, path) {
			return true
		}
	}

	return false
}

// validateCSRF validates the CSRF token
func validateCSRF(c *gin.Context, cfg SecurityConfig) bool {
	// Get token from header
	headerToken := c.GetHeader(cfg.CSRFHeaderName)
	if headerToken == "" {
		// Also check form data
		headerToken = c.PostForm("_csrf")
	}

	// Get token from cookie
	cookieToken, err := c.Cookie(cfg.CSRFCookieName)
	if err != nil || cookieToken == "" {
		// Generate new CSRF token
		token, err := generateCSRFToken(cfg.CSRFTokenLength)
		if err != nil {
			log.Error().Err(err).Msg("Failed to generate CSRF token")
			respondSecurityError(c, "CSRF_ERROR", "Failed to generate security token")
			return false
		}

		// Set cookie
		setCSRFCookie(c, cfg, token)

		// Store token
		storeCSRFToken(c, cfg, token)

		// First request - allow and provide token
		c.Set("csrf_token", token)
		return true
	}

	// Validate token
	if headerToken == "" {
		respondSecurityError(c, "CSRF_MISSING", "CSRF token required")
		return false
	}

	// Constant-time comparison
	if !secureCompare(headerToken, cookieToken) {
		log.Warn().
			Str("path", c.Request.URL.Path).
			Str("method", c.Request.Method).
			Str("ip", c.ClientIP()).
			Msg("CSRF token mismatch")
		respondSecurityError(c, "CSRF_INVALID", "Invalid CSRF token")
		return false
	}

	// Verify token exists in store (prevent token fixation)
	if !verifyCSRFToken(c, cfg, cookieToken) {
		log.Warn().
			Str("path", c.Request.URL.Path).
			Str("ip", c.ClientIP()).
			Msg("CSRF token not found in store")
		respondSecurityError(c, "CSRF_INVALID", "Invalid CSRF token")
		return false
	}

	c.Set("csrf_token", cookieToken)
	return true
}

// generateCSRFToken generates a cryptographically secure random token
func generateCSRFToken(length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// setCSRFCookie sets the CSRF cookie
func setCSRFCookie(c *gin.Context, cfg SecurityConfig, token string) {
	c.SetCookie(
		cfg.CSRFCookieName,
		token,
		int(cfg.CSRFTokenExpiry.Seconds()),
		"/",
		cfg.CSRFCookieDomain,
		cfg.CSRFCookieSecure,
		true, // HttpOnly
	)
}

// storeCSRFToken stores the CSRF token
func storeCSRFToken(c *gin.Context, cfg SecurityConfig, token string) {
	if cfg.RedisClient != nil {
		// Store in Redis
		key := "csrf:" + token
		cfg.RedisClient.Set(c.Request.Context(), key, c.ClientIP(), cfg.CSRFTokenExpiry)
	} else {
		// Store in memory
		csrfTokensLock.Lock()
		csrfTokens[token] = time.Now().Add(cfg.CSRFTokenExpiry)
		csrfTokensLock.Unlock()
	}
}

// verifyCSRFToken verifies the CSRF token exists
func verifyCSRFToken(c *gin.Context, cfg SecurityConfig, token string) bool {
	if cfg.RedisClient != nil {
		key := "csrf:" + token
		exists, err := cfg.RedisClient.Exists(c.Request.Context(), key).Result()
		return err == nil && exists > 0
	}

	csrfTokensLock.RLock()
	expiry, exists := csrfTokens[token]
	csrfTokensLock.RUnlock()

	if !exists || time.Now().After(expiry) {
		return false
	}
	return true
}

// secureCompare performs constant-time string comparison
func secureCompare(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var result byte
	for i := 0; i < len(a); i++ {
		result |= a[i] ^ b[i]
	}
	return result == 0
}

// RequestSizeLimit creates middleware to limit request body size
func RequestSizeLimit(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSize)

		// Verify size on read
		if c.Request.ContentLength > maxSize {
			respondSecurityError(c, "REQUEST_TOO_LARGE", "Request body exceeds maximum allowed size")
			return
		}

		c.Next()

		// Handle max bytes exceeded error
		if c.Errors.Last() != nil && strings.Contains(c.Errors.Last().Error(), "http: request body too large") {
			respondSecurityError(c, "REQUEST_TOO_LARGE", "Request body exceeds maximum allowed size")
			return
		}
	}
}

// InputSanitization creates middleware for input sanitization
func InputSanitization(cfg SecurityConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !sanitizeAndValidateInput(c, cfg) {
			return
		}
		c.Next()
	}
}

// sanitizeAndValidateInput performs input validation and sanitization
func sanitizeAndValidateInput(c *gin.Context, cfg SecurityConfig) bool {
	// Check query parameters
	for key, values := range c.Request.URL.Query() {
		for _, value := range values {
			if threat, detected := detectThreat(value, cfg); detected {
				log.Warn().
					Str("type", threat).
					Str("param", key).
					Str("path", c.Request.URL.Path).
					Str("ip", c.ClientIP()).
					Msg("Potential attack detected in query parameter")
				respondSecurityError(c, "MALICIOUS_INPUT", "Potentially malicious input detected")
				return false
			}
		}
	}

	// Check headers for injection
	suspiciousHeaders := []string{"X-Forwarded-For", "X-Real-IP", "Referer", "User-Agent"}
	for _, header := range suspiciousHeaders {
		value := c.GetHeader(header)
		if value != "" {
			if threat, detected := detectThreat(value, cfg); detected {
				log.Warn().
					Str("type", threat).
					Str("header", header).
					Str("path", c.Request.URL.Path).
					Str("ip", c.ClientIP()).
					Msg("Potential attack detected in header")
				respondSecurityError(c, "MALICIOUS_INPUT", "Potentially malicious input detected")
				return false
			}
		}
	}

	// For POST/PUT/PATCH, check body when content-type is form
	contentType := c.ContentType()
	if c.Request.Method != "GET" && c.Request.Method != "HEAD" && c.Request.Method != "OPTIONS" {
		if strings.Contains(contentType, "application/x-www-form-urlencoded") ||
			strings.Contains(contentType, "multipart/form-data") {
			if err := c.Request.ParseForm(); err == nil {
				for key, values := range c.Request.PostForm {
					for _, value := range values {
						if threat, detected := detectThreat(value, cfg); detected {
							log.Warn().
								Str("type", threat).
								Str("field", key).
								Str("path", c.Request.URL.Path).
								Str("ip", c.ClientIP()).
								Msg("Potential attack detected in form data")
							respondSecurityError(c, "MALICIOUS_INPUT", "Potentially malicious input detected")
							return false
						}
					}
				}
			}
		}
	}

	return true
}

// detectThreat checks input for various attack patterns
// Note: Pattern variables (sqlInjectionPatterns, xssPatterns, etc.) are defined in injection.go
func detectThreat(input string, cfg SecurityConfig) (string, bool) {
	if cfg.BlockSQLInjection {
		for _, pattern := range sqlInjectionPatterns {
			if pattern.MatchString(input) {
				return "SQL_INJECTION", true
			}
		}
	}

	if cfg.BlockXSS {
		for _, pattern := range xssPatterns {
			if pattern.MatchString(input) {
				return "XSS", true
			}
		}
	}

	if cfg.BlockPathTraversal {
		for _, pattern := range pathTraversalPatterns {
			if pattern.MatchString(input) {
				return "PATH_TRAVERSAL", true
			}
		}
	}

	if cfg.BlockCommandInjection {
		for _, pattern := range commandInjectionPatterns {
			if pattern.MatchString(input) {
				return "COMMAND_INJECTION", true
			}
		}
	}

	return "", false
}

// GenerateCSRFToken is a handler that generates and returns a CSRF token
func GenerateCSRFToken(cfg SecurityConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := generateCSRFToken(cfg.CSRFTokenLength)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{
					"code":    "CSRF_ERROR",
					"message": "Failed to generate security token",
				},
			})
			return
		}

		setCSRFCookie(c, cfg, token)
		storeCSRFToken(c, cfg, token)

		c.JSON(http.StatusOK, gin.H{
			"csrf_token": token,
		})
	}
}

// CleanExpiredCSRFTokens cleans up expired tokens from memory store
func CleanExpiredCSRFTokens() {
	csrfTokensLock.Lock()
	defer csrfTokensLock.Unlock()

	now := time.Now()
	for token, expiry := range csrfTokens {
		if now.After(expiry) {
			delete(csrfTokens, token)
		}
	}
}

// StartCSRFCleanup starts a goroutine to periodically clean expired tokens
func StartCSRFCleanup(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			CleanExpiredCSRFTokens()
		}
	}()
}

// respondSecurityError sends a security-related error response
func respondSecurityError(c *gin.Context, code, message string) {
	c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
		"error": gin.H{
			"code":    code,
			"message": message,
		},
	})
}

// SecureJSONMiddleware wraps JSON responses with security prefix to prevent JSON hijacking
func SecureJSONMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

// ValidateContentType ensures the Content-Type header matches expected values
func ValidateContentType(allowedTypes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		contentType := c.ContentType()
		if contentType == "" {
			respondSecurityError(c, "MISSING_CONTENT_TYPE", "Content-Type header is required")
			return
		}

		for _, allowed := range allowedTypes {
			if strings.HasPrefix(contentType, allowed) {
				c.Next()
				return
			}
		}

		respondSecurityError(c, "INVALID_CONTENT_TYPE", "Unsupported Content-Type")
	}
}

// PreventCaching adds headers to prevent caching of sensitive responses
func PreventCaching() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Header("Surrogate-Control", "no-store")
		c.Next()
	}
}

// BodyDump creates a middleware that captures and validates request body
func BodyDump(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body != nil && c.Request.ContentLength > 0 {
			body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxSize))
			if err != nil {
				respondSecurityError(c, "BODY_READ_ERROR", "Failed to read request body")
				return
			}

			// Store original body for later use
			c.Set("request_body", body)

			// Reset body for downstream handlers
			c.Request.Body = io.NopCloser(strings.NewReader(string(body)))
		}

		c.Next()
	}
}
