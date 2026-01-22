package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// RateLimitConfig holds configuration for rate limiting
type RateLimitConfig struct {
	// Redis client for distributed rate limiting
	RedisClient *redis.Client

	// Default limits
	DefaultRequestsPerMinute int
	DefaultRequestsPerHour   int

	// Role-based limits (requests per minute)
	RoleLimits map[string]RoleLimit

	// Per-endpoint limits (optional)
	EndpointLimits map[string]int

	// Skip rate limiting for certain paths
	SkipPaths []string

	// Key prefix for Redis
	KeyPrefix string

	// Enable per-IP limiting for unauthenticated requests
	EnableIPLimiting bool

	// IP limit for unauthenticated requests
	IPRequestsPerMinute int
}

// RoleLimit defines rate limits for a specific role
type RoleLimit struct {
	RequestsPerMinute int
	RequestsPerHour   int
	BurstSize         int // Maximum burst allowed
}

// RateLimitInfo contains rate limit information for response headers
type RateLimitInfo struct {
	Limit     int
	Remaining int
	Reset     time.Time
}

// DefaultRateLimitConfig returns default rate limiting configuration
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		DefaultRequestsPerMinute: 60,
		DefaultRequestsPerHour:   1000,
		RoleLimits: map[string]RoleLimit{
			RoleAdmin: {
				RequestsPerMinute: 300,
				RequestsPerHour:   10000,
				BurstSize:         50,
			},
			RoleOrganizer: {
				RequestsPerMinute: 200,
				RequestsPerHour:   5000,
				BurstSize:         30,
			},
			RoleStaff: {
				RequestsPerMinute: 120,
				RequestsPerHour:   3000,
				BurstSize:         20,
			},
			RoleUser: {
				RequestsPerMinute: 60,
				RequestsPerHour:   1000,
				BurstSize:         10,
			},
		},
		KeyPrefix:           "ratelimit:",
		EnableIPLimiting:    true,
		IPRequestsPerMinute: 30,
	}
}

// RateLimit creates a rate limiting middleware
func RateLimit(cfg RateLimitConfig) gin.HandlerFunc {
	if cfg.RedisClient == nil {
		log.Warn().Msg("Rate limiting disabled: no Redis client provided")
		return func(c *gin.Context) {
			c.Next()
		}
	}

	if cfg.KeyPrefix == "" {
		cfg.KeyPrefix = "ratelimit:"
	}

	if cfg.DefaultRequestsPerMinute == 0 {
		cfg.DefaultRequestsPerMinute = 60
	}

	return func(c *gin.Context) {
		// Check if path should be skipped
		for _, path := range cfg.SkipPaths {
			if c.Request.URL.Path == path {
				c.Next()
				return
			}
		}

		var key string
		var limit int

		// Determine key and limit based on authentication status
		userID := c.GetString("user_id")
		if userID != "" {
			// Authenticated user - use user-based rate limiting
			key = cfg.KeyPrefix + "user:" + userID
			limit = cfg.DefaultRequestsPerMinute

			// Check role-based limits
			roles := GetRoles(c)
			if len(roles) > 0 {
				highestRole := GetHighestRole(roles)
				if roleLimit, ok := cfg.RoleLimits[highestRole]; ok {
					limit = roleLimit.RequestsPerMinute
				}
			}
		} else if cfg.EnableIPLimiting {
			// Unauthenticated - use IP-based rate limiting
			clientIP := c.ClientIP()
			key = cfg.KeyPrefix + "ip:" + clientIP
			limit = cfg.IPRequestsPerMinute
			if limit == 0 {
				limit = 30 // Default IP limit
			}
		} else {
			// No rate limiting for unauthenticated if IP limiting is disabled
			c.Next()
			return
		}

		// Check endpoint-specific limits
		if endpointLimit, ok := cfg.EndpointLimits[c.FullPath()]; ok {
			if endpointLimit < limit {
				limit = endpointLimit
			}
		}

		// Apply rate limiting using sliding window
		ctx := c.Request.Context()
		allowed, info, err := checkSlidingWindowRateLimit(ctx, cfg.RedisClient, key, limit, time.Minute)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("Rate limit check failed")
			// Fail open - allow request if rate limiting fails
			c.Next()
			return
		}

		// Set rate limit headers
		setRateLimitHeaders(c, info)

		if !allowed {
			respondRateLimited(c, info)
			return
		}

		c.Next()
	}
}

