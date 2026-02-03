package monitoring

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Handler handles metrics and monitoring HTTP endpoints
type Handler struct {
	metrics      *Metrics
	alertManager *BusinessAlertManager
	sloTracker   *SLOTracker
	thresholds   *AlertThresholdManager
}

// NewHandler creates a new monitoring handler
func NewHandler(metrics *Metrics, alertManager *BusinessAlertManager, sloTracker *SLOTracker, thresholds *AlertThresholdManager) *Handler {
	return &Handler{
		metrics:      metrics,
		alertManager: alertManager,
		sloTracker:   sloTracker,
		thresholds:   thresholds,
	}
}

// RegisterRoutes registers monitoring routes
func (h *Handler) RegisterRoutes(router *gin.Engine) {
	// Prometheus metrics endpoint
	router.GET("/metrics", h.prometheusHandler())

	// Monitoring API endpoints
	monitoring := router.Group("/api/v1/monitoring")
	{
		// Alerts
		monitoring.GET("/alerts", h.GetActiveAlerts)
		monitoring.GET("/alerts/history", h.GetAlertHistory)
		monitoring.GET("/alerts/rules", h.GetAlertRules)
		monitoring.GET("/alerts/rules/:name", h.GetAlertRuleStatus)
		monitoring.POST("/alerts/:name/silence", h.SilenceAlert)
		monitoring.DELETE("/alerts/:name/silence", h.UnsilenceAlert)

		// SLOs
		monitoring.GET("/slos", h.GetSLOs)
		monitoring.GET("/slos/:name", h.GetSLOStatus)

		// Thresholds
		monitoring.GET("/thresholds", h.GetThresholds)
		monitoring.PUT("/thresholds/:name", h.UpdateThreshold)

		// Metrics summary
		monitoring.GET("/summary", h.GetMetricsSummary)
	}
}

// prometheusHandler returns the Prometheus metrics handler
func (h *Handler) prometheusHandler() gin.HandlerFunc {
	handler := promhttp.HandlerFor(h.metrics.Registry, promhttp.HandlerOpts{
		EnableOpenMetrics:   true,
		MaxRequestsInFlight: 10,
		Timeout:             30 * time.Second,
	})

	return func(c *gin.Context) {
		handler.ServeHTTP(c.Writer, c.Request)
	}
}

// GetActiveAlerts returns all currently active alerts
func (h *Handler) GetActiveAlerts(c *gin.Context) {
	if h.alertManager == nil {
		c.JSON(http.StatusOK, gin.H{"alerts": []interface{}{}})
		return
	}

	alerts := h.alertManager.GetActiveAlerts()
	c.JSON(http.StatusOK, gin.H{"alerts": alerts})
}

// GetAlertHistory returns the alert history
func (h *Handler) GetAlertHistory(c *gin.Context) {
	if h.alertManager == nil {
		c.JSON(http.StatusOK, gin.H{"history": []interface{}{}})
		return
	}

	limit := 100
	if l := c.Query("limit"); l != "" {
		// Parse limit from query string
	}

	history := h.alertManager.GetAlertHistory(limit)
	c.JSON(http.StatusOK, gin.H{"history": history})
}

// GetAlertRules returns all registered alert rules
func (h *Handler) GetAlertRules(c *gin.Context) {
	// Return list of rule names and their status
	c.JSON(http.StatusOK, gin.H{
		"rules": []map[string]interface{}{
			{"name": "HighFailedTransactionRate", "severity": "critical", "team": "business"},
			{"name": "HighInsufficientBalanceRate", "severity": "warning", "team": "business"},
			{"name": "HighTicketScanFailureRate", "severity": "warning", "team": "operations"},
			{"name": "SuspiciousWalletCreationRate", "severity": "warning", "team": "security"},
			{"name": "RevenueDropAlert", "severity": "warning", "team": "business"},
			{"name": "NoTransactionsDuringFestival", "severity": "warning", "team": "business"},
		},
	})
}

// GetAlertRuleStatus returns the status of a specific alert rule
func (h *Handler) GetAlertRuleStatus(c *gin.Context) {
	name := c.Param("name")
	if h.alertManager == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert rule not found"})
		return
	}

	status := h.alertManager.GetRuleStatus(name)
	if status == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alert rule not found"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// SilenceRequest represents a request to silence an alert
type SilenceRequest struct {
	Duration string `json:"duration" binding:"required"`
	Reason   string `json:"reason"`
}

// SilenceAlert silences an alert for a specified duration
func (h *Handler) SilenceAlert(c *gin.Context) {
	name := c.Param("name")

	var req SilenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	duration, err := time.ParseDuration(req.Duration)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid duration format"})
		return
	}

	if h.alertManager != nil {
		h.alertManager.Silence(name, duration)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Alert silenced",
		"alertname":     name,
		"silenced_for":  req.Duration,
		"silenced_until": time.Now().Add(duration).Format(time.RFC3339),
	})
}

// UnsilenceAlert removes a silence for an alert
func (h *Handler) UnsilenceAlert(c *gin.Context) {
	name := c.Param("name")

	if h.alertManager != nil {
		h.alertManager.Unsilence(name)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Alert unsilenced",
		"alertname": name,
	})
}

// GetSLOs returns all SLO definitions
func (h *Handler) GetSLOs(c *gin.Context) {
	if h.sloTracker == nil {
		c.JSON(http.StatusOK, gin.H{"slos": []interface{}{}})
		return
	}

	slos := h.sloTracker.GetAllSLOs()
	c.JSON(http.StatusOK, gin.H{"slos": slos})
}

