package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/mimi6060/festivals/backend/internal/pkg/security"
)

// InjectionConfig holds configuration for injection prevention
type InjectionConfig struct {
	// Enable SQL injection prevention
	EnableSQLInjection bool
	// Enable NoSQL injection prevention
	EnableNoSQLInjection bool
	// Enable command injection prevention
	EnableCommandInjection bool
	// Enable XSS prevention
	EnableXSS bool
	// Enable LDAP injection prevention
	EnableLDAPInjection bool
	// Enable XML injection prevention (XXE)
	EnableXMLInjection bool
	// Enable path traversal prevention
	EnablePathTraversal bool

	// Custom patterns to block
	CustomPatterns []*regexp.Regexp

	// Paths to exclude from checking
	ExcludePaths []string

	// Log detected attacks
	LogAttacks bool

	// Security auditor for logging events
	Auditor *security.SecurityAuditor

	// Block request or just log
	BlockRequests bool

	// Maximum request body size to scan
	MaxBodySize int64
}

// DefaultInjectionConfig returns default configuration
func DefaultInjectionConfig() InjectionConfig {
	return InjectionConfig{
		EnableSQLInjection:     true,
		EnableNoSQLInjection:   true,
		EnableCommandInjection: true,
		EnableXSS:              true,
		EnableLDAPInjection:    true,
		EnableXMLInjection:     true,
		EnablePathTraversal:    true,
		LogAttacks:             true,
		BlockRequests:          true,
		MaxBodySize:            10 * 1024 * 1024, // 10MB
	}
}

