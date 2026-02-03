-- ============================================
-- Query Analysis Script
-- Purpose: Find and analyze slow queries using pg_stat_statements
-- ============================================

-- Ensure pg_stat_statements extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================
-- 1. Top 20 Slowest Queries by Mean Execution Time
-- ============================================
SELECT
    queryid,
    LEFT(query, 100) AS query_preview,
    calls,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
    ROUND(min_exec_time::numeric, 2) AS min_time_ms,
    ROUND(max_exec_time::numeric, 2) AS max_time_ms,
    ROUND(stddev_exec_time::numeric, 2) AS stddev_time_ms,
    rows,
    ROUND((100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric, 2) AS cache_hit_percent
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
    AND query NOT LIKE 'EXPLAIN%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- ============================================
-- 2. Top 20 Queries by Total Execution Time
-- ============================================
SELECT
    queryid,
    LEFT(query, 100) AS query_preview,
    calls,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
    rows,
    ROUND((total_exec_time / SUM(total_exec_time) OVER () * 100)::numeric, 2) AS percentage_of_total
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- ============================================
-- 3. Most Frequently Called Queries
-- ============================================
SELECT
    queryid,
    LEFT(query, 100) AS query_preview,
    calls,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
    rows,
    ROUND(rows::numeric / NULLIF(calls, 0), 2) AS avg_rows_per_call
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY calls DESC
LIMIT 20;

-- ============================================
-- 4. Queries with Poor Cache Hit Ratio
-- ============================================
SELECT
    queryid,
    LEFT(query, 100) AS query_preview,
    calls,
    shared_blks_hit,
    shared_blks_read,
    ROUND((100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric, 2) AS cache_hit_percent,
    ROUND(mean_exec_time::numeric, 2) AS mean_time_ms
FROM pg_stat_statements
WHERE shared_blks_read > 100
    AND query NOT LIKE '%pg_stat%'
ORDER BY cache_hit_percent ASC NULLS LAST
LIMIT 20;

-- ============================================
-- 5. Queries with High Row Counts (potential full scans)
-- ============================================
SELECT
    queryid,
    LEFT(query, 100) AS query_preview,
    calls,
    rows,
    ROUND(rows::numeric / NULLIF(calls, 0), 0) AS avg_rows_per_call,
    ROUND(mean_exec_time::numeric, 2) AS mean_time_ms
FROM pg_stat_statements
WHERE rows > 10000
    AND query NOT LIKE '%pg_stat%'
ORDER BY rows DESC
LIMIT 20;

-- ============================================
-- 6. Queries with High Variance (inconsistent performance)
-- ============================================
SELECT
    queryid,
    LEFT(query, 100) AS query_preview,
    calls,
    ROUND(min_exec_time::numeric, 2) AS min_time_ms,
    ROUND(max_exec_time::numeric, 2) AS max_time_ms,
    ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
    ROUND(stddev_exec_time::numeric, 2) AS stddev_time_ms,
    ROUND((stddev_exec_time / NULLIF(mean_exec_time, 0))::numeric, 2) AS coeff_of_variation
FROM pg_stat_statements
WHERE calls > 10
    AND query NOT LIKE '%pg_stat%'
ORDER BY stddev_exec_time DESC
LIMIT 20;

-- ============================================
-- 7. Sequential Scans on Large Tables
-- ============================================
SELECT
    schemaname,
    relname AS table_name,
    seq_scan,
    seq_tup_read,
    ROUND(seq_tup_read::numeric / NULLIF(seq_scan, 0), 0) AS avg_rows_per_scan,
    idx_scan,
    idx_tup_fetch,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE seq_scan > 0
    AND n_live_tup > 1000
ORDER BY seq_tup_read DESC
LIMIT 20;

-- ============================================
-- 8. Tables with High Dead Tuple Ratio (need VACUUM)
-- ============================================
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    ROUND((n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100)::numeric, 2) AS dead_tuple_percent,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_tuple_percent DESC
LIMIT 20;

-- ============================================
-- 9. Long Running Active Queries
-- ============================================
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
    AND state != 'idle'
    AND query NOT LIKE '%pg_stat%'
ORDER BY duration DESC;

-- ============================================
-- 10. Blocked Queries (Waiting for Locks)
-- ============================================
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity
    ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity
    ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- ============================================
-- 11. Query Statistics Summary
-- ============================================
SELECT
    'Total queries executed' AS metric,
    SUM(calls)::text AS value
FROM pg_stat_statements
UNION ALL
SELECT
    'Total execution time (hours)',
    ROUND((SUM(total_exec_time) / 1000 / 60 / 60)::numeric, 2)::text
FROM pg_stat_statements
UNION ALL
SELECT
    'Average query time (ms)',
    ROUND(AVG(mean_exec_time)::numeric, 2)::text
FROM pg_stat_statements
UNION ALL
SELECT
    'Queries > 100ms average',
    COUNT(*)::text
FROM pg_stat_statements
WHERE mean_exec_time > 100
UNION ALL
SELECT
    'Queries > 1000ms average',
    COUNT(*)::text
FROM pg_stat_statements
WHERE mean_exec_time > 1000;

-- ============================================
-- To reset statistics (run manually when needed):
-- SELECT pg_stat_statements_reset();
-- ============================================
