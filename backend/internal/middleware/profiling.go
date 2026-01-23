package middleware

import (
	"database/sql"
	"runtime"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/profiling"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/rs/zerolog/log"
)

// ProfilingConfig holds configuration for the profiling middleware
type ProfilingConfig struct {
	// EnableMemoryTracking enables memory allocation tracking
	EnableMemoryTracking bool
	// EnableGoroutineTracking enables goroutine count monitoring
	EnableGoroutineTracking bool
	// EnableDBQueryTiming enables database query timing
	EnableDBQueryTiming bool
	// SlowRequestThreshold is the threshold for logging slow requests
	SlowRequestThreshold time.Duration
	// SamplingRate is the rate at which to sample requests (0.0-1.0)
	SamplingRate float64
	// Namespace for prometheus metrics
	Namespace string
}

// DefaultProfilingConfig returns the default profiling configuration
func DefaultProfilingConfig() ProfilingConfig {
	return ProfilingConfig{
		EnableMemoryTracking:    true,
		EnableGoroutineTracking: true,
		EnableDBQueryTiming:     true,
		SlowRequestThreshold:    500 * time.Millisecond,
		SamplingRate:            1.0,
		Namespace:               "festivals",
	}
}

// RequestMetrics holds metrics for a single request
type RequestMetrics struct {
	StartTime          time.Time
	EndTime            time.Time
	Duration           time.Duration
	MemoryAllocBefore  uint64
	MemoryAllocAfter   uint64
	MemoryAllocDelta   int64
	GoroutinesBefore   int
	GoroutinesAfter    int
	GoroutinesDelta    int
	DBQueryCount       int
	DBQueryTotalTime   time.Duration
	Path               string
	Method             string
	StatusCode         int
	ResponseSize       int
	RequestID          string
}

// ProfilingMiddleware provides request profiling capabilities
type ProfilingMiddleware struct {
	config           ProfilingConfig
	metrics          *profiling.PerformanceMetrics
	activeRequests   int64
	sampleCounter    uint64
	dbQueryCallbacks []func(duration time.Duration, query string)
	mu               sync.RWMutex
}

// NewProfilingMiddleware creates a new profiling middleware
func NewProfilingMiddleware(config ProfilingConfig, registry *prometheus.Registry) *ProfilingMiddleware {
	metrics := profiling.InitPerformanceMetrics(config.Namespace, registry)
	return &ProfilingMiddleware{
		config:  config,
		metrics: metrics,
	}
}

// RequestTiming returns middleware that tracks request timing
func (pm *ProfilingMiddleware) RequestTiming() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Increment active requests
		atomic.AddInt64(&pm.activeRequests, 1)
		pm.metrics.IncrementActiveConnections()

		// Initialize request metrics
		reqMetrics := &RequestMetrics{
			StartTime: time.Now(),
			Path:      c.FullPath(),
			Method:    c.Request.Method,
			RequestID: c.GetString("request_id"),
		}

		// Track memory before if enabled
		if pm.config.EnableMemoryTracking {
			var memStats runtime.MemStats
			runtime.ReadMemStats(&memStats)
			reqMetrics.MemoryAllocBefore = memStats.TotalAlloc
		}

		// Track goroutines before if enabled
		if pm.config.EnableGoroutineTracking {
			reqMetrics.GoroutinesBefore = runtime.NumGoroutine()
		}

		// Store metrics in context
		c.Set("request_metrics", reqMetrics)

		// Process request
		c.Next()

		// Calculate duration
		reqMetrics.EndTime = time.Now()
		reqMetrics.Duration = reqMetrics.EndTime.Sub(reqMetrics.StartTime)
		reqMetrics.StatusCode = c.Writer.Status()
		reqMetrics.ResponseSize = c.Writer.Size()

		// Track memory after if enabled
		if pm.config.EnableMemoryTracking {
			var memStats runtime.MemStats
			runtime.ReadMemStats(&memStats)
			reqMetrics.MemoryAllocAfter = memStats.TotalAlloc
			reqMetrics.MemoryAllocDelta = int64(reqMetrics.MemoryAllocAfter - reqMetrics.MemoryAllocBefore)
		}

		// Track goroutines after if enabled
		if pm.config.EnableGoroutineTracking {
			reqMetrics.GoroutinesAfter = runtime.NumGoroutine()
			reqMetrics.GoroutinesDelta = reqMetrics.GoroutinesAfter - reqMetrics.GoroutinesBefore
		}

		// Record metrics
		path := reqMetrics.Path
		if path == "" {
			path = c.Request.URL.Path
		}
		status := strconv.Itoa(reqMetrics.StatusCode)
		pm.metrics.RecordRequestLatency(reqMetrics.Method, path, status, reqMetrics.Duration)

		// Record errors
		if reqMetrics.StatusCode >= 400 {
			errorType := "client_error"
			if reqMetrics.StatusCode >= 500 {
				errorType = "server_error"
			}
			pm.metrics.RecordError(reqMetrics.Method, path, errorType)
		}

		// Log slow requests
		if reqMetrics.Duration >= pm.config.SlowRequestThreshold {
			log.Warn().
				Str("method", reqMetrics.Method).
				Str("path", path).
				Dur("duration", reqMetrics.Duration).
				Int("status", reqMetrics.StatusCode).
				Str("request_id", reqMetrics.RequestID).
				Int64("memory_alloc_delta", reqMetrics.MemoryAllocDelta).
				Int("goroutines_delta", reqMetrics.GoroutinesDelta).
				Msg("Slow request detected")
		}

		// Decrement active requests
		atomic.AddInt64(&pm.activeRequests, -1)
		pm.metrics.DecrementActiveConnections()
	}
}