// Attack patterns
var (
	// SQL injection patterns
	sqlInjectionPatterns = []*regexp.Regexp{
		// Basic SQL keywords in suspicious context
		regexp.MustCompile(`(?i)(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b\s+)`),
		// Boolean-based blind SQL injection
		regexp.MustCompile(`(?i)(\b(AND|OR)\b\s+\d+\s*=\s*\d+)`),
		regexp.MustCompile(`(?i)(\b(AND|OR)\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)`),
		// Comment-based injection
		regexp.MustCompile(`(?i)(--\s*$|/\*|\*\/|#\s*$)`),
		// Quote manipulation
		regexp.MustCompile(`(?i)('|")\s*(OR|AND)\s*('|")\s*=\s*('|")`),
		// Time-based blind injection
		regexp.MustCompile(`(?i)(WAITFOR\s+DELAY|BENCHMARK\s*\(|SLEEP\s*\(|pg_sleep\s*\()`),
		// Stacked queries
		regexp.MustCompile(`(?i)(;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|UNION))`),
		// String manipulation functions
		regexp.MustCompile(`(?i)(CHAR\s*\(|CONCAT\s*\(|CHR\s*\(|SUBSTRING\s*\()`),
		// Information schema access
		regexp.MustCompile(`(?i)(INFORMATION_SCHEMA|sys\.tables|sysobjects)`),
		// UNION-based injection
		regexp.MustCompile(`(?i)(UNION\s+(ALL\s+)?SELECT)`),
		// Error-based injection
		regexp.MustCompile(`(?i)(CONVERT\s*\(|CAST\s*\(.*AS\s+(INT|VARCHAR))`),
		// Hex encoding bypass
		regexp.MustCompile(`(?i)(0x[0-9a-fA-F]+)`),
	}

	// NoSQL injection patterns
	noSQLInjectionPatterns = []*regexp.Regexp{
		// MongoDB operators
		regexp.MustCompile(`(?i)\$where\s*:`),
		regexp.MustCompile(`(?i)\$(gt|gte|lt|lte|ne|eq|in|nin|or|and|not|nor|exists|type|regex)\s*:`),
		regexp.MustCompile(`(?i)\$function\s*:`),
		// JavaScript injection in MongoDB
		regexp.MustCompile(`(?i)function\s*\(\s*\)\s*\{`),
		regexp.MustCompile(`(?i)this\.[a-zA-Z]+\s*==`),
		// Redis injection
		regexp.MustCompile(`(?i)(EVAL|EVALSHA|SCRIPT)\s+`),
		// Generic NoSQL patterns
		regexp.MustCompile(`(?i)(\{|\[)\s*["']?\$`),
	}

	// Command injection patterns
	commandInjectionPatterns = []*regexp.Regexp{
		// Shell metacharacters
		regexp.MustCompile(`[;&|` + "`" + `]`),
		// Command substitution
		regexp.MustCompile(`\$\([^)]+\)`),
		regexp.MustCompile(`\$\{[^}]+\}`),
		regexp.MustCompile("`.+`"),
		// Pipe to commands
		regexp.MustCompile(`\|\s*\w+`),
		// Common commands after injection
		regexp.MustCompile(`(?i)(;|\||&&)\s*(cat|ls|pwd|whoami|id|uname|wget|curl|nc|netcat|bash|sh|python|perl|ruby|php)`),
		// Newline injection
		regexp.MustCompile(`\n|\r\n|\r`),
		// Path to shell
		regexp.MustCompile(`(?i)/bin/(ba)?sh`),
		regexp.MustCompile(`(?i)/etc/passwd`),
		// Windows commands
		regexp.MustCompile(`(?i)(cmd\.exe|powershell)`),
	}

	// XSS patterns
	xssPatterns = []*regexp.Regexp{
		// Script tags
		regexp.MustCompile(`(?i)<\s*script[^>]*>`),
		regexp.MustCompile(`(?i)<\s*\/\s*script\s*>`),
		// JavaScript URLs
		regexp.MustCompile(`(?i)javascript\s*:`),
		regexp.MustCompile(`(?i)vbscript\s*:`),
		// Event handlers
		regexp.MustCompile(`(?i)on(load|error|click|mouseover|mouseout|mouseenter|mouseleave|focus|blur|change|input|keyup|keydown|keypress|submit|reset|select|abort|dragstart|drag|dragend|drop)\s*=`),
		// Dangerous tags
		regexp.MustCompile(`(?i)<\s*(iframe|frame|embed|object|applet|form|input|button|textarea|select|link|meta|base|style)`),
		// SVG/XML injection
		regexp.MustCompile(`(?i)<\s*svg[^>]*on\w+\s*=`),
		regexp.MustCompile(`(?i)<\s*math[^>]*>`),
		// Data URLs with HTML/JavaScript
		regexp.MustCompile(`(?i)data\s*:\s*(text/html|application/javascript|text/javascript)`),
		// CSS injection
		regexp.MustCompile(`(?i)expression\s*\(`),
		regexp.MustCompile(`(?i)behavior\s*:`),
		// Template injection
		regexp.MustCompile(`(?i)\{\{.*\}\}`),
		regexp.MustCompile(`(?i)\$\{.*\}`),
	}

	// LDAP injection patterns
	ldapInjectionPatterns = []*regexp.Regexp{
		regexp.MustCompile(`[*()\\|\x00]`),
		regexp.MustCompile(`(?i)\)\s*\(\s*[&|!]`),
	}

	// XML/XXE patterns
	xmlInjectionPatterns = []*regexp.Regexp{
		// DOCTYPE declarations
		regexp.MustCompile(`(?i)<!DOCTYPE[^>]*>`),
		// ENTITY declarations
		regexp.MustCompile(`(?i)<!ENTITY[^>]*>`),
		// SYSTEM keyword
		regexp.MustCompile(`(?i)SYSTEM\s+["'][^"']*["']`),
		// PUBLIC keyword
		regexp.MustCompile(`(?i)PUBLIC\s+["'][^"']*["']\s+["'][^"']*["']`),
		// Parameter entities
		regexp.MustCompile(`(?i)%[a-zA-Z]+;`),
		// External entity references
		regexp.MustCompile(`(?i)&[a-zA-Z]+;`),
	}

	// Path traversal patterns
	pathTraversalPatterns = []*regexp.Regexp{
		regexp.MustCompile(`\.\.\/`),
		regexp.MustCompile(`\.\.\\`),
		regexp.MustCompile(`%2e%2e%2f`),
		regexp.MustCompile(`%2e%2e\/`),
		regexp.MustCompile(`\.\.%2f`),
		regexp.MustCompile(`%2e%2e%5c`),
		regexp.MustCompile(`\.\.%5c`),
		regexp.MustCompile(`%252e%252e%252f`),
		regexp.MustCompile(`(?i)(etc\/passwd|etc\/shadow|windows\/system32|boot\.ini)`),
	}

	patternsMu sync.RWMutex
)

// InjectionType represents the type of injection detected
type InjectionType string

