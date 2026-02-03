# Database Scaling Strategies

## Overview

This document outlines scaling strategies for the Festival Management Platform database to handle growing traffic and data volumes, particularly during peak festival events.

## Current Architecture

```
┌─────────────────┐
│   Application   │
│     Servers     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Connection    │
│     Pooler      │
│   (PgBouncer)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Primary      │
│   PostgreSQL    │
└─────────────────┘
```

## Scaling Dimensions

### 1. Vertical Scaling (Scale Up)

**When to use**: Quick fixes, predictable growth

#### Hardware Upgrades
- CPU: More cores for parallel query execution
- RAM: Larger shared_buffers and work_mem
- Storage: NVMe SSDs for better I/O

#### PostgreSQL Configuration
```ini
# Memory Settings (for 64GB RAM server)
shared_buffers = 16GB          # 25% of RAM
effective_cache_size = 48GB    # 75% of RAM
work_mem = 256MB               # Per operation
maintenance_work_mem = 2GB     # VACUUM, CREATE INDEX

# Parallel Query
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_parallel_maintenance_workers = 4

# Write Performance
wal_buffers = 64MB
checkpoint_completion_target = 0.9
max_wal_size = 4GB
```

### 2. Read Scaling (Replicas)

**When to use**: Read-heavy workloads, analytics

```
┌─────────────────┐
│   Application   │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│Primary│ │Replica│
│ (R/W) │ │ (R)   │
└───────┘ └───────┘
```

#### Setup Streaming Replication
```sql
-- On primary
CREATE USER replication_user REPLICATION LOGIN ENCRYPTED PASSWORD 'xxx';

-- In pg_hba.conf
host replication replication_user replica_ip/32 scram-sha-256
```

#### Application Changes
```go
// Use read replica for reporting queries
type DBConfig struct {
    Primary *gorm.DB
    Replica *gorm.DB
}

func (r *repository) GetTransactionStats(ctx context.Context) (*Stats, error) {
    // Use replica for read-only analytics
    return r.db.Replica.WithContext(ctx).Raw(...).Scan(&stats)
}
```

### 3. Connection Pooling

**When to use**: Many application instances, connection overhead

#### PgBouncer Configuration
```ini
[databases]
festivals = host=localhost port=5432 dbname=festivals

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = scram-sha-256
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 50
min_pool_size = 10
reserve_pool_size = 5
reserve_pool_timeout = 3
```

#### Application Configuration
```go
// Connect to PgBouncer instead of PostgreSQL directly
db, err := gorm.Open(postgres.Open("host=pgbouncer port=6432 ..."))

// Configure application pool
sqlDB.SetMaxOpenConns(100)
sqlDB.SetMaxIdleConns(10)
sqlDB.SetConnMaxLifetime(time.Hour)
```

### 4. Table Partitioning

**When to use**: Large tables (>100M rows), time-series data

#### Range Partitioning (by date)
```sql
-- Partition transactions by month
CREATE TABLE transactions (
    id UUID,
    wallet_id UUID,
    amount BIGINT,
    created_at TIMESTAMPTZ,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE transactions_2024_01 PARTITION OF transactions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE transactions_2024_02 PARTITION OF transactions
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

#### Benefits
- Partition pruning: Only scan relevant partitions
- Easy archival: Drop old partitions instead of DELETE
- Parallel maintenance: VACUUM each partition separately
- Better cache utilization: Recent data stays in memory

#### Automated Partition Management
```go
// Use the partition manager
pm := database.NewPartitionManager(db)

// Create partitions for next 3 months
pm.CreateFuturePartitions(ctx, "transactions_partitioned", database.PartitionSizeMonthly, 3)

// Drop partitions older than 12 months
pm.DropOldPartitions(ctx, "transactions_partitioned", 365*24*time.Hour)
```

### 5. Sharding (Horizontal Partitioning)

**When to use**: Massive scale, multi-region deployment

#### Sharding Strategy: By Festival

```
Festival A (EU)          Festival B (US)
     │                        │
     ▼                        ▼
┌─────────┐              ┌─────────┐
│ Shard 1 │              │ Shard 2 │
│  (EU)   │              │  (US)   │
└─────────┘              └─────────┘
```

#### Implementation with Citus
```sql
-- Enable Citus extension
CREATE EXTENSION citus;

-- Distribute tables by festival_id
SELECT create_distributed_table('wallets', 'festival_id');
SELECT create_distributed_table('transactions', 'festival_id');
SELECT create_distributed_table('orders', 'festival_id');

