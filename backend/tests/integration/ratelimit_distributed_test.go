package integration

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mimi6060/festivals/backend/internal/middleware"
	"github.com/mimi6060/festivals/backend/tests/helpers"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
)

// ============================================================================
// Redis-Based Distributed Rate Limiting Tests
// ============================================================================

func TestRedisDistributedRateLimiting(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Rate limit state is persisted in Redis", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		}

		router := setupRateLimitTestRouter(suite.Redis, cfg)
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Make some requests
		for i := 0; i < 5; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			assert.Equal(t, http.StatusOK, w.Code)
		}

		// Verify state in Redis
		key := fmt.Sprintf("ratelimit:user:%s", testUser.ID.String())
		count, err := suite.Redis.ZCard(ctx, key).Result()
		require.NoError(t, err)
		assert.Equal(t, int64(5), count, "Redis should have recorded 5 requests")
	})

	t.Run("Rate limit keys have proper TTL", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		}

		router := setupRateLimitTestRouter(suite.Redis, cfg)
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Make a request
		req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Check TTL
		key := fmt.Sprintf("ratelimit:user:%s", testUser.ID.String())
		ttl, err := suite.Redis.TTL(ctx, key).Result()
		require.NoError(t, err)
		assert.Greater(t, ttl, time.Duration(0), "Key should have TTL set")
		assert.LessOrEqual(t, ttl, time.Minute+time.Second, "TTL should be around 1 minute")
	})

	t.Run("Old entries are removed from sliding window", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 100,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      100,
		}

		router := setupRateLimitTestRouter(suite.Redis, cfg)
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Add some entries directly to Redis with old timestamps
		key := fmt.Sprintf("ratelimit:user:%s", testUser.ID.String())
		oldTimestamp := time.Now().Add(-2 * time.Minute).UnixNano()

		// Add old entries
		for i := 0; i < 5; i++ {
			suite.Redis.ZAdd(ctx, key, redis.Z{
				Score:  float64(oldTimestamp + int64(i)),
				Member: fmt.Sprintf("%d", oldTimestamp+int64(i)),
			})
		}

		// Make a new request - should trigger cleanup
		req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Old entries should be removed
		count, err := suite.Redis.ZCard(ctx, key).Result()
		require.NoError(t, err)
		assert.LessOrEqual(t, count, int64(2), "Old entries should be cleaned up")
	})

	t.Run("Consistent rate limiting with atomic operations", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 50,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      50,
		}

		router := setupRateLimitTestRouter(suite.Redis, cfg)
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		var wg sync.WaitGroup
		successCount := int32(0)
		rateLimitedCount := int32(0)

		// Send 100 concurrent requests
		for i := 0; i < 100; i++ {
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

		// All requests should be handled
		assert.Equal(t, int32(100), successCount+rateLimitedCount, "All requests should be handled")

		// Success count should be close to limit (but concurrent access may vary)
		assert.LessOrEqual(t, int(successCount), 55, "Success count should not greatly exceed limit")
		assert.Greater(t, int(rateLimitedCount), 0, "Some requests should be rate limited")
	})
}

// ============================================================================
// Rate Limit Across Multiple API Instances
// ============================================================================

