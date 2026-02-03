package middleware

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mimi6060/festivals/backend/internal/domain/auth"
	"github.com/rs/zerolog/log"
)

// Impersonation context keys
const (
	ContextKeyImpersonating       = "impersonating"
	ContextKeyImpersonationSession = "impersonation_session"
	ContextKeyOriginalUserID      = "original_user_id"
	ContextKeyOriginalEmail       = "original_email"
	ContextKeyOriginalRoles       = "original_roles"
	ImpersonationTokenHeader      = "X-Impersonation-Token"
)

// ImpersonationConfig holds configuration for the impersonation middleware
type ImpersonationConfig struct {
	ImpersonationService auth.ImpersonationService
	RBACService          auth.RBACService
	MaxBodyLogSize       int  // Maximum size of request body to log
	LogRequestBodies     bool // Whether to log request bodies
}

// DefaultImpersonationConfig returns default impersonation configuration
func DefaultImpersonationConfig(impService auth.ImpersonationService, rbacService auth.RBACService) ImpersonationConfig {
	return ImpersonationConfig{
		ImpersonationService: impService,
		RBACService:          rbacService,
		MaxBodyLogSize:       4096,
		LogRequestBodies:     true,
	}
}

// Impersonation creates the impersonation detection middleware
// This middleware should be placed AFTER the Auth middleware
func Impersonation(cfg ImpersonationConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check for impersonation token header
		token := c.GetHeader(ImpersonationTokenHeader)
		if token == "" {
			// No impersonation, continue normally
			c.Next()
			return
		}

		// Validate the impersonation token
		session, err := cfg.ImpersonationService.ValidateImpersonation(c.Request.Context(), token)
		if err != nil {
			switch err {
			case auth.ErrImpersonationNotFound:
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": gin.H{
						"code":    "IMPERSONATION_SESSION_NOT_FOUND",
						"message": "Impersonation session not found or has ended",
					},
				})
			case auth.ErrImpersonationExpired:
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": gin.H{
						"code":    "IMPERSONATION_SESSION_EXPIRED",
						"message": "Impersonation session has expired",
					},
				})
			default:
				log.Error().Err(err).Msg("Failed to validate impersonation token")
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": gin.H{
						"code":    "IMPERSONATION_ERROR",
						"message": "Failed to validate impersonation session",
					},
				})
			}
			return
		}

		// Verify the current user is the admin who started the session
		currentUserID := c.GetString("user_id")
		if currentUserID != session.AdminID.String() {
			log.Warn().
				Str("currentUserID", currentUserID).
				Str("sessionAdminID", session.AdminID.String()).
				Msg("Impersonation token used by different user than session owner")
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"code":    "IMPERSONATION_NOT_AUTHORIZED",
					"message": "You are not authorized to use this impersonation session",
				},
			})
			return
		}

		// Store original user info before switching
		originalUserID := c.GetString("user_id")
		originalEmail := c.GetString("email")
		originalRoles, _ := c.Get("roles")

		// Store original values for audit
		c.Set(ContextKeyOriginalUserID, originalUserID)
		c.Set(ContextKeyOriginalEmail, originalEmail)
		if originalRoles != nil {
			c.Set(ContextKeyOriginalRoles, originalRoles)
		}

		// Switch context to impersonated user
		c.Set(string(ContextKeyUserID), session.TargetUserID.String())
		c.Set("user_id", session.TargetUserID.String())
		c.Set(string(ContextKeyEmail), session.TargetUserEmail)
		c.Set("email", session.TargetUserEmail)

		// Get target user's roles
		targetRoles, err := cfg.RBACService.GetUserRoles(c.Request.Context(), session.TargetUserID, nil)
		if err == nil {
			roleNames := make([]string, len(targetRoles))
			for i, role := range targetRoles {
				roleNames[i] = role.Name
			}
			c.Set(string(ContextKeyRoles), roleNames)
			c.Set("roles", roleNames)
		}

		// Mark that we're impersonating
		c.Set(ContextKeyImpersonating, true)
		c.Set(ContextKeyImpersonationSession, session)

		// Capture request body for audit logging
		var requestBody string
		if cfg.LogRequestBodies && c.Request.Body != nil {
			bodyBytes, _ := io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			if len(bodyBytes) > cfg.MaxBodyLogSize {
				requestBody = string(bodyBytes[:cfg.MaxBodyLogSize]) + "...[truncated]"
			} else {
				requestBody = string(bodyBytes)
			}
			// Redact sensitive fields
			requestBody = redactSensitiveFieldsForImpersonation(requestBody)
		}

		// Continue with request
		c.Next()

		// Log the impersonated action (after request completed)
		go func() {
			cfg.ImpersonationService.LogImpersonationAction(
				c.Request.Context(),
				session.ID,
				c.Request.Method,
				c.Request.URL.Path,
				requestBody,
				c.Writer.Status(),
				c.ClientIP(),
				c.Request.UserAgent(),
			)
			cfg.ImpersonationService.IncrementActionsCount(c.Request.Context(), session.ID)
		}()

		log.Debug().
			Str("adminID", session.AdminID.String()).
			Str("targetUserID", session.TargetUserID.String()).
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Int("status", c.Writer.Status()).
			Msg("Impersonated action performed")
	}
}