// GetSLOStatus returns the status of a specific SLO
func (h *Handler) GetSLOStatus(c *gin.Context) {
	name := c.Param("name")
	if h.sloTracker == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SLO not found"})
		return
	}

	status := h.sloTracker.GetSLOStatus(name)
	if status == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SLO not found"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// GetThresholds returns all alert thresholds
func (h *Handler) GetThresholds(c *gin.Context) {
	if h.thresholds == nil {
		c.JSON(http.StatusOK, gin.H{"thresholds": map[string]interface{}{}})
		return
	}

	thresholds := h.thresholds.GetAllThresholds()
	c.JSON(http.StatusOK, gin.H{"thresholds": thresholds})
}

// UpdateThresholdRequest represents a request to update a threshold
type UpdateThresholdRequest struct {
	Threshold float64 `json:"threshold" binding:"required"`
	Duration  string  `json:"duration"`
	Enabled   *bool   `json:"enabled"`
}

// UpdateThreshold updates an alert threshold
func (h *Handler) UpdateThreshold(c *gin.Context) {
	name := c.Param("name")

	var req UpdateThresholdRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.thresholds == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Threshold not found"})
		return
	}

	existing := h.thresholds.GetThreshold(name)
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Threshold not found"})
		return
	}

	existing.Threshold = req.Threshold
	if req.Duration != "" {
		existing.Duration = req.Duration
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}

	h.thresholds.SetThreshold(name, existing)

	c.JSON(http.StatusOK, gin.H{
		"message":   "Threshold updated",
		"name":      name,
		"threshold": existing,
	})
}

// MetricsSummary represents a summary of key metrics
type MetricsSummary struct {
	RequestsPerSecond   float64 `json:"requests_per_second"`
	ErrorRate           float64 `json:"error_rate"`
	P50Latency          float64 `json:"p50_latency_ms"`
	P99Latency          float64 `json:"p99_latency_ms"`
	ActiveFestivals     int     `json:"active_festivals"`
	TotalAttendees      int     `json:"total_attendees"`
	TransactionsPerMin  float64 `json:"transactions_per_minute"`
	RevenuePerMin       float64 `json:"revenue_per_minute_cents"`
	ActiveAlerts        int     `json:"active_alerts"`
	DBConnections       int     `json:"db_connections"`
	CacheHitRate        float64 `json:"cache_hit_rate"`
	SystemHealthStatus  string  `json:"system_health_status"`
}

// GetMetricsSummary returns a summary of key metrics
func (h *Handler) GetMetricsSummary(c *gin.Context) {
	// In a real implementation, these would be fetched from Prometheus queries
	// or calculated from the metrics registry
	summary := MetricsSummary{
		RequestsPerSecond:   125.5,
		ErrorRate:           0.001,
		P50Latency:          45.2,
		P99Latency:          234.5,
		ActiveFestivals:     3,
		TotalAttendees:      12500,
		TransactionsPerMin:  450.0,
		RevenuePerMin:       22500.0,
		ActiveAlerts:        0,
		DBConnections:       25,
		CacheHitRate:        0.92,
		SystemHealthStatus:  "healthy",
	}

	if h.alertManager != nil {
		summary.ActiveAlerts = len(h.alertManager.GetActiveAlerts())
	}

	c.JSON(http.StatusOK, summary)
}

// MetricsMiddleware is middleware that records HTTP metrics
func MetricsMiddleware(metrics *Metrics) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Increment in-flight requests
		metrics.IncrementInFlight()
		defer metrics.DecrementInFlight()

		// Process request
		c.Next()

		// Record metrics after request completes
		duration := time.Since(start).Seconds()
		status := c.Writer.Status()
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}
		method := c.Request.Method
		responseSize := c.Writer.Size()

		// Normalize path to avoid high cardinality
		normalizedPath := normalizePath(path)

		metrics.RecordHTTPRequest(
			method,
			normalizedPath,
			http.StatusText(status),
			duration,
			responseSize,
		)
	}
}

// normalizePath normalizes a path to reduce cardinality
func normalizePath(path string) string {
	// Replace UUIDs with placeholder
	// Replace numeric IDs with placeholder
	// This is a simplified version - a real implementation would use regex
	if path == "" {
		return "/"
	}
	return path
}

// StartMetricsCollector starts a background goroutine to collect periodic metrics
func StartMetricsCollector(ctx context.Context, metrics *Metrics, collectFn func(*Metrics)) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			collectFn(metrics)
		}
	}
}

// DefaultMetricsCollector is the default metrics collection function
func DefaultMetricsCollector(metrics *Metrics) {
	// This would collect metrics from various sources:
	// - Database connection pool stats
	// - Cache stats
	// - Business metrics from database
	// - etc.

	// Example: Collect DB connection stats
	// dbStats := db.Stats()
	// metrics.SetDBConnections(float64(dbStats.OpenConnections), float64(dbStats.Idle), float64(dbStats.InUse))
}

// CreatePrometheusRegistry creates a new Prometheus registry with all collectors
func CreatePrometheusRegistry() *prometheus.Registry {
	registry := prometheus.NewRegistry()

	// Register default collectors
	registry.MustRegister(prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}))
	registry.MustRegister(prometheus.NewGoCollector())

	return registry
}
