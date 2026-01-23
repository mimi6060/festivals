package profiling

import (
	"runtime"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// PerformanceMetrics holds custom performance-related Prometheus metrics
type PerformanceMetrics struct {
	// Request latency histogram by endpoint
	RequestLatency *prometheus.HistogramVec

	// Active connections gauge
	ActiveConnections prometheus.Gauge

	// Cache hit rate
	CacheHitRate *prometheus.GaugeVec
	CacheHits    *prometheus.CounterVec
	CacheMisses  *prometheus.CounterVec

	// Error rate by endpoint
	ErrorRate *prometheus.CounterVec

	// Memory metrics
	HeapAlloc     prometheus.Gauge
	HeapInUse     prometheus.Gauge
	StackInUse    prometheus.Gauge
	NumGoroutines prometheus.Gauge
	NumGC         prometheus.Counter
	GCPauseTotal  prometheus.Counter

	// Database connection pool
	DBPoolSize      prometheus.Gauge
	DBPoolInUse     prometheus.Gauge
	DBPoolIdle      prometheus.Gauge
	DBWaitCount     prometheus.Counter
	DBWaitDuration  prometheus.Counter
	DBQueryDuration *prometheus.HistogramVec

	// Object pool metrics
	PoolAllocations   *prometheus.CounterVec
	PoolReuse         *prometheus.CounterVec
	PoolSize          *prometheus.GaugeVec
	PoolMisses        *prometheus.CounterVec

	// Batch processing metrics
	BatchSize     *prometheus.HistogramVec
	BatchDuration *prometheus.HistogramVec
	BatchErrors   *prometheus.CounterVec

	// Custom registry
	Registry *prometheus.Registry

	mu sync.Mutex
}

// NewPerformanceMetrics creates a new performance metrics instance
func NewPerformanceMetrics(namespace string, registry *prometheus.Registry) *PerformanceMetrics {
	if registry == nil {
		registry = prometheus.NewRegistry()
	}

	m := &PerformanceMetrics{
		Registry: registry,

		// Request latency histogram with detailed buckets for P50, P90, P99
		RequestLatency: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: "performance",
				Name:      "request_latency_seconds",
				Help:      "Request latency histogram by endpoint",
				Buckets:   []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
			},
			[]string{"method", "endpoint", "status"},
		),

		// Active connections
		ActiveConnections: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: "performance",
				Name:      "active_connections",
				Help:      "Number of active connections",
			},
		),

		// Cache hit rate tracking
		CacheHitRate: promauto.With(registry).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: "performance",
				Name:      "cache_hit_rate",
				Help:      "Cache hit rate (0-1)",
			},
			[]string{"cache_name"},
		),

		CacheHits: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "performance",
				Name:      "cache_hits_total",
				Help:      "Total cache hits",
			},
			[]string{"cache_name"},
		),

		CacheMisses: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "performance",
				Name:      "cache_misses_total",
				Help:      "Total cache misses",
			},
			[]string{"cache_name"},
		),

		// Error rate by endpoint
		ErrorRate: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "performance",
				Name:      "errors_total",
				Help:      "Total errors by endpoint",
			},
			[]string{"method", "endpoint", "error_type"},
		),

		// Memory metrics
		HeapAlloc: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: "runtime",
				Name:      "heap_alloc_bytes",
				Help:      "Current heap allocation in bytes",
			},
		),

		HeapInUse: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: "runtime",
				Name:      "heap_inuse_bytes",
				Help:      "Heap in use in bytes",
			},
		),

		StackInUse: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: "runtime",
				Name:      "stack_inuse_bytes",
				Help:      "Stack in use in bytes",
			},
		),

		NumGoroutines: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: "runtime",
				Name:      "goroutines",
				Help:      "Number of goroutines",
			},
		),

		NumGC: promauto.With(registry).NewCounter(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "runtime",
				Name:      "gc_cycles_total",
				Help:      "Total number of GC cycles",
			},
		),

		GCPauseTotal: promauto.With(registry).NewCounter(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "runtime",
				Name:      "gc_pause_total_nanoseconds",
				Help:      "Total GC pause time in nanoseconds",
			},
		),

		// Database pool metrics
		DBPoolSize: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: "db",
				Name:      "pool_size",
				Help:      "Database connection pool size",
			},
		),

		DBPoolInUse: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: "db",
				Name:      "pool_in_use",
				Help:      "Database connections in use",
			},
		),

		DBPoolIdle: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: "db",
				Name:      "pool_idle",
				Help:      "Idle database connections",
			},
		),

		DBWaitCount: promauto.With(registry).NewCounter(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "db",
				Name:      "pool_wait_count_total",
				Help:      "Total number of connection wait events",
			},
		),

		DBWaitDuration: promauto.With(registry).NewCounter(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "db",
				Name:      "pool_wait_duration_nanoseconds",
				Help:      "Total wait time for connections in nanoseconds",
			},
		),

		DBQueryDuration: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: "db",
				Name:      "query_duration_seconds",
				Help:      "Database query duration in seconds",
				Buckets:   []float64{.0001, .0005, .001, .005, .01, .025, .05, .1, .25, .5, 1},
			},
			[]string{"operation", "table"},
		),

		// Object pool metrics
		PoolAllocations: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "pool",
				Name:      "allocations_total",
				Help:      "Total new allocations from pool",
			},
			[]string{"pool_name"},
		),

		PoolReuse: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "pool",
				Name:      "reuse_total",
				Help:      "Total reuse from pool",
			},
			[]string{"pool_name"},
		),

		PoolSize: promauto.With(registry).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: "pool",
				Name:      "size",
				Help:      "Current pool size",
			},
			[]string{"pool_name"},
		),

		PoolMisses: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "pool",
				Name:      "misses_total",
				Help:      "Total pool misses (had to allocate)",
			},
			[]string{"pool_name"},
		),

		// Batch processing metrics
		BatchSize: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: "batch",
				Name:      "size",
				Help:      "Batch size distribution",
				Buckets:   []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000},
			},
			[]string{"batch_name"},
		),

		BatchDuration: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: "batch",
				Name:      "duration_seconds",
				Help:      "Batch processing duration in seconds",
				Buckets:   []float64{.01, .05, .1, .25, .5, 1, 2.5, 5, 10},
			},
			[]string{"batch_name"},
		),

		BatchErrors: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "batch",
				Name:      "errors_total",
				Help:      "Total batch processing errors",
			},
			[]string{"batch_name"},
		),
	}

	return m
}

