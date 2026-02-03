package monitoring

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds all Prometheus metrics for the application
type Metrics struct {
	// HTTP metrics
	HTTPRequestsTotal    *prometheus.CounterVec
	HTTPRequestDuration  *prometheus.HistogramVec
	HTTPRequestsInFlight prometheus.Gauge
	HTTPResponseSize     *prometheus.HistogramVec

	// Database metrics
	DBQueriesTotal    *prometheus.CounterVec
	DBQueryDuration   *prometheus.HistogramVec
	DBConnectionsOpen prometheus.Gauge
	DBConnectionsIdle prometheus.Gauge
	DBConnectionsUsed prometheus.Gauge
	DBErrors          *prometheus.CounterVec

	// Cache metrics
	CacheHitsTotal    *prometheus.CounterVec
	CacheMissesTotal  *prometheus.CounterVec
	CacheHitRatio     *prometheus.GaugeVec
	CacheOperations   *prometheus.CounterVec
	CacheLatency      *prometheus.HistogramVec

	// Business metrics
	TransactionsTotal   *prometheus.CounterVec
	TransactionAmount   *prometheus.HistogramVec
	WalletsCreated      prometheus.Counter
	WalletsActive       prometheus.Gauge
	TicketsIssued       *prometheus.CounterVec
	TicketsScanned      *prometheus.CounterVec
	ActiveFestivals     prometheus.Gauge
	FestivalAttendees   *prometheus.GaugeVec

	// Error metrics
	ErrorsTotal *prometheus.CounterVec

	// Custom registry
	Registry *prometheus.Registry

	// Internal counters for hit ratio calculation
	hitCounts  map[string]float64
	missCounts map[string]float64
	mu         sync.RWMutex
}

var (
	globalMetrics *Metrics
	once          sync.Once
)

// NewMetrics creates and registers all Prometheus metrics
func NewMetrics(namespace string) *Metrics {
	registry := prometheus.NewRegistry()

	// Register default collectors
	registry.MustRegister(prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}))
	registry.MustRegister(prometheus.NewGoCollector())

	m := &Metrics{
		Registry:   registry,
		hitCounts:  make(map[string]float64),
		missCounts: make(map[string]float64),

		// HTTP metrics
		HTTPRequestsTotal: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "http_requests_total",
				Help:      "Total number of HTTP requests processed",
			},
			[]string{"method", "path", "status"},
		),

		HTTPRequestDuration: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "http_request_duration_seconds",
				Help:      "HTTP request duration in seconds",
				Buckets:   []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
			},
			[]string{"method", "path"},
		),

		HTTPRequestsInFlight: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "http_requests_in_flight",
				Help:      "Number of HTTP requests currently being processed",
			},
		),

		HTTPResponseSize: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "http_response_size_bytes",
				Help:      "Size of HTTP responses in bytes",
				Buckets:   prometheus.ExponentialBuckets(100, 10, 8), // 100B to 10GB
			},
			[]string{"method", "path"},
		),

		// Database metrics
		DBQueriesTotal: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "db_queries_total",
				Help:      "Total number of database queries executed",
			},
			[]string{"operation", "table", "status"},
		),

		DBQueryDuration: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "db_query_duration_seconds",
				Help:      "Duration of database queries in seconds",
				Buckets:   []float64{.0005, .001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5},
			},
			[]string{"operation", "table"},
		),

		DBConnectionsOpen: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "db_connections_open",
				Help:      "Number of open database connections",
			},
		),

		DBConnectionsIdle: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "db_connections_idle",
				Help:      "Number of idle database connections",
			},
		),

		DBConnectionsUsed: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "db_connections_in_use",
				Help:      "Number of database connections currently in use",
			},
		),

		DBErrors: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "db_errors_total",
				Help:      "Total number of database errors",
			},
			[]string{"operation", "error_type"},
		),

		// Cache metrics
		CacheHitsTotal: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "cache_hits_total",
				Help:      "Total number of cache hits",
			},
			[]string{"cache_name"},
		),

		CacheMissesTotal: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "cache_misses_total",
				Help:      "Total number of cache misses",
			},
			[]string{"cache_name"},
		),

		CacheHitRatio: promauto.With(registry).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "cache_hit_ratio",
				Help:      "Cache hit ratio (hits / (hits + misses))",
			},
			[]string{"cache_name"},
		),

		CacheOperations: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "cache_operations_total",
				Help:      "Total number of cache operations",
			},
			[]string{"cache_name", "operation", "status"},
		),

		CacheLatency: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "cache_operation_duration_seconds",
				Help:      "Duration of cache operations in seconds",
				Buckets:   []float64{.0001, .0005, .001, .005, .01, .025, .05, .1},
			},
			[]string{"cache_name", "operation"},
		),

		// Business metrics
		TransactionsTotal: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "transactions_total",
				Help:      "Total number of transactions",
			},
			[]string{"festival_id", "type", "status"},
		),

		TransactionAmount: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "transaction_amount_cents",
				Help:      "Transaction amounts in cents",
				Buckets:   []float64{100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000},
			},
			[]string{"festival_id", "type"},
		),

		WalletsCreated: promauto.With(registry).NewCounter(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "wallets_created_total",
				Help:      "Total number of wallets created",
			},
		),

		WalletsActive: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "wallets_active",
				Help:      "Number of currently active wallets",
			},
		),

		TicketsIssued: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "tickets_issued_total",
				Help:      "Total number of tickets issued",
			},
			[]string{"festival_id", "ticket_type"},
		),

		TicketsScanned: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "tickets_scanned_total",
				Help:      "Total number of tickets scanned",
			},
			[]string{"festival_id", "scan_type"},
		),

		ActiveFestivals: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "festivals_active",
				Help:      "Number of currently active festivals",
			},
		),

		FestivalAttendees: promauto.With(registry).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "festival_attendees_current",
				Help:      "Current number of attendees per festival",
			},
			[]string{"festival_id"},
		),

		// Error metrics
		ErrorsTotal: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "errors_total",
				Help:      "Total number of errors by type and operation",
			},
			[]string{"type", "operation"},
		),
	}

	return m
}

