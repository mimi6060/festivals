package middleware

import (
	"regexp"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/monitoring"
)

// Metrics returns a middleware that collects Prometheus metrics for HTTP requests
func Metrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		m := monitoring.Get()
		if m == nil {
			c.Next()
			return
		}

		// Track in-flight requests
		m.IncrementInFlight()
		defer m.DecrementInFlight()

		// Record start time for response time tracking
		start := time.Now()

		// Process request
		c.Next()

		// Calculate duration in seconds
		duration := time.Since(start).Seconds()

		// Normalize path (remove IDs for cardinality control)
		path := normalizePath(c.FullPath())
		if path == "" {
			path = normalizePath(c.Request.URL.Path)
		}

		// Get status code as string
		status := strconv.Itoa(c.Writer.Status())

		// Get response size
		responseSize := c.Writer.Size()
		if responseSize < 0 {
			responseSize = 0
		}

		// Record HTTP request metrics
		m.RecordHTTPRequest(c.Request.Method, path, status, duration, responseSize)
	}
}

// MetricsConfig holds configuration for the metrics middleware
type MetricsConfig struct {
	// SkipPaths are paths that should not be recorded in metrics
	SkipPaths []string
	// SkipHealthCheck skips health check endpoints from metrics
	SkipHealthCheck bool
	// SkipMetricsEndpoint skips the /metrics endpoint from metrics
	SkipMetricsEndpoint bool
}

// DefaultMetricsConfig returns the default metrics configuration
func DefaultMetricsConfig() MetricsConfig {
	return MetricsConfig{
		SkipHealthCheck:     true,
		SkipMetricsEndpoint: true,
	}
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

	if config.SkipMetricsEndpoint {
		skipPaths["/metrics"] = true
	}

	return func(c *gin.Context) {
		m := monitoring.Get()
		if m == nil {
			c.Next()
			return
		}

		// Skip certain paths to avoid noise in metrics
		if skipPaths[c.Request.URL.Path] {
			c.Next()
			return
		}

		// Track in-flight requests
		m.IncrementInFlight()
		defer m.DecrementInFlight()

		// Record start time for response time tracking
		start := time.Now()

		// Process request
		c.Next()

		// Calculate duration in seconds
		duration := time.Since(start).Seconds()

		// Normalize path
		path := normalizePath(c.FullPath())
		if path == "" {
			path = normalizePath(c.Request.URL.Path)
		}

		// Get status code as string
		status := strconv.Itoa(c.Writer.Status())

		// Get response size
		responseSize := c.Writer.Size()
		if responseSize < 0 {
			responseSize = 0
		}

		// Record HTTP request metrics
		m.RecordHTTPRequest(c.Request.Method, path, status, duration, responseSize)
	}
}

// pathNormalizers contains regex patterns for normalizing paths
var pathNormalizers = []struct {
	pattern *regexp.Regexp
	replace string
}{
	// UUID pattern (e.g., /festivals/550e8400-e29b-41d4-a716-446655440000)
	{regexp.MustCompile(`/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`), "/:id"},
	// Numeric IDs (e.g., /users/123)
	{regexp.MustCompile(`/\d+`), "/:id"},
	// Short hash IDs (8-12 characters, e.g., /tickets/a1b2c3d4e5)
	{regexp.MustCompile(`/[a-zA-Z0-9]{8,12}(?:/|$)`), "/:id/"},
}

// normalizePath normalizes a path by replacing dynamic segments with placeholders
// This prevents high cardinality in metrics labels which can cause memory issues
func normalizePath(path string) string {
	if path == "" {
		return ""
	}

	// If the path already has Gin route parameters, use it as-is
	if hasRouteParams(path) {
		return path
	}

	// Apply normalizers to replace dynamic segments
	for _, n := range pathNormalizers {
		path = n.pattern.ReplaceAllString(path, n.replace)
	}

	// Clean up any trailing slash duplicates
	path = regexp.MustCompile(`/+`).ReplaceAllString(path, "/")

	return path
}

// hasRouteParams checks if a path contains Gin route parameters (e.g., :id, :festivalId)
func hasRouteParams(path string) bool {
	return regexp.MustCompile(`:[a-zA-Z]+`).MatchString(path)
}

// ResponseTimeTracker provides response time tracking utilities
type ResponseTimeTracker struct {
	startTime time.Time
}

// NewResponseTimeTracker creates a new response time tracker
func NewResponseTimeTracker() *ResponseTimeTracker {
	return &ResponseTimeTracker{
		startTime: time.Now(),
	}
}

// Elapsed returns the elapsed time in seconds since the tracker was created
func (r *ResponseTimeTracker) Elapsed() float64 {
	return time.Since(r.startTime).Seconds()
}

// ElapsedMilliseconds returns the elapsed time in milliseconds
func (r *ResponseTimeTracker) ElapsedMilliseconds() float64 {
	return float64(time.Since(r.startTime).Milliseconds())
}
