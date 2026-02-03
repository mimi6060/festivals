package middleware

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"
)

// Rate limit constants - these define the default limits for different user roles
// Values are tuned based on typical API usage patterns for festival applications
const (
	// DefaultRatePerMinute is the default requests per minute for regular users
	DefaultRatePerMinute = 60

	// DefaultRatePerHour is the default requests per hour for regular users
	DefaultRatePerHour = 1000

	// AdminRatePerMinute allows admins higher throughput for dashboard operations
	AdminRatePerMinute = 300

	// AdminRatePerHour allows admins higher daily throughput
	AdminRatePerHour = 10000

	// OrganizerRatePerMinute for festival organizer operations
	OrganizerRatePerMinute = 200

	// OrganizerRatePerHour for festival organizer daily operations
	OrganizerRatePerHour = 5000

	// StaffRatePerMinute for festival staff (scanning, POS operations)
	StaffRatePerMinute = 120

	// StaffRatePerHour for staff daily operations
	StaffRatePerHour = 3000

	// IPRatePerMinute for unauthenticated requests (by IP address)
	IPRatePerMinute = 30
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

	// IP whitelist for bypassing rate limits (e.g., internal services)
	IPWhitelist []string

	// Parsed CIDR networks from IPWhitelist
	ipNetworks []*net.IPNet

	// Internal service API keys that bypass rate limiting
	InternalServiceAPIKeys []string

	// Enable adaptive rate limiting based on server load
	EnableAdaptiveLimit bool

	// Load key in Redis for adaptive limiting
	LoadKey string

	// Minimum limit when under high load (adaptive limiting)
	MinimumLimit int

	// Maximum load factor reduction (0.0 to 1.0)
	MaxLoadReduction float64
}

// EndpointRateLimitConfig represents per-endpoint rate limit configuration
type EndpointRateLimitConfig struct {
	Path              string `yaml:"path"`
	Method            string `yaml:"method,omitempty"` // Empty means all methods
	RequestsPerMinute int    `yaml:"requests_per_minute"`
	RequestsPerHour   int    `yaml:"requests_per_hour,omitempty"`
	BurstSize         int    `yaml:"burst_size,omitempty"`
	Description       string `yaml:"description,omitempty"`
}

// RateLimitYAMLConfig represents the YAML configuration file structure
type RateLimitYAMLConfig struct {
	// Global settings
	Global struct {
		DefaultRequestsPerMinute int  `yaml:"default_requests_per_minute"`
		DefaultRequestsPerHour   int  `yaml:"default_requests_per_hour"`
		EnableIPLimiting         bool `yaml:"enable_ip_limiting"`
		IPRequestsPerMinute      int  `yaml:"ip_requests_per_minute"`
		KeyPrefix                string `yaml:"key_prefix"`
	} `yaml:"global"`

	// Role-based limits
	Roles map[string]struct {
		RequestsPerMinute int `yaml:"requests_per_minute"`
		RequestsPerHour   int `yaml:"requests_per_hour"`
		BurstSize         int `yaml:"burst_size"`
	} `yaml:"roles"`

	// Endpoint-specific limits
	Endpoints []EndpointRateLimitConfig `yaml:"endpoints"`

	// Paths to skip rate limiting
	SkipPaths []string `yaml:"skip_paths"`

	// IP whitelist
	IPWhitelist []string `yaml:"ip_whitelist"`

	// Internal service API keys
	InternalServiceAPIKeys []string `yaml:"internal_service_api_keys"`

	// Adaptive limiting settings
	Adaptive struct {
		Enabled          bool    `yaml:"enabled"`
		LoadKey          string  `yaml:"load_key"`
		MinimumLimit     int     `yaml:"minimum_limit"`
		MaxLoadReduction float64 `yaml:"max_load_reduction"`
	} `yaml:"adaptive"`
}

