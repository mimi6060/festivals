package performance

import (
	"container/list"
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/mimi6060/festivals/backend/internal/infrastructure/profiling"
	"github.com/redis/go-redis/v9"
)

// CacheStrategy defines the caching strategy interface
type CacheStrategy interface {
	Get(ctx context.Context, key string) ([]byte, bool)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration)
	Delete(ctx context.Context, key string)
	Clear(ctx context.Context)
	Stats() CacheStats
}

// CacheStats holds cache statistics
type CacheStats struct {
	Hits       uint64
	Misses     uint64
	Size       int
	MaxSize    int
	HitRate    float64
	Evictions  uint64
	TotalItems int
}

// LRUCache implements an LRU cache with TTL support
type LRUCache struct {
	maxSize  int
	items    map[string]*list.Element
	order    *list.List
	mu       sync.RWMutex
	stats    lruStats
	metrics  *profiling.PerformanceMetrics
	name     string
}

type lruStats struct {
	hits      uint64
	misses    uint64
	evictions uint64
}

type lruEntry struct {
	key       string
	value     []byte
	expiresAt time.Time
}

// NewLRUCache creates a new LRU cache
func NewLRUCache(name string, maxSize int) *LRUCache {
	return &LRUCache{
		maxSize: maxSize,
		items:   make(map[string]*list.Element),
		order:   list.New(),
		metrics: profiling.GetPerformanceMetrics(),
		name:    name,
	}
}

// Get retrieves a value from the cache
func (c *LRUCache) Get(ctx context.Context, key string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.items[key]; ok {
		entry := elem.Value.(*lruEntry)

		// Check if expired
		if !entry.expiresAt.IsZero() && time.Now().After(entry.expiresAt) {
			c.removeElement(elem)
			c.stats.misses++
			if c.metrics != nil {
				c.metrics.RecordCacheMiss(c.name)
			}
			return nil, false
		}

		// Move to front (most recently used)
		c.order.MoveToFront(elem)
		c.stats.hits++
		if c.metrics != nil {
			c.metrics.RecordCacheHit(c.name)
		}
		return entry.value, true
	}

	c.stats.misses++
	if c.metrics != nil {
		c.metrics.RecordCacheMiss(c.name)
	}
	return nil, false
}

// Set adds a value to the cache
func (c *LRUCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	var expiresAt time.Time
	if ttl > 0 {
		expiresAt = time.Now().Add(ttl)
	}

	// Update existing entry
	if elem, ok := c.items[key]; ok {
		c.order.MoveToFront(elem)
		entry := elem.Value.(*lruEntry)
		entry.value = value
		entry.expiresAt = expiresAt
		return
	}

	// Evict if necessary
	for c.order.Len() >= c.maxSize {
		c.evictOldest()
	}

	// Add new entry
	entry := &lruEntry{
		key:       key,
		value:     value,
		expiresAt: expiresAt,
	}
	elem := c.order.PushFront(entry)
	c.items[key] = elem
}

// Delete removes a value from the cache
func (c *LRUCache) Delete(ctx context.Context, key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.items[key]; ok {
		c.removeElement(elem)
	}
}

// Clear removes all items from the cache
func (c *LRUCache) Clear(ctx context.Context) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[string]*list.Element)
	c.order.Init()
}

// Stats returns cache statistics
func (c *LRUCache) Stats() CacheStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	hitRate := float64(0)
	total := c.stats.hits + c.stats.misses
	if total > 0 {
		hitRate = float64(c.stats.hits) / float64(total)
	}

	return CacheStats{
		Hits:       c.stats.hits,
		Misses:     c.stats.misses,
		Size:       c.order.Len(),
		MaxSize:    c.maxSize,
		HitRate:    hitRate,
		Evictions:  c.stats.evictions,
		TotalItems: len(c.items),
	}
}

func (c *LRUCache) evictOldest() {
	elem := c.order.Back()
	if elem != nil {
		c.removeElement(elem)
		c.stats.evictions++
	}
}

func (c *LRUCache) removeElement(elem *list.Element) {
	c.order.Remove(elem)
	entry := elem.Value.(*lruEntry)
	delete(c.items, entry.key)
}

