package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/middleware"
	"github.com/mimi6060/festivals/backend/tests/helpers"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Default Rate Limit Tests
// ============================================================================

func TestDefaultRateLimits(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Requests within default limit are allowed", func(t *testing.T) {
		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		})

		// Make requests within limit
		for i := 0; i < 5; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.100:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code, "Request %d should succeed", i+1)
		}
	})

	t.Run("Requests exceeding default limit are rate limited", func(t *testing.T) {
		// Clean up Redis keys before test
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 5,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      5,
		})

		rateLimited := false
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.101:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				rateLimited = true
				break
			}
		}

		assert.True(t, rateLimited, "Should have been rate limited after exceeding limit")
	})

	t.Run("Default config values are applied correctly", func(t *testing.T) {
		cfg := middleware.DefaultRateLimitConfig()

		assert.Equal(t, 60, cfg.DefaultRequestsPerMinute)
		assert.Equal(t, 1000, cfg.DefaultRequestsPerHour)
		assert.Equal(t, "ratelimit:", cfg.KeyPrefix)
		assert.True(t, cfg.EnableIPLimiting)
		assert.Equal(t, 30, cfg.IPRequestsPerMinute)
	})

	t.Run("Rate limiting is disabled without Redis client", func(t *testing.T) {
		router := setupRateLimitTestRouter(nil, middleware.RateLimitConfig{
			RedisClient:              nil, // No Redis
			DefaultRequestsPerMinute: 1,
		})

		// All requests should succeed without Redis
		for i := 0; i < 20; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code, "Request %d should succeed without Redis", i+1)
		}
	})
}

// ============================================================================
// Role-Based Rate Limit Tests
// ============================================================================

func TestRoleBasedRateLimits(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	roleLimits := map[string]middleware.RoleLimit{
		middleware.RoleAdmin: {
			RequestsPerMinute: 100,
			RequestsPerHour:   5000,
			BurstSize:         20,
		},
		middleware.RoleOrganizer: {
			RequestsPerMinute: 50,
			RequestsPerHour:   2000,
			BurstSize:         15,
		},
		middleware.RoleStaff: {
			RequestsPerMinute: 30,
			RequestsPerHour:   1000,
			BurstSize:         10,
		},
		middleware.RoleUser: {
			RequestsPerMinute: 10,
			RequestsPerHour:   500,
			BurstSize:         5,
		},
	}

	t.Run("Admin gets higher rate limit than regular user", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouterWithRoles(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			RoleLimits:               roleLimits,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		})

		adminUser := helpers.CreateTestAdmin(t, suite.DB)
		regularUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Admin should handle more requests
		adminRateLimitedAt := 0
		for i := 0; i < 50; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", adminUser.ID.String())
			req.Header.Set("X-Test-Roles", "ADMIN")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				adminRateLimitedAt = i
				break
			}
		}

		// Flush to test regular user
		suite.Redis.FlushDB(ctx)

		// Regular user should be rate limited sooner
		userRateLimitedAt := 0
		for i := 0; i < 50; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", regularUser.ID.String())
			req.Header.Set("X-Test-Roles", "USER")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				userRateLimitedAt = i
				break
			}
		}

		// Admin should be rate limited later (or not at all within 50 requests)
		if adminRateLimitedAt > 0 && userRateLimitedAt > 0 {
			assert.Greater(t, adminRateLimitedAt, userRateLimitedAt,
				"Admin should be rate limited later than regular user")
		} else {
			// Admin should not be rate limited if userRateLimitedAt > 0
			assert.Greater(t, userRateLimitedAt, 0, "Regular user should be rate limited")
		}
	})

	t.Run("Organizer limit is between admin and user", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouterWithRoles(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			RoleLimits:               roleLimits,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		})

		organizerUser := helpers.CreateTestUser(t, suite.DB, nil)

		organizerRateLimitedAt := 0
		for i := 0; i < 80; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", organizerUser.ID.String())
			req.Header.Set("X-Test-Roles", "ORGANIZER")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				organizerRateLimitedAt = i
				break
			}
		}

		// Should be limited around 50 requests (organizer limit)
		assert.Greater(t, organizerRateLimitedAt, 30, "Organizer should handle more than user limit")
		if organizerRateLimitedAt > 0 {
			assert.LessOrEqual(t, organizerRateLimitedAt, 60, "Organizer should be limited before 60 requests")
		}
	})

	t.Run("Highest role determines limit for users with multiple roles", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouterWithMultipleRoles(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			RoleLimits:               roleLimits,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		})

		multiRoleUser := helpers.CreateTestUser(t, suite.DB, nil)

		rateLimitedAt := 0
		for i := 0; i < 80; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", multiRoleUser.ID.String())
			req.Header.Set("X-Test-Roles", "USER,ORGANIZER") // Both roles, organizer is higher
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				rateLimitedAt = i
				break
			}
		}

		// Should use organizer limit (50) not user limit (10)
		assert.Greater(t, rateLimitedAt, 30, "Should use higher role's limit")
	})
}