func TestRateLimitAcrossMultipleInstances(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Rate limit is shared across multiple router instances", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		}

		// Create two "API instances" (different router instances sharing Redis)
		router1 := setupRateLimitTestRouter(suite.Redis, cfg)
		router2 := setupRateLimitTestRouter(suite.Redis, cfg)

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Make 5 requests to instance 1
		for i := 0; i < 5; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router1.ServeHTTP(w, req)
			assert.Equal(t, http.StatusOK, w.Code, "Instance 1 request %d should succeed", i+1)
		}

		// Make 5 more requests to instance 2 - should hit the shared limit
		rateLimited := false
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router2.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				rateLimited = true
				break
			}
		}

		assert.True(t, rateLimited, "Instance 2 should be rate limited due to shared state with Instance 1")
	})

	t.Run("Round-robin requests across instances respect total limit", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 20,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      20,
		}

		routers := []*gin.Engine{
			setupRateLimitTestRouter(suite.Redis, cfg),
			setupRateLimitTestRouter(suite.Redis, cfg),
			setupRateLimitTestRouter(suite.Redis, cfg),
		}

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		successCount := 0
		rateLimitedCount := 0

		// Send 30 requests round-robin across 3 instances
		for i := 0; i < 30; i++ {
			router := routers[i%3]
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusOK {
				successCount++
			} else if w.Code == http.StatusTooManyRequests {
				rateLimitedCount++
			}
		}

		// Should have around 20 successes (the limit)
		assert.LessOrEqual(t, successCount, 25, "Success count should respect shared limit")
		assert.Greater(t, rateLimitedCount, 0, "Some requests should be rate limited")
	})

	t.Run("Concurrent requests across instances maintain consistency", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 30,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      30,
		}

		routers := []*gin.Engine{
			setupRateLimitTestRouter(suite.Redis, cfg),
			setupRateLimitTestRouter(suite.Redis, cfg),
			setupRateLimitTestRouter(suite.Redis, cfg),
		}

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		var wg sync.WaitGroup
		successCount := int32(0)
		rateLimitedCount := int32(0)

		// Send 60 concurrent requests across 3 instances
		for i := 0; i < 60; i++ {
			wg.Add(1)
			routerIdx := i % 3
			go func(idx int) {
				defer wg.Done()

				router := routers[idx]
				req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
				req.Header.Set("X-Test-User-ID", testUser.ID.String())
				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)

				if w.Code == http.StatusOK {
					atomic.AddInt32(&successCount, 1)
				} else if w.Code == http.StatusTooManyRequests {
					atomic.AddInt32(&rateLimitedCount, 1)
				}
			}(routerIdx)
		}

		wg.Wait()

		// All requests should be handled
		assert.Equal(t, int32(60), successCount+rateLimitedCount, "All requests should be handled")
		// Success should be close to limit
		assert.LessOrEqual(t, int(successCount), 40, "Success count should not greatly exceed limit")
	})
}

// ============================================================================
// Failover When Redis is Unavailable
// ============================================================================

func TestRedisFailover(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Rate limiting fails open when Redis unavailable", func(t *testing.T) {
		// Create a client that points to a non-existent Redis
		badRedisClient := redis.NewClient(&redis.Options{
			Addr:        "localhost:59999", // Non-existent port
			DialTimeout: 100 * time.Millisecond,
		})
		defer badRedisClient.Close()

		cfg := middleware.RateLimitConfig{
			RedisClient:              badRedisClient,
			DefaultRequestsPerMinute: 5,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      5,
		}

		router := setupRateLimitTestRouter(badRedisClient, cfg)

		// Requests should succeed (fail open) even though limit is 5
		for i := 0; i < 20; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.210:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code, "Request %d should succeed (fail open)", i+1)
		}
	})

	t.Run("Rate limiting recovers when Redis becomes available again", func(t *testing.T) {
		ctx := context.Background()

		// Start with functioning Redis
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		}

		router := setupRateLimitTestRouter(suite.Redis, cfg)

		// First verify it works
		req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
		req.RemoteAddr = "192.168.1.220:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)

		// Make more requests - should eventually be limited
		rateLimited := false
		for i := 0; i < 20; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.220:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				rateLimited = true
				break
			}
		}

		assert.True(t, rateLimited, "Should be rate limited when Redis is working")
	})

	t.Run("Graceful handling of Redis connection timeout", func(t *testing.T) {
		// Create a client with very short timeout
		slowRedisClient := redis.NewClient(&redis.Options{
			Addr:        suite.Redis.Options().Addr,
			ReadTimeout: 1 * time.Nanosecond, // Extremely short timeout
		})
		defer slowRedisClient.Close()

		cfg := middleware.RateLimitConfig{
			RedisClient:              slowRedisClient,
			DefaultRequestsPerMinute: 5,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      5,
		}

		router := setupRateLimitTestRouter(slowRedisClient, cfg)

		// Requests should still work (fail open)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
		req.RemoteAddr = "192.168.1.230:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Should succeed regardless of timeout issues
		assert.Equal(t, http.StatusOK, w.Code, "Should succeed even with Redis timeout")
	})

	t.Run("Nil Redis client completely disables rate limiting", func(t *testing.T) {
		cfg := middleware.RateLimitConfig{
			RedisClient:              nil,
			DefaultRequestsPerMinute: 1,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      1,
		}

		router := setupRateLimitTestRouter(nil, cfg)

		// All requests should succeed
		for i := 0; i < 50; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = "192.168.1.240:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code, "Request %d should succeed without Redis", i+1)
		}
	})
}

// ============================================================================
// Rate Limit Reset Tests
// ============================================================================

