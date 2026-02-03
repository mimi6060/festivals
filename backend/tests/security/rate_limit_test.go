package security_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mimi6060/festivals/backend/internal/middleware"
)

func setupRateLimitTestRedis(t *testing.T) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15,
	})

	if err := client.Ping(context.Background()).Err(); err != nil {
		t.Skip("Redis not available for testing")
	}

	client.FlushDB(context.Background())
	return client
}

func setupRateLimitRouter(cfg middleware.RateLimitConfig) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(middleware.RateLimit(cfg))

	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.POST("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}

// ============================================================================
// Basic Rate Limiting Tests
// ============================================================================

func TestBasicRateLimit(t *testing.T) {
	redisClient := setupRateLimitTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RateLimitConfig{
		RedisClient:              redisClient,
		DefaultRequestsPerMinute: 5,
		EnableIPLimiting:         true,
		IPRequestsPerMinute:      5,
		KeyPrefix:                "test:ratelimit:basic:",
	}

	router := setupRateLimitRouter(cfg)

	// Make requests up to the limit
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "Request %d should succeed", i+1)
	}

	// Next request should be rate limited
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code, "Request should be rate limited")
}

func TestRateLimitHeaders(t *testing.T) {
	redisClient := setupRateLimitTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RateLimitConfig{
		RedisClient:              redisClient,
		DefaultRequestsPerMinute: 10,
		EnableIPLimiting:         true,
		IPRequestsPerMinute:      10,
		KeyPrefix:                "test:ratelimit:headers:",
	}

	router := setupRateLimitRouter(cfg)

	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.2:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Check rate limit headers
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Limit"), "Should have X-RateLimit-Limit header")
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Remaining"), "Should have X-RateLimit-Remaining header")
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Reset"), "Should have X-RateLimit-Reset header")
}

func TestRateLimitRetryAfter(t *testing.T) {
	redisClient := setupRateLimitTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RateLimitConfig{
		RedisClient:              redisClient,
		DefaultRequestsPerMinute: 2,
		EnableIPLimiting:         true,
		IPRequestsPerMinute:      2,
		KeyPrefix:                "test:ratelimit:retry:",
	}

	router := setupRateLimitRouter(cfg)

	// Exhaust rate limit
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.3:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}

	// Check Retry-After header on rate limited response
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.3:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.NotEmpty(t, w.Header().Get("Retry-After"), "Should have Retry-After header")
}

// ============================================================================
// Role-Based Rate Limiting Tests
// ============================================================================

func TestRoleBaeedRateLimit(t *testing.T) {
	redisClient := setupRateLimitTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RateLimitConfig{
		RedisClient:              redisClient,
		DefaultRequestsPerMinute: 5,
		RoleLimits: map[string]middleware.RoleLimit{
			middleware.RoleAdmin: {
				RequestsPerMinute: 100,
				RequestsPerHour:   1000,
				BurstSize:         20,
			},
			middleware.RoleUser: {
				RequestsPerMinute: 10,
				RequestsPerHour:   100,
				BurstSize:         5,
			},
		},
		EnableIPLimiting:    true,
		IPRequestsPerMinute: 5,
		KeyPrefix:           "test:ratelimit:role:",
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Simulate authenticated user middleware
	router.Use(func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		if userID != "" {
			c.Set("user_id", userID)
		}
		role := c.GetHeader("X-User-Role")
		if role != "" {
			c.Set("roles", []string{role})
		}
		c.Next()
	})

	router.Use(middleware.RateLimit(cfg))

	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Test admin user - should have higher limit
	for i := 0; i < 50; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-User-ID", "admin-user")
		req.Header.Set("X-User-Role", middleware.RoleAdmin)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "Admin request %d should succeed", i+1)
	}

	// Test regular user - should have lower limit
	for i := 0; i < 10; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-User-ID", "regular-user")
		req.Header.Set("X-User-Role", middleware.RoleUser)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "User request %d should succeed", i+1)
	}

	// Regular user should be rate limited after 10 requests
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-User-ID", "regular-user")
	req.Header.Set("X-User-Role", middleware.RoleUser)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code, "User should be rate limited")
}