// rateLimitConfigCache caches parsed YAML configurations
var (
	rateLimitConfigCache     *RateLimitYAMLConfig
	rateLimitConfigCacheLock sync.RWMutex
	rateLimitConfigPath      string
)

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
// These values are suitable for most festival applications and can be tuned via configuration
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		DefaultRequestsPerMinute: DefaultRatePerMinute,
		DefaultRequestsPerHour:   DefaultRatePerHour,
		RoleLimits: map[string]RoleLimit{
			RoleAdmin: {
				RequestsPerMinute: AdminRatePerMinute,
				RequestsPerHour:   AdminRatePerHour,
				BurstSize:         50, // High burst for dashboard operations
			},
			RoleOrganizer: {
				RequestsPerMinute: OrganizerRatePerMinute,
				RequestsPerHour:   OrganizerRatePerHour,
				BurstSize:         30, // Medium burst for management tasks
			},
			RoleStaff: {
				RequestsPerMinute: StaffRatePerMinute,
				RequestsPerHour:   StaffRatePerHour,
				BurstSize:         20, // Lower burst, steady throughput for POS/scanning
			},
			RoleUser: {
				RequestsPerMinute: DefaultRatePerMinute,
				RequestsPerHour:   DefaultRatePerHour,
				BurstSize:         10, // Limited burst for regular users
			},
		},
		KeyPrefix:           "ratelimit:",
		EnableIPLimiting:    true,
		IPRequestsPerMinute: IPRatePerMinute,
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

// ============================================================================
// Enhanced Rate Limiting Features
// ============================================================================

// LoadRateLimitConfig loads rate limit configuration from a YAML file
func LoadRateLimitConfig(configPath string) (*RateLimitYAMLConfig, error) {
	rateLimitConfigCacheLock.Lock()
	defer rateLimitConfigCacheLock.Unlock()

	// Check cache
	if rateLimitConfigCache != nil && rateLimitConfigPath == configPath {
		return rateLimitConfigCache, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read rate limit config: %w", err)
	}

	var cfg RateLimitYAMLConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse rate limit config: %w", err)
	}

	rateLimitConfigCache = &cfg
	rateLimitConfigPath = configPath

	return &cfg, nil
}

// ReloadRateLimitConfig forces a reload of the rate limit configuration
func ReloadRateLimitConfig(configPath string) (*RateLimitYAMLConfig, error) {
	rateLimitConfigCacheLock.Lock()
	rateLimitConfigCache = nil
	rateLimitConfigPath = ""
	rateLimitConfigCacheLock.Unlock()

	return LoadRateLimitConfig(configPath)
}

// NewRateLimitConfigFromYAML creates a RateLimitConfig from a YAML config
func NewRateLimitConfigFromYAML(yamlCfg *RateLimitYAMLConfig, redisClient *redis.Client) RateLimitConfig {
	cfg := RateLimitConfig{
		RedisClient:              redisClient,
		DefaultRequestsPerMinute: yamlCfg.Global.DefaultRequestsPerMinute,
		DefaultRequestsPerHour:   yamlCfg.Global.DefaultRequestsPerHour,
		EnableIPLimiting:         yamlCfg.Global.EnableIPLimiting,
		IPRequestsPerMinute:      yamlCfg.Global.IPRequestsPerMinute,
		KeyPrefix:                yamlCfg.Global.KeyPrefix,
		SkipPaths:                yamlCfg.SkipPaths,
		IPWhitelist:              yamlCfg.IPWhitelist,
		InternalServiceAPIKeys:   yamlCfg.InternalServiceAPIKeys,
		EnableAdaptiveLimit:      yamlCfg.Adaptive.Enabled,
		LoadKey:                  yamlCfg.Adaptive.LoadKey,
		MinimumLimit:             yamlCfg.Adaptive.MinimumLimit,
		MaxLoadReduction:         yamlCfg.Adaptive.MaxLoadReduction,
	}

	// Convert role limits
	cfg.RoleLimits = make(map[string]RoleLimit)
	for role, limits := range yamlCfg.Roles {
		cfg.RoleLimits[role] = RoleLimit{
			RequestsPerMinute: limits.RequestsPerMinute,
			RequestsPerHour:   limits.RequestsPerHour,
			BurstSize:         limits.BurstSize,
		}
	}

	// Convert endpoint limits
	cfg.EndpointLimits = make(map[string]int)
	for _, endpoint := range yamlCfg.Endpoints {
		key := endpoint.Path
		if endpoint.Method != "" {
			key = endpoint.Method + ":" + endpoint.Path
		}
		cfg.EndpointLimits[key] = endpoint.RequestsPerMinute
	}

	// Parse IP whitelist into CIDR networks
	cfg.parseIPWhitelist()

	return cfg
}

