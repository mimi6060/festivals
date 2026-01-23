-- ============================================
-- Partition Maintenance Script
-- Purpose: Manage table partitions for time-series data
-- ============================================

-- ============================================
-- SECTION 1: PARTITION STATUS CHECK
-- ============================================

-- List all partitioned tables
SELECT
    parent.relname AS parent_table,
    COUNT(child.relname) AS partition_count,
    pg_size_pretty(SUM(pg_total_relation_size(child.oid))) AS total_size
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
GROUP BY parent.relname
ORDER BY parent.relname;

-- List all partitions with their bounds and sizes
SELECT
    parent.relname AS parent_table,
    child.relname AS partition_name,
    pg_get_expr(child.relpartbound, child.oid) AS partition_bounds,
    pg_size_pretty(pg_total_relation_size(child.oid)) AS size,
    pg_total_relation_size(child.oid) AS size_bytes
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY parent.relname, child.relname;

-- Get row counts per partition (expensive on large partitions)
DO $$
DECLARE
    r RECORD;
    row_count BIGINT;
BEGIN
    RAISE NOTICE 'Partition Row Counts:';
    RAISE NOTICE '=====================';

    FOR r IN
        SELECT
            parent.relname AS parent_table,
            child.relname AS partition_name
        FROM pg_inherits
        JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
        JOIN pg_class child ON pg_inherits.inhrelid = child.oid
        WHERE parent.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        ORDER BY parent.relname, child.relname
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.partition_name) INTO row_count;
        RAISE NOTICE '% - %: % rows', r.parent_table, r.partition_name, row_count;
    END LOOP;
END $$;

-- ============================================
-- SECTION 2: CREATE FUTURE PARTITIONS
-- Functions to create monthly partitions
-- ============================================

-- Function to create monthly partitions for any table
CREATE OR REPLACE FUNCTION create_monthly_partition(
    parent_table TEXT,
    partition_date DATE
) RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    start_date := date_trunc('month', partition_date)::DATE;
    end_date := (date_trunc('month', partition_date) + INTERVAL '1 month')::DATE;
    partition_name := parent_table || '_' || to_char(start_date, 'YYYY_MM');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        parent_table,
        start_date,
        end_date
    );

    RETURN partition_name;
END;
$$ LANGUAGE plpgsql;

-- Function to create partitions for the next N months
CREATE OR REPLACE FUNCTION create_future_partitions(
    parent_table TEXT,
    months_ahead INTEGER DEFAULT 3
) RETURNS TABLE(partition_name TEXT) AS $$
DECLARE
    i INTEGER;
    target_date DATE;
BEGIN
    FOR i IN 0..months_ahead LOOP
        target_date := (current_date + (i || ' months')::INTERVAL)::DATE;
        partition_name := create_monthly_partition(parent_table, target_date);
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create partitions for transactions table (next 3 months)
-- SELECT * FROM create_future_partitions('transactions_partitioned', 3);

-- Create partitions for audit_logs table (next 3 months)
-- SELECT * FROM create_future_partitions('audit_logs_partitioned', 3);

-- ============================================
-- SECTION 3: DROP OLD PARTITIONS
-- Functions to remove partitions beyond retention period
-- ============================================

-- Function to drop partitions older than retention period
CREATE OR REPLACE FUNCTION drop_old_partitions(
    parent_table TEXT,
    retention_months INTEGER DEFAULT 12
) RETURNS TABLE(dropped_partition TEXT) AS $$
DECLARE
    cutoff_date DATE;
    r RECORD;
    partition_end_date DATE;
BEGIN
    cutoff_date := (current_date - (retention_months || ' months')::INTERVAL)::DATE;

    FOR r IN
        SELECT
            child.relname AS partition_name,
            pg_get_expr(child.relpartbound, child.oid) AS partition_bounds
        FROM pg_inherits
        JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
        JOIN pg_class child ON pg_inherits.inhrelid = child.oid
        WHERE parent.relname = parent_table
    LOOP
        -- Extract end date from partition bounds
        -- Format: FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
        BEGIN
            partition_end_date := (regexp_match(r.partition_bounds, 'TO \(''([^'']+)''\)'))[1]::DATE;

            IF partition_end_date < cutoff_date THEN
                EXECUTE format('DROP TABLE IF EXISTS %I', r.partition_name);
                dropped_partition := r.partition_name;
                RETURN NEXT;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Skip partitions with non-standard bounds
            CONTINUE;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Drop partitions older than 12 months
-- SELECT * FROM drop_old_partitions('transactions_partitioned', 12);
-- SELECT * FROM drop_old_partitions('audit_logs_partitioned', 12);

-- ============================================
-- SECTION 4: DETACH AND ARCHIVE PARTITIONS
-- For archiving old data before dropping
-- ============================================