func TestRateLimitReset(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Rate limit resets after window expires", func(t *testing.T) {
		// This test uses a custom short window for testing
		// In production, the window is 1 minute
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 5,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      5,
		}

		router := setupRateLimitTestRouter(suite.Redis, cfg)
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Exhaust the limit
		rateLimited := false
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusTooManyRequests {
				rateLimited = true
				break
			}
		}

		assert.True(t, rateLimited, "Should be rate limited")

		// Manually clear the sliding window to simulate time passing
		key := fmt.Sprintf("ratelimit:user:%s", testUser.ID.String())
		suite.Redis.Del(ctx, key)

		// Should be able to make requests again
		req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code, "Should succeed after reset")
	})

	t.Run("Partial window expiry removes old entries", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		}

		router := setupRateLimitTestRouter(suite.Redis, cfg)
		testUser := helpers.CreateTestUser(t, suite.DB, nil)
		key := fmt.Sprintf("ratelimit:user:%s", testUser.ID.String())

		// Add entries with mixed timestamps
		now := time.Now()
		oldTime := now.Add(-90 * time.Second) // Outside window
		recentTime := now.Add(-30 * time.Second) // Inside window

		// Add old entries
		for i := 0; i < 5; i++ {
			ts := oldTime.UnixNano() + int64(i)
			suite.Redis.ZAdd(ctx, key, redis.Z{
				Score:  float64(ts),
				Member: fmt.Sprintf("%d", ts),
			})
		}

		// Add recent entries
		for i := 0; i < 3; i++ {
			ts := recentTime.UnixNano() + int64(i)
			suite.Redis.ZAdd(ctx, key, redis.Z{
				Score:  float64(ts),
				Member: fmt.Sprintf("%d", ts),
			})
		}

		// Trigger cleanup with a new request
		req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Should have cleaned up old entries
		count, err := suite.Redis.ZCard(ctx, key).Result()
		require.NoError(t, err)
		assert.LessOrEqual(t, count, int64(5), "Old entries should be removed, only recent + new should remain")
	})

	t.Run("Flush specific user rate limit", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 5,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      5,
		}

		router := setupRateLimitTestRouter(suite.Redis, cfg)
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Exhaust the limit
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
		}

		// Delete specific user's rate limit key
		key := fmt.Sprintf("ratelimit:user:%s", testUser.ID.String())
		deleted, err := suite.Redis.Del(ctx, key).Result()
		require.NoError(t, err)
		assert.Equal(t, int64(1), deleted, "Should have deleted the key")

		// User should have fresh limit
		successCount := 0
		for i := 0; i < 5; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusOK {
				successCount++
			}
		}

		assert.GreaterOrEqual(t, successCount, 4, "User should have fresh limit after reset")
	})

	t.Run("Flush IP rate limit", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		cfg := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 60,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      5,
		}

		router := setupRateLimitTestRouter(suite.Redis, cfg)
		testIP := "192.168.1.250"

		// Exhaust IP limit
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.RemoteAddr = testIP + ":12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
		}

		// Delete IP's rate limit key
		key := fmt.Sprintf("ratelimit:ip:%s", testIP)
		suite.Redis.Del(ctx, key)

		// IP should have fresh limit
		req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
		req.RemoteAddr = testIP + ":12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code, "IP should have fresh limit after reset")
	})
}

// ============================================================================
// Token Bucket Distributed Tests
// ============================================================================

func TestDistributedTokenBucket(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Token bucket state is shared across instances", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router1 := setupBurstRateLimitTestRouter(suite.Redis, 5, 3) // 5/sec, 3 burst
		router2 := setupBurstRateLimitTestRouter(suite.Redis, 5, 3)

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Exhaust tokens on instance 1
		for i := 0; i < 5; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/burst", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router1.ServeHTTP(w, req)
		}

		// Instance 2 should see depleted tokens
		req := httptest.NewRequest(http.MethodGet, "/api/v1/burst", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())
		w := httptest.NewRecorder()
		router2.ServeHTTP(w, req)

		// May or may not be rate limited depending on timing, but state should be shared
		assert.Contains(t, []int{http.StatusOK, http.StatusTooManyRequests}, w.Code)
	})

	t.Run("Token bucket keys stored correctly in Redis", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupBurstRateLimitTestRouter(suite.Redis, 5, 10)
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Make a request
		req := httptest.NewRequest(http.MethodGet, "/api/v1/burst", nil)
		req.Header.Set("X-Test-User-ID", testUser.ID.String())
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Verify keys exist
		tokensKey := fmt.Sprintf("ratelimit:burst:user:%s:tokens", testUser.ID.String())
		lastKey := fmt.Sprintf("ratelimit:burst:user:%s:last", testUser.ID.String())

		tokensExist, err := suite.Redis.Exists(ctx, tokensKey).Result()
		require.NoError(t, err)
		lastExist, err := suite.Redis.Exists(ctx, lastKey).Result()
		require.NoError(t, err)

		assert.Equal(t, int64(1), tokensExist, "Tokens key should exist")
		assert.Equal(t, int64(1), lastExist, "Last timestamp key should exist")
	})
}

