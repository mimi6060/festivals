package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// CORSConfig holds CORS configuration
type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	AllowCredentials bool
}

// DefaultCORSConfig returns default CORS configuration
// Note: In production, always set explicit allowed origins via environment variables
func DefaultCORSConfig() CORSConfig {
	return CORSConfig{
		AllowedOrigins: []string{"http://localhost:3000", "http://localhost:3001"},
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{
			"Content-Type",
			"Content-Length",
			"Accept-Encoding",
			"X-CSRF-Token",
			"Authorization",
			"Accept",
			"Origin",
			"Cache-Control",
			"X-Requested-With",
			"X-Request-ID",
		},
		AllowCredentials: true,
	}
}

// CORS creates a CORS middleware with default configuration
// WARNING: This uses permissive defaults for development. In production,
// use CORSWithConfig with explicit allowed origins.
func CORS() gin.HandlerFunc {
	return CORSWithConfig(DefaultCORSConfig())
}

// CORSWithConfig creates a CORS middleware with custom configuration
func CORSWithConfig(cfg CORSConfig) gin.HandlerFunc {
	// Build allowed methods string
	allowedMethods := strings.Join(cfg.AllowedMethods, ", ")
	if allowedMethods == "" {
		allowedMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
	}

	// Build allowed headers string
	allowedHeaders := strings.Join(cfg.AllowedHeaders, ", ")
	if allowedHeaders == "" {
		allowedHeaders = "Content-Type, Authorization, Accept, Origin, X-Request-ID"
	}

	// Build origin lookup map for O(1) checks
	allowedOriginMap := make(map[string]bool)
	for _, origin := range cfg.AllowedOrigins {
		allowedOriginMap[strings.ToLower(origin)] = true
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Check if origin is allowed
		if origin != "" {
			originLower := strings.ToLower(origin)
			if allowedOriginMap[originLower] {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				if cfg.AllowCredentials {
					c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
				}
			}
			// If origin is not allowed, don't set CORS headers (browser will block)
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers", allowedHeaders)
		c.Writer.Header().Set("Access-Control-Allow-Methods", allowedMethods)

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// CORSForEnvironment returns appropriate CORS middleware based on environment
func CORSForEnvironment(environment string, allowedOrigins []string) gin.HandlerFunc {
	cfg := DefaultCORSConfig()

	if environment == "production" {
		// In production, use only explicitly configured origins
		if len(allowedOrigins) > 0 {
			cfg.AllowedOrigins = allowedOrigins
		} else {
			// Fallback to empty list - blocks all cross-origin requests if not configured
			cfg.AllowedOrigins = []string{}
		}
	} else {
		// In development, use configured origins or defaults
		if len(allowedOrigins) > 0 {
			cfg.AllowedOrigins = allowedOrigins
		}
		// Default dev origins are already set in DefaultCORSConfig
	}

	return CORSWithConfig(cfg)
}