-- Function to detach a partition (keeps data, removes from parent)
CREATE OR REPLACE FUNCTION detach_partition(
    parent_table TEXT,
    partition_name TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I DETACH PARTITION %I', parent_table, partition_name);
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error detaching partition %: %', partition_name, SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to archive a partition to a separate schema
CREATE OR REPLACE FUNCTION archive_partition(
    partition_name TEXT,
    archive_schema TEXT DEFAULT 'archive'
) RETURNS BOOLEAN AS $$
BEGIN
    -- Create archive schema if not exists
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', archive_schema);

    -- Move partition to archive schema
    EXECUTE format('ALTER TABLE %I SET SCHEMA %I', partition_name, archive_schema);

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error archiving partition %: %', partition_name, SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SECTION 5: PARTITION STATISTICS
-- ============================================

-- Get partition sizes and row counts summary
CREATE OR REPLACE VIEW partition_statistics AS
SELECT
    parent.relname AS parent_table,
    COUNT(child.relname) AS partition_count,
    pg_size_pretty(SUM(pg_total_relation_size(child.oid))) AS total_size,
    pg_size_pretty(MIN(pg_total_relation_size(child.oid))) AS min_partition_size,
    pg_size_pretty(MAX(pg_total_relation_size(child.oid))) AS max_partition_size,
    pg_size_pretty(AVG(pg_total_relation_size(child.oid))::BIGINT) AS avg_partition_size
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY parent.relname;

-- SELECT * FROM partition_statistics;

-- ============================================
-- SECTION 6: PARTITION MAINTENANCE SCHEDULE
-- ============================================

-- Function to run full partition maintenance
CREATE OR REPLACE FUNCTION run_partition_maintenance(
    create_months_ahead INTEGER DEFAULT 3,
    retention_months INTEGER DEFAULT 12
) RETURNS TABLE(
    operation TEXT,
    table_name TEXT,
    partition_name TEXT
) AS $$
DECLARE
    partitioned_tables TEXT[] := ARRAY['transactions_partitioned', 'audit_logs_partitioned'];
    tbl TEXT;
    r RECORD;
BEGIN
    FOREACH tbl IN ARRAY partitioned_tables
    LOOP
        -- Create future partitions
        FOR r IN SELECT * FROM create_future_partitions(tbl, create_months_ahead)
        LOOP
            operation := 'CREATE';
            table_name := tbl;
            partition_name := r.partition_name;
            RETURN NEXT;
        END LOOP;

        -- Drop old partitions
        FOR r IN SELECT * FROM drop_old_partitions(tbl, retention_months)
        LOOP
            operation := 'DROP';
            table_name := tbl;
            partition_name := r.dropped_partition;
            RETURN NEXT;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run maintenance
-- SELECT * FROM run_partition_maintenance(3, 12);

-- ============================================
-- SECTION 7: PARTITION PRUNING VERIFICATION
-- ============================================

-- Verify partition pruning is working
-- Run EXPLAIN on a query with date filter to see which partitions are scanned

-- Example:
-- EXPLAIN (ANALYZE, COSTS, BUFFERS)
-- SELECT * FROM transactions_partitioned
-- WHERE created_at >= '2024-01-01' AND created_at < '2024-02-01';

-- Check partition constraint exclusion setting
SELECT name, setting, short_desc
FROM pg_settings
WHERE name IN ('constraint_exclusion', 'enable_partition_pruning');

-- ============================================
-- SECTION 8: DEFAULT PARTITION MANAGEMENT
-- ============================================

-- Check for data in default partitions (shouldn't have any ideally)
DO $$
DECLARE
    r RECORD;
    row_count BIGINT;
BEGIN
    RAISE NOTICE 'Checking default partitions:';

    FOR r IN
        SELECT child.relname AS partition_name
        FROM pg_inherits
        JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
        JOIN pg_class child ON pg_inherits.inhrelid = child.oid
        WHERE child.relname LIKE '%_default'
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.partition_name) INTO row_count;
        IF row_count > 0 THEN
            RAISE WARNING 'Default partition % has % rows - consider creating proper partitions',
                r.partition_name, row_count;
        ELSE
            RAISE NOTICE 'Default partition % is empty (OK)', r.partition_name;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- SECTION 9: PARTITION INDEX MANAGEMENT
-- ============================================

-- Indexes are automatically inherited on partitions since PostgreSQL 11
-- But you can also create indexes on specific partitions

-- List indexes on partitioned tables
SELECT
    parent.relname AS parent_table,
    child.relname AS partition_name,
    i.relname AS index_name,
    pg_size_pretty(pg_relation_size(i.oid)) AS index_size
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
JOIN pg_index ix ON child.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
WHERE parent.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY parent.relname, child.relname, i.relname;

-- ============================================
-- SECTION 10: CLEANUP AND SUMMARY
-- ============================================

-- Summary of partition maintenance needs
SELECT
    'Partitioned tables' AS metric,
    COUNT(DISTINCT parent.relname)::TEXT AS value
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
WHERE parent.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
UNION ALL
SELECT
    'Total partitions',
    COUNT(*)::TEXT
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
WHERE parent.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
UNION ALL
SELECT
    'Total partitioned data size',
    pg_size_pretty(SUM(pg_total_relation_size(child.oid)))
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