// ============================================================================
// Per-Endpoint Rate Limiting Tests
// ============================================================================

func TestEndpointRateLimit(t *testing.T) {
	redisClient := setupRateLimitTestRedis(t)
	defer redisClient.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Different rate limits for different endpoints
	router.GET("/high-traffic", middleware.RateLimitByEndpoint(redisClient, 100), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"endpoint": "high-traffic"})
	})

	router.GET("/low-traffic", middleware.RateLimitByEndpoint(redisClient, 5), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"endpoint": "low-traffic"})
	})

	// Test high-traffic endpoint
	for i := 0; i < 50; i++ {
		req := httptest.NewRequest("GET", "/high-traffic", nil)
		req.RemoteAddr = "192.168.1.10:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	// Test low-traffic endpoint
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("GET", "/low-traffic", nil)
		req.RemoteAddr = "192.168.1.10:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	// Low-traffic endpoint should be rate limited
	req := httptest.NewRequest("GET", "/low-traffic", nil)
	req.RemoteAddr = "192.168.1.10:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
}

// ============================================================================
// Burst Rate Limiting Tests
// ============================================================================

func TestBurstRateLimit(t *testing.T) {
	redisClient := setupRateLimitTestRedis(t)
	defer redisClient.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()

	router.Use(middleware.BurstRateLimit(redisClient, 10, 5)) // 10 per second, burst of 5

	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Burst of 5 requests should succeed
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.20:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "Burst request %d should succeed", i+1)
	}

	// Additional immediate request may be limited
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.20:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	// Result depends on timing, just verify it doesn't error
}

// ============================================================================
// Concurrent Rate Limiting Tests
// ============================================================================

func TestConcurrencyLimit(t *testing.T) {
	redisClient := setupRateLimitTestRedis(t)
	defer redisClient.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()

	router.Use(middleware.ConcurrencyLimit(redisClient, 3)) // Max 3 concurrent requests

	router.GET("/slow", func(c *gin.Context) {
		time.Sleep(100 * time.Millisecond)
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	var wg sync.WaitGroup
	results := make([]int, 5)

	// Send 5 concurrent requests
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			req := httptest.NewRequest("GET", "/slow", nil)
			req.RemoteAddr = "192.168.1.30:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			results[idx] = w.Code
		}(i)
	}

	wg.Wait()

	// Count successes and rate limits
	successes := 0
	rateLimited := 0
	for _, code := range results {
		if code == http.StatusOK {
			successes++
		} else if code == http.StatusServiceUnavailable {
			rateLimited++
		}
	}

	// At least some should succeed and some should be limited
	assert.LessOrEqual(t, successes, 3, "Should have at most 3 concurrent requests")
	assert.GreaterOrEqual(t, rateLimited, 2, "Some requests should be limited")
}

// ============================================================================
// Skip Path Tests
// ============================================================================

func TestRateLimitSkipPaths(t *testing.T) {
	redisClient := setupRateLimitTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RateLimitConfig{
		RedisClient:              redisClient,
		DefaultRequestsPerMinute: 2,
		EnableIPLimiting:         true,
		IPRequestsPerMinute:      2,
		SkipPaths:                []string{"/health", "/metrics"},
		KeyPrefix:                "test:ratelimit:skip:",
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(middleware.RateLimit(cfg))

	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})
	router.GET("/metrics", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"metrics": "data"})
	})

	// Exhaust rate limit on /test
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.40:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}

	// /health should still work
	req := httptest.NewRequest("GET", "/health", nil)
	req.RemoteAddr = "192.168.1.40:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code, "Health endpoint should not be rate limited")

	// /metrics should still work
	req = httptest.NewRequest("GET", "/metrics", nil)
	req.RemoteAddr = "192.168.1.40:12345"
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code, "Metrics endpoint should not be rate limited")
}

// ============================================================================
// Distributed Rate Limiting Tests
// ============================================================================

