# Database Index Strategy

## Overview

This document outlines the indexing strategy for the Festival Management Platform database. Proper indexing is crucial for query performance, especially during high-traffic festival events.

## Index Types Used

### 1. B-tree Indexes (Default)
- Best for equality and range queries
- Used for most columns with unique values
- Supports: `=`, `<`, `>`, `<=`, `>=`, `BETWEEN`, `IN`, `IS NULL`

### 2. GIN (Generalized Inverted Index)
- Used for full-text search (`tsvector`)
- Used for array containment queries
- Used for JSONB document queries
- Slower to update but very fast for searches

### 3. BRIN (Block Range Index)
- Ideal for time-series data
- Very small index size
- Used for `timestamp` columns on large tables

### 4. Trigram (pg_trgm)
- Enables fuzzy string matching
- Used for `LIKE '%text%'` queries
- Supports similarity searches

## Index Categories

### Primary Key Indexes
Automatically created for all tables:
```sql
-- Example: festivals_pkey ON festivals(id)
```

### Foreign Key Indexes
Essential for JOIN performance and cascading operations:
```sql
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_festival_id ON wallets(festival_id);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
```

### Composite Indexes
For queries with multiple WHERE conditions:
```sql
-- Optimizes: WHERE wallet_id = ? AND created_at BETWEEN ? AND ?
CREATE INDEX idx_transactions_wallet_created_at
    ON transactions(wallet_id, created_at DESC);

-- Optimizes: WHERE stand_id = ? AND category = ? AND status = 'ACTIVE'
CREATE INDEX idx_products_stand_category_active
    ON products(stand_id, category) WHERE status = 'ACTIVE';
```

### Partial Indexes
Reduce index size by only indexing relevant rows:
```sql
-- Only index pending transactions
CREATE INDEX idx_transactions_pending
    ON transactions(wallet_id, created_at DESC)
    WHERE status = 'PENDING';

-- Only index active wallets
CREATE INDEX idx_wallets_active
    ON wallets(user_id, festival_id)
    WHERE status = 'ACTIVE';

-- Recent data is queried most often
CREATE INDEX idx_orders_recent
    ON orders(festival_id, created_at DESC)
    WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Covering Indexes
Include additional columns to enable index-only scans:
```sql
-- No table lookup needed for balance queries
CREATE INDEX idx_wallets_user_festival_covering
    ON wallets(user_id, festival_id) INCLUDE (balance, status);

-- No table lookup needed for product price queries
CREATE INDEX idx_products_covering_price
    ON products(id) INCLUDE (name, price, status, stock);
```

### Full-Text Search Indexes
For searching text content:
```sql
-- Generated column with weighted search
ALTER TABLE products ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B')
    ) STORED;

CREATE INDEX idx_products_search_vector
    ON products USING GIN(search_vector);
```

### Fuzzy Search Indexes
For typo-tolerant search:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_products_name_trgm
    ON products USING GIN(name gin_trgm_ops);

-- Usage: SELECT * FROM products WHERE name % 'beer' ORDER BY similarity(name, 'beer') DESC;
```

## Index Maintenance

### Monitor Index Usage
```sql
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS scans,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### Find Unused Indexes
```sql
SELECT
    relname AS table_name,
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Rebuild Bloated Indexes
```sql
-- PostgreSQL 12+: Concurrent rebuild
REINDEX TABLE CONCURRENTLY transactions;

-- Or rebuild specific index
REINDEX INDEX CONCURRENTLY idx_transactions_wallet_created_at;
```

## Query-Specific Index Recommendations

### Transaction History
```sql
-- Query: Get user's transaction history
SELECT * FROM transactions
WHERE wallet_id = ?
ORDER BY created_at DESC
LIMIT 50;

-- Optimal index:
CREATE INDEX idx_transactions_wallet_created_at
    ON transactions(wallet_id, created_at DESC);
```