// Init initializes the global metrics instance (thread-safe singleton)
func Init(namespace string) *Metrics {
	once.Do(func() {
		globalMetrics = NewMetrics(namespace)
	})
	return globalMetrics
}

// Get returns the global metrics instance
func Get() *Metrics {
	return globalMetrics
}

// RecordHTTPRequest records metrics for an HTTP request
func (m *Metrics) RecordHTTPRequest(method, path, status string, duration float64, responseSize int) {
	m.HTTPRequestsTotal.WithLabelValues(method, path, status).Inc()
	m.HTTPRequestDuration.WithLabelValues(method, path).Observe(duration)
	m.HTTPResponseSize.WithLabelValues(method, path).Observe(float64(responseSize))
}

// IncrementInFlight increments the in-flight requests gauge
func (m *Metrics) IncrementInFlight() {
	m.HTTPRequestsInFlight.Inc()
}

// DecrementInFlight decrements the in-flight requests gauge
func (m *Metrics) DecrementInFlight() {
	m.HTTPRequestsInFlight.Dec()
}

// RecordDBQuery records metrics for a database query
func (m *Metrics) RecordDBQuery(operation, table, status string, duration float64) {
	m.DBQueriesTotal.WithLabelValues(operation, table, status).Inc()
	m.DBQueryDuration.WithLabelValues(operation, table).Observe(duration)
}

// RecordDBError records a database error
func (m *Metrics) RecordDBError(operation, errorType string) {
	m.DBErrors.WithLabelValues(operation, errorType).Inc()
}

// SetDBConnections sets the current database connection pool stats
func (m *Metrics) SetDBConnections(open, idle, inUse float64) {
	m.DBConnectionsOpen.Set(open)
	m.DBConnectionsIdle.Set(idle)
	m.DBConnectionsUsed.Set(inUse)
}

// RecordCacheHit records a cache hit and updates the hit ratio
func (m *Metrics) RecordCacheHit(cacheName string) {
	m.CacheHitsTotal.WithLabelValues(cacheName).Inc()
	m.updateCacheHitRatio(cacheName, true)
}

// RecordCacheMiss records a cache miss and updates the hit ratio
func (m *Metrics) RecordCacheMiss(cacheName string) {
	m.CacheMissesTotal.WithLabelValues(cacheName).Inc()
	m.updateCacheHitRatio(cacheName, false)
}

// updateCacheHitRatio updates the hit ratio for a cache
func (m *Metrics) updateCacheHitRatio(cacheName string, hit bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if hit {
		m.hitCounts[cacheName]++
	} else {
		m.missCounts[cacheName]++
	}

	hits := m.hitCounts[cacheName]
	misses := m.missCounts[cacheName]
	total := hits + misses

	if total > 0 {
		m.CacheHitRatio.WithLabelValues(cacheName).Set(hits / total)
	}
}

// RecordCacheOperation records a cache operation with status and latency
func (m *Metrics) RecordCacheOperation(cacheName, operation, status string, duration float64) {
	m.CacheOperations.WithLabelValues(cacheName, operation, status).Inc()
	m.CacheLatency.WithLabelValues(cacheName, operation).Observe(duration)
}

// GetCacheHitRatio returns the current hit ratio for a cache
func (m *Metrics) GetCacheHitRatio(cacheName string) float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()

	hits := m.hitCounts[cacheName]
	misses := m.missCounts[cacheName]
	total := hits + misses

	if total == 0 {
		return 0
	}
	return hits / total
}

// RecordTransaction records a transaction
func (m *Metrics) RecordTransaction(festivalID, transactionType, status string, amount float64) {
	m.TransactionsTotal.WithLabelValues(festivalID, transactionType, status).Inc()
	m.TransactionAmount.WithLabelValues(festivalID, transactionType).Observe(amount)
}

// RecordWalletCreated records a new wallet creation
func (m *Metrics) RecordWalletCreated() {
	m.WalletsCreated.Inc()
}

// SetActiveWallets sets the current number of active wallets
func (m *Metrics) SetActiveWallets(count float64) {
	m.WalletsActive.Set(count)
}

// RecordTicketIssued records a ticket being issued
func (m *Metrics) RecordTicketIssued(festivalID, ticketType string) {
	m.TicketsIssued.WithLabelValues(festivalID, ticketType).Inc()
}

// RecordTicketScanned records a ticket being scanned
func (m *Metrics) RecordTicketScanned(festivalID, scanType string) {
	m.TicketsScanned.WithLabelValues(festivalID, scanType).Inc()
}

// SetActiveFestivals sets the current number of active festivals
func (m *Metrics) SetActiveFestivals(count float64) {
	m.ActiveFestivals.Set(count)
}

// SetFestivalAttendees sets the current number of attendees for a festival
func (m *Metrics) SetFestivalAttendees(festivalID string, count float64) {
	m.FestivalAttendees.WithLabelValues(festivalID).Set(count)
}

// RecordError records an error
func (m *Metrics) RecordError(errorType, operation string) {
	m.ErrorsTotal.WithLabelValues(errorType, operation).Inc()
}