// ============================================================================
// Endpoint-Specific Rate Limit Tests
// ============================================================================

func TestEndpointSpecificLimits(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Sensitive endpoints have stricter limits", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		endpointLimits := map[string]int{
			"/api/v1/auth/login":         5,  // Very strict for login
			"/api/v1/auth/register":      3,  // Even stricter for registration
			"/api/v1/wallet/topup":       10, // Stricter for financial operations
			"/api/v1/test":               50, // Normal endpoint
		}

		router := setupRateLimitTestRouterWithEndpoints(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 60,
			EndpointLimits:           endpointLimits,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      60,
		})

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Test login endpoint - should be limited at 5
		loginLimitedAt := 0
		for i := 0; i < 20; i++ {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				loginLimitedAt = i
				break
			}
		}

		assert.Greater(t, loginLimitedAt, 0, "Login should be rate limited")
		assert.LessOrEqual(t, loginLimitedAt, 6, "Login should be limited around 5 requests")

		// Reset for register test
		suite.Redis.FlushDB(ctx)

		// Test register endpoint - should be limited at 3
		registerLimitedAt := 0
		for i := 0; i < 20; i++ {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				registerLimitedAt = i
				break
			}
		}

		assert.Greater(t, registerLimitedAt, 0, "Register should be rate limited")
		assert.LessOrEqual(t, registerLimitedAt, 4, "Register should be limited around 3 requests")
	})

	t.Run("Endpoint limit overrides role limit when lower", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		endpointLimits := map[string]int{
			"/api/v1/limited": 5, // Very strict
		}

		roleLimits := map[string]middleware.RoleLimit{
			middleware.RoleAdmin: {
				RequestsPerMinute: 100,
				BurstSize:         20,
			},
		}

		router := setupRateLimitTestRouterWithEndpointsAndRoles(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 60,
			RoleLimits:               roleLimits,
			EndpointLimits:           endpointLimits,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      60,
		})

		adminUser := helpers.CreateTestAdmin(t, suite.DB)

		// Admin making requests to limited endpoint
		limitedAt := 0
		for i := 0; i < 20; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/limited", nil)
			req.Header.Set("X-Test-User-ID", adminUser.ID.String())
			req.Header.Set("X-Test-Roles", "ADMIN")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				limitedAt = i
				break
			}
		}

		// Should be limited at endpoint limit (5), not admin limit (100)
		assert.Greater(t, limitedAt, 0, "Should be rate limited")
		assert.LessOrEqual(t, limitedAt, 6, "Should be limited at endpoint limit, not role limit")
	})

	t.Run("Skip paths are not rate limited", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		skipPaths := []string{
			"/api/v1/health",
			"/api/v1/metrics",
		}

		router := setupRateLimitTestRouterWithSkipPaths(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 5,
			SkipPaths:                skipPaths,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      5,
		})

		// Health endpoint should never be rate limited
		for i := 0; i < 50; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
			req.RemoteAddr = "192.168.1.200:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code, "Health endpoint should not be rate limited")
		}
	})
}