// parseIPWhitelist parses the IP whitelist into CIDR networks
func (cfg *RateLimitConfig) parseIPWhitelist() {
	cfg.ipNetworks = make([]*net.IPNet, 0, len(cfg.IPWhitelist))

	for _, ipStr := range cfg.IPWhitelist {
		// Check if it's a CIDR notation
		if strings.Contains(ipStr, "/") {
			_, network, err := net.ParseCIDR(ipStr)
			if err != nil {
				log.Warn().Str("ip", ipStr).Err(err).Msg("Invalid CIDR in IP whitelist")
				continue
			}
			cfg.ipNetworks = append(cfg.ipNetworks, network)
		} else {
			// Single IP address - convert to /32 or /128
			ip := net.ParseIP(ipStr)
			if ip == nil {
				log.Warn().Str("ip", ipStr).Msg("Invalid IP in whitelist")
				continue
			}

			var mask net.IPMask
			if ip.To4() != nil {
				mask = net.CIDRMask(32, 32)
			} else {
				mask = net.CIDRMask(128, 128)
			}

			cfg.ipNetworks = append(cfg.ipNetworks, &net.IPNet{
				IP:   ip,
				Mask: mask,
			})
		}
	}
}

// isIPWhitelisted checks if the given IP is in the whitelist
func (cfg *RateLimitConfig) isIPWhitelisted(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}

	for _, network := range cfg.ipNetworks {
		if network.Contains(ip) {
			return true
		}
	}

	return false
}

// isInternalService checks if the request is from an internal service
func (cfg *RateLimitConfig) isInternalService(c *gin.Context) bool {
	// Check for internal service API key
	apiKey := c.GetHeader("X-Internal-API-Key")
	if apiKey == "" {
		apiKey = c.GetHeader("X-API-Key")
	}

	if apiKey != "" {
		for _, key := range cfg.InternalServiceAPIKeys {
			if key == apiKey {
				return true
			}
		}
	}

	return false
}