// RateLimitByEndpoint creates endpoint-specific rate limiting
func RateLimitByEndpoint(redisClient *redis.Client, requestsPerMinute int) gin.HandlerFunc {
	if redisClient == nil {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		endpoint := c.FullPath()

		var key string
		if userID != "" {
			key = fmt.Sprintf("ratelimit:endpoint:%s:user:%s", endpoint, userID)
		} else {
			key = fmt.Sprintf("ratelimit:endpoint:%s:ip:%s", endpoint, c.ClientIP())
		}

		ctx := c.Request.Context()
		allowed, info, err := checkSlidingWindowRateLimit(ctx, redisClient, key, requestsPerMinute, time.Minute)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("Endpoint rate limit check failed")
			c.Next()
			return
		}

		setRateLimitHeaders(c, info)

		if !allowed {
			respondRateLimited(c, info)
			return
		}

		c.Next()
	}
}

// checkSlidingWindowRateLimit implements sliding window rate limiting using Redis
func checkSlidingWindowRateLimit(ctx context.Context, client *redis.Client, key string, limit int, window time.Duration) (bool, *RateLimitInfo, error) {
	now := time.Now()
	windowStart := now.Add(-window)

	// Use Redis pipeline for atomic operations
	pipe := client.Pipeline()

	// Remove old entries outside the window
	pipe.ZRemRangeByScore(ctx, key, "0", strconv.FormatInt(windowStart.UnixNano(), 10))

	// Count current requests in window
	countCmd := pipe.ZCard(ctx, key)

	// Add current request
	pipe.ZAdd(ctx, key, redis.Z{
		Score:  float64(now.UnixNano()),
		Member: fmt.Sprintf("%d", now.UnixNano()),
	})

	// Set expiry on the key
	pipe.Expire(ctx, key, window)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, nil, fmt.Errorf("failed to execute rate limit pipeline: %w", err)
	}

	count := int(countCmd.Val())
	remaining := limit - count - 1
	if remaining < 0 {
		remaining = 0
	}

	info := &RateLimitInfo{
		Limit:     limit,
		Remaining: remaining,
		Reset:     now.Add(window),
	}

	// Check if over limit (count is before adding current request)
	if count >= limit {
		return false, info, nil
	}

	return true, info, nil
}

// setRateLimitHeaders sets the rate limit headers on the response
func setRateLimitHeaders(c *gin.Context, info *RateLimitInfo) {
	if info == nil {
		return
	}

	c.Header("X-RateLimit-Limit", strconv.Itoa(info.Limit))
	c.Header("X-RateLimit-Remaining", strconv.Itoa(info.Remaining))
	c.Header("X-RateLimit-Reset", strconv.FormatInt(info.Reset.Unix(), 10))

	// Also set standard Retry-After if remaining is 0
	if info.Remaining == 0 {
		retryAfter := int(time.Until(info.Reset).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		c.Header("Retry-After", strconv.Itoa(retryAfter))
	}
}

// respondRateLimited sends a rate limited response
func respondRateLimited(c *gin.Context, info *RateLimitInfo) {
	retryAfter := int(time.Until(info.Reset).Seconds())
	if retryAfter < 1 {
		retryAfter = 1
	}

	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
		"error": gin.H{
			"code":        "RATE_LIMITED",
			"message":     "Too many requests. Please try again later.",
			"retry_after": retryAfter,
		},
	})
}

// BurstRateLimit creates a token bucket style rate limiter for handling bursts
func BurstRateLimit(redisClient *redis.Client, ratePerSecond int, burstSize int) gin.HandlerFunc {
	if redisClient == nil {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		var key string
		if userID != "" {
			key = "ratelimit:burst:user:" + userID
		} else {
			key = "ratelimit:burst:ip:" + c.ClientIP()
		}

		ctx := c.Request.Context()
		allowed, info, err := checkTokenBucket(ctx, redisClient, key, ratePerSecond, burstSize)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("Burst rate limit check failed")
			c.Next()
			return
		}

		setRateLimitHeaders(c, info)

		if !allowed {
			respondRateLimited(c, info)
			return
		}

		c.Next()
	}
}

