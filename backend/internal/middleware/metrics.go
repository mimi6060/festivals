package middleware

import (
	"regexp"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/metrics"
)

// Metrics returns a middleware that collects Prometheus metrics
func Metrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		m := metrics.Get()
		if m == nil {
			c.Next()
			return
		}

		// Track in-flight requests
		m.IncrementInFlight()
		defer m.DecrementInFlight()

		// Record start time
		start := time.Now()

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start).Seconds()

		// Normalize path (remove IDs for cardinality control)
		path := normalizePath(c.FullPath())
		if path == "" {
			path = c.Request.URL.Path
		}

		// Get status code
		status := strconv.Itoa(c.Writer.Status())

		// Get response size
		responseSize := c.Writer.Size()
		if responseSize < 0 {
			responseSize = 0
		}

		// Record metrics
		m.RecordHTTPRequest(c.Request.Method, path, status, duration, responseSize)
	}
}

// pathNormalizers contains regex patterns for normalizing paths
var pathNormalizers = []struct {
	pattern *regexp.Regexp
	replace string
}{
	// UUID pattern
	{regexp.MustCompile(`/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`), "/:id"},
	// Numeric IDs
	{regexp.MustCompile(`/\d+`), "/:id"},
	// Short hash IDs (8-12 characters)
	{regexp.MustCompile(`/[a-zA-Z0-9]{8,12}(?:/|$)`), "/:id/"},
}

// normalizePath normalizes a path by replacing dynamic segments with placeholders
// This prevents high cardinality in metrics labels
func normalizePath(path string) string {
	if path == "" {
		return ""
	}

	// If the path already has Gin route parameters, use it as-is
	if hasRouteParams(path) {
		return path
	}

	// Apply normalizers
	for _, n := range pathNormalizers {
		path = n.pattern.ReplaceAllString(path, n.replace)
	}

	// Clean up any trailing slash duplicates
	path = regexp.MustCompile(`/+`).ReplaceAllString(path, "/")

	return path
}

// hasRouteParams checks if a path contains Gin route parameters
func hasRouteParams(path string) bool {
	return regexp.MustCompile(`:[a-zA-Z]+`).MatchString(path)
}

// MetricsConfig holds configuration for the metrics middleware
type MetricsConfig struct {
	// SkipPaths are paths that should not be recorded
	SkipPaths []string
	// SkipHealthCheck skips health check endpoints
	SkipHealthCheck bool
}

// MetricsWithConfig returns a metrics middleware with custom configuration
func MetricsWithConfig(config MetricsConfig) gin.HandlerFunc {
	skipPaths := make(map[string]bool)
	for _, path := range config.SkipPaths {
		skipPaths[path] = true
	}

	if config.SkipHealthCheck {
		skipPaths["/health"] = true
		skipPaths["/health/ready"] = true
		skipPaths["/health/live"] = true
	}

	return func(c *gin.Context) {
		m := metrics.Get()
		if m == nil {
			c.Next()
			return
		}

		// Skip certain paths
		if skipPaths[c.Request.URL.Path] {
			c.Next()
			return
		}

		// Track in-flight requests
		m.IncrementInFlight()
		defer m.DecrementInFlight()

		// Record start time
		start := time.Now()

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start).Seconds()

		// Normalize path
		path := normalizePath(c.FullPath())
		if path == "" {
			path = normalizePath(c.Request.URL.Path)
		}

		// Get status code
		status := strconv.Itoa(c.Writer.Status())

		// Get response size
		responseSize := c.Writer.Size()
		if responseSize < 0 {
			responseSize = 0
		}

		// Record metrics
		m.RecordHTTPRequest(c.Request.Method, path, status, duration, responseSize)
	}
}