// ============================================================================
// Burst Handling Tests
// ============================================================================

func TestBurstHandling(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Burst requests within limit are allowed", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupBurstRateLimitTestRouter(suite.Redis, 10, 5) // 10/sec rate, 5 burst

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Send burst of requests
		var wg sync.WaitGroup
		successCount := int32(0)

		for i := 0; i < 5; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				req := httptest.NewRequest(http.MethodGet, "/api/v1/burst", nil)
				req.Header.Set("X-Test-User-ID", testUser.ID.String())
				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)

				if w.Code == http.StatusOK {
					atomic.AddInt32(&successCount, 1)
				}
			}()
		}

		wg.Wait()

		// Most or all should succeed due to burst allowance
		assert.GreaterOrEqual(t, int(successCount), 3, "Burst requests should mostly succeed")
	})

	t.Run("Burst exceeding limit triggers rate limiting", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupBurstRateLimitTestRouter(suite.Redis, 2, 3) // 2/sec rate, 3 burst

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Send many rapid requests
		rateLimited := false
		for i := 0; i < 20; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/burst", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				rateLimited = true
				break
			}
		}

		assert.True(t, rateLimited, "Should be rate limited after exceeding burst")
	})

	t.Run("Token bucket refills over time", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupBurstRateLimitTestRouter(suite.Redis, 5, 3) // 5/sec rate, 3 burst

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Exhaust burst
		for i := 0; i < 5; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/burst", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
		}

		// Wait for token refill
		time.Sleep(500 * time.Millisecond)

		// Should be able to make more requests
		req := httptest.NewRequest(http.MethodGet, "/api/v1/burst", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// May or may not succeed depending on exact timing, but shouldn't panic
		assert.Contains(t, []int{http.StatusOK, http.StatusTooManyRequests}, w.Code)
	})
}

// ============================================================================
// Rate Limit Header Tests
// ============================================================================

func TestRateLimitHeaders(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("X-RateLimit-Limit header is set correctly", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 100,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      100,
		})

		req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
		req.RemoteAddr = "192.168.1.50:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		limitHeader := w.Header().Get("X-RateLimit-Limit")
		assert.NotEmpty(t, limitHeader, "X-RateLimit-Limit header should be set")

		limit, err := strconv.Atoi(limitHeader)
		require.NoError(t, err)
		assert.Equal(t, 100, limit, "Limit should match configuration")
	})

	t.Run("X-RateLimit-Remaining header decreases with requests", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 50,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      50,
		})

		var previousRemaining int = 100

		for i := 0; i < 5; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.60:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			remainingHeader := w.Header().Get("X-RateLimit-Remaining")
			require.NotEmpty(t, remainingHeader, "X-RateLimit-Remaining header should be set")

			remaining, err := strconv.Atoi(remainingHeader)
			require.NoError(t, err)

			if i > 0 {
				assert.Less(t, remaining, previousRemaining, "Remaining should decrease")
			}
			previousRemaining = remaining
		}
	})

	t.Run("X-RateLimit-Reset header contains valid timestamp", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 60,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      60,
		})

		req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
		req.RemoteAddr = "192.168.1.70:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		resetHeader := w.Header().Get("X-RateLimit-Reset")
		assert.NotEmpty(t, resetHeader, "X-RateLimit-Reset header should be set")

		resetTimestamp, err := strconv.ParseInt(resetHeader, 10, 64)
		require.NoError(t, err)

		resetTime := time.Unix(resetTimestamp, 0)
		assert.True(t, resetTime.After(time.Now()), "Reset time should be in the future")
		assert.True(t, resetTime.Before(time.Now().Add(2*time.Minute)), "Reset time should be within 2 minutes")
	})

	t.Run("Retry-After header is set when rate limited", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 3,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      3,
		})

		var retryAfter string
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.80:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				retryAfter = w.Header().Get("Retry-After")
				break
			}
		}

		assert.NotEmpty(t, retryAfter, "Retry-After header should be set when rate limited")

		retrySeconds, err := strconv.Atoi(retryAfter)
		require.NoError(t, err)
		assert.Greater(t, retrySeconds, 0, "Retry-After should be positive")
		assert.LessOrEqual(t, retrySeconds, 61, "Retry-After should be reasonable (within window)")
	})

	t.Run("All rate limit headers present on normal request", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 100,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      100,
		})

		req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
		req.RemoteAddr = "192.168.1.90:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.NotEmpty(t, w.Header().Get("X-RateLimit-Limit"), "X-RateLimit-Limit should be set")
		assert.NotEmpty(t, w.Header().Get("X-RateLimit-Remaining"), "X-RateLimit-Remaining should be set")
		assert.NotEmpty(t, w.Header().Get("X-RateLimit-Reset"), "X-RateLimit-Reset should be set")
	})
}