// TieredCache implements a two-tier cache (L1: memory, L2: Redis)
type TieredCache struct {
	l1      CacheStrategy
	l2      *redis.Client
	name    string
	metrics *profiling.PerformanceMetrics
	stats   tieredStats
	mu      sync.RWMutex
}

type tieredStats struct {
	l1Hits uint64
	l2Hits uint64
	misses uint64
}

// NewTieredCache creates a new tiered cache
func NewTieredCache(name string, l1MaxSize int, redisClient *redis.Client) *TieredCache {
	return &TieredCache{
		l1:      NewLRUCache(name+"_l1", l1MaxSize),
		l2:      redisClient,
		name:    name,
		metrics: profiling.GetPerformanceMetrics(),
	}
}

// Get retrieves a value, checking L1 first, then L2
func (c *TieredCache) Get(ctx context.Context, key string) ([]byte, bool) {
	// Check L1
	if value, ok := c.l1.Get(ctx, key); ok {
		c.mu.Lock()
		c.stats.l1Hits++
		c.mu.Unlock()
		return value, true
	}

	// Check L2
	if c.l2 != nil {
		value, err := c.l2.Get(ctx, c.name+":"+key).Bytes()
		if err == nil {
			// Populate L1 with default TTL
			c.l1.Set(ctx, key, value, 5*time.Minute)
			c.mu.Lock()
			c.stats.l2Hits++
			c.mu.Unlock()
			return value, true
		}
	}

	c.mu.Lock()
	c.stats.misses++
	c.mu.Unlock()
	return nil, false
}

// Set stores a value in both L1 and L2
func (c *TieredCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) {
	// Set in L1 with shorter TTL
	l1TTL := ttl
	if l1TTL > 5*time.Minute {
		l1TTL = 5 * time.Minute
	}
	c.l1.Set(ctx, key, value, l1TTL)

	// Set in L2
	if c.l2 != nil {
		c.l2.Set(ctx, c.name+":"+key, value, ttl)
	}
}

// Delete removes a value from both tiers
func (c *TieredCache) Delete(ctx context.Context, key string) {
	c.l1.Delete(ctx, key)
	if c.l2 != nil {
		c.l2.Del(ctx, c.name+":"+key)
	}
}

// Clear clears both cache tiers
func (c *TieredCache) Clear(ctx context.Context) {
	c.l1.Clear(ctx)
	// Note: L2 clear would require pattern matching, use with caution
}

// Stats returns combined cache statistics
func (c *TieredCache) Stats() CacheStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	l1Stats := c.l1.Stats()
	total := c.stats.l1Hits + c.stats.l2Hits + c.stats.misses
	hitRate := float64(0)
	if total > 0 {
		hitRate = float64(c.stats.l1Hits+c.stats.l2Hits) / float64(total)
	}

	return CacheStats{
		Hits:       c.stats.l1Hits + c.stats.l2Hits,
		Misses:     c.stats.misses,
		Size:       l1Stats.Size,
		MaxSize:    l1Stats.MaxSize,
		HitRate:    hitRate,
		TotalItems: l1Stats.TotalItems,
	}
}

// WriteThrough implements write-through caching
type WriteThrough[T any] struct {
	cache   CacheStrategy
	loader  func(ctx context.Context, key string) (T, error)
	writer  func(ctx context.Context, key string, value T) error
	ttl     time.Duration
	metrics *profiling.PerformanceMetrics
	name    string
}

// NewWriteThrough creates a new write-through cache
func NewWriteThrough[T any](
	name string,
	cache CacheStrategy,
	loader func(ctx context.Context, key string) (T, error),
	writer func(ctx context.Context, key string, value T) error,
	ttl time.Duration,
) *WriteThrough[T] {
	return &WriteThrough[T]{
		cache:   cache,
		loader:  loader,
		writer:  writer,
		ttl:     ttl,
		metrics: profiling.GetPerformanceMetrics(),
		name:    name,
	}
}