// MemoryTracking returns middleware that tracks memory allocations
func (pm *ProfilingMiddleware) MemoryTracking() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !pm.config.EnableMemoryTracking {
			c.Next()
			return
		}

		var memStatsBefore runtime.MemStats
		runtime.ReadMemStats(&memStatsBefore)

		c.Next()

		var memStatsAfter runtime.MemStats
		runtime.ReadMemStats(&memStatsAfter)

		allocDelta := int64(memStatsAfter.TotalAlloc - memStatsBefore.TotalAlloc)
		heapAllocDelta := int64(memStatsAfter.HeapAlloc - memStatsBefore.HeapAlloc)
		mallocs := memStatsAfter.Mallocs - memStatsBefore.Mallocs

		// Store in context for later use
		c.Set("memory_alloc_delta", allocDelta)
		c.Set("heap_alloc_delta", heapAllocDelta)
		c.Set("mallocs", mallocs)

		// Log high memory allocations
		if allocDelta > 1024*1024 { // > 1MB
			log.Warn().
				Str("path", c.FullPath()).
				Int64("alloc_delta_bytes", allocDelta).
				Uint64("mallocs", mallocs).
				Msg("High memory allocation detected")
		}
	}
}

// GoroutineMonitor returns middleware that monitors goroutine count
func (pm *ProfilingMiddleware) GoroutineMonitor() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !pm.config.EnableGoroutineTracking {
			c.Next()
			return
		}

		goroutinesBefore := runtime.NumGoroutine()

		c.Next()

		goroutinesAfter := runtime.NumGoroutine()
		delta := goroutinesAfter - goroutinesBefore

		c.Set("goroutines_delta", delta)

		// Warn on goroutine leaks
		if delta > 10 {
			log.Warn().
				Str("path", c.FullPath()).
				Int("goroutines_before", goroutinesBefore).
				Int("goroutines_after", goroutinesAfter).
				Int("delta", delta).
				Msg("Possible goroutine leak detected")
		}
	}
}

// DBQueryContext holds query timing information
type DBQueryContext struct {
	mu         sync.Mutex
	queries    []QueryTiming
	totalTime  time.Duration
	queryCount int
}

// QueryTiming holds timing for a single query
type QueryTiming struct {
	Query    string
	Duration time.Duration
	Table    string
}

// DatabaseQueryTiming returns middleware that tracks database query timing
func (pm *ProfilingMiddleware) DatabaseQueryTiming() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !pm.config.EnableDBQueryTiming {
			c.Next()
			return
		}

		// Create query context for this request
		dbCtx := &DBQueryContext{
			queries: make([]QueryTiming, 0),
		}
		c.Set("db_query_context", dbCtx)

		c.Next()

		// Log slow queries
		for _, q := range dbCtx.queries {
			if q.Duration > 100*time.Millisecond {
				log.Warn().
					Str("path", c.FullPath()).
					Str("query", truncateQuery(q.Query, 200)).
					Dur("duration", q.Duration).
					Str("table", q.Table).
					Msg("Slow database query detected")
			}
		}

		// Store summary in context
		c.Set("db_query_count", dbCtx.queryCount)
		c.Set("db_query_total_time", dbCtx.totalTime)
	}
}