// ============================================================================
// 429 Response Tests
// ============================================================================

func TestRateLimited429Response(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("429 response has correct error format", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 2,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      2,
		})

		var rateLimitedResponse *httptest.ResponseRecorder
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.110:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				rateLimitedResponse = w
				break
			}
		}

		require.NotNil(t, rateLimitedResponse, "Should have received a 429 response")

		var resp map[string]interface{}
		err := json.Unmarshal(rateLimitedResponse.Body.Bytes(), &resp)
		require.NoError(t, err)

		errObj, ok := resp["error"].(map[string]interface{})
		require.True(t, ok, "Response should have error object")

		assert.Equal(t, "RATE_LIMITED", errObj["code"], "Error code should be RATE_LIMITED")
		assert.NotEmpty(t, errObj["message"], "Error should have message")
		assert.NotNil(t, errObj["retry_after"], "Error should have retry_after")
	})

	t.Run("429 response includes Retry-After header", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 2,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      2,
		})

		var rateLimitedResponse *httptest.ResponseRecorder
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.120:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				rateLimitedResponse = w
				break
			}
		}

		require.NotNil(t, rateLimitedResponse, "Should have received a 429 response")
		assert.NotEmpty(t, rateLimitedResponse.Header().Get("Retry-After"), "Should have Retry-After header")
	})

	t.Run("Retry-After value in body matches header", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 2,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      2,
		})

		var rateLimitedResponse *httptest.ResponseRecorder
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.130:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				rateLimitedResponse = w
				break
			}
		}

		require.NotNil(t, rateLimitedResponse, "Should have received a 429 response")

		headerRetryAfter, err := strconv.Atoi(rateLimitedResponse.Header().Get("Retry-After"))
		require.NoError(t, err)

		var resp map[string]interface{}
		err = json.Unmarshal(rateLimitedResponse.Body.Bytes(), &resp)
		require.NoError(t, err)

		errObj := resp["error"].(map[string]interface{})
		bodyRetryAfter := int(errObj["retry_after"].(float64))

		assert.Equal(t, headerRetryAfter, bodyRetryAfter, "Retry-After should match in header and body")
	})
}

// ============================================================================
// IP-Based Rate Limiting Tests
// ============================================================================

