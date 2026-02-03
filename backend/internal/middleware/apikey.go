package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/api"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// APIKeyConfig holds configuration for the API key middleware
type APIKeyConfig struct {
	APIService   *api.Service
	RedisClient  *redis.Client
	RateLimitTTL time.Duration
}

// APIKeyContext represents the API key information stored in context
type APIKeyContext struct {
	KeyID       uuid.UUID
	FestivalID  uuid.UUID
	Permissions []api.Permission
	Environment api.Environment
	RateLimit   api.RateLimitConfig
}

// Context keys for API authentication
const (
	ContextAPIKey       = "api_key"
	ContextAPIKeyID     = "api_key_id"
	ContextAPIFestival  = "api_festival_id"
	ContextAPIPerms     = "api_permissions"
	ContextAPIEnv       = "api_environment"
)

// APIKeyAuth creates the API key authentication middleware
func APIKeyAuth(cfg APIKeyConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract API key from header or query
		apiKey := extractAPIKey(c)
		if apiKey == "" {
			respondAPIError(c, http.StatusUnauthorized, "API_KEY_REQUIRED", "API key is required. Provide it via X-API-Key header or api_key query parameter.")
			return
		}

		// Validate API key
		key, err := cfg.APIService.ValidateAPIKey(c.Request.Context(), apiKey)
		if err != nil {
			respondAPIError(c, http.StatusUnauthorized, "INVALID_API_KEY", "The provided API key is invalid or has been revoked.")
			return
		}

		// Check rate limit
		if key.RateLimit.Enabled {
			allowed, err := checkRateLimit(c.Request.Context(), cfg, key)
			if err != nil {
				log.Error().Err(err).Msg("Rate limit check failed")
				// Allow request if rate limit check fails (fail open)
			} else if !allowed {
				respondAPIError(c, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "You have exceeded your rate limit. Please wait before making more requests.")
				return
			}
		}

		// Store API key info in context
		c.Set(ContextAPIKey, key)
		c.Set(ContextAPIKeyID, key.ID.String())
		c.Set(ContextAPIFestival, key.FestivalID.String())
		c.Set(ContextAPIPerms, key.Permissions)
		c.Set(ContextAPIEnv, key.Environment)

		// Track usage (async)
		go trackAPIUsage(cfg.APIService, key, c)

		c.Next()
	}
}

// RequirePermission creates a middleware that checks for a specific permission
func RequirePermission(permission api.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		key, exists := c.Get(ContextAPIKey)
		if !exists {
			respondAPIError(c, http.StatusUnauthorized, "API_KEY_REQUIRED", "API key authentication required.")
			return
		}

		apiKey := key.(*api.APIKey)
		if !apiKey.HasPermission(permission) {
			respondAPIError(c, http.StatusForbidden, "INSUFFICIENT_PERMISSIONS",
				"Your API key does not have the required permission: "+string(permission))
			return
		}

		c.Next()
	}
}

// RequireAnyPermission creates a middleware that checks for any of the specified permissions
func RequireAnyPermission(permissions ...api.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		key, exists := c.Get(ContextAPIKey)
		if !exists {
			respondAPIError(c, http.StatusUnauthorized, "API_KEY_REQUIRED", "API key authentication required.")
			return
		}

		apiKey := key.(*api.APIKey)
		if !apiKey.HasAnyPermission(permissions...) {
			permStrs := make([]string, len(permissions))
			for i, p := range permissions {
				permStrs[i] = string(p)
			}
			respondAPIError(c, http.StatusForbidden, "INSUFFICIENT_PERMISSIONS",
				"Your API key requires one of these permissions: "+strings.Join(permStrs, ", "))
			return
		}

		c.Next()
	}
}

// RequireProduction creates a middleware that only allows production API keys
func RequireProduction() gin.HandlerFunc {
	return func(c *gin.Context) {
		key, exists := c.Get(ContextAPIKey)
		if !exists {
			respondAPIError(c, http.StatusUnauthorized, "API_KEY_REQUIRED", "API key authentication required.")
			return
		}

		apiKey := key.(*api.APIKey)
		if apiKey.Environment != api.EnvironmentProduction {
			respondAPIError(c, http.StatusForbidden, "PRODUCTION_REQUIRED",
				"This endpoint requires a production API key. You are using a sandbox key.")
			return
		}

		c.Next()
	}
}