// RecordDBQuery records a database query for the current request
func RecordDBQuery(c *gin.Context, query string, duration time.Duration, table string) {
	val, exists := c.Get("db_query_context")
	if !exists {
		return
	}

	dbCtx, ok := val.(*DBQueryContext)
	if !ok {
		return
	}

	dbCtx.mu.Lock()
	defer dbCtx.mu.Unlock()

	dbCtx.queries = append(dbCtx.queries, QueryTiming{
		Query:    query,
		Duration: duration,
		Table:    table,
	})
	dbCtx.totalTime += duration
	dbCtx.queryCount++

	// Record in performance metrics
	if metrics := profiling.GetPerformanceMetrics(); metrics != nil {
		metrics.RecordDBQuery("query", table, duration)
	}
}

// GetActiveRequests returns the current number of active requests
func (pm *ProfilingMiddleware) GetActiveRequests() int64 {
	return atomic.LoadInt64(&pm.activeRequests)
}

// DBStatsCollector collects database pool statistics
type DBStatsCollector struct {
	db       *sql.DB
	metrics  *profiling.PerformanceMetrics
	interval time.Duration
	stopCh   chan struct{}
}

// NewDBStatsCollector creates a new database stats collector
func NewDBStatsCollector(db *sql.DB, metrics *profiling.PerformanceMetrics, interval time.Duration) *DBStatsCollector {
	return &DBStatsCollector{
		db:       db,
		metrics:  metrics,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins collecting database statistics
func (c *DBStatsCollector) Start() {
	go func() {
		ticker := time.NewTicker(c.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				stats := c.db.Stats()
				c.metrics.UpdateDBPoolStats(
					stats.MaxOpenConnections,
					stats.InUse,
					stats.Idle,
					stats.WaitCount,
					stats.WaitDuration,
				)
			case <-c.stopCh:
				return
			}
		}
	}()
}

// Stop stops the database stats collector
func (c *DBStatsCollector) Stop() {
	close(c.stopCh)
}

// ResponseCompression returns middleware that adds response compression info
func ResponseCompression() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Track original response size
		c.Next()

		// Log compression effectiveness
		if c.Writer.Size() > 1024 {
			acceptEncoding := c.Request.Header.Get("Accept-Encoding")
			contentEncoding := c.Writer.Header().Get("Content-Encoding")
			log.Debug().
				Str("path", c.FullPath()).
				Int("response_size", c.Writer.Size()).
				Str("accept_encoding", acceptEncoding).
				Str("content_encoding", contentEncoding).
				Msg("Response compression info")
		}
	}
}

// truncateQuery truncates a query string to the specified length
func truncateQuery(query string, maxLen int) string {
	if len(query) <= maxLen {
		return query
	}
	return query[:maxLen] + "..."
}

// RequestMetricsFromContext extracts request metrics from the context
func RequestMetricsFromContext(c *gin.Context) *RequestMetrics {
	val, exists := c.Get("request_metrics")
	if !exists {
		return nil
	}
	metrics, ok := val.(*RequestMetrics)
	if !ok {
		return nil
	}
	return metrics
}

// ConcurrentRequestLimiter limits concurrent requests
type ConcurrentRequestLimiter struct {
	maxConcurrent int64
	current       int64
}

// NewConcurrentRequestLimiter creates a new concurrent request limiter
func NewConcurrentRequestLimiter(maxConcurrent int64) *ConcurrentRequestLimiter {
	return &ConcurrentRequestLimiter{
		maxConcurrent: maxConcurrent,
	}
}

// Limit returns middleware that limits concurrent requests
func (l *ConcurrentRequestLimiter) Limit() gin.HandlerFunc {
	return func(c *gin.Context) {
		current := atomic.AddInt64(&l.current, 1)
		defer atomic.AddInt64(&l.current, -1)

		if current > l.maxConcurrent {
			c.AbortWithStatusJSON(503, gin.H{
				"error":   "Service temporarily unavailable",
				"message": "Too many concurrent requests",
			})
			return
		}

		c.Next()
	}
}

// GetCurrent returns the current number of concurrent requests
func (l *ConcurrentRequestLimiter) GetCurrent() int64 {
	return atomic.LoadInt64(&l.current)
}