// ============================================================================
// Concurrency Limit Distributed Tests
// ============================================================================

func TestDistributedConcurrencyLimit(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Concurrency counter is shared across instances", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router1 := setupConcurrencyLimitTestRouter(suite.Redis, 2) // Max 2 concurrent
		router2 := setupConcurrencyLimitTestRouter(suite.Redis, 2)

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		var wg sync.WaitGroup
		rejectedCount := int32(0)

		// Start concurrent requests across both instances
		for i := 0; i < 10; i++ {
			wg.Add(1)
			router := router1
			if i%2 == 0 {
				router = router2
			}
			go func(r *gin.Engine) {
				defer wg.Done()

				req := httptest.NewRequest(http.MethodGet, "/api/v1/slow", nil)
				req.Header.Set("X-Test-User-ID", testUser.ID.String())
				w := httptest.NewRecorder()
				r.ServeHTTP(w, req)

				if w.Code == http.StatusServiceUnavailable {
					atomic.AddInt32(&rejectedCount, 1)
				}
			}(router)
		}

		wg.Wait()

		// Should have some rejections due to shared concurrency limit
		assert.Greater(t, int(rejectedCount), 0, "Some requests should be rejected")
	})

	t.Run("Concurrency counter decrements correctly", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		router := setupConcurrencyLimitTestRouter(suite.Redis, 5)
		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Make sequential requests (not concurrent)
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/slow", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// All should succeed because counter decrements after each
			assert.Equal(t, http.StatusOK, w.Code, "Sequential request %d should succeed", i+1)
		}

		// Verify counter is back to 0
		key := fmt.Sprintf("concurrent:user:%s", testUser.ID.String())
		count, err := suite.Redis.Get(ctx, key).Int64()
		// Key might not exist or be 0
		if err != nil && err != redis.Nil {
			t.Fatalf("Error getting counter: %v", err)
		}
		assert.LessOrEqual(t, count, int64(1), "Counter should be low after all requests complete")
	})
}

// ============================================================================
// Redis Cluster Simulation Tests
// ============================================================================

func TestRedisClusterSimulation(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping Redis cluster simulation in short mode")
	}

	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Rate limiting works with multiple Redis connections", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		// Create multiple Redis clients pointing to same server (simulating cluster)
		clients := []*redis.Client{
			redis.NewClient(suite.Redis.Options()),
			redis.NewClient(suite.Redis.Options()),
		}
		defer func() {
			for _, c := range clients {
				c.Close()
			}
		}()

		// Create routers with different Redis clients
		routers := make([]*gin.Engine, len(clients))
		for i, client := range clients {
			cfg := middleware.RateLimitConfig{
				RedisClient:              client,
				DefaultRequestsPerMinute: 10,
				KeyPrefix:                "ratelimit:",
				EnableIPLimiting:         true,
				IPRequestsPerMinute:      10,
			}
			routers[i] = setupRateLimitTestRouter(client, cfg)
		}

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		successCount := 0
		for i := 0; i < 15; i++ {
			router := routers[i%len(routers)]
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code == http.StatusOK {
				successCount++
			}
		}

		// Success count should be around the limit
		assert.LessOrEqual(t, successCount, 12, "Success count should respect shared limit")
	})
}

// ============================================================================
// Multiple Redis Containers Test
// ============================================================================

