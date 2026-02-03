# Performance Optimization Guide

This guide covers performance best practices and optimization techniques for the Festivals backend.

## Table of Contents

1. [General Principles](#general-principles)
2. [Memory Optimization](#memory-optimization)
3. [CPU Optimization](#cpu-optimization)
4. [Database Optimization](#database-optimization)
5. [Caching Strategies](#caching-strategies)
6. [Concurrency Patterns](#concurrency-patterns)
7. [API Optimization](#api-optimization)
8. [Monitoring & Alerting](#monitoring--alerting)

## General Principles

### Measure First

1. **Never optimize prematurely** - Profile first to identify actual bottlenecks
2. **Set performance budgets** - Define acceptable latency and resource usage
3. **Benchmark changes** - Verify optimizations with benchmarks
4. **Monitor production** - Real-world performance may differ from tests

### Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| API P50 Latency | < 50ms | < 200ms |
| API P99 Latency | < 200ms | < 1s |
| Database Query | < 10ms | < 100ms |
| Cache Hit Rate | > 80% | > 50% |
| Memory Usage | < 512MB | < 2GB |

## Memory Optimization

### Object Pooling

Use object pools for frequently allocated objects:

```go
import "github.com/mimi6060/festivals/backend/internal/pkg/performance"

// Use pre-defined pools
buf := performance.JSONBufferPool.Get()
defer performance.JSONBufferPool.Put(buf)

// Write JSON to buffer
json.NewEncoder(buf).Encode(data)

// Custom pool for specific objects
var myPool = performance.NewSyncPool("my_objects", func() *MyObject {
    return &MyObject{}
})

obj := myPool.Get()
defer myPool.Put(obj)
```

### Reduce Allocations

1. **Reuse slices and maps**:
```go
// Bad - allocates new slice each time
func process() {
    data := make([]byte, 1024)
    // ...
}

// Good - reuse from pool
func process() {
    data := performance.SmallSlicePool.Get()
    defer performance.SmallSlicePool.Put(data)
    // ...
}
```

2. **Pre-allocate with capacity**:
```go
// Bad
items := []Item{}
for _, v := range input {
    items = append(items, transform(v))
}

// Good
items := make([]Item, 0, len(input))
for _, v := range input {
    items = append(items, transform(v))
}
```

3. **Use pointers for large structs**:
```go
// Bad - copies entire struct
func process(w Wallet) { ... }

// Good - passes pointer
func process(w *Wallet) { ... }
```

### String Optimization

```go
// Use strings.Builder for concatenation
var sb strings.Builder
sb.Grow(100) // Pre-allocate if size known
sb.WriteString("Hello, ")
sb.WriteString("World!")
result := sb.String()

// Or use the pooled version
sb := performance.StringPool.Get()
defer performance.StringPool.Put(sb)
```

## CPU Optimization

### Avoid Reflection

```go
// Bad - uses reflection
json.Marshal(data)

// Better - use code generation
// Generate with easyjson, ffjson, or similar
data.MarshalJSON()
```

### Efficient JSON Handling

```go
// Pre-compute JSON for static responses
var cachedJSON = func() []byte {
    data, _ := json.Marshal(staticData)
    return data
}()

// Stream large responses
func streamJSON(w http.ResponseWriter, items []Item) {
    encoder := json.NewEncoder(w)
    for _, item := range items {
        encoder.Encode(item)
    }
}
```

### Algorithm Optimization

1. Use maps for O(1) lookups instead of slice iteration
2. Sort and binary search for large ordered datasets
3. Consider bloom filters for membership tests

## Database Optimization

### Connection Pooling

```go
// Configure pool settings
sqlDB, _ := db.DB()
sqlDB.SetMaxOpenConns(100)
sqlDB.SetMaxIdleConns(10)
sqlDB.SetConnMaxLifetime(time.Hour)
sqlDB.SetConnMaxIdleTime(10 * time.Minute)
```

### Query Optimization

1. **Use indexes effectively**:
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_wallets_user_festival ON wallets(user_id, festival_id);
CREATE INDEX idx_transactions_wallet_created ON transactions(wallet_id, created_at DESC);
```

2. **Select only needed columns**:
```go
// Bad
db.Find(&wallets)

// Good
db.Select("id", "balance", "status").Find(&wallets)
```

3. **Use proper pagination**:
```go
// Bad - offset pagination is slow for large offsets
db.Offset(10000).Limit(20).Find(&items)

// Good - cursor-based pagination
db.Where("id > ?", lastID).Limit(20).Find(&items)
```

4. **Batch operations**:
```go
// Bad - N queries
for _, item := range items {
    db.Create(&item)
}

// Good - single query
db.Create(&items)

// Or use batches for large datasets
batchSize := 1000
for i := 0; i < len(items); i += batchSize {
    end := min(i+batchSize, len(items))
    db.Create(items[i:end])
}
```

### N+1 Query Prevention

```go
// Bad - N+1 queries
var wallets []Wallet
db.Find(&wallets)
for _, w := range wallets {
    db.Where("wallet_id = ?", w.ID).Find(&w.Transactions)
}

// Good - eager loading
db.Preload("Transactions").Find(&wallets)

// Better - with conditions
db.Preload("Transactions", func(db *gorm.DB) *gorm.DB {
    return db.Order("created_at DESC").Limit(10)
}).Find(&wallets)
```

## Caching Strategies

### Cache Hierarchy

```
Request → L1 (Memory) → L2 (Redis) → Database
```

### Implementation

```go
import "github.com/mimi6060/festivals/backend/internal/pkg/performance"

// Create tiered cache
cache := performance.NewTieredCache("wallets", 1000, redisClient)

// Get with automatic fallthrough
data, found := cache.Get(ctx, walletID.String())
if !found {
    // Load from database
    wallet, _ := repo.GetWallet(ctx, walletID)
    data, _ = json.Marshal(wallet)
    cache.Set(ctx, walletID.String(), data, 5*time.Minute)
}
```

### Cache Patterns

1. **Cache-Aside (Lazy Loading)**:
```go
func GetWallet(ctx context.Context, id uuid.UUID) (*Wallet, error) {
    // Check cache
    if data, ok := cache.Get(ctx, id.String()); ok {
        var w Wallet
        json.Unmarshal(data, &w)
        return &w, nil
    }

    // Load from DB
    w, err := repo.GetWallet(ctx, id)
    if err != nil {
        return nil, err
    }

    // Populate cache
    data, _ := json.Marshal(w)
    cache.Set(ctx, id.String(), data, 5*time.Minute)

    return w, nil
}
```

2. **Write-Through**:
```go
func UpdateWallet(ctx context.Context, w *Wallet) error {
    // Update DB
    if err := repo.UpdateWallet(ctx, w); err != nil {
        return err
    }

    // Update cache
    data, _ := json.Marshal(w)
    cache.Set(ctx, w.ID.String(), data, 5*time.Minute)

    return nil
}
```

3. **Cache Invalidation**:
```go
// Invalidate on write
func DeleteWallet(ctx context.Context, id uuid.UUID) error {
    cache.Delete(ctx, id.String())
    return repo.DeleteWallet(ctx, id)
}

// Group invalidation
func InvalidateFestivalCache(ctx context.Context, festivalID uuid.UUID) {
    cacheGroup := cache.Group("festival:" + festivalID.String())
    cacheGroup.InvalidateAll(ctx)
}
```

### Cache Key Design

```go
// Use consistent, namespaced keys
const (
    cacheKeyWallet      = "wallet:%s"
    cacheKeyUserWallets = "user:%s:wallets"
    cacheKeyFestival    = "festival:%s"
)

func walletCacheKey(id uuid.UUID) string {
    return fmt.Sprintf(cacheKeyWallet, id.String())
}
```

## Concurrency Patterns

### Worker Pools

```go
import "github.com/mimi6060/festivals/backend/internal/pkg/performance"

// Process items in parallel
processor := performance.NewParallelBatch("notifications", 10,
    func(ctx context.Context, n Notification) (bool, error) {
        return sendNotification(ctx, n)
    })

results := processor.Process(ctx, notifications)
```

### Batch Processing

```go
// Batch database operations
batcher := performance.NewBatchProcessor("db_inserts",
    performance.BatchConfig{
        MaxSize: 100,
        MaxWait: 100 * time.Millisecond,
        Workers: 4,
    },
    func(ctx context.Context, items []Transaction) ([]uuid.UUID, error) {
        return repo.BulkInsert(ctx, items)
    })

// Submit items - they'll be batched automatically
id, err := batcher.Submit(ctx, transaction)
```

### Rate Limiting

```go
// Protect external APIs
rateLimiter := performance.NewRateLimiter(100, 10) // 100 max, 10/sec refill

func callExternalAPI(ctx context.Context) error {
    if err := rateLimiter.Wait(ctx); err != nil {
        return err
    }
    return externalClient.Call()
}
```

## API Optimization

### Response Compression

Enable gzip compression for responses > 1KB:

```go
router.Use(gzip.Gzip(gzip.DefaultCompression))
```

### Pagination

```go
type PaginatedResponse struct {
    Data       interface{} `json:"data"`
    NextCursor string      `json:"next_cursor,omitempty"`
    HasMore    bool        `json:"has_more"`
}

func ListTransactions(c *gin.Context) {
    cursor := c.Query("cursor")
    limit := 20

    transactions, hasMore := repo.ListAfter(ctx, cursor, limit+1)

    var nextCursor string
    if len(transactions) > limit {
        transactions = transactions[:limit]
        nextCursor = transactions[limit-1].ID.String()
        hasMore = true
    }

    c.JSON(200, PaginatedResponse{
        Data:       transactions,
        NextCursor: nextCursor,
        HasMore:    hasMore,
    })
}
```

### Field Selection

```go
// Allow clients to request specific fields
func GetWallet(c *gin.Context) {
    fields := c.QueryArray("fields")

    wallet := repo.GetWallet(ctx, id)

    if len(fields) > 0 {
        c.JSON(200, selectFields(wallet, fields))
    } else {
        c.JSON(200, wallet)
    }
}
```

## Monitoring & Alerting

### Key Metrics

```go
// Request latency histogram
metrics.RequestLatency.WithLabelValues(method, path, status).Observe(duration)

// Error rate
metrics.ErrorRate.WithLabelValues(method, path, errorType).Inc()

// Cache hit rate
metrics.CacheHitRate.WithLabelValues(cacheName).Set(hitRate)

// Database query duration
metrics.DBQueryDuration.WithLabelValues(operation, table).Observe(duration)
```

### Alerting Rules

```yaml
# prometheus alerts
groups:
  - name: performance
    rules:
      - alert: HighLatency
        expr: histogram_quantile(0.99, festivals_request_latency_seconds) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High P99 latency detected

      - alert: LowCacheHitRate
        expr: festivals_cache_hit_rate < 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Cache hit rate below 50%

      - alert: HighGoroutineCount
        expr: festivals_runtime_goroutines > 10000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: Possible goroutine leak
```

### Performance Dashboard

Track these metrics in your dashboard:

1. Request latency (P50, P90, P99)
2. Request rate and error rate
3. Database query latency
4. Cache hit/miss rates
5. Memory usage and GC pauses
6. Goroutine count
7. Active connections

## Checklist

Before deploying performance-critical code:

- [ ] Profiled under load
- [ ] Benchmarks written and passing
- [ ] No unnecessary allocations in hot paths
- [ ] Database queries optimized with indexes
- [ ] Appropriate caching implemented
- [ ] Rate limiting configured
- [ ] Monitoring and alerts set up
- [ ] Load tested at expected scale