// Get retrieves a value, loading from source if not cached
func (wt *WriteThrough[T]) Get(ctx context.Context, key string) (T, error) {
	var zero T

	// Check cache
	if data, ok := wt.cache.Get(ctx, key); ok {
		var value T
		if err := json.Unmarshal(data, &value); err == nil {
			return value, nil
		}
	}

	// Load from source
	value, err := wt.loader(ctx, key)
	if err != nil {
		return zero, err
	}

	// Cache the result
	data, err := json.Marshal(value)
	if err == nil {
		wt.cache.Set(ctx, key, data, wt.ttl)
	}

	return value, nil
}

// Set writes to both cache and source
func (wt *WriteThrough[T]) Set(ctx context.Context, key string, value T) error {
	// Write to source first
	if err := wt.writer(ctx, key, value); err != nil {
		return err
	}

	// Update cache
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	wt.cache.Set(ctx, key, data, wt.ttl)

	return nil
}

// Invalidate removes a key from the cache
func (wt *WriteThrough[T]) Invalidate(ctx context.Context, key string) {
	wt.cache.Delete(ctx, key)
}

// WriteAround implements write-around caching (invalidate on write)
type WriteAround[T any] struct {
	cache   CacheStrategy
	loader  func(ctx context.Context, key string) (T, error)
	ttl     time.Duration
	metrics *profiling.PerformanceMetrics
	name    string
}

// NewWriteAround creates a new write-around cache
func NewWriteAround[T any](
	name string,
	cache CacheStrategy,
	loader func(ctx context.Context, key string) (T, error),
	ttl time.Duration,
) *WriteAround[T] {
	return &WriteAround[T]{
		cache:   cache,
		loader:  loader,
		ttl:     ttl,
		metrics: profiling.GetPerformanceMetrics(),
		name:    name,
	}
}

// Get retrieves a value, loading from source if not cached
func (wa *WriteAround[T]) Get(ctx context.Context, key string) (T, error) {
	var zero T

	// Check cache
	if data, ok := wa.cache.Get(ctx, key); ok {
		var value T
		if err := json.Unmarshal(data, &value); err == nil {
			return value, nil
		}
	}

	// Load from source
	value, err := wa.loader(ctx, key)
	if err != nil {
		return zero, err
	}

	// Cache the result
	data, err := json.Marshal(value)
	if err == nil {
		wa.cache.Set(ctx, key, data, wa.ttl)
	}

	return value, nil
}

// Invalidate removes a key from the cache (call this after writes)
func (wa *WriteAround[T]) Invalidate(ctx context.Context, key string) {
	wa.cache.Delete(ctx, key)
}

// CacheGroup manages multiple related cache keys
type CacheGroup struct {
	cache  CacheStrategy
	prefix string
	keys   map[string]struct{}
	mu     sync.RWMutex
}

// NewCacheGroup creates a new cache group
func NewCacheGroup(cache CacheStrategy, prefix string) *CacheGroup {
	return &CacheGroup{
		cache:  cache,
		prefix: prefix,
		keys:   make(map[string]struct{}),
	}
}

// Get retrieves a value from the group
func (cg *CacheGroup) Get(ctx context.Context, key string) ([]byte, bool) {
	return cg.cache.Get(ctx, cg.prefix+":"+key)
}

// Set stores a value in the group
func (cg *CacheGroup) Set(ctx context.Context, key string, value []byte, ttl time.Duration) {
	fullKey := cg.prefix + ":" + key
	cg.cache.Set(ctx, fullKey, value, ttl)

	cg.mu.Lock()
	cg.keys[fullKey] = struct{}{}
	cg.mu.Unlock()
}

// Delete removes a value from the group
func (cg *CacheGroup) Delete(ctx context.Context, key string) {
	fullKey := cg.prefix + ":" + key
	cg.cache.Delete(ctx, fullKey)

	cg.mu.Lock()
	delete(cg.keys, fullKey)
	cg.mu.Unlock()
}

// InvalidateAll invalidates all keys in the group
func (cg *CacheGroup) InvalidateAll(ctx context.Context) {
	cg.mu.Lock()
	defer cg.mu.Unlock()

	for key := range cg.keys {
		cg.cache.Delete(ctx, key)
	}
	cg.keys = make(map[string]struct{})
}