const (
	InjectionTypeSQL     InjectionType = "SQL_INJECTION"
	InjectionTypeNoSQL   InjectionType = "NOSQL_INJECTION"
	InjectionTypeCommand InjectionType = "COMMAND_INJECTION"
	InjectionTypeXSS     InjectionType = "XSS"
	InjectionTypeLDAP    InjectionType = "LDAP_INJECTION"
	InjectionTypeXML     InjectionType = "XML_INJECTION"
	InjectionTypePath    InjectionType = "PATH_TRAVERSAL"
	InjectionTypeCustom  InjectionType = "CUSTOM"
)

// InjectionPrevention creates middleware to prevent various injection attacks
func InjectionPrevention(cfg InjectionConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if path should be excluded
		for _, path := range cfg.ExcludePaths {
			if strings.HasPrefix(c.Request.URL.Path, path) {
				c.Next()
				return
			}
		}

		// Check URL path
		if detected, injType, pattern := checkInjection(c.Request.URL.Path, cfg); detected {
			handleInjectionDetected(c, cfg, injType, "url_path", c.Request.URL.Path, pattern)
			if cfg.BlockRequests {
				return
			}
		}

		// Check query parameters
		for key, values := range c.Request.URL.Query() {
			for _, value := range values {
				if detected, injType, pattern := checkInjection(value, cfg); detected {
					handleInjectionDetected(c, cfg, injType, "query_param:"+key, value, pattern)
					if cfg.BlockRequests {
						return
					}
				}
			}
		}

		// Check headers
		headersToCheck := []string{
			"User-Agent", "Referer", "X-Forwarded-For", "X-Real-IP",
			"Cookie", "Authorization", "Content-Type",
		}
		for _, header := range headersToCheck {
			value := c.GetHeader(header)
			if value != "" {
				if detected, injType, pattern := checkInjection(value, cfg); detected {
					handleInjectionDetected(c, cfg, injType, "header:"+header, value, pattern)
					if cfg.BlockRequests {
						return
					}
				}
			}
		}

		// Check request body for POST/PUT/PATCH
		if c.Request.Method == "POST" || c.Request.Method == "PUT" || c.Request.Method == "PATCH" {
			if c.Request.ContentLength > 0 && c.Request.ContentLength < cfg.MaxBodySize {
				bodyBytes, err := io.ReadAll(io.LimitReader(c.Request.Body, cfg.MaxBodySize))
				if err == nil && len(bodyBytes) > 0 {
					// Restore body for downstream handlers
					c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

					// Check body content
					bodyStr := string(bodyBytes)

					// Check raw body
					if detected, injType, pattern := checkInjection(bodyStr, cfg); detected {
						handleInjectionDetected(c, cfg, injType, "body", truncateString(bodyStr, 200), pattern)
						if cfg.BlockRequests {
							return
						}
					}

					// Check JSON fields if applicable
					contentType := c.ContentType()
					if strings.Contains(contentType, "application/json") {
						checkJSONInjection(c, cfg, bodyBytes)
						if c.IsAborted() && cfg.BlockRequests {
							return
						}
					}

					// Check form data
					if strings.Contains(contentType, "application/x-www-form-urlencoded") ||
						strings.Contains(contentType, "multipart/form-data") {
						// Reset body again for ParseForm
						c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
						if err := c.Request.ParseForm(); err == nil {
							for key, values := range c.Request.PostForm {
								for _, value := range values {
									if detected, injType, pattern := checkInjection(value, cfg); detected {
										handleInjectionDetected(c, cfg, injType, "form:"+key, value, pattern)
										if cfg.BlockRequests {
											return
										}
									}
								}
							}
						}
						// Reset body again for downstream
						c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
					}
				}
			}
		}

		c.Next()
	}
}