// IsImpersonating checks if the current request is being made while impersonating
func IsImpersonating(c *gin.Context) bool {
	impersonating, exists := c.Get(ContextKeyImpersonating)
	if !exists {
		return false
	}
	return impersonating.(bool)
}

// GetImpersonationSession gets the current impersonation session from context
func GetImpersonationSession(c *gin.Context) *auth.ImpersonationSession {
	session, exists := c.Get(ContextKeyImpersonationSession)
	if !exists {
		return nil
	}
	return session.(*auth.ImpersonationSession)
}

// GetOriginalUserID gets the original (admin) user ID when impersonating
func GetOriginalUserID(c *gin.Context) string {
	if userID, exists := c.Get(ContextKeyOriginalUserID); exists {
		return userID.(string)
	}
	return ""
}

// GetOriginalEmail gets the original (admin) email when impersonating
func GetOriginalEmail(c *gin.Context) string {
	if email, exists := c.Get(ContextKeyOriginalEmail); exists {
		return email.(string)
	}
	return ""
}

// GetEffectiveUserID returns the effective user ID (impersonated user if impersonating, otherwise current user)
func GetEffectiveUserID(c *gin.Context) string {
	return c.GetString("user_id")
}

// GetActorUserID returns the actual actor user ID (always the admin, even when impersonating)
// This should be used for audit logging
func GetActorUserID(c *gin.Context) string {
	if IsImpersonating(c) {
		return GetOriginalUserID(c)
	}
	return c.GetString("user_id")
}

// redactSensitiveFieldsForImpersonation redacts sensitive fields from request body
func redactSensitiveFieldsForImpersonation(content string) string {
	sensitiveFields := []string{"password", "token", "secret", "api_key", "apiKey", "authorization", "credit_card", "creditCard", "cvv", "ssn"}
	redacted := content
	for _, field := range sensitiveFields {
		// Simple redaction - in production, use proper JSON parsing
		if strings.Contains(strings.ToLower(redacted), field) {
			// This is a simple approach - for production, parse JSON properly
			redacted = strings.ReplaceAll(redacted, field, "[REDACTED]")
		}
	}
	return redacted
}

// RequireNotImpersonating middleware blocks certain operations during impersonation
// Use this for sensitive operations that shouldn't be allowed during impersonation
func RequireNotImpersonating() gin.HandlerFunc {
	return func(c *gin.Context) {
		if IsImpersonating(c) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"code":    "IMPERSONATION_BLOCKED",
					"message": "This operation is not allowed while impersonating a user",
				},
			})
			return
		}
		c.Next()
	}
}

// AddImpersonationAuditContext adds impersonation context to audit metadata
// Use this helper when building audit log entries
func AddImpersonationAuditContext(c *gin.Context, metadata map[string]interface{}) map[string]interface{} {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	if IsImpersonating(c) {
		metadata["impersonating"] = true
		metadata["original_user_id"] = GetOriginalUserID(c)
		metadata["original_email"] = GetOriginalEmail(c)
		if session := GetImpersonationSession(c); session != nil {
			metadata["impersonation_session_id"] = session.ID.String()
		}
	}

	return metadata
}
