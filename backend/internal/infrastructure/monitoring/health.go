package monitoring

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// HealthStatus represents the health status of a component
type HealthStatus string

const (
	StatusHealthy   HealthStatus = "healthy"
	StatusUnhealthy HealthStatus = "unhealthy"
	StatusDegraded  HealthStatus = "degraded"
)

// ComponentHealth represents the health of a single component
type ComponentHealth struct {
	Name      string            `json:"name"`
	Status    HealthStatus      `json:"status"`
	Latency   time.Duration     `json:"latency_ms"`
	Message   string            `json:"message,omitempty"`
	Details   map[string]any    `json:"details,omitempty"`
	Timestamp time.Time         `json:"timestamp"`
}

// HealthReport represents the overall health of the system
type HealthReport struct {
	Status     HealthStatus      `json:"status"`
	Timestamp  time.Time         `json:"timestamp"`
	Version    string            `json:"version"`
	Uptime     time.Duration     `json:"uptime_seconds"`
	Components []ComponentHealth `json:"components"`
}

// Checker defines the interface for health checks
type Checker interface {
	Name() string
	Check(ctx context.Context) ComponentHealth
}

// HealthChecker aggregates multiple health checks
type HealthChecker struct {
	version   string
	startTime time.Time
	checkers  []Checker
	mu        sync.RWMutex
}

// NewHealthChecker creates a new HealthChecker
func NewHealthChecker(version string) *HealthChecker {
	return &HealthChecker{
		version:   version,
		startTime: time.Now(),
		checkers:  make([]Checker, 0),
	}
}

// Register adds a new health checker
func (h *HealthChecker) Register(checker Checker) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.checkers = append(h.checkers, checker)
}

// Check performs all registered health checks concurrently
func (h *HealthChecker) Check(ctx context.Context) HealthReport {
	h.mu.RLock()
	defer h.mu.RUnlock()

	report := HealthReport{
		Status:     StatusHealthy,
		Timestamp:  time.Now().UTC(),
		Version:    h.version,
		Uptime:     time.Since(h.startTime),
		Components: make([]ComponentHealth, 0, len(h.checkers)),
	}

	var wg sync.WaitGroup
	results := make(chan ComponentHealth, len(h.checkers))

	for _, checker := range h.checkers {
		wg.Add(1)
		go func(c Checker) {
			defer wg.Done()
			results <- c.Check(ctx)
		}(checker)
	}

	wg.Wait()
	close(results)

	for result := range results {
		report.Components = append(report.Components, result)
		if result.Status == StatusUnhealthy {
			report.Status = StatusUnhealthy
		} else if result.Status == StatusDegraded && report.Status != StatusUnhealthy {
			report.Status = StatusDegraded
		}
	}

	return report
}

// IsHealthy returns true if all components are healthy
func (h *HealthChecker) IsHealthy(ctx context.Context) bool {
	report := h.Check(ctx)
	return report.Status == StatusHealthy
}

// DatabaseChecker checks PostgreSQL database connectivity and health
type DatabaseChecker struct {
	db                *gorm.DB
	criticalLatencyMs int64
}

// NewDatabaseChecker creates a new DatabaseChecker
func NewDatabaseChecker(db *gorm.DB) *DatabaseChecker {
	return &DatabaseChecker{
		db:                db,
		criticalLatencyMs: 500, // Default 500ms threshold
	}
}

// WithCriticalLatency sets the critical latency threshold in milliseconds
func (d *DatabaseChecker) WithCriticalLatency(ms int64) *DatabaseChecker {
	d.criticalLatencyMs = ms
	return d
}

// Name returns the checker name
func (d *DatabaseChecker) Name() string {
	return "database"
}

// Check performs the database health check
func (d *DatabaseChecker) Check(ctx context.Context) ComponentHealth {
	start := time.Now()
	health := ComponentHealth{
		Name:      d.Name(),
		Status:    StatusHealthy,
		Timestamp: time.Now().UTC(),
		Details:   make(map[string]any),
	}

	sqlDB, err := d.db.DB()
	if err != nil {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("failed to get database connection: %v", err)
		health.Latency = time.Since(start)
		return health
	}

	// Ping the database
	if err := sqlDB.PingContext(ctx); err != nil {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("database ping failed: %v", err)
		health.Latency = time.Since(start)
		return health
	}

	health.Latency = time.Since(start)

	// Get connection pool stats
	stats := sqlDB.Stats()
	health.Details["open_connections"] = stats.OpenConnections
	health.Details["in_use"] = stats.InUse
	health.Details["idle"] = stats.Idle
	health.Details["max_open_connections"] = stats.MaxOpenConnections
	health.Details["wait_count"] = stats.WaitCount
	health.Details["wait_duration_ms"] = stats.WaitDuration.Milliseconds()

	// Update metrics if available
	if m := Get(); m != nil {
		m.SetDBConnections(float64(stats.OpenConnections), float64(stats.Idle), float64(stats.InUse))
	}

	// Check if latency is concerning
	if health.Latency.Milliseconds() > d.criticalLatencyMs {
		health.Status = StatusDegraded
		health.Message = fmt.Sprintf("high latency detected: %dms", health.Latency.Milliseconds())
	}

	// Check connection pool health
	if stats.OpenConnections >= stats.MaxOpenConnections {
		health.Status = StatusDegraded
		health.Message = "connection pool exhausted"
	}

	return health
}