// checkTokenBucket implements token bucket rate limiting
func checkTokenBucket(ctx context.Context, client *redis.Client, key string, rate int, burst int) (bool, *RateLimitInfo, error) {
	now := time.Now()
	tokensKey := key + ":tokens"
	lastKey := key + ":last"

	// Lua script for atomic token bucket operation
	script := redis.NewScript(`
		local tokens_key = KEYS[1]
		local last_key = KEYS[2]
		local rate = tonumber(ARGV[1])
		local burst = tonumber(ARGV[2])
		local now = tonumber(ARGV[3])
		local ttl = tonumber(ARGV[4])

		local last = tonumber(redis.call('get', last_key)) or now
		local tokens = tonumber(redis.call('get', tokens_key)) or burst

		-- Calculate new tokens based on time elapsed
		local elapsed = now - last
		tokens = math.min(burst, tokens + (elapsed * rate / 1000000000))

		local allowed = 0
		if tokens >= 1 then
			tokens = tokens - 1
			allowed = 1
		end

		redis.call('set', tokens_key, tokens, 'EX', ttl)
		redis.call('set', last_key, now, 'EX', ttl)

		return {allowed, math.floor(tokens)}
	`)

	result, err := script.Run(ctx, client, []string{tokensKey, lastKey},
		rate, burst, now.UnixNano(), 60).Slice()
	if err != nil {
		return false, nil, fmt.Errorf("failed to run token bucket script: %w", err)
	}

	allowed := result[0].(int64) == 1
	remaining := int(result[1].(int64))

	info := &RateLimitInfo{
		Limit:     burst,
		Remaining: remaining,
		Reset:     now.Add(time.Second * time.Duration(burst-remaining) / time.Duration(rate)),
	}

	return allowed, info, nil
}

// ConcurrencyLimit limits the number of concurrent requests
func ConcurrencyLimit(redisClient *redis.Client, maxConcurrent int) gin.HandlerFunc {
	if redisClient == nil {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		var key string
		if userID != "" {
			key = "concurrent:user:" + userID
		} else {
			key = "concurrent:ip:" + c.ClientIP()
		}

		ctx := c.Request.Context()

		// Try to increment the counter
		current, err := redisClient.Incr(ctx, key).Result()
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("Concurrency limit check failed")
			c.Next()
			return
		}

		// Set expiry to prevent stuck counters
		redisClient.Expire(ctx, key, 5*time.Minute)

		if current > int64(maxConcurrent) {
			// Decrement since we're rejecting
			redisClient.Decr(ctx, key)

			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": gin.H{
					"code":    "TOO_MANY_CONCURRENT_REQUESTS",
					"message": "Too many concurrent requests. Please wait and try again.",
				},
			})
			return
		}

		// Ensure we decrement on request completion
		c.Next()

		redisClient.Decr(ctx, key)
	}
}

// AdaptiveRateLimit adjusts rate limits based on server load
func AdaptiveRateLimit(redisClient *redis.Client, baseLimit int, loadKey string) gin.HandlerFunc {
	if redisClient == nil {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	return func(c *gin.Context) {
		ctx := c.Request.Context()

		// Get current load factor (0.0 to 1.0, where 1.0 means high load)
		loadFactor := getLoadFactor(ctx, redisClient, loadKey)

		// Adjust limit based on load (reduce limit when load is high)
		adjustedLimit := int(float64(baseLimit) * (1.0 - loadFactor*0.7))
		if adjustedLimit < 10 {
			adjustedLimit = 10 // Minimum limit
		}

		userID := c.GetString("user_id")
		var key string
		if userID != "" {
			key = "ratelimit:adaptive:user:" + userID
		} else {
			key = "ratelimit:adaptive:ip:" + c.ClientIP()
		}

		allowed, info, err := checkSlidingWindowRateLimit(ctx, redisClient, key, adjustedLimit, time.Minute)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("Adaptive rate limit check failed")
			c.Next()
			return
		}

		// Add load factor to headers for debugging
		c.Header("X-Load-Factor", fmt.Sprintf("%.2f", loadFactor))
		setRateLimitHeaders(c, info)

		if !allowed {
			respondRateLimited(c, info)
			return
		}

		c.Next()
	}
}

// getLoadFactor retrieves the current load factor from Redis
func getLoadFactor(ctx context.Context, client *redis.Client, loadKey string) float64 {
	if loadKey == "" {
		loadKey = "system:load_factor"
	}

	val, err := client.Get(ctx, loadKey).Float64()
	if err != nil {
		return 0.0 // Default to no load
	}

	if val < 0 {
		return 0.0
	}
	if val > 1.0 {
		return 1.0
	}
	return val
}

// SetLoadFactor sets the current load factor in Redis (called by a monitoring service)
func SetLoadFactor(ctx context.Context, client *redis.Client, loadKey string, factor float64) error {
	if loadKey == "" {
		loadKey = "system:load_factor"
	}
	return client.Set(ctx, loadKey, factor, time.Minute).Err()
}
