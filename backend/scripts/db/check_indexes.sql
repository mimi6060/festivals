-- ============================================
-- Index Health Check Script
-- Purpose: Analyze index usage and find optimization opportunities
-- ============================================

-- ============================================
-- 1. Index Usage Statistics
-- ============================================
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    pg_relation_size(indexrelid) AS index_size_bytes
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- ============================================
-- 2. Unused Indexes (candidates for removal)
-- Indexes with zero scans since last statistics reset
-- ============================================
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    pg_relation_size(indexrelid) AS index_size_bytes
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey'      -- Exclude primary keys
    AND indexrelname NOT LIKE '%_unique'    -- Exclude unique constraints
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================
-- 3. Duplicate Indexes (same columns, wasted space)
-- ============================================
SELECT
    pg_size_pretty(sum(pg_relation_size(idx))::bigint) AS total_size,
    (array_agg(idx))[1] AS index1,
    (array_agg(idx))[2] AS index2,
    (array_agg(idx))[3] AS index3
FROM (
    SELECT
        indexrelid::regclass AS idx,
        (
            SELECT array_to_string(array_agg(attname ORDER BY attnum), ', ')
            FROM pg_attribute
            WHERE attrelid = pg_index.indrelid
                AND attnum = ANY(pg_index.indkey)
        ) AS columns
    FROM pg_index
    JOIN pg_stat_user_indexes USING (indexrelid)
) s
GROUP BY columns
HAVING count(*) > 1
ORDER BY sum(pg_relation_size(idx)) DESC;

-- ============================================
-- 4. Index vs Table Size Ratio
-- High ratio may indicate over-indexing
-- ============================================
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS indexes_size,
    ROUND((pg_indexes_size(relid)::numeric / NULLIF(pg_relation_size(relid), 0) * 100)::numeric, 2) AS index_ratio_percent,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = relname) AS index_count
FROM pg_stat_user_tables
WHERE pg_relation_size(relid) > 0
ORDER BY index_ratio_percent DESC NULLS LAST;

-- ============================================
-- 5. Index Bloat Estimation
-- Identify indexes that may benefit from REINDEX
-- ============================================
SELECT
    current_database() AS db,
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) AS index_size,
    idx_scan AS index_scans,
    CASE
        WHEN idx_scan = 0 THEN 'Never used'
        WHEN idx_scan < 50 THEN 'Rarely used'
        WHEN idx_scan < 500 THEN 'Occasionally used'
        ELSE 'Frequently used'
    END AS usage_category
FROM pg_stat_user_indexes
JOIN pg_indexes ON indexrelname = indexname AND schemaname = pg_indexes.schemaname
ORDER BY pg_relation_size(indexrelid::regclass) DESC;

-- ============================================
-- 6. Missing Indexes Detection
-- Tables with sequential scans and no index usage
-- ============================================
SELECT
    schemaname,
    relname AS table_name,
    seq_scan,
    seq_tup_read,
    idx_scan,
    ROUND(seq_tup_read::numeric / NULLIF(seq_scan, 0), 0) AS avg_seq_tup_read,
    n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE seq_scan > 100
    AND idx_scan = 0
    AND n_live_tup > 1000
ORDER BY seq_tup_read DESC;

-- ============================================
-- 7. Index Details with Column Information
-- ============================================
SELECT
    t.relname AS table_name,
    i.relname AS index_name,
    a.attname AS column_name,
    ix.indisunique AS is_unique,
    ix.indisprimary AS is_primary,
    pg_size_pretty(pg_relation_size(i.oid)) AS index_size,
    am.amname AS index_type
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_am am ON i.relam = am.oid
LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relkind = 'r'
    AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY t.relname, i.relname, a.attnum;

-- ============================================
-- 8. Partial Index Candidates
-- Columns with low selectivity that might benefit from partial indexes
-- ============================================
SELECT
    schemaname,
    tablename,
    attname AS column_name,
    null_frac AS null_fraction,
    n_distinct,
    most_common_vals,
    most_common_freqs
FROM pg_stats
WHERE schemaname = 'public'
    AND n_distinct BETWEEN -0.1 AND 10
    AND null_frac < 0.5
ORDER BY tablename, attname;

-- ============================================
-- 9. Index Size Summary by Table
-- ============================================
SELECT
    relname AS table_name,
    COUNT(*) AS index_count,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS total_index_size,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
GROUP BY relname, relid
ORDER BY pg_indexes_size(relid) DESC;

-- ============================================
-- 10. Foreign Keys Without Indexes
-- These can cause slow deletes and joins
-- ============================================
SELECT
    c.conrelid::regclass AS table_name,
    c.conname AS constraint_name,
    a.attname AS column_name,
    c.confrelid::regclass AS referenced_table
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.contype = 'f'
    AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
            AND a.attnum = ANY(i.indkey)
    )
ORDER BY c.conrelid::regclass::text, c.conname;

-- ============================================
-- 11. Index Efficiency Score
-- Combines usage, size, and performance metrics
-- ============================================
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS scans,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size,
    CASE
        WHEN idx_scan = 0 THEN 0
        ELSE ROUND((idx_scan::numeric / pg_relation_size(indexrelid) * 1000000)::numeric, 2)
    END AS efficiency_score,
    CASE
        WHEN idx_scan = 0 THEN 'Consider removing'
        WHEN idx_scan < 100 AND pg_relation_size(indexrelid) > 10485760 THEN 'Low efficiency'
        WHEN idx_scan > 1000 THEN 'High value'
        ELSE 'Normal'
    END AS recommendation
FROM pg_stat_user_indexes
ORDER BY efficiency_score DESC;

-- ============================================
-- 12. GIN/GiST Index Performance
-- Special indexes for full-text search and spatial data
-- ============================================
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size,
    am.amname AS index_type
FROM pg_stat_user_indexes sui
JOIN pg_class c ON sui.indexrelid = c.oid
JOIN pg_am am ON c.relam = am.oid
WHERE am.amname IN ('gin', 'gist', 'brin')
ORDER BY idx_scan DESC;

-- ============================================
-- 13. Index Maintenance Recommendations
-- ============================================
SELECT
    'Total unused indexes' AS metric,
    COUNT(*)::text AS value
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey'
UNION ALL
SELECT
    'Space wasted by unused indexes',
    pg_size_pretty(SUM(pg_relation_size(indexrelid)))
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey'
UNION ALL
SELECT
    'Total index space used',
    pg_size_pretty(SUM(pg_relation_size(indexrelid)))
FROM pg_stat_user_indexes
UNION ALL
SELECT
    'Average index size',
    pg_size_pretty(AVG(pg_relation_size(indexrelid))::bigint)
FROM pg_stat_user_indexes;