// RecordRequestLatency records request latency
func (m *PerformanceMetrics) RecordRequestLatency(method, endpoint, status string, duration time.Duration) {
	m.RequestLatency.WithLabelValues(method, endpoint, status).Observe(duration.Seconds())
}

// IncrementActiveConnections increments active connections
func (m *PerformanceMetrics) IncrementActiveConnections() {
	m.ActiveConnections.Inc()
}

// DecrementActiveConnections decrements active connections
func (m *PerformanceMetrics) DecrementActiveConnections() {
	m.ActiveConnections.Dec()
}

// RecordCacheHit records a cache hit
func (m *PerformanceMetrics) RecordCacheHit(cacheName string) {
	m.CacheHits.WithLabelValues(cacheName).Inc()
}

// RecordCacheMiss records a cache miss
func (m *PerformanceMetrics) RecordCacheMiss(cacheName string) {
	m.CacheMisses.WithLabelValues(cacheName).Inc()
}

// UpdateCacheHitRate updates the cache hit rate
func (m *PerformanceMetrics) UpdateCacheHitRate(cacheName string, hitRate float64) {
	m.CacheHitRate.WithLabelValues(cacheName).Set(hitRate)
}

// RecordError records an error
func (m *PerformanceMetrics) RecordError(method, endpoint, errorType string) {
	m.ErrorRate.WithLabelValues(method, endpoint, errorType).Inc()
}