// RateLimitWithBypass creates a rate limiting middleware with bypass support
func RateLimitWithBypass(cfg RateLimitConfig) gin.HandlerFunc {
	if cfg.RedisClient == nil {
		log.Warn().Msg("Rate limiting disabled: no Redis client provided")
		return func(c *gin.Context) {
			c.Next()
		}
	}

	// Parse IP whitelist if not already done
	if len(cfg.IPWhitelist) > 0 && len(cfg.ipNetworks) == 0 {
		cfg.parseIPWhitelist()
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

		// Check IP whitelist bypass
		clientIP := c.ClientIP()
		if cfg.isIPWhitelisted(clientIP) {
			c.Header("X-RateLimit-Bypass", "ip-whitelist")
			c.Next()
			return
		}

		// Check internal service bypass
		if cfg.isInternalService(c) {
			c.Header("X-RateLimit-Bypass", "internal-service")
			c.Next()
			return
		}

		var key string
		var limit int

		// Determine key and limit based on authentication status
		userID := c.GetString("user_id")
		if userID != "" {
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
			key = cfg.KeyPrefix + "ip:" + clientIP
			limit = cfg.IPRequestsPerMinute
			if limit == 0 {
				limit = 30
			}
		} else {
			c.Next()
			return
		}

		// Check endpoint-specific limits (with method if specified)
		fullPath := c.FullPath()
		methodPath := c.Request.Method + ":" + fullPath

		if endpointLimit, ok := cfg.EndpointLimits[methodPath]; ok {
			if endpointLimit < limit {
				limit = endpointLimit
			}
		} else if endpointLimit, ok := cfg.EndpointLimits[fullPath]; ok {
			if endpointLimit < limit {
				limit = endpointLimit
			}
		}

		// Apply adaptive rate limiting if enabled
		if cfg.EnableAdaptiveLimit {
			limit = cfg.applyAdaptiveLimit(c.Request.Context(), limit)
		}

		// Apply rate limiting
		ctx := c.Request.Context()
		allowed, info, err := checkSlidingWindowRateLimit(ctx, cfg.RedisClient, key, limit, time.Minute)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("Rate limit check failed")
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

// applyAdaptiveLimit adjusts the limit based on current server load
func (cfg *RateLimitConfig) applyAdaptiveLimit(ctx context.Context, baseLimit int) int {
	if cfg.RedisClient == nil {
		return baseLimit
	}

	loadFactor := getLoadFactor(ctx, cfg.RedisClient, cfg.LoadKey)

	maxReduction := cfg.MaxLoadReduction
	if maxReduction <= 0 || maxReduction > 1.0 {
		maxReduction = 0.7 // Default 70% reduction at full load
	}

	adjustedLimit := int(float64(baseLimit) * (1.0 - loadFactor*maxReduction))

	minLimit := cfg.MinimumLimit
	if minLimit <= 0 {
		minLimit = 10
	}

	if adjustedLimit < minLimit {
		adjustedLimit = minLimit
	}

	return adjustedLimit
}

// IPRateLimit creates an IP-only rate limiting middleware (for public endpoints)
func IPRateLimit(redisClient *redis.Client, requestsPerMinute int, whitelist []string) gin.HandlerFunc {
	if redisClient == nil {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	cfg := RateLimitConfig{
		IPWhitelist: whitelist,
	}
	cfg.parseIPWhitelist()

	return func(c *gin.Context) {
		clientIP := c.ClientIP()

		// Check whitelist
		if cfg.isIPWhitelisted(clientIP) {
			c.Header("X-RateLimit-Bypass", "ip-whitelist")
			c.Next()
			return
		}

		key := "ratelimit:ip:" + clientIP

		ctx := c.Request.Context()
		allowed, info, err := checkSlidingWindowRateLimit(ctx, redisClient, key, requestsPerMinute, time.Minute)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("IP rate limit check failed")
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

// MethodSpecificRateLimit creates rate limiting that varies by HTTP method
func MethodSpecificRateLimit(redisClient *redis.Client, methodLimits map[string]int, defaultLimit int) gin.HandlerFunc {
	if redisClient == nil {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	return func(c *gin.Context) {
		limit := defaultLimit
		if methodLimit, ok := methodLimits[c.Request.Method]; ok {
			limit = methodLimit
		}

		userID := c.GetString("user_id")
		var key string
		if userID != "" {
			key = fmt.Sprintf("ratelimit:method:%s:user:%s", c.Request.Method, userID)
		} else {
			key = fmt.Sprintf("ratelimit:method:%s:ip:%s", c.Request.Method, c.ClientIP())
		}

		ctx := c.Request.Context()
		allowed, info, err := checkSlidingWindowRateLimit(ctx, redisClient, key, limit, time.Minute)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("Method rate limit check failed")
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

// DailyRateLimit creates a rate limiter with daily limits
func DailyRateLimit(redisClient *redis.Client, requestsPerDay int) gin.HandlerFunc {
	if redisClient == nil {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		var key string
		if userID != "" {
			key = "ratelimit:daily:user:" + userID
		} else {
			key = "ratelimit:daily:ip:" + c.ClientIP()
		}

		ctx := c.Request.Context()
		allowed, info, err := checkSlidingWindowRateLimit(ctx, redisClient, key, requestsPerDay, 24*time.Hour)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("Daily rate limit check failed")
			c.Next()
			return
		}

		// Set custom headers for daily limits
		c.Header("X-RateLimit-Daily-Limit", strconv.Itoa(info.Limit))
		c.Header("X-RateLimit-Daily-Remaining", strconv.Itoa(info.Remaining))
		c.Header("X-RateLimit-Daily-Reset", strconv.FormatInt(info.Reset.Unix(), 10))

		if !allowed {
			retryAfter := int(time.Until(info.Reset).Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}

			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": gin.H{
					"code":        "DAILY_LIMIT_EXCEEDED",
					"message":     "Daily request limit exceeded. Please try again tomorrow.",
					"retry_after": retryAfter,
				},
			})
			return
		}

		c.Next()
	}
}

// CostBasedRateLimit implements rate limiting where different operations have different costs
type CostBasedRateLimitConfig struct {
	RedisClient    *redis.Client
	TokensPerMinute int
	OperationCosts map[string]int // operation name -> cost in tokens
	DefaultCost    int
}

// CostBasedRateLimit creates a cost-based rate limiter
func CostBasedRateLimit(cfg CostBasedRateLimitConfig) gin.HandlerFunc {
	if cfg.RedisClient == nil {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	if cfg.DefaultCost == 0 {
		cfg.DefaultCost = 1
	}

	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		var key string
		if userID != "" {
			key = "ratelimit:cost:user:" + userID
		} else {
			key = "ratelimit:cost:ip:" + c.ClientIP()
		}

		// Determine operation cost
		operation := c.FullPath()
		cost := cfg.DefaultCost
		if opCost, ok := cfg.OperationCosts[operation]; ok {
			cost = opCost
		}

		ctx := c.Request.Context()

		// Use token bucket with cost
		allowed, info, err := checkCostBasedLimit(ctx, cfg.RedisClient, key, cfg.TokensPerMinute, cost)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("Cost-based rate limit check failed")
			c.Next()
			return
		}

		c.Header("X-RateLimit-Cost", strconv.Itoa(cost))
		setRateLimitHeaders(c, info)

		if !allowed {
			respondRateLimited(c, info)
			return
		}

		c.Next()
	}
}

// checkCostBasedLimit checks if the operation is allowed given its cost
func checkCostBasedLimit(ctx context.Context, client *redis.Client, key string, tokensPerMinute int, cost int) (bool, *RateLimitInfo, error) {
	now := time.Now()
	tokensKey := key + ":tokens"
	lastKey := key + ":last"

	// Lua script for atomic cost-based token bucket operation
	script := redis.NewScript(`
		local tokens_key = KEYS[1]
		local last_key = KEYS[2]
		local rate = tonumber(ARGV[1])
		local max_tokens = tonumber(ARGV[2])
		local now = tonumber(ARGV[3])
		local cost = tonumber(ARGV[4])
		local ttl = tonumber(ARGV[5])

		local last = tonumber(redis.call('get', last_key)) or now
		local tokens = tonumber(redis.call('get', tokens_key)) or max_tokens

		-- Calculate new tokens based on time elapsed (tokens per nanosecond)
		local elapsed = now - last
		local tokens_per_ns = rate / 60 / 1000000000
		tokens = math.min(max_tokens, tokens + (elapsed * tokens_per_ns))

		local allowed = 0
		if tokens >= cost then
			tokens = tokens - cost
			allowed = 1
		end

		redis.call('set', tokens_key, tokens, 'EX', ttl)
		redis.call('set', last_key, now, 'EX', ttl)

		return {allowed, math.floor(tokens)}
	`)

	result, err := script.Run(ctx, client, []string{tokensKey, lastKey},
		tokensPerMinute, tokensPerMinute, now.UnixNano(), cost, 120).Slice()
	if err != nil {
		return false, nil, fmt.Errorf("failed to run cost-based limit script: %w", err)
	}

	allowed := result[0].(int64) == 1
	remaining := int(result[1].(int64))

	info := &RateLimitInfo{
		Limit:     tokensPerMinute,
		Remaining: remaining,
		Reset:     now.Add(time.Minute),
	}

	return allowed, info, nil
}

// GlobalRateLimit creates a global rate limiter that limits total requests across all users
func GlobalRateLimit(redisClient *redis.Client, requestsPerMinute int, key string) gin.HandlerFunc {
	if redisClient == nil {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	if key == "" {
		key = "ratelimit:global"
	}

	return func(c *gin.Context) {
		ctx := c.Request.Context()

		allowed, info, err := checkSlidingWindowRateLimit(ctx, redisClient, key, requestsPerMinute, time.Minute)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("Global rate limit check failed")
			c.Next()
			return
		}

		c.Header("X-Global-RateLimit-Limit", strconv.Itoa(info.Limit))
		c.Header("X-Global-RateLimit-Remaining", strconv.Itoa(info.Remaining))

		if !allowed {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": gin.H{
					"code":    "SERVICE_OVERLOADED",
					"message": "Service is experiencing high load. Please try again later.",
				},
			})
			return
		}

		c.Next()
	}
}