### Stand Sales Report
```sql
-- Query: Get stand sales for date range
SELECT * FROM transactions
WHERE stand_id = ?
AND created_at BETWEEN ? AND ?
ORDER BY created_at DESC;

-- Optimal index:
CREATE INDEX idx_transactions_stand_created_at
    ON transactions(stand_id, created_at DESC)
    WHERE stand_id IS NOT NULL;
```

### Product Menu Display
```sql
-- Query: Get active products for a stand
SELECT * FROM products
WHERE stand_id = ? AND status = 'ACTIVE'
ORDER BY sort_order;

-- Optimal index:
CREATE INDEX idx_products_stand_active
    ON products(stand_id, sort_order)
    WHERE status = 'ACTIVE';
```

### User Wallet Lookup
```sql
-- Query: Get user's wallet for a festival
SELECT * FROM wallets
WHERE user_id = ? AND festival_id = ?;

-- Optimal index (already covered by unique constraint):
-- wallets_user_festival_unique
```

### Ticket Validation
```sql
-- Query: Validate ticket code
SELECT * FROM tickets
WHERE code = ? AND status = 'VALID';

-- Optimal index:
CREATE INDEX idx_tickets_valid
    ON tickets(code)
    WHERE status = 'VALID';
```

## Statistics Configuration

### Increase Statistics for Filtered Columns
```sql
-- More accurate query planning for status columns
ALTER TABLE transactions ALTER COLUMN status SET STATISTICS 1000;
ALTER TABLE transactions ALTER COLUMN type SET STATISTICS 1000;
ALTER TABLE products ALTER COLUMN status SET STATISTICS 500;
ALTER TABLE products ALTER COLUMN category SET STATISTICS 500;
```

### Update Statistics After Data Load
```sql
ANALYZE VERBOSE transactions;
ANALYZE VERBOSE orders;
ANALYZE VERBOSE wallets;
```

## Performance Tips

### 1. Column Order in Composite Indexes
Place the most selective column first:
```sql
-- Good: festival_id is highly selective
CREATE INDEX idx ON orders(festival_id, status, created_at);

-- Less optimal: status has few distinct values
CREATE INDEX idx ON orders(status, festival_id, created_at);
```

### 2. Include vs Additional Columns
Use INCLUDE for columns only needed in SELECT:
```sql
-- Good: created_at only needed for output
CREATE INDEX idx ON wallets(user_id, festival_id) INCLUDE (balance, created_at);

-- Less optimal: adds created_at to index structure
CREATE INDEX idx ON wallets(user_id, festival_id, balance, created_at);
```

### 3. Partial Index Conditions
Match the WHERE clause exactly:
```sql
-- Index for: WHERE status = 'PENDING'
CREATE INDEX idx ON orders(...) WHERE status = 'PENDING';

-- Won't use index for: WHERE status IN ('PENDING', 'PROCESSING')
```

### 4. Index-Only Scans
Verify with EXPLAIN:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, balance FROM wallets WHERE user_id = ? AND festival_id = ?;

-- Look for: "Index Only Scan"
```

### 5. Avoid Over-Indexing
- Each index slows down INSERT/UPDATE/DELETE
- More indexes = more storage
- Review and remove unused indexes regularly

## Index Size Monitoring

```sql
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS index_size,
    ROUND(pg_indexes_size(relid)::numeric / NULLIF(pg_relation_size(relid), 0) * 100, 2) AS index_ratio
FROM pg_stat_user_tables
ORDER BY pg_indexes_size(relid) DESC;
```

## Migration Notes

When adding indexes to production:
1. Always use `CREATE INDEX CONCURRENTLY`
2. Test index impact in staging first
3. Monitor query performance before/after
4. Schedule during low-traffic periods
5. Have a rollback plan

```sql
-- Safe index creation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_new
    ON transactions(wallet_id, created_at DESC);

-- Verify index is valid
SELECT indexname, indisvalid
FROM pg_indexes
JOIN pg_class ON indexname = relname
WHERE tablename = 'transactions';
```
