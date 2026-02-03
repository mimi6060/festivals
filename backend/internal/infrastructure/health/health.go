package health

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// Status represents the health status of a component
type Status string

const (
	StatusHealthy   Status = "healthy"
	StatusUnhealthy Status = "unhealthy"
	StatusDegraded  Status = "degraded"
)

// ComponentHealth represents the health of a single component
type ComponentHealth struct {
	Name    string        `json:"name"`
	Status  Status        `json:"status"`
	Latency time.Duration `json:"latency_ms"`
	Message string        `json:"message,omitempty"`
}

// HealthReport represents the overall health of the system
type HealthReport struct {
	Status     Status            `json:"status"`
	Timestamp  time.Time         `json:"timestamp"`
	Version    string            `json:"version"`
	Components []ComponentHealth `json:"components"`
}

// Checker defines the interface for health checks
type Checker interface {
	Name() string
	Check(ctx context.Context) ComponentHealth
}

// HealthChecker aggregates multiple health checks
type HealthChecker struct {
	version  string
	checkers []Checker
	mu       sync.RWMutex
}

// NewHealthChecker creates a new HealthChecker
func NewHealthChecker(version string) *HealthChecker {
	return &HealthChecker{
		version:  version,
		checkers: make([]Checker, 0),
	}
}

// Register adds a new health checker
func (h *HealthChecker) Register(checker Checker) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.checkers = append(h.checkers, checker)
}

// Check performs all registered health checks
func (h *HealthChecker) Check(ctx context.Context) HealthReport {
	h.mu.RLock()
	defer h.mu.RUnlock()

	report := HealthReport{
		Status:     StatusHealthy,
		Timestamp:  time.Now().UTC(),
		Version:    h.version,
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

// DatabaseChecker checks PostgreSQL health
type DatabaseChecker struct {
	db *gorm.DB
}

// NewDatabaseChecker creates a new DatabaseChecker
func NewDatabaseChecker(db *gorm.DB) *DatabaseChecker {
	return &DatabaseChecker{db: db}
}

// Name returns the checker name
func (d *DatabaseChecker) Name() string {
	return "database"
}

// Check performs the database health check
func (d *DatabaseChecker) Check(ctx context.Context) ComponentHealth {
	start := time.Now()
	health := ComponentHealth{
		Name:   d.Name(),
		Status: StatusHealthy,
	}

	sqlDB, err := d.db.DB()
	if err != nil {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("failed to get database connection: %v", err)
		health.Latency = time.Since(start)
		return health
	}

	if err := sqlDB.PingContext(ctx); err != nil {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("database ping failed: %v", err)
		health.Latency = time.Since(start)
		return health
	}

	health.Latency = time.Since(start)

	// Check if latency is concerning
	if health.Latency > 500*time.Millisecond {
		health.Status = StatusDegraded
		health.Message = "high latency detected"
	}

	return health
}

// RedisChecker checks Redis health
type RedisChecker struct {
	client *redis.Client
}

// NewRedisChecker creates a new RedisChecker
func NewRedisChecker(client *redis.Client) *RedisChecker {
	return &RedisChecker{client: client}
}

// Name returns the checker name
func (r *RedisChecker) Name() string {
	return "redis"
}

// Check performs the Redis health check
func (r *RedisChecker) Check(ctx context.Context) ComponentHealth {
	start := time.Now()
	health := ComponentHealth{
		Name:   r.Name(),
		Status: StatusHealthy,
	}

	if err := r.client.Ping(ctx).Err(); err != nil {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("redis ping failed: %v", err)
		health.Latency = time.Since(start)
		return health
	}

	health.Latency = time.Since(start)

	// Check if latency is concerning
	if health.Latency > 100*time.Millisecond {
		health.Status = StatusDegraded
		health.Message = "high latency detected"
	}

	return health
}

// MinIOChecker checks MinIO health
type MinIOChecker struct {
	client     *minio.Client
	bucketName string
}

// NewMinIOChecker creates a new MinIOChecker
func NewMinIOChecker(client *minio.Client, bucketName string) *MinIOChecker {
	return &MinIOChecker{
		client:     client,
		bucketName: bucketName,
	}
}

// Name returns the checker name
func (m *MinIOChecker) Name() string {
	return "minio"
}

// Check performs the MinIO health check
func (m *MinIOChecker) Check(ctx context.Context) ComponentHealth {
	start := time.Now()
	health := ComponentHealth{
		Name:   m.Name(),
		Status: StatusHealthy,
	}

	// Check if bucket exists (also verifies connectivity)
	exists, err := m.client.BucketExists(ctx, m.bucketName)
	if err != nil {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("minio check failed: %v", err)
		health.Latency = time.Since(start)
		return health
	}

	if !exists {
		health.Status = StatusDegraded
		health.Message = fmt.Sprintf("bucket %s does not exist", m.bucketName)
		health.Latency = time.Since(start)
		return health
	}

	health.Latency = time.Since(start)

	// Check if latency is concerning
	if health.Latency > 500*time.Millisecond {
		health.Status = StatusDegraded
		health.Message = "high latency detected"
	}

	return health
}

// CustomChecker allows creating custom health checks
type CustomChecker struct {
	name      string
	checkFunc func(ctx context.Context) (Status, string)
}

// NewCustomChecker creates a new custom health checker
func NewCustomChecker(name string, checkFunc func(ctx context.Context) (Status, string)) *CustomChecker {
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
	status, message := c.checkFunc(ctx)
	return ComponentHealth{
		Name:    c.name,
		Status:  status,
		Message: message,
		Latency: time.Since(start),
	}
}