// ResetRateLimit resets the rate limit for a specific key
func ResetRateLimit(ctx context.Context, client *redis.Client, key string) error {
	if client == nil {
		return fmt.Errorf("redis client is nil")
	}
	return client.Del(ctx, key).Err()
}

// ResetUserRateLimit resets all rate limit keys for a user
func ResetUserRateLimit(ctx context.Context, client *redis.Client, userID string) error {
	if client == nil {
		return fmt.Errorf("redis client is nil")
	}

	// Find and delete all keys for this user
	pattern := "ratelimit:*:user:" + userID + "*"
	keys, err := client.Keys(ctx, pattern).Result()
	if err != nil {
		return fmt.Errorf("failed to find rate limit keys: %w", err)
	}

	if len(keys) == 0 {
		return nil
	}

	return client.Del(ctx, keys...).Err()
}

// ResetIPRateLimit resets all rate limit keys for an IP
func ResetIPRateLimit(ctx context.Context, client *redis.Client, ip string) error {
	if client == nil {
		return fmt.Errorf("redis client is nil")
	}

	pattern := "ratelimit:*:ip:" + ip + "*"
	keys, err := client.Keys(ctx, pattern).Result()
	if err != nil {
		return fmt.Errorf("failed to find rate limit keys: %w", err)
	}

	if len(keys) == 0 {
		return nil
	}

	return client.Del(ctx, keys...).Err()
}