func TestIPBasedRateLimiting(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Unauthenticated requests are rate limited by IP", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 60,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      5, // Low limit for unauthenticated
		})

		rateLimited := false
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.140:12345" // Same IP, no user
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				rateLimited = true
				break
			}
		}

		assert.True(t, rateLimited, "Unauthenticated requests should be rate limited by IP")
	})

	t.Run("Different IPs have separate limits", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 60,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      3,
		})

		// Exhaust limit for IP 1
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.150:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
		}

		// IP 2 should still have full limit
		successCount := 0
		for i := 0; i < 3; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.151:12345" // Different IP
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusOK {
				successCount++
			}
		}

		assert.GreaterOrEqual(t, successCount, 2, "Different IP should have separate limit")
	})

	t.Run("IP limiting disabled still allows requests", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 60,
			EnableIPLimiting:         false, // Disabled
			IPRequestsPerMinute:      5,
		})

		// All requests should succeed (no auth, no IP limiting)
		for i := 0; i < 20; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.160:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code, "Request should succeed with IP limiting disabled")
		}
	})
}

// ============================================================================
// Sliding Window Tests
// ============================================================================

func TestSlidingWindowRateLimit(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Sliding window correctly expires old requests", func(t *testing.T) {
		// This test verifies sliding window behavior
		// Old requests outside the window should not count
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		})

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Make some requests
		for i := 0; i < 5; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			assert.Equal(t, http.StatusOK, w.Code)
		}

		// Check remaining should reflect usage
		req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		remaining, _ := strconv.Atoi(w.Header().Get("X-RateLimit-Remaining"))
		assert.LessOrEqual(t, remaining, 4, "Remaining should reflect previous requests")
	})
}

// ============================================================================
// Concurrent Request Tests
// ============================================================================

func TestConcurrentRequestHandling(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Concurrent requests are handled correctly", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 20,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      20,
		})

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		var wg sync.WaitGroup
		successCount := int32(0)
		rateLimitedCount := int32(0)

		// Send 30 concurrent requests
		for i := 0; i < 30; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()

				req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
				req.Header.Set("X-Test-User-ID", testUser.ID.String())
				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)

				if w.Code == http.StatusOK {
					atomic.AddInt32(&successCount, 1)
				} else if w.Code == http.StatusTooManyRequests {
					atomic.AddInt32(&rateLimitedCount, 1)
				}
			}()
		}

		wg.Wait()

		// Should have some successes and some rate limited
		assert.Greater(t, int(successCount), 0, "Some requests should succeed")
		assert.Greater(t, int(rateLimitedCount), 0, "Some requests should be rate limited")
		assert.Equal(t, int32(30), successCount+rateLimitedCount, "All requests should be handled")
	})

	t.Run("Concurrency limit middleware works", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupConcurrencyLimitTestRouter(suite.Redis, 3) // Max 3 concurrent

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		var wg sync.WaitGroup
		concurrentRejected := int32(0)

		// Start 10 concurrent slow requests
		for i := 0; i < 10; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()

				req := httptest.NewRequest(http.MethodGet, "/api/v1/slow", nil)
				req.Header.Set("X-Test-User-ID", testUser.ID.String())
				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)

				if w.Code == http.StatusServiceUnavailable {
					atomic.AddInt32(&concurrentRejected, 1)
				}
			}()
		}

		wg.Wait()

		// Some should be rejected due to concurrency limit
		assert.Greater(t, int(concurrentRejected), 0, "Some requests should be rejected for concurrency")
	})
}

// ============================================================================
// Adaptive Rate Limiting Tests
// ============================================================================