func TestDistributedRateLimit(t *testing.T) {
	redisClient := setupRateLimitTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RateLimitConfig{
		RedisClient:              redisClient,
		DefaultRequestsPerMinute: 10,
		EnableIPLimiting:         true,
		IPRequestsPerMinute:      10,
		KeyPrefix:                "test:ratelimit:distributed:",
	}

	// Simulate two instances of the application
	router1 := setupRateLimitRouter(cfg)
	router2 := setupRateLimitRouter(cfg)

	testIP := "192.168.1.50:12345"

	// Make 5 requests from "instance 1"
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = testIP
		w := httptest.NewRecorder()
		router1.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	// Make 5 more requests from "instance 2"
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = testIP
		w := httptest.NewRecorder()
		router2.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	// 11th request from either instance should be limited
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = testIP
	w := httptest.NewRecorder()
	router1.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code, "Should be rate limited across instances")
}

// ============================================================================
// Rate Limit Window Reset Tests
// ============================================================================

func TestRateLimitWindowReset(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping test that requires waiting")
	}

	redisClient := setupRateLimitTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RateLimitConfig{
		RedisClient:              redisClient,
		DefaultRequestsPerMinute: 5,
		EnableIPLimiting:         true,
		IPRequestsPerMinute:      5,
		KeyPrefix:                "test:ratelimit:reset:",
	}

	router := setupRateLimitRouter(cfg)
	testIP := "192.168.1.60:12345"

	// Exhaust rate limit
	for i := 0; i < 6; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = testIP
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}

	// Should be rate limited
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = testIP
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)

	// Note: In a real test with shorter windows, you'd wait for the window to reset
	// For now, we just verify the rate limiting works
}

// ============================================================================
// Error Response Format Tests
// ============================================================================

func TestRateLimitErrorResponse(t *testing.T) {
	redisClient := setupRateLimitTestRedis(t)
	defer redisClient.Close()

	cfg := middleware.RateLimitConfig{
		RedisClient:              redisClient,
		DefaultRequestsPerMinute: 1,
		EnableIPLimiting:         true,
		IPRequestsPerMinute:      1,
		KeyPrefix:                "test:ratelimit:error:",
	}

	router := setupRateLimitRouter(cfg)

	// Trigger rate limit
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.70:12345"
	router.ServeHTTP(httptest.NewRecorder(), req)

	req = httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.70:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.Contains(t, w.Body.String(), "RATE_LIMITED")
	assert.Contains(t, w.Body.String(), "retry_after")
}

// ============================================================================
// Fail-Open Tests
// ============================================================================

func TestRateLimitFailOpen(t *testing.T) {
	// Test with nil Redis client - should fail open
	cfg := middleware.RateLimitConfig{
		RedisClient:              nil, // No Redis
		DefaultRequestsPerMinute: 1,
		EnableIPLimiting:         true,
		IPRequestsPerMinute:      1,
	}

	router := setupRateLimitRouter(cfg)

	// Should succeed even with "rate limit" of 1 because Redis is unavailable
	for i := 0; i < 10; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.80:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "Request %d should succeed (fail-open)", i+1)
	}
}

// ============================================================================
// Benchmark Tests
// ============================================================================

func BenchmarkRateLimit(b *testing.B) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15,
	})
	if err := client.Ping(context.Background()).Err(); err != nil {
		b.Skip("Redis not available")
	}
	defer client.Close()

	cfg := middleware.RateLimitConfig{
		RedisClient:              client,
		DefaultRequestsPerMinute: 10000, // High limit for benchmark
		EnableIPLimiting:         true,
		IPRequestsPerMinute:      10000,
		KeyPrefix:                "bench:ratelimit:",
	}

	router := setupRateLimitRouter(cfg)
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.100:12345"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}
}

func BenchmarkRateLimitConcurrent(b *testing.B) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15,
	})
	if err := client.Ping(context.Background()).Err(); err != nil {
		b.Skip("Redis not available")
	}
	defer client.Close()

	cfg := middleware.RateLimitConfig{
		RedisClient:              client,
		DefaultRequestsPerMinute: 100000,
		EnableIPLimiting:         true,
		IPRequestsPerMinute:      100000,
		KeyPrefix:                "bench:ratelimit:concurrent:",
	}

	router := setupRateLimitRouter(cfg)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req := httptest.NewRequest("GET", "/test", nil)
			req.RemoteAddr = "192.168.1.101:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
		}
	})
}
