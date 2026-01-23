-- ============================================
-- Database Maintenance Script: VACUUM and ANALYZE
-- Purpose: Reclaim storage, update statistics, and optimize performance
-- ============================================

-- ============================================
-- SECTION 1: PRE-MAINTENANCE DIAGNOSTICS
-- ============================================

-- Check current database size
SELECT
    pg_database.datname AS database_name,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = current_database();

-- Check tables that need vacuum (high dead tuple ratio)
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    ROUND((n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100)::numeric, 2) AS dead_ratio_pct,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
    OR (n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100) > 10
ORDER BY dead_ratio_pct DESC NULLS LAST;

-- Check table bloat estimates
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS live_tuples,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS index_size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- ============================================
-- SECTION 2: ANALYZE OPERATIONS
-- Update statistics for query planner
-- ============================================

-- Analyze all tables with stale statistics
-- (Tables not analyzed in the last 24 hours with significant row changes)

-- High-traffic tables (analyze first)
ANALYZE VERBOSE transactions;
ANALYZE VERBOSE orders;
ANALYZE VERBOSE wallets;
ANALYZE VERBOSE tickets;
ANALYZE VERBOSE ticket_scans;
ANALYZE VERBOSE audit_logs;

-- Core tables
ANALYZE VERBOSE festivals;
ANALYZE VERBOSE users;
ANALYZE VERBOSE stands;
ANALYZE VERBOSE products;
ANALYZE VERBOSE stand_staff;

-- Supporting tables
ANALYZE VERBOSE ticket_types;

-- ============================================
-- SECTION 3: VACUUM OPERATIONS
-- Reclaim dead tuple space
-- ============================================

-- Regular VACUUM for high-traffic tables
-- (Does not lock table, reclaims space for reuse)
VACUUM VERBOSE transactions;
VACUUM VERBOSE orders;
VACUUM VERBOSE wallets;
VACUUM VERBOSE tickets;
VACUUM VERBOSE ticket_scans;
VACUUM VERBOSE audit_logs;

-- VACUUM with index cleanup for other tables
VACUUM (VERBOSE, INDEX_CLEANUP ON) festivals;
VACUUM (VERBOSE, INDEX_CLEANUP ON) users;
VACUUM (VERBOSE, INDEX_CLEANUP ON) stands;
VACUUM (VERBOSE, INDEX_CLEANUP ON) products;
VACUUM (VERBOSE, INDEX_CLEANUP ON) stand_staff;

-- ============================================
-- SECTION 4: VACUUM FULL (USE WITH CAUTION)
-- Only run during maintenance windows!
-- This locks the table and rewrites it completely.
-- ============================================

-- Uncomment the following lines during scheduled maintenance windows
-- when tables need complete space reclamation:

-- VACUUM FULL VERBOSE transactions;
-- VACUUM FULL VERBOSE orders;
-- VACUUM FULL VERBOSE wallets;
-- VACUUM FULL VERBOSE tickets;
-- VACUUM FULL VERBOSE audit_logs;

-- ============================================
-- SECTION 5: REINDEX OPERATIONS
-- Rebuild bloated or corrupted indexes
-- ============================================

-- Reindex specific tables with high index bloat
-- Note: REINDEX CONCURRENTLY requires PostgreSQL 12+

-- Uncomment for concurrent reindex (doesn't lock table):
-- REINDEX TABLE CONCURRENTLY transactions;
-- REINDEX TABLE CONCURRENTLY orders;
-- REINDEX TABLE CONCURRENTLY wallets;
-- REINDEX TABLE CONCURRENTLY tickets;

-- ============================================
-- SECTION 6: POST-MAINTENANCE VERIFICATION
-- ============================================

-- Verify vacuum and analyze status
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count
FROM pg_stat_user_tables
ORDER BY relname;

-- Check new database size
SELECT
    pg_database.datname AS database_name,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = current_database();

-- ============================================
-- SECTION 7: AUTOVACUUM MONITORING
-- ============================================

-- Check autovacuum settings
SELECT
    name,
    setting,
    unit,
    short_desc
FROM pg_settings
WHERE name LIKE '%autovacuum%'
ORDER BY name;

-- Check if any autovacuum workers are currently running
SELECT
    pid,
    datname,
    relid::regclass AS table_name,
    phase,
    heap_blks_total,
    heap_blks_scanned,
    heap_blks_vacuumed,
    index_vacuum_count,
    max_dead_tuples,
    num_dead_tuples
FROM pg_stat_progress_vacuum;

-- ============================================
-- SECTION 8: MAINTENANCE SCHEDULE RECOMMENDATIONS
-- ============================================

-- Tables that should have more aggressive autovacuum settings
-- (High write volume tables)

-- To adjust autovacuum settings per table:
-- ALTER TABLE transactions SET (
--     autovacuum_vacuum_threshold = 1000,
--     autovacuum_vacuum_scale_factor = 0.01,
--     autovacuum_analyze_threshold = 500,
--     autovacuum_analyze_scale_factor = 0.005
-- );

-- ALTER TABLE orders SET (
--     autovacuum_vacuum_threshold = 1000,
--     autovacuum_vacuum_scale_factor = 0.01,
--     autovacuum_analyze_threshold = 500,
--     autovacuum_analyze_scale_factor = 0.005
-- );

-- ALTER TABLE audit_logs SET (
--     autovacuum_vacuum_threshold = 5000,
--     autovacuum_vacuum_scale_factor = 0.02,
--     autovacuum_analyze_threshold = 2500,
--     autovacuum_analyze_scale_factor = 0.01
-- );

-- ============================================
-- SECTION 9: CLEANUP OLD DATA (OPTIONAL)
-- ============================================

-- Delete old audit logs (older than retention period)
-- DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '365 days';

-- Archive and delete old transactions
-- Note: Use partitioning for better performance (see partitioning.go)

-- ============================================
-- SECTION 10: SUMMARY STATISTICS
-- ============================================

SELECT
    'Total tables' AS metric,
    COUNT(*)::text AS value
FROM pg_stat_user_tables
UNION ALL
SELECT
    'Tables with dead tuples > 1000',
    COUNT(*)::text
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
UNION ALL
SELECT
    'Tables needing VACUUM',
    COUNT(*)::text
FROM pg_stat_user_tables
WHERE (n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100) > 20
UNION ALL
SELECT
    'Total live tuples',
    SUM(n_live_tup)::text
FROM pg_stat_user_tables
UNION ALL
SELECT
    'Total dead tuples',
    SUM(n_dead_tup)::text
FROM pg_stat_user_tables
UNION ALL
SELECT
    'Database size',
    pg_size_pretty(pg_database_size(current_database()));