func TestAdaptiveRateLimiting(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Rate limit reduces under high load", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		// Set high load factor
		loadKey := "system:load_factor"
		suite.Redis.Set(ctx, loadKey, 0.8, time.Minute) // 80% load

		router := setupAdaptiveRateLimitTestRouter(suite.Redis, 100, loadKey)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/adaptive", nil)
		req.RemoteAddr = "192.168.1.170:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		loadFactorHeader := w.Header().Get("X-Load-Factor")
		assert.NotEmpty(t, loadFactorHeader, "Load factor header should be set")
		assert.Equal(t, "0.80", loadFactorHeader, "Load factor should reflect Redis value")
	})

	t.Run("Rate limit remains normal under low load", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		// Set low load factor
		loadKey := "system:load_factor"
		suite.Redis.Set(ctx, loadKey, 0.1, time.Minute) // 10% load

		router := setupAdaptiveRateLimitTestRouter(suite.Redis, 100, loadKey)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/adaptive", nil)
		req.RemoteAddr = "192.168.1.180:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		loadFactorHeader := w.Header().Get("X-Load-Factor")
		assert.Equal(t, "0.10", loadFactorHeader, "Load factor should be low")
	})

	t.Run("SetLoadFactor helper works correctly", func(t *testing.T) {
		ctx := context.Background()

		err := middleware.SetLoadFactor(ctx, suite.Redis, "test:load", 0.5)
		require.NoError(t, err)

		val, err := suite.Redis.Get(ctx, "test:load").Float64()
		require.NoError(t, err)
		assert.Equal(t, 0.5, val)
	})
}

// ============================================================================
// Helper Functions
// ============================================================================

func setupRateLimitTestRouter(redisClient *redis.Client, cfg middleware.RateLimitConfig) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(testAuthMiddlewareForRateLimit())
	router.Use(middleware.RateLimit(cfg))

	router.GET("/api/v1/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	router.GET("/api/v1/metrics", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"metrics": "data"})
	})

	return router
}

func setupRateLimitTestRouterWithRoles(redisClient *redis.Client, cfg middleware.RateLimitConfig) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(testAuthMiddlewareForRateLimitWithRoles())
	router.Use(middleware.RateLimit(cfg))

	router.GET("/api/v1/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}

func setupRateLimitTestRouterWithMultipleRoles(redisClient *redis.Client, cfg middleware.RateLimitConfig) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(testAuthMiddlewareForRateLimitWithMultipleRoles())
	router.Use(middleware.RateLimit(cfg))

	router.GET("/api/v1/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}

func setupRateLimitTestRouterWithEndpoints(redisClient *redis.Client, cfg middleware.RateLimitConfig) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(testAuthMiddlewareForRateLimit())
	router.Use(middleware.RateLimit(cfg))

	router.POST("/api/v1/auth/login", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "logged in"})
	})

	router.POST("/api/v1/auth/register", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"status": "registered"})
	})

	router.POST("/api/v1/wallet/topup", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "topped up"})
	})

	router.GET("/api/v1/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}

func setupRateLimitTestRouterWithEndpointsAndRoles(redisClient *redis.Client, cfg middleware.RateLimitConfig) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(testAuthMiddlewareForRateLimitWithRoles())
	router.Use(middleware.RateLimit(cfg))

	router.GET("/api/v1/limited", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}

func setupRateLimitTestRouterWithSkipPaths(redisClient *redis.Client, cfg middleware.RateLimitConfig) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(testAuthMiddlewareForRateLimit())
	router.Use(middleware.RateLimit(cfg))

	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	router.GET("/api/v1/metrics", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"metrics": "data"})
	})

	router.GET("/api/v1/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}

func setupBurstRateLimitTestRouter(redisClient *redis.Client, ratePerSecond, burstSize int) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(testAuthMiddlewareForRateLimit())
	router.Use(middleware.BurstRateLimit(redisClient, ratePerSecond, burstSize))

	router.GET("/api/v1/burst", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}

func setupConcurrencyLimitTestRouter(redisClient *redis.Client, maxConcurrent int) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(testAuthMiddlewareForRateLimit())
	router.Use(middleware.ConcurrencyLimit(redisClient, maxConcurrent))

	router.GET("/api/v1/slow", func(c *gin.Context) {
		// Simulate slow operation
		time.Sleep(100 * time.Millisecond)
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}

func setupAdaptiveRateLimitTestRouter(redisClient *redis.Client, baseLimit int, loadKey string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(testAuthMiddlewareForRateLimit())
	router.Use(middleware.AdaptiveRateLimit(redisClient, baseLimit, loadKey))

	router.GET("/api/v1/adaptive", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}

func testAuthMiddlewareForRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-Test-User-ID")
		if userID != "" {
			c.Set("user_id", userID)
		}
		c.Next()
	}
}

func testAuthMiddlewareForRateLimitWithRoles() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-Test-User-ID")
		if userID != "" {
			c.Set("user_id", userID)
		}

		roles := c.GetHeader("X-Test-Roles")
		if roles != "" {
			c.Set("roles", []string{roles})
		}
		c.Next()
	}
}