// RedisChecker checks Redis connectivity and health
type RedisChecker struct {
	client            *redis.Client
	criticalLatencyMs int64
}

// NewRedisChecker creates a new RedisChecker
func NewRedisChecker(client *redis.Client) *RedisChecker {
	return &RedisChecker{
		client:            client,
		criticalLatencyMs: 100, // Default 100ms threshold for Redis
	}
}

// WithCriticalLatency sets the critical latency threshold in milliseconds
func (r *RedisChecker) WithCriticalLatency(ms int64) *RedisChecker {
	r.criticalLatencyMs = ms
	return r
}

// Name returns the checker name
func (r *RedisChecker) Name() string {
	return "redis"
}

// Check performs the Redis health check
func (r *RedisChecker) Check(ctx context.Context) ComponentHealth {
	start := time.Now()
	health := ComponentHealth{
		Name:      r.Name(),
		Status:    StatusHealthy,
		Timestamp: time.Now().UTC(),
		Details:   make(map[string]any),
	}

	// Ping Redis
	if err := r.client.Ping(ctx).Err(); err != nil {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("redis ping failed: %v", err)
		health.Latency = time.Since(start)
		return health
	}

	health.Latency = time.Since(start)

	// Get Redis info
	_, err := r.client.Info(ctx, "server", "clients", "memory").Result()
	if err == nil {
		health.Details["info_available"] = true
		health.Details["connected"] = true
	} else {
		health.Details["info_available"] = false
	}

	// Get pool stats
	poolStats := r.client.PoolStats()
	health.Details["pool_hits"] = poolStats.Hits
	health.Details["pool_misses"] = poolStats.Misses
	health.Details["pool_timeouts"] = poolStats.Timeouts
	health.Details["pool_total_conns"] = poolStats.TotalConns
	health.Details["pool_idle_conns"] = poolStats.IdleConns
	health.Details["pool_stale_conns"] = poolStats.StaleConns

	// Check if latency is concerning
	if health.Latency.Milliseconds() > r.criticalLatencyMs {
		health.Status = StatusDegraded
		health.Message = fmt.Sprintf("high latency detected: %dms", health.Latency.Milliseconds())
	}

	// Check for connection issues
	if poolStats.Timeouts > 0 {
		health.Status = StatusDegraded
		health.Message = fmt.Sprintf("connection pool timeouts detected: %d", poolStats.Timeouts)
	}

	return health
}

// ExternalServiceChecker checks external service connectivity
type ExternalServiceChecker struct {
	name              string
	url               string
	timeout           time.Duration
	criticalLatencyMs int64
	httpClient        *http.Client
}