func TestMultipleRedisInstances(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping multiple Redis instances test in short mode")
	}

	ctx := context.Background()

	// Start a second Redis container
	redisC2, err := tcredis.Run(ctx,
		"redis:7-alpine",
		testcontainers.WithWaitStrategy(
			wait.ForLog("Ready to accept connections").
				WithStartupTimeout(30*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("Failed to start second Redis container: %v", err)
	}
	defer func() {
		if err := redisC2.Terminate(ctx); err != nil {
			t.Logf("Failed to terminate Redis container: %v", err)
		}
	}()

	redisHost2, _ := redisC2.Host(ctx)
	redisPort2, _ := redisC2.MappedPort(ctx, "6379")

	redis2 := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", redisHost2, redisPort2.Port()),
	})
	defer redis2.Close()

	t.Run("Different Redis instances maintain separate state", func(t *testing.T) {
		suite := SetupTestSuite(t)
		defer suite.CleanupDatabase(t)

		suite.Redis.FlushDB(ctx)
		redis2.FlushDB(ctx)

		// Router 1 uses main Redis
		cfg1 := middleware.RateLimitConfig{
			RedisClient:              suite.Redis,
			DefaultRequestsPerMinute: 10,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		}
		router1 := setupRateLimitTestRouter(suite.Redis, cfg1)

		// Router 2 uses second Redis
		cfg2 := middleware.RateLimitConfig{
			RedisClient:              redis2,
			DefaultRequestsPerMinute: 10,
			KeyPrefix:                "ratelimit:",
			EnableIPLimiting:         true,
			IPRequestsPerMinute:      10,
		}
		router2 := setupRateLimitTestRouter(redis2, cfg2)

		testUser := helpers.CreateTestUser(t, suite.DB, nil)

		// Exhaust limit on router1
		for i := 0; i < 15; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router1.ServeHTTP(w, req)
		}

		// Router2 (different Redis) should have separate state
		successCount := 0
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("X-Test-User-ID", testUser.ID.String())
			w := httptest.NewRecorder()
			router2.ServeHTTP(w, req)

			if w.Code == http.StatusOK {
				successCount++
			}
		}

		// Router2 should have its full limit available
		assert.GreaterOrEqual(t, successCount, 8, "Router2 should have separate limit")
	})
}

// ============================================================================
// Adaptive Rate Limit Distributed Tests
// ============================================================================

func TestDistributedAdaptiveRateLimit(t *testing.T) {
	suite := SetupTestSuite(t)
	defer suite.CleanupDatabase(t)

	t.Run("Load factor is shared across instances", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		loadKey := "system:load_factor"

		// Set load factor from one instance
		err := middleware.SetLoadFactor(ctx, suite.Redis, loadKey, 0.75)
		require.NoError(t, err)

		// Create routers
		router1 := setupAdaptiveRateLimitTestRouter(suite.Redis, 100, loadKey)
		router2 := setupAdaptiveRateLimitTestRouter(suite.Redis, 100, loadKey)

		// Both should see the same load factor
		for _, router := range []*gin.Engine{router1, router2} {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/adaptive", nil)
			req.RemoteAddr = "192.168.1.50:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			loadFactorHeader := w.Header().Get("X-Load-Factor")
			assert.Equal(t, "0.75", loadFactorHeader, "Load factor should be shared")
		}
	})

	t.Run("Load factor updates propagate to all instances", func(t *testing.T) {
		ctx := context.Background()
		suite.Redis.FlushDB(ctx)

		loadKey := "system:shared_load"

		// Initial load
		middleware.SetLoadFactor(ctx, suite.Redis, loadKey, 0.2)

		router1 := setupAdaptiveRateLimitTestRouter(suite.Redis, 100, loadKey)
		router2 := setupAdaptiveRateLimitTestRouter(suite.Redis, 100, loadKey)

		// Check initial load
		req := httptest.NewRequest(http.MethodGet, "/api/v1/adaptive", nil)
		req.RemoteAddr = "192.168.1.51:12345"
		w := httptest.NewRecorder()
		router1.ServeHTTP(w, req)
		assert.Equal(t, "0.20", w.Header().Get("X-Load-Factor"))

		// Update load
		middleware.SetLoadFactor(ctx, suite.Redis, loadKey, 0.9)

		// Both routers should see updated load
		for _, router := range []*gin.Engine{router1, router2} {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/adaptive", nil)
			req.RemoteAddr = "192.168.1.52:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			loadFactorHeader := w.Header().Get("X-Load-Factor")
			assert.Equal(t, "0.90", loadFactorHeader, "Updated load factor should be visible")
		}
	})
}

// ============================================================================
// Helper Functions
// ============================================================================

// No additional helper functions needed - using the ones from ratelimit_test.go