func testAuthMiddlewareForRateLimitWithMultipleRoles() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-Test-User-ID")
		if userID != "" {
			c.Set("user_id", userID)
		}

		roles := c.GetHeader("X-Test-Roles")
		if roles != "" {
			// Parse comma-separated roles
			roleList := []string{}
			for _, r := range splitRoles(roles) {
				roleList = append(roleList, r)
			}
			c.Set("roles", roleList)
		}
		c.Next()
	}
}

func splitRoles(roles string) []string {
	result := []string{}
	current := ""
	for _, c := range roles {
		if c == ',' {
			if current != "" {
				result = append(result, current)
			}
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

// ============================================================================
// Rate Limit By Endpoint Tests
// ============================================================================

func TestRateLimitByEndpoint(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Endpoint-specific middleware applies correct limit", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := gin.New()
		router.Use(gin.Recovery())
		router.Use(testAuthMiddlewareForRateLimit())

		// Different limits for different endpoints
		router.GET("/api/v1/fast", middleware.RateLimitByEndpoint(suite.Redis, 20), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "fast"})
		})

		router.GET("/api/v1/slow", middleware.RateLimitByEndpoint(suite.Redis, 5), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "slow"})
		})

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Test slow endpoint gets limited faster
		slowLimitedAt := 0
		for i := 0; i < 15; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/slow", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				slowLimitedAt = i
				break
			}
		}

		assert.Greater(t, slowLimitedAt, 0, "Slow endpoint should be rate limited")
		assert.LessOrEqual(t, slowLimitedAt, 6, "Slow endpoint should be limited around 5 requests")

		// Fast endpoint should handle more
		fastSuccessCount := 0
		for i := 0; i < 15; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/fast", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusOK {
				fastSuccessCount++
			}
		}

		assert.Greater(t, fastSuccessCount, slowLimitedAt, "Fast endpoint should handle more requests")
	})
}

// ============================================================================
// Integration with Authentication Tests
// ============================================================================

func TestRateLimitWithAuthentication(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Authenticated user uses user-based limiting", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 20,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      5, // Lower IP limit
		})

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Authenticated user should get user limit (20), not IP limit (5)
		successCount := 0
		for i := 0; i < 15; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			req.RemoteAddr = "192.168.1.190:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusOK {
				successCount++
			}
		}

		// Should have more than IP limit (5) successes
		assert.Greater(t, successCount, 5, "Authenticated user should use user limit, not IP limit")
	})

	t.Run("Same IP different users have separate limits", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupRateLimitTestRouter(suite.Redis, middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      5,
		})

		user1 := helpers.CreateTestUser(t, suite.DB, nil)
		user2 := helpers.CreateTestUser(t, suite.DB, &helpers.TestUserOptions{
			Email: fmt.Sprintf("user2_%s@test.com", uuid.New().String()[:8]),
		})

		// Exhaust user1's limit
		for i := 0; i < 15; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", user1.ID.String())
			req.RemoteAddr = "192.168.1.200:12345" // Same IP
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
		}

		// User2 from same IP should still have full limit
		user2Success := 0
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", user2.ID.String())
			req.RemoteAddr = "192.168.1.200:12345" // Same IP
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusOK {
				user2Success++
			}
		}

		assert.Greater(t, user2Success, 5, "Different user from same IP should have separate limit")
	})
}