// GetRateLimitStatus returns the current rate limit status for a key
func GetRateLimitStatus(ctx context.Context, client *redis.Client, key string, limit int, window time.Duration) (*RateLimitInfo, error) {
	if client == nil {
		return nil, fmt.Errorf("redis client is nil")
	}

	now := time.Now()
	windowStart := now.Add(-window)

	// Count current requests in window
	count, err := client.ZCount(ctx, key,
		strconv.FormatInt(windowStart.UnixNano(), 10),
		strconv.FormatInt(now.UnixNano(), 10)).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get rate limit count: %w", err)
	}

	remaining := limit - int(count)
	if remaining < 0 {
		remaining = 0
	}

	// Get TTL for reset time
	ttl, err := client.TTL(ctx, key).Result()
	if err != nil || ttl < 0 {
		ttl = window
	}

	return &RateLimitInfo{
		Limit:     limit,
		Remaining: remaining,
		Reset:     now.Add(ttl),
	}, nil
}

// ============================================================================
// Authentication Rate Limiting
// ============================================================================

// AuthRateLimitConfig holds configuration for authentication rate limiting
type AuthRateLimitConfig struct {
	RedisClient             *redis.Client
	LoginAttemptsPerMinute  int           // Max login attempts per IP per minute (default: 5)
	LoginLockoutDuration    time.Duration // Lockout duration after max attempts (default: 15 min)
	PasswordResetPerMinute  int           // Max password reset requests per IP per minute (default: 3)
	PasswordResetPerHour    int           // Max password reset requests per IP per hour (default: 10)
	KeyPrefix               string        // Redis key prefix (default: "auth_ratelimit:")
}

// DefaultAuthRateLimitConfig returns default authentication rate limiting configuration
func DefaultAuthRateLimitConfig() AuthRateLimitConfig {
	return AuthRateLimitConfig{
		LoginAttemptsPerMinute: 5,
		LoginLockoutDuration:   15 * time.Minute,
		PasswordResetPerMinute: 3,
		PasswordResetPerHour:   10,
		KeyPrefix:              "auth_ratelimit:",
	}
}

