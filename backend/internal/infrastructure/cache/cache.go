package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// Default TTL values
const (
	DefaultTTL      = 5 * time.Minute
	ShortTTL        = 1 * time.Minute
	LongTTL         = 30 * time.Minute
	FestivalTTL     = 10 * time.Minute
	WalletTTL       = 1 * time.Minute // Shorter TTL for frequently changing data
	UserTTL         = 5 * time.Minute
)

// Cacher defines the interface for cache operations
type Cacher interface {
	// Get retrieves a value from the cache
	Get(ctx context.Context, key string) (string, error)

	// GetJSON retrieves and deserializes a JSON value from the cache
	GetJSON(ctx context.Context, key string, dest interface{}) error

	// Set stores a value in the cache with a TTL
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error

	// SetJSON serializes and stores a value as JSON in the cache
	SetJSON(ctx context.Context, key string, value interface{}, ttl time.Duration) error

	// Delete removes a value from the cache
	Delete(ctx context.Context, keys ...string) error

	// Exists checks if a key exists in the cache
	Exists(ctx context.Context, key string) (bool, error)

	// GetOrSet retrieves a value from cache, or computes and stores it if not present
	GetOrSet(ctx context.Context, key string, ttl time.Duration, fn func() (interface{}, error)) (string, error)

	// GetOrSetJSON retrieves and deserializes a JSON value, or computes and stores it if not present
	GetOrSetJSON(ctx context.Context, key string, dest interface{}, ttl time.Duration, fn func() (interface{}, error)) error

	// GetClient returns the underlying Redis client for advanced operations
	GetClient() *redis.Client
}

// RedisCache implements Cacher using Redis
type RedisCache struct {
	client *redis.Client
}

// NewRedisCache creates a new RedisCache instance
func NewRedisCache(client *redis.Client) *RedisCache {
	return &RedisCache{client: client}
}

// Get retrieves a value from the cache
func (c *RedisCache) Get(ctx context.Context, key string) (string, error) {
	val, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", ErrCacheMiss
	}
	if err != nil {
		return "", fmt.Errorf("cache get error: %w", err)
	}
	return val, nil
}

// GetJSON retrieves and deserializes a JSON value from the cache
func (c *RedisCache) GetJSON(ctx context.Context, key string, dest interface{}) error {
	val, err := c.Get(ctx, key)
	if err != nil {
		return err
	}

	if err := json.Unmarshal([]byte(val), dest); err != nil {
		return fmt.Errorf("cache unmarshal error: %w", err)
	}

	return nil
}

// Set stores a value in the cache with a TTL
func (c *RedisCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	var strVal string
	switch v := value.(type) {
	case string:
		strVal = v
	case []byte:
		strVal = string(v)
	default:
		data, err := json.Marshal(value)
		if err != nil {
			return fmt.Errorf("cache marshal error: %w", err)
		}
		strVal = string(data)
	}

	if err := c.client.Set(ctx, key, strVal, ttl).Err(); err != nil {
		return fmt.Errorf("cache set error: %w", err)
	}

	return nil
}

// SetJSON serializes and stores a value as JSON in the cache
func (c *RedisCache) SetJSON(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("cache marshal error: %w", err)
	}

	return c.Set(ctx, key, string(data), ttl)
}

// Delete removes values from the cache
func (c *RedisCache) Delete(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}

	if err := c.client.Del(ctx, keys...).Err(); err != nil {
		return fmt.Errorf("cache delete error: %w", err)
	}

	return nil
}

// Exists checks if a key exists in the cache
func (c *RedisCache) Exists(ctx context.Context, key string) (bool, error) {
	result, err := c.client.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("cache exists error: %w", err)
	}
	return result > 0, nil
}

