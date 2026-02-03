package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds all Prometheus metrics for the application
type Metrics struct {
	// HTTP metrics
	RequestsTotal    *prometheus.CounterVec
	RequestDuration  *prometheus.HistogramVec
	RequestsInFlight prometheus.Gauge
	ResponseSize     *prometheus.HistogramVec

	// Database metrics
	DBQueriesTotal   *prometheus.CounterVec
	DBQueryDuration  *prometheus.HistogramVec
	DBConnectionsOpen prometheus.Gauge

	// Cache metrics
	CacheHits   *prometheus.CounterVec
	CacheMisses *prometheus.CounterVec

	// Business metrics
	TransactionsTotal       *prometheus.CounterVec
	TransactionAmount       *prometheus.HistogramVec
	WalletsCreated          prometheus.Counter
	WalletsActive           prometheus.Gauge
	TicketsIssued           *prometheus.CounterVec
	TicketsScanned          *prometheus.CounterVec
	ActiveFestivals         prometheus.Gauge
	FestivalAttendees       *prometheus.GaugeVec

	// Error metrics
	ErrorsTotal *prometheus.CounterVec

	// Custom registry
	Registry *prometheus.Registry
}

// NewMetrics creates and registers all metrics
func NewMetrics(namespace string) *Metrics {
	registry := prometheus.NewRegistry()

	// Register default collectors
	registry.MustRegister(prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}))
	registry.MustRegister(prometheus.NewGoCollector())

	m := &Metrics{
		Registry: registry,

		// HTTP metrics
		RequestsTotal: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "http_requests_total",
				Help:      "Total number of HTTP requests",
			},
			[]string{"method", "path", "status"},
		),

		RequestDuration: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "http_request_duration_seconds",
				Help:      "Duration of HTTP requests in seconds",
				Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
			},
			[]string{"method", "path"},
		),

		RequestsInFlight: promauto.With(registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "http_requests_in_flight",
				Help:      "Number of HTTP requests currently being processed",
			},
		),

		ResponseSize: promauto.With(registry).NewHistogramVec(
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
				Help:      "Total number of database queries",
			},
			[]string{"operation", "table"},
		),

		DBQueryDuration: promauto.With(registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Name:      "db_query_duration_seconds",
				Help:      "Duration of database queries in seconds",
				Buckets:   []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5},
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

		// Cache metrics
		CacheHits: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "cache_hits_total",
				Help:      "Total number of cache hits",
			},
			[]string{"cache_name"},
		),

		CacheMisses: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "cache_misses_total",
				Help:      "Total number of cache misses",
			},
			[]string{"cache_name"},
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
				Name:      "transaction_amount",
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
				Help:      "Number of active wallets",
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
				Help:      "Number of active festivals",
			},
		),

		FestivalAttendees: promauto.With(registry).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Name:      "festival_attendees",
				Help:      "Number of current attendees per festival",
			},
			[]string{"festival_id"},
		),

		// Error metrics
		ErrorsTotal: promauto.With(registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Name:      "errors_total",
				Help:      "Total number of errors",
			},
			[]string{"type", "operation"},
		),
	}

	return m
}

// RecordHTTPRequest records metrics for an HTTP request
func (m *Metrics) RecordHTTPRequest(method, path, status string, duration float64, responseSize int) {
	m.RequestsTotal.WithLabelValues(method, path, status).Inc()
	m.RequestDuration.WithLabelValues(method, path).Observe(duration)
	m.ResponseSize.WithLabelValues(method, path).Observe(float64(responseSize))
}

// RecordDBQuery records metrics for a database query
func (m *Metrics) RecordDBQuery(operation, table string, duration float64) {
	m.DBQueriesTotal.WithLabelValues(operation, table).Inc()
	m.DBQueryDuration.WithLabelValues(operation, table).Observe(duration)
}

// RecordCacheHit records a cache hit
func (m *Metrics) RecordCacheHit(cacheName string) {
	m.CacheHits.WithLabelValues(cacheName).Inc()
}

// RecordCacheMiss records a cache miss
func (m *Metrics) RecordCacheMiss(cacheName string) {
	m.CacheMisses.WithLabelValues(cacheName).Inc()
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

// IncrementInFlight increments the in-flight requests gauge
func (m *Metrics) IncrementInFlight() {
	m.RequestsInFlight.Inc()
}

// DecrementInFlight decrements the in-flight requests gauge
func (m *Metrics) DecrementInFlight() {
	m.RequestsInFlight.Dec()
}

// SetDBConnections sets the current number of open database connections
func (m *Metrics) SetDBConnections(count float64) {
	m.DBConnectionsOpen.Set(count)
}

// Global metrics instance
var globalMetrics *Metrics

// Init initializes the global metrics instance
func Init(namespace string) *Metrics {
	globalMetrics = NewMetrics(namespace)
	return globalMetrics
}

// Get returns the global metrics instance
func Get() *Metrics {
	return globalMetrics
}