// checkInjection checks input against all enabled patterns
func checkInjection(input string, cfg InjectionConfig) (bool, InjectionType, string) {
	if input == "" {
		return false, "", ""
	}

	patternsMu.RLock()
	defer patternsMu.RUnlock()

	if cfg.EnableSQLInjection {
		for _, pattern := range sqlInjectionPatterns {
			if pattern.MatchString(input) {
				return true, InjectionTypeSQL, pattern.String()
			}
		}
	}

	if cfg.EnableNoSQLInjection {
		for _, pattern := range noSQLInjectionPatterns {
			if pattern.MatchString(input) {
				return true, InjectionTypeNoSQL, pattern.String()
			}
		}
	}

	if cfg.EnableCommandInjection {
		for _, pattern := range commandInjectionPatterns {
			if pattern.MatchString(input) {
				return true, InjectionTypeCommand, pattern.String()
			}
		}
	}

	if cfg.EnableXSS {
		for _, pattern := range xssPatterns {
			if pattern.MatchString(input) {
				return true, InjectionTypeXSS, pattern.String()
			}
		}
	}

	if cfg.EnableLDAPInjection {
		for _, pattern := range ldapInjectionPatterns {
			if pattern.MatchString(input) {
				return true, InjectionTypeLDAP, pattern.String()
			}
		}
	}

	if cfg.EnableXMLInjection {
		for _, pattern := range xmlInjectionPatterns {
			if pattern.MatchString(input) {
				return true, InjectionTypeXML, pattern.String()
			}
		}
	}

	if cfg.EnablePathTraversal {
		for _, pattern := range pathTraversalPatterns {
			if pattern.MatchString(input) {
				return true, InjectionTypePath, pattern.String()
			}
		}
	}

	// Custom patterns
	for _, pattern := range cfg.CustomPatterns {
		if pattern.MatchString(input) {
			return true, InjectionTypeCustom, pattern.String()
		}
	}

	return false, "", ""
}

// checkJSONInjection recursively checks JSON values for injection
func checkJSONInjection(c *gin.Context, cfg InjectionConfig, body []byte) {
	var data interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return
	}

	checkJSONValue(c, cfg, "root", data)
}

// checkJSONValue recursively checks JSON values
func checkJSONValue(c *gin.Context, cfg InjectionConfig, path string, value interface{}) {
	if c.IsAborted() {
		return
	}

	switch v := value.(type) {
	case string:
		if detected, injType, pattern := checkInjection(v, cfg); detected {
			handleInjectionDetected(c, cfg, injType, "json:"+path, v, pattern)
		}
	case map[string]interface{}:
		for key, val := range v {
			checkJSONValue(c, cfg, path+"."+key, val)
		}
	case []interface{}:
		for i, val := range v {
			checkJSONValue(c, cfg, path+"["+string(rune('0'+i))+"]", val)
		}
	}
}

// handleInjectionDetected handles a detected injection attempt
func handleInjectionDetected(c *gin.Context, cfg InjectionConfig, injType InjectionType, location, value, pattern string) {
	if cfg.LogAttacks {
		log.Warn().
			Str("type", string(injType)).
			Str("location", location).
			Str("value", truncateString(value, 200)).
			Str("pattern", pattern).
			Str("path", c.Request.URL.Path).
			Str("method", c.Request.Method).
			Str("ip", c.ClientIP()).
			Str("user_agent", c.GetHeader("User-Agent")).
			Msg("Injection attack detected")
	}

	// Log to security auditor if available
	if cfg.Auditor != nil {
		eventType := mapInjectionTypeToEvent(injType)
		event := &security.SecurityEvent{
			Type:      eventType,
			Severity:  security.SeverityWarning,
			IPAddress: c.ClientIP(),
			UserAgent: c.GetHeader("User-Agent"),
			Resource:  c.Request.URL.Path,
			Action:    c.Request.Method,
			Result:    "blocked",
			Details: map[string]interface{}{
				"injection_type": string(injType),
				"location":       location,
				"pattern":        pattern,
				"value_preview":  truncateString(value, 100),
			},
		}
		if userID, exists := c.Get("user_id"); exists {
			event.UserID = userID.(string)
		}
		cfg.Auditor.LogEvent(c.Request.Context(), event)
	}

	if cfg.BlockRequests {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": gin.H{
				"code":    "INJECTION_DETECTED",
				"message": "Potentially malicious input detected",
			},
		})
	}
}

// mapInjectionTypeToEvent maps injection type to security event type
func mapInjectionTypeToEvent(injType InjectionType) security.SecurityEventType {
	switch injType {
	case InjectionTypeSQL:
		return security.EventAttackSQLInjection
	case InjectionTypeNoSQL:
		return security.EventAttackNoSQLInjection
	case InjectionTypeCommand:
		return security.EventAttackCommandInjection
	case InjectionTypeXSS:
		return security.EventAttackXSS
	case InjectionTypePath:
		return security.EventAttackPathTraversal
	case InjectionTypeXML:
		return security.EventAttackXXE
	default:
		return security.EventAttackSQLInjection
	}
}