-- Reference tables (small, shared across shards)
SELECT create_reference_table('users');
SELECT create_reference_table('festivals');
```

### 6. Caching Layer

**When to use**: Reduce database load, improve latency

```
┌─────────────────┐
│   Application   │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ Redis │ │  DB   │
│ Cache │ │       │
└───────┘ └───────┘
```

#### Cache Strategies

**1. Read-Through Cache**
```go
func (s *Service) GetWallet(ctx context.Context, id uuid.UUID) (*Wallet, error) {
    // Try cache first
    cached, err := s.cache.Get(ctx, "wallet:"+id.String())
    if err == nil {
        return cached.(*Wallet), nil
    }

    // Load from database
    wallet, err := s.repo.GetWalletByID(ctx, id)
    if err != nil {
        return nil, err
    }

    // Store in cache
    s.cache.Set(ctx, "wallet:"+id.String(), wallet, 5*time.Minute)
    return wallet, nil
}
```

**2. Write-Through Cache**
```go
func (s *Service) UpdateWalletBalance(ctx context.Context, id uuid.UUID, balance int64) error {
    // Update database
    if err := s.repo.UpdateBalance(ctx, id, balance); err != nil {
        return err
    }

    // Invalidate cache
    s.cache.Delete(ctx, "wallet:"+id.String())
    return nil
}
```

**3. Cache-Aside with TTL**
```go
// For frequently read, rarely changed data
func (s *Service) GetFestival(ctx context.Context, slug string) (*Festival, error) {
    cacheKey := "festival:" + slug

    var festival Festival
    err := s.cache.Get(ctx, cacheKey, &festival)
    if err == nil {
        return &festival, nil
    }

    // Load from DB with longer TTL for stable data
    festival, err = s.repo.GetFestivalBySlug(ctx, slug)
    if err != nil {
        return nil, err
    }

    s.cache.Set(ctx, cacheKey, festival, 1*time.Hour)
    return festival, nil
}
```

### 7. Query Optimization

#### Use Materialized Views for Analytics
```sql
CREATE MATERIALIZED VIEW festival_daily_stats AS
SELECT
    festival_id,
    DATE(created_at) as date,
    COUNT(*) as transaction_count,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_debits
FROM transactions
GROUP BY festival_id, DATE(created_at);

-- Refresh daily (or as needed)
REFRESH MATERIALIZED VIEW CONCURRENTLY festival_daily_stats;

-- Index for fast lookups
CREATE INDEX idx_festival_daily_stats ON festival_daily_stats(festival_id, date);
```

#### Denormalization for Hot Paths
```sql
-- Add redundant columns for frequent queries
ALTER TABLE orders ADD COLUMN festival_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN stand_name VARCHAR(255);

-- Update via trigger or application code
```

## Load Balancing Strategies

### HAProxy Configuration
```
frontend postgresql
    bind *:5432
    default_backend pg_primary

frontend postgresql_readonly
    bind *:5433
    default_backend pg_replicas

backend pg_primary
    server primary 10.0.0.1:5432 check

backend pg_replicas
    balance roundrobin
    server replica1 10.0.0.2:5432 check
    server replica2 10.0.0.3:5432 check
```

## Monitoring at Scale

### Key Metrics to Track
- Queries per second (QPS)
- Query latency (p50, p95, p99)
- Connection count and utilization
- Replication lag
- Cache hit ratio
- Disk I/O wait

### Alerting Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Query latency p95 | > 100ms | > 500ms |
| Connection utilization | > 70% | > 90% |
| Replication lag | > 1s | > 10s |
| Disk space | > 70% | > 85% |
| Cache hit ratio | < 90% | < 80% |

## Scaling Checklist by Traffic Level

### Small (< 1,000 concurrent users)
- [ ] Proper indexing
- [ ] Connection pooling (application-level)
- [ ] Query optimization

### Medium (1,000 - 10,000 concurrent users)
- [ ] PgBouncer connection pooling
- [ ] Read replica for analytics
- [ ] Redis caching layer
- [ ] Materialized views

### Large (10,000 - 100,000 concurrent users)
- [ ] Multiple read replicas
- [ ] Table partitioning
- [ ] Sharding preparation
- [ ] Multi-region deployment

### Enterprise (> 100,000 concurrent users)
- [ ] Full sharding (Citus/custom)
- [ ] Multi-region with geo-routing
- [ ] Custom read/write routing
- [ ] Dedicated analytics cluster

## Cost Considerations

| Strategy | Complexity | Cost Impact | When to Use |
|----------|------------|-------------|-------------|
| Vertical scaling | Low | High | Quick fix |
| Read replicas | Medium | Medium | Read-heavy |
| Connection pooling | Low | Low | Always |
| Caching | Medium | Medium | High read volume |
| Partitioning | Medium | Low | Large tables |
| Sharding | High | Variable | Massive scale |

## Migration Path

1. **Start simple**: Optimize queries and add indexes
2. **Add caching**: Reduce DB load for frequent reads
3. **Scale vertically**: Upgrade hardware
4. **Add read replicas**: Separate read/write traffic
5. **Implement partitioning**: Manage large tables
6. **Consider sharding**: Only when truly necessary

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Citus Data Scaling Guide](https://docs.citusdata.com/)
- [PgBouncer Documentation](https://www.pgbouncer.org/config.html)
- [Redis Caching Patterns](https://redis.io/docs/manual/patterns/)