// NewExternalServiceChecker creates a new ExternalServiceChecker
func NewExternalServiceChecker(name, url string) *ExternalServiceChecker {
	return &ExternalServiceChecker{
		name:              name,
		url:               url,
		timeout:           5 * time.Second,
		criticalLatencyMs: 1000,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// WithTimeout sets the timeout for the health check
func (e *ExternalServiceChecker) WithTimeout(timeout time.Duration) *ExternalServiceChecker {
	e.timeout = timeout
	e.httpClient.Timeout = timeout
	return e
}

// WithCriticalLatency sets the critical latency threshold in milliseconds
func (e *ExternalServiceChecker) WithCriticalLatency(ms int64) *ExternalServiceChecker {
	e.criticalLatencyMs = ms
	return e
}

// Name returns the checker name
func (e *ExternalServiceChecker) Name() string {
	return e.name
}

// Check performs the external service health check
func (e *ExternalServiceChecker) Check(ctx context.Context) ComponentHealth {
	start := time.Now()
	health := ComponentHealth{
		Name:      e.Name(),
		Status:    StatusHealthy,
		Timestamp: time.Now().UTC(),
		Details: map[string]any{
			"url": e.url,
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, e.url, nil)
	if err != nil {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("failed to create request: %v", err)
		health.Latency = time.Since(start)
		return health
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("request failed: %v", err)
		health.Latency = time.Since(start)
		return health
	}
	defer resp.Body.Close()

	health.Latency = time.Since(start)
	health.Details["status_code"] = resp.StatusCode

	// Check response status
	if resp.StatusCode >= 500 {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("service returned error status: %d", resp.StatusCode)
	} else if resp.StatusCode >= 400 {
		health.Status = StatusDegraded
		health.Message = fmt.Sprintf("service returned client error: %d", resp.StatusCode)
	}

	// Check if latency is concerning
	if health.Latency.Milliseconds() > e.criticalLatencyMs {
		if health.Status == StatusHealthy {
			health.Status = StatusDegraded
		}
		health.Message = fmt.Sprintf("high latency detected: %dms", health.Latency.Milliseconds())
	}

	return health
}

// CustomChecker allows creating custom health checks
type CustomChecker struct {
	name      string
	checkFunc func(ctx context.Context) (HealthStatus, string, map[string]any)
}

// NewCustomChecker creates a new custom health checker
func NewCustomChecker(name string, checkFunc func(ctx context.Context) (HealthStatus, string, map[string]any)) *CustomChecker {
	return &CustomChecker{
		name:      name,
		checkFunc: checkFunc,
	}
}

// Name returns the checker name
func (c *CustomChecker) Name() string {
	return c.name
}

// Check performs the custom health check
func (c *CustomChecker) Check(ctx context.Context) ComponentHealth {
	start := time.Now()
	status, message, details := c.checkFunc(ctx)
	return ComponentHealth{
		Name:      c.name,
		Status:    status,
		Message:   message,
		Details:   details,
		Latency:   time.Since(start),
		Timestamp: time.Now().UTC(),
	}
}

// HealthHandler handles health check HTTP endpoints
type HealthHandler struct {
	checker *HealthChecker
}

// NewHealthHandler creates a new health check handler
func NewHealthHandler(checker *HealthChecker) *HealthHandler {
	return &HealthHandler{checker: checker}
}

// RegisterRoutes registers health check routes on a Gin engine
func (h *HealthHandler) RegisterRoutes(router *gin.Engine) {
	router.GET("/health", h.Health)
	router.GET("/health/ready", h.Ready)
	router.GET("/health/live", h.Live)
}

// HealthResponse represents the basic health response
type HealthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	Version   string `json:"version"`
}

// ReadyResponse represents the readiness check response
type ReadyResponse struct {
	Status     string                    `json:"status"`
	Timestamp  string                    `json:"timestamp"`
	Version    string                    `json:"version"`
	Uptime     int64                     `json:"uptime_seconds"`
	Components []ComponentHealthResponse `json:"components"`
}

// ComponentHealthResponse represents a component's health in the response
type ComponentHealthResponse struct {
	Name      string         `json:"name"`
	Status    string         `json:"status"`
	LatencyMs int64          `json:"latency_ms"`
	Message   string         `json:"message,omitempty"`
	Details   map[string]any `json:"details,omitempty"`
}

// Health handles GET /health - Basic health check
// This is a lightweight check that just confirms the service is running
func (h *HealthHandler) Health(c *gin.Context) {
	response := HealthResponse{
		Status:    "ok",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Version:   h.checker.version,
	}

	c.JSON(http.StatusOK, response)
}

// Ready handles GET /health/ready - Readiness check
// This checks if the service is ready to receive traffic
// All dependencies must be healthy
func (h *HealthHandler) Ready(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	report := h.checker.Check(ctx)

	components := make([]ComponentHealthResponse, len(report.Components))
	for i, comp := range report.Components {
		components[i] = ComponentHealthResponse{
			Name:      comp.Name,
			Status:    string(comp.Status),
			LatencyMs: comp.Latency.Milliseconds(),
			Message:   comp.Message,
			Details:   comp.Details,
		}
	}

	response := ReadyResponse{
		Status:     string(report.Status),
		Timestamp:  report.Timestamp.Format(time.RFC3339),
		Version:    report.Version,
		Uptime:     int64(report.Uptime.Seconds()),
		Components: components,
	}

	statusCode := http.StatusOK
	if report.Status == StatusUnhealthy {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, response)
}

// Live handles GET /health/live - Liveness check
// This is a simple check to confirm the application is running
// Used by Kubernetes to determine if the container should be restarted
func (h *HealthHandler) Live(c *gin.Context) {
	response := HealthResponse{
		Status:    "alive",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Version:   h.checker.version,
	}

	c.JSON(http.StatusOK, response)
}
