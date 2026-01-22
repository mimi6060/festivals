package health

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Handler handles health check HTTP endpoints
type Handler struct {
	checker *HealthChecker
}

// NewHandler creates a new health check handler
func NewHandler(checker *HealthChecker) *Handler {
	return &Handler{checker: checker}
}

// RegisterRoutes registers health check routes
func (h *Handler) RegisterRoutes(router *gin.Engine) {
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
	Status     string                   `json:"status"`
	Timestamp  string                   `json:"timestamp"`
	Version    string                   `json:"version"`
	Components []ComponentHealthResponse `json:"components"`
}

// ComponentHealthResponse represents a component's health in the response
type ComponentHealthResponse struct {
	Name      string `json:"name"`
	Status    string `json:"status"`
	LatencyMs int64  `json:"latency_ms"`
	Message   string `json:"message,omitempty"`
}

// Health handles GET /health - Basic health check
// This is a lightweight check that just confirms the service is running
func (h *Handler) Health(c *gin.Context) {
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
func (h *Handler) Ready(c *gin.Context) {
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
		}
	}

	response := ReadyResponse{
		Status:     string(report.Status),
		Timestamp:  report.Timestamp.Format(time.RFC3339),
		Version:    report.Version,
		Components: components,
	}

	statusCode := http.StatusOK
	if report.Status == StatusUnhealthy {
		statusCode = http.StatusServiceUnavailable
	} else if report.Status == StatusDegraded {
		statusCode = http.StatusOK // Still serving, but degraded
	}

	c.JSON(statusCode, response)
}

// Live handles GET /health/live - Liveness check
// This is a simple check to confirm the application is running
// Used by Kubernetes to determine if the container should be restarted
func (h *Handler) Live(c *gin.Context) {
	response := HealthResponse{
		Status:    "alive",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Version:   h.checker.version,
	}

	c.JSON(http.StatusOK, response)
}