// truncateString truncates a string to the specified length
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// SQLInjectionPrevention creates middleware specifically for SQL injection prevention
func SQLInjectionPrevention() gin.HandlerFunc {
	cfg := DefaultInjectionConfig()
	cfg.EnableNoSQLInjection = false
	cfg.EnableCommandInjection = false
	cfg.EnableXSS = false
	cfg.EnableLDAPInjection = false
	cfg.EnableXMLInjection = false
	cfg.EnablePathTraversal = false
	return InjectionPrevention(cfg)
}

// XSSPrevention creates middleware specifically for XSS prevention
func XSSPrevention() gin.HandlerFunc {
	cfg := DefaultInjectionConfig()
	cfg.EnableSQLInjection = false
	cfg.EnableNoSQLInjection = false
	cfg.EnableCommandInjection = false
	cfg.EnableLDAPInjection = false
	cfg.EnableXMLInjection = false
	cfg.EnablePathTraversal = false
	return InjectionPrevention(cfg)
}

// NoSQLInjectionPrevention creates middleware specifically for NoSQL injection prevention
func NoSQLInjectionPrevention() gin.HandlerFunc {
	cfg := DefaultInjectionConfig()
	cfg.EnableSQLInjection = false
	cfg.EnableCommandInjection = false
	cfg.EnableXSS = false
	cfg.EnableLDAPInjection = false
	cfg.EnableXMLInjection = false
	cfg.EnablePathTraversal = false
	return InjectionPrevention(cfg)
}

// CommandInjectionPrevention creates middleware specifically for command injection prevention
func CommandInjectionPrevention() gin.HandlerFunc {
	cfg := DefaultInjectionConfig()
	cfg.EnableSQLInjection = false
	cfg.EnableNoSQLInjection = false
	cfg.EnableXSS = false
	cfg.EnableLDAPInjection = false
	cfg.EnableXMLInjection = false
	cfg.EnablePathTraversal = false
	return InjectionPrevention(cfg)
}

// XXEPrevention creates middleware specifically for XXE prevention
func XXEPrevention() gin.HandlerFunc {
	cfg := DefaultInjectionConfig()
	cfg.EnableSQLInjection = false
	cfg.EnableNoSQLInjection = false
	cfg.EnableCommandInjection = false
	cfg.EnableXSS = false
	cfg.EnableLDAPInjection = false
	cfg.EnablePathTraversal = false
	return InjectionPrevention(cfg)
}

// PathTraversalPrevention creates middleware specifically for path traversal prevention
func PathTraversalPrevention() gin.HandlerFunc {
	cfg := DefaultInjectionConfig()
	cfg.EnableSQLInjection = false
	cfg.EnableNoSQLInjection = false
	cfg.EnableCommandInjection = false
	cfg.EnableXSS = false
	cfg.EnableLDAPInjection = false
	cfg.EnableXMLInjection = false
	return InjectionPrevention(cfg)
}

// AddCustomPattern adds a custom pattern to detect
func AddCustomPattern(pattern *regexp.Regexp) {
	patternsMu.Lock()
	defer patternsMu.Unlock()
	// Note: Custom patterns are added to config, not global patterns
}

// IsCleanInput checks if input is clean (no injection detected)
func IsCleanInput(input string) bool {
	cfg := DefaultInjectionConfig()
	detected, _, _ := checkInjection(input, cfg)
	return !detected
}

// CleanInput returns true if the input passes all injection checks
func CleanInput(input string, checks ...InjectionType) bool {
	cfg := InjectionConfig{}

	if len(checks) == 0 {
		cfg = DefaultInjectionConfig()
	} else {
		for _, check := range checks {
			switch check {
			case InjectionTypeSQL:
				cfg.EnableSQLInjection = true
			case InjectionTypeNoSQL:
				cfg.EnableNoSQLInjection = true
			case InjectionTypeCommand:
				cfg.EnableCommandInjection = true
			case InjectionTypeXSS:
				cfg.EnableXSS = true
			case InjectionTypeLDAP:
				cfg.EnableLDAPInjection = true
			case InjectionTypeXML:
				cfg.EnableXMLInjection = true
			case InjectionTypePath:
				cfg.EnablePathTraversal = true
			}
		}
	}

	detected, _, _ := checkInjection(input, cfg)
	return !detected
}