// extractAPIKey extracts the API key from the request
func extractAPIKey(c *gin.Context) string {
	// Try X-API-Key header first
	if key := c.GetHeader("X-API-Key"); key != "" {
		return key
	}

	// Try Authorization header with ApiKey scheme
	authHeader := c.GetHeader("Authorization")
	if strings.HasPrefix(authHeader, "ApiKey ") {
		return strings.TrimPrefix(authHeader, "ApiKey ")
	}

	// Try query parameter
	if key := c.Query("api_key"); key != "" {
		return key
	}

	return ""
}

// checkRateLimit checks if the API key is within its rate limit
func checkRateLimit(ctx context.Context, cfg APIKeyConfig, key *api.APIKey) (bool, error) {
	if cfg.RedisClient == nil {
		// If no Redis, use service method (which uses DB)
		return cfg.APIService.CheckRateLimit(ctx, key)
	}

	// Use Redis for rate limiting
	now := time.Now()
	minuteKey := "ratelimit:" + key.ID.String() + ":" + now.Format("2006-01-02-15-04")

	// Increment counter
	count, err := cfg.RedisClient.Incr(ctx, minuteKey).Result()
	if err != nil {
		return false, err
	}

	// Set expiry on first request
	if count == 1 {
		cfg.RedisClient.Expire(ctx, minuteKey, 2*time.Minute)
	}

	return count <= int64(key.RateLimit.RequestsPerMinute), nil
}

// trackAPIUsage records API usage asynchronously
func trackAPIUsage(service *api.Service, key *api.APIKey, c *gin.Context) {
	// Calculate response size (approximate)
	var bandwidth int64
	if c.Writer != nil {
		bandwidth = int64(c.Writer.Size())
	}

	// Get response time from context if set
	var responseTime int64
	if start, exists := c.Get("request_start"); exists {
		if startTime, ok := start.(time.Time); ok {
			responseTime = time.Since(startTime).Milliseconds()
		}
	}

	err := service.TrackUsage(
		context.Background(),
		key.ID,
		key.FestivalID,
		c.Request.URL.Path,
		c.Request.Method,
		c.Writer.Status(),
		bandwidth,
		responseTime,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to track API usage")
	}
}

// respondAPIError sends a standardized API error response
func respondAPIError(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, gin.H{
		"error": gin.H{
			"code":    code,
			"message": message,
		},
	})
}

// GetAPIKey retrieves the API key from the context
func GetAPIKey(c *gin.Context) *api.APIKey {
	if key, exists := c.Get(ContextAPIKey); exists {
		if apiKey, ok := key.(*api.APIKey); ok {
			return apiKey
		}
	}
	return nil
}

// GetAPIKeyID retrieves the API key ID from the context
func GetAPIKeyID(c *gin.Context) string {
	return c.GetString(ContextAPIKeyID)
}

// GetAPIFestivalID retrieves the festival ID associated with the API key
func GetAPIFestivalID(c *gin.Context) string {
	return c.GetString(ContextAPIFestival)
}

// GetAPIPermissions retrieves the permissions from the API key context
func GetAPIPermissions(c *gin.Context) []api.Permission {
	if perms, exists := c.Get(ContextAPIPerms); exists {
		if permissions, ok := perms.([]api.Permission); ok {
			return permissions
		}
	}
	return nil
}

// GetAPIEnvironment retrieves the API environment from context
func GetAPIEnvironment(c *gin.Context) api.Environment {
	if env, exists := c.Get(ContextAPIEnv); exists {
		if environment, ok := env.(api.Environment); ok {
			return environment
		}
	}
	return ""
}

// RequestTimer middleware to track request timing
func RequestTimer() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("request_start", time.Now())
		c.Next()
	}
}