// RecordDBQuery records database query timing
func (m *PerformanceMetrics) RecordDBQuery(operation, table string, duration time.Duration) {
	m.DBQueryDuration.WithLabelValues(operation, table).Observe(duration.Seconds())
}

// UpdateDBPoolStats updates database pool statistics
func (m *PerformanceMetrics) UpdateDBPoolStats(size, inUse, idle int, waitCount int64, waitDuration time.Duration) {
	m.DBPoolSize.Set(float64(size))
	m.DBPoolInUse.Set(float64(inUse))
	m.DBPoolIdle.Set(float64(idle))
	m.DBWaitCount.Add(float64(waitCount))
	m.DBWaitDuration.Add(float64(waitDuration.Nanoseconds()))
}

// RecordPoolAllocation records a pool allocation
func (m *PerformanceMetrics) RecordPoolAllocation(poolName string) {
	m.PoolAllocations.WithLabelValues(poolName).Inc()
}

// RecordPoolReuse records a pool reuse
func (m *PerformanceMetrics) RecordPoolReuse(poolName string) {
	m.PoolReuse.WithLabelValues(poolName).Inc()
}

// RecordPoolMiss records a pool miss
func (m *PerformanceMetrics) RecordPoolMiss(poolName string) {
	m.PoolMisses.WithLabelValues(poolName).Inc()
}

// UpdatePoolSize updates the pool size
func (m *PerformanceMetrics) UpdatePoolSize(poolName string, size int) {
	m.PoolSize.WithLabelValues(poolName).Set(float64(size))
}

// RecordBatch records batch processing metrics
func (m *PerformanceMetrics) RecordBatch(batchName string, size int, duration time.Duration, err error) {
	m.BatchSize.WithLabelValues(batchName).Observe(float64(size))
	m.BatchDuration.WithLabelValues(batchName).Observe(duration.Seconds())
	if err != nil {
		m.BatchErrors.WithLabelValues(batchName).Inc()
	}
}

// CollectRuntimeMetrics collects runtime memory statistics
func (m *PerformanceMetrics) CollectRuntimeMetrics() {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	m.HeapAlloc.Set(float64(memStats.HeapAlloc))
	m.HeapInUse.Set(float64(memStats.HeapInuse))
	m.StackInUse.Set(float64(memStats.StackInuse))
	m.NumGoroutines.Set(float64(runtime.NumGoroutine()))
}

// StartRuntimeCollector starts a goroutine that periodically collects runtime metrics
func (m *PerformanceMetrics) StartRuntimeCollector(interval time.Duration, stopCh <-chan struct{}) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				m.CollectRuntimeMetrics()
			case <-stopCh:
				return
			}
		}
	}()
}

// Global performance metrics instance
var globalPerfMetrics *PerformanceMetrics
var perfMetricsOnce sync.Once

// InitPerformanceMetrics initializes the global performance metrics
func InitPerformanceMetrics(namespace string, registry *prometheus.Registry) *PerformanceMetrics {
	perfMetricsOnce.Do(func() {
		globalPerfMetrics = NewPerformanceMetrics(namespace, registry)
	})
	return globalPerfMetrics
}

// GetPerformanceMetrics returns the global performance metrics instance
func GetPerformanceMetrics() *PerformanceMetrics {
	return globalPerfMetrics
}

// Timer is a helper for timing operations
type Timer struct {
	start time.Time
}

// NewTimer creates a new timer
func NewTimer() *Timer {
	return &Timer{start: time.Now()}
}

// Elapsed returns the elapsed time
func (t *Timer) Elapsed() time.Duration {
	return time.Since(t.start)
}

// ElapsedSeconds returns the elapsed time in seconds
func (t *Timer) ElapsedSeconds() float64 {
	return t.Elapsed().Seconds()
}