// AuthRateLimit creates middleware for rate limiting authentication endpoints
// This provides strict rate limiting specifically for login and password reset endpoints
// to protect against brute force attacks
func AuthRateLimit(cfg AuthRateLimitConfig) gin.HandlerFunc {
	if cfg.RedisClient == nil {
		log.Warn().Msg("Auth rate limiting disabled: no Redis client provided")
		return func(c *gin.Context) {
			c.Next()
		}
	}

	if cfg.KeyPrefix == "" {
		cfg.KeyPrefix = "auth_ratelimit:"
	}
	if cfg.LoginAttemptsPerMinute == 0 {
		cfg.LoginAttemptsPerMinute = 5
	}
	if cfg.LoginLockoutDuration == 0 {
		cfg.LoginLockoutDuration = 15 * time.Minute
	}
	if cfg.PasswordResetPerMinute == 0 {
		cfg.PasswordResetPerMinute = 3
	}
	if cfg.PasswordResetPerHour == 0 {
		cfg.PasswordResetPerHour = 10
	}

	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		ctx := c.Request.Context()

		// Determine endpoint type
		path := c.Request.URL.Path
		isLogin := strings.Contains(path, "/login") || strings.Contains(path, "/auth") || strings.Contains(path, "/token")
		isPasswordReset := strings.Contains(path, "/password") || strings.Contains(path, "/reset") || strings.Contains(path, "/forgot")

		var key string
		var limit int
		var window time.Duration

		if isLogin {
			key = cfg.KeyPrefix + "login:ip:" + clientIP
			limit = cfg.LoginAttemptsPerMinute
			window = time.Minute

			// Check if IP is currently locked out
			lockoutKey := cfg.KeyPrefix + "lockout:ip:" + clientIP
			ttl, err := cfg.RedisClient.TTL(ctx, lockoutKey).Result()
			if err == nil && ttl > 0 {
				retryAfter := int(ttl.Seconds())
				if retryAfter < 1 {
					retryAfter = 1
				}
				c.Header("Retry-After", strconv.Itoa(retryAfter))
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error": gin.H{
						"code":        "AUTH_LOCKED_OUT",
						"message":     "Too many failed login attempts. Please try again later.",
						"retry_after": retryAfter,
					},
				})
				return
			}
		} else if isPasswordReset {
			// Check both minute and hour limits for password reset
			minuteKey := cfg.KeyPrefix + "reset:minute:ip:" + clientIP
			hourKey := cfg.KeyPrefix + "reset:hour:ip:" + clientIP

			// Check minute limit
			minuteAllowed, minuteInfo, err := checkSlidingWindowRateLimit(ctx, cfg.RedisClient, minuteKey, cfg.PasswordResetPerMinute, time.Minute)
			if err != nil {
				log.Error().Err(err).Msg("Failed to check password reset minute rate limit")
				c.Next()
				return
			}

			if !minuteAllowed {
				setRateLimitHeaders(c, minuteInfo)
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error": gin.H{
						"code":        "RESET_RATE_LIMITED",
						"message":     "Too many password reset requests. Please wait before trying again.",
						"retry_after": int(time.Until(minuteInfo.Reset).Seconds()),
					},
				})
				return
			}

			// Check hour limit
			hourAllowed, hourInfo, err := checkSlidingWindowRateLimit(ctx, cfg.RedisClient, hourKey, cfg.PasswordResetPerHour, time.Hour)
			if err != nil {
				log.Error().Err(err).Msg("Failed to check password reset hour rate limit")
				c.Next()
				return
			}

			if !hourAllowed {
				setRateLimitHeaders(c, hourInfo)
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error": gin.H{
						"code":        "RESET_RATE_LIMITED",
						"message":     "Too many password reset requests today. Please try again later.",
						"retry_after": int(time.Until(hourInfo.Reset).Seconds()),
					},
				})
				return
			}

			c.Next()
			return
		} else {
			// Not an auth endpoint, skip
			c.Next()
			return
		}

		// Check rate limit for login
		allowed, info, err := checkSlidingWindowRateLimit(ctx, cfg.RedisClient, key, limit, window)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("Auth rate limit check failed")
			c.Next()
			return
		}

		setRateLimitHeaders(c, info)

		if !allowed {
			// Set lockout for login attempts
			if isLogin {
				lockoutKey := cfg.KeyPrefix + "lockout:ip:" + clientIP
				cfg.RedisClient.Set(ctx, lockoutKey, "1", cfg.LoginLockoutDuration)

				log.Warn().
					Str("ip", clientIP).
					Dur("lockout_duration", cfg.LoginLockoutDuration).
					Msg("Login rate limit triggered - IP locked out")
			}

			retryAfter := int(time.Until(info.Reset).Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}

			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": gin.H{
					"code":        "AUTH_RATE_LIMITED",
					"message":     "Too many authentication attempts. Please try again later.",
					"retry_after": retryAfter,
				},
			})
			return
		}

		c.Next()
	}
}

// RecordFailedLogin increments the failed login counter for an IP
// Should be called when a login attempt fails
func RecordFailedLogin(ctx context.Context, client *redis.Client, clientIP string) {
	if client == nil {
		return
	}
	key := "auth_ratelimit:login:ip:" + clientIP
	// Increment the failed login counter with 1 hour expiry
	client.Incr(ctx, key)
	client.Expire(ctx, key, time.Hour)
}

// RecordSuccessfulLogin clears the failed login counter for an IP
// Should be called when a login succeeds
func RecordSuccessfulLogin(ctx context.Context, client *redis.Client, clientIP string) {
	if client == nil {
		return
	}
	// Clear both the rate limit key and any lockout
	key := "auth_ratelimit:login:ip:" + clientIP
	lockoutKey := "auth_ratelimit:lockout:ip:" + clientIP
	client.Del(ctx, key, lockoutKey)
}