// GetOrSet retrieves a value from cache, or computes and stores it if not present
func (c *RedisCache) GetOrSet(ctx context.Context, key string, ttl time.Duration, fn func() (interface{}, error)) (string, error) {
	// Try to get from cache first
	val, err := c.Get(ctx, key)
	if err == nil {
		log.Debug().Str("key", key).Msg("cache hit")
		return val, nil
	}

	if err != ErrCacheMiss {
		log.Warn().Err(err).Str("key", key).Msg("cache get error, falling back to source")
	}

	// Cache miss - compute the value
	log.Debug().Str("key", key).Msg("cache miss")
	result, err := fn()
	if err != nil {
		return "", err
	}

	// Convert result to string
	var strVal string
	switch v := result.(type) {
	case string:
		strVal = v
	case []byte:
		strVal = string(v)
	default:
		data, err := json.Marshal(result)
		if err != nil {
			return "", fmt.Errorf("cache marshal error: %w", err)
		}
		strVal = string(data)
	}

	// Store in cache (don't fail if caching fails)
	if err := c.Set(ctx, key, strVal, ttl); err != nil {
		log.Warn().Err(err).Str("key", key).Msg("failed to cache value")
	}

	return strVal, nil
}

// GetOrSetJSON retrieves and deserializes a JSON value, or computes and stores it if not present
func (c *RedisCache) GetOrSetJSON(ctx context.Context, key string, dest interface{}, ttl time.Duration, fn func() (interface{}, error)) error {
	// Try to get from cache first
	err := c.GetJSON(ctx, key, dest)
	if err == nil {
		log.Debug().Str("key", key).Msg("cache hit")
		return nil
	}

	if err != ErrCacheMiss {
		log.Warn().Err(err).Str("key", key).Msg("cache get error, falling back to source")
	}

	// Cache miss - compute the value
	log.Debug().Str("key", key).Msg("cache miss")
	result, err := fn()
	if err != nil {
		return err
	}

	// Store in cache (don't fail if caching fails)
	if err := c.SetJSON(ctx, key, result, ttl); err != nil {
		log.Warn().Err(err).Str("key", key).Msg("failed to cache value")
	}

	// Marshal and unmarshal to populate dest with the computed value
	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("cache marshal error: %w", err)
	}

	if err := json.Unmarshal(data, dest); err != nil {
		return fmt.Errorf("cache unmarshal error: %w", err)
	}

	return nil
}

// GetClient returns the underlying Redis client
func (c *RedisCache) GetClient() *redis.Client {
	return c.client
}

// ErrCacheMiss is returned when a key is not found in the cache
var ErrCacheMiss = fmt.Errorf("cache miss")

// NoOpCache is a cache implementation that does nothing (useful for testing/disabling cache)
type NoOpCache struct{}

// NewNoOpCache creates a new NoOpCache instance
func NewNoOpCache() *NoOpCache {
	return &NoOpCache{}
}

func (c *NoOpCache) Get(ctx context.Context, key string) (string, error) {
	return "", ErrCacheMiss
}

func (c *NoOpCache) GetJSON(ctx context.Context, key string, dest interface{}) error {
	return ErrCacheMiss
}

func (c *NoOpCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	return nil
}

func (c *NoOpCache) SetJSON(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	return nil
}

func (c *NoOpCache) Delete(ctx context.Context, keys ...string) error {
	return nil
}

func (c *NoOpCache) Exists(ctx context.Context, key string) (bool, error) {
	return false, nil
}

func (c *NoOpCache) GetOrSet(ctx context.Context, key string, ttl time.Duration, fn func() (interface{}, error)) (string, error) {
	result, err := fn()
	if err != nil {
		return "", err
	}

	switch v := result.(type) {
	case string:
		return v, nil
	case []byte:
		return string(v), nil
	default:
		data, err := json.Marshal(result)
		if err != nil {
			return "", fmt.Errorf("marshal error: %w", err)
		}
		return string(data), nil
	}
}

func (c *NoOpCache) GetOrSetJSON(ctx context.Context, key string, dest interface{}, ttl time.Duration, fn func() (interface{}, error)) error {
	result, err := fn()
	if err != nil {
		return err
	}

	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	return json.Unmarshal(data, dest)
}

func (c *NoOpCache) GetClient() *redis.Client {
	return nil
}
