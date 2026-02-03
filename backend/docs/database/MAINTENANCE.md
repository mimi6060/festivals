# Database Maintenance Guide

## Overview

This guide covers routine database maintenance tasks for the Festival Management Platform. Regular maintenance ensures optimal performance, especially during high-traffic festival events.

## Maintenance Schedule

### Daily Tasks
- Monitor slow queries
- Check connection pool usage
- Review error logs

### Weekly Tasks
- Run ANALYZE on high-traffic tables
- Check index usage statistics
- Review autovacuum activity

### Monthly Tasks
- Full VACUUM on all tables
- Review and clean up unused indexes
- Check table bloat

### Quarterly Tasks
- REINDEX bloated indexes
- Review query performance trends
- Update statistics targets if needed

## Routine Maintenance Scripts

### 1. VACUUM and ANALYZE

Run the maintenance script:
```bash
psql -d festivals -f scripts/db/vacuum_analyze.sql
```

Or run individually:
```sql
-- Update statistics for query planner
ANALYZE VERBOSE transactions;
ANALYZE VERBOSE orders;
ANALYZE VERBOSE wallets;
ANALYZE VERBOSE tickets;

-- Reclaim dead tuple space
VACUUM VERBOSE transactions;
VACUUM VERBOSE orders;
```

### 2. Monitor Table Bloat

```sql
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    ROUND((n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100)::numeric, 2) AS dead_ratio_pct,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_ratio_pct DESC;
```

### 3. Check Autovacuum Status

```sql
-- Current autovacuum activity
SELECT
    pid,
    datname,
    relid::regclass AS table_name,
    phase,
    heap_blks_total,
    heap_blks_scanned,
    heap_blks_vacuumed
FROM pg_stat_progress_vacuum;

-- Autovacuum settings
SELECT name, setting, short_desc
FROM pg_settings
WHERE name LIKE '%autovacuum%'
ORDER BY name;
```

### 4. Tune Autovacuum for High-Traffic Tables

```sql
-- Aggressive autovacuum for transactions table
ALTER TABLE transactions SET (
    autovacuum_vacuum_threshold = 1000,
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_analyze_threshold = 500,
    autovacuum_analyze_scale_factor = 0.005
);

-- Similar settings for orders
ALTER TABLE orders SET (
    autovacuum_vacuum_threshold = 1000,
    autovacuum_vacuum_scale_factor = 0.01
);

-- Audit logs (less aggressive, larger table)
ALTER TABLE audit_logs SET (
    autovacuum_vacuum_threshold = 5000,
    autovacuum_vacuum_scale_factor = 0.02
);
```

## Performance Monitoring

### 1. Slow Query Analysis

Enable pg_stat_statements:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Find slowest queries:
```sql
SELECT
    LEFT(query, 100) AS query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 2. Connection Monitoring

```sql
-- Current connections
SELECT
    datname,
    usename,
    state,
    COUNT(*) as count
FROM pg_stat_activity
GROUP BY datname, usename, state
ORDER BY count DESC;

-- Long-running queries
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
    AND state != 'idle'
ORDER BY duration DESC;
```

### 3. Lock Monitoring

```sql
-- Active locks
SELECT
    pg_locks.pid,
    pg_class.relname,
    pg_locks.mode,
    pg_locks.granted
FROM pg_locks
JOIN pg_class ON pg_locks.relation = pg_class.oid
WHERE pg_class.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY pg_class.relname;

-- Blocked queries
SELECT
    blocked.pid AS blocked_pid,
    blocked.query AS blocked_query,
    blocking.pid AS blocking_pid,
    blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
    ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.pid != blocking.pid;
```

## Backup and Recovery

### 1. Regular Backups

```bash
# Full database backup
pg_dump -Fc -d festivals -f backup_$(date +%Y%m%d).dump

# Backup specific tables
pg_dump -Fc -d festivals -t transactions -t orders -f transactions_backup.dump

# Backup with parallel jobs
pg_dump -Fc -d festivals -j 4 -f backup_parallel.dump
```

### 2. Point-in-Time Recovery Setup

Ensure WAL archiving is configured in `postgresql.conf`:
```
wal_level = replica
archive_mode = on
archive_command = 'cp %p /path/to/archive/%f'
```

### 3. Restore Procedures

```bash
# Restore full database
pg_restore -d festivals -c backup.dump

# Restore specific table
pg_restore -d festivals -t transactions backup.dump
```

## Storage Management

### 1. Check Database Size

```sql
SELECT
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;
```

### 2. Table Sizes

```sql
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS index_size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

### 3. Reclaim Disk Space

```sql
-- Regular VACUUM only marks space for reuse
VACUUM VERBOSE transactions;

-- VACUUM FULL rewrites table (requires exclusive lock!)
-- Only run during maintenance windows
VACUUM FULL VERBOSE transactions;

-- Alternative: pg_repack (no locks)
-- pg_repack -d festivals -t transactions
```

## Partition Maintenance

For partitioned tables (transactions, audit_logs):

### 1. Create Future Partitions

```sql
-- Using partition maintenance function
SELECT * FROM create_future_partitions('transactions_partitioned', 3);
```

### 2. Drop Old Partitions

```sql
-- Drop partitions older than 12 months
SELECT * FROM drop_old_partitions('transactions_partitioned', 12);
```

### 3. Monitor Partition Health

```sql
SELECT
    parent.relname AS parent_table,
    child.relname AS partition_name,
    pg_size_pretty(pg_total_relation_size(child.oid)) AS size
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
ORDER BY parent.relname, child.relname;
```

## Emergency Procedures

### 1. Kill Long-Running Query

```sql
-- Graceful termination
SELECT pg_cancel_backend(pid);

-- Force termination
SELECT pg_terminate_backend(pid);
```

### 2. Release Locks

```sql
-- Find blocking processes
SELECT pg_blocking_pids(pid), * FROM pg_stat_activity WHERE wait_event_type = 'Lock';

-- Terminate blocking process
SELECT pg_terminate_backend(blocking_pid);
```

### 3. Connection Limit Reached

```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Terminate idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < NOW() - INTERVAL '10 minutes';
```

## Health Checks

Run before and after major events:

```sql
-- Database health check
SELECT
    'Database Size' AS check,
    pg_size_pretty(pg_database_size(current_database())) AS value
UNION ALL
SELECT
    'Total Connections',
    COUNT(*)::text
FROM pg_stat_activity
UNION ALL
SELECT
    'Active Queries',
    COUNT(*)::text
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT
    'Tables Needing VACUUM',
    COUNT(*)::text
FROM pg_stat_user_tables
WHERE (n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100) > 20;
```

## Monitoring Checklist

- [ ] Daily slow query review
- [ ] Weekly ANALYZE on high-traffic tables
- [ ] Weekly index usage check
- [ ] Monthly VACUUM FULL consideration
- [ ] Monthly backup verification
- [ ] Quarterly index rebuild assessment
- [ ] Quarterly partition maintenance

## Tools

- **pgAdmin**: GUI for database management
- **pg_stat_statements**: Query performance statistics
- **pg_repack**: Online table reorganization
- **pgBadger**: Log analyzer
- **Prometheus + postgres_exporter**: Metrics collection
