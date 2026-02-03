-- ============================================
-- Database Index Optimization Migration
-- Purpose: Add composite, partial, and covering indexes for query optimization
-- ============================================

-- Enable pg_stat_statements for query analysis (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================
-- TRANSACTIONS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for wallet transaction history with date filtering
-- Supports: SELECT * FROM transactions WHERE wallet_id = ? AND created_at BETWEEN ? AND ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_wallet_created_at
    ON transactions(wallet_id, created_at DESC);

-- Composite index for stand sales reporting
-- Supports: SELECT * FROM transactions WHERE stand_id = ? AND created_at BETWEEN ? AND ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_stand_created_at
    ON transactions(stand_id, created_at DESC)
    WHERE stand_id IS NOT NULL;

-- Composite index for festival-wide transaction queries with status filtering
-- Supports: SELECT * FROM transactions t JOIN wallets w ON t.wallet_id = w.id WHERE w.festival_id = ? AND t.status = ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_status_created_at
    ON transactions(status, created_at DESC);

-- Partial index for pending transactions (commonly queried for processing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_pending
    ON transactions(wallet_id, created_at DESC)
    WHERE status = 'PENDING';

-- Partial index for completed transactions (for reporting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_completed_recent
    ON transactions(created_at DESC)
    WHERE status = 'COMPLETED' AND created_at > NOW() - INTERVAL '7 days';

-- Covering index for transaction summaries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_covering_summary
    ON transactions(wallet_id, type, status) INCLUDE (amount, created_at);

-- ============================================
-- WALLETS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for user-festival wallet lookup (most common query)
-- Already exists as unique constraint, but add covering index for balance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_user_festival_covering
    ON wallets(user_id, festival_id) INCLUDE (balance, status);

-- Index for QR code lookups (add if qr_code column exists)
-- Supports fast wallet lookup by QR code scanning
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'wallets' AND column_name = 'qr_code') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_qr_code
            ON wallets(qr_code) WHERE qr_code IS NOT NULL;
    END IF;
END $$;

-- Partial index for active wallets only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_active
    ON wallets(user_id, festival_id)
    WHERE status = 'ACTIVE';

-- Index for festival wallet statistics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_festival_status
    ON wallets(festival_id, status) INCLUDE (balance);

-- ============================================
-- PRODUCTS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for active products by stand (menu display)
-- Supports: SELECT * FROM products WHERE stand_id = ? AND status = 'ACTIVE' ORDER BY sort_order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_stand_active
    ON products(stand_id, sort_order ASC)
    WHERE status = 'ACTIVE';

-- Composite index for category filtering
-- Supports: SELECT * FROM products WHERE stand_id = ? AND category = ? AND status = 'ACTIVE'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_stand_category_active
    ON products(stand_id, category)
    WHERE status = 'ACTIVE';

-- Covering index for product price lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_covering_price
    ON products(id) INCLUDE (name, price, status, stock);

-- Partial index for out-of-stock products (inventory alerts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_out_of_stock
    ON products(stand_id)
    WHERE status = 'OUT_OF_STOCK' OR (stock IS NOT NULL AND stock <= 0);

-- Partial index for low stock products (inventory alerts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_low_stock
    ON products(stand_id, stock)
    WHERE stock IS NOT NULL AND stock > 0 AND stock <= 10;

-- ============================================
-- ORDERS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for user order history with date filtering
-- Supports: SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_created
    ON orders(user_id, created_at DESC);

-- Composite index for festival-status queries (dashboard)
-- Supports: SELECT * FROM orders WHERE festival_id = ? AND status = ?
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_festival_status_created
    ON orders(festival_id, status, created_at DESC);

-- Covering index for order summaries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_covering_summary
    ON orders(stand_id, status) INCLUDE (total_amount, created_at);

-- Partial index for pending orders (requires attention)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_pending
    ON orders(festival_id, stand_id, created_at)
    WHERE status = 'PENDING';

-- Partial index for recent orders (most queried)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_recent
    ON orders(festival_id, created_at DESC)
    WHERE created_at > NOW() - INTERVAL '24 hours';

-- ============================================
-- TICKETS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for user ticket list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_user_status
    ON tickets(user_id, status) INCLUDE (code, holder_name);

-- Composite index for festival check-in queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_festival_checkin
    ON tickets(festival_id, status, checked_in_at)
    WHERE status IN ('VALID', 'USED');

-- Partial index for valid tickets only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_valid
    ON tickets(festival_id, code)
    WHERE status = 'VALID';

-- Index for email lookup (ticket transfer)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_holder_email_lower
    ON tickets(lower(holder_email))
    WHERE holder_email IS NOT NULL;

-- ============================================
-- STANDS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for active stands by festival
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stands_festival_active
    ON stands(festival_id, category)
    WHERE status = 'ACTIVE';

-- Covering index for stand listings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stands_covering_list
    ON stands(festival_id, status) INCLUDE (name, category, location);

-- ============================================
-- USERS TABLE OPTIMIZATIONS
-- ============================================

-- Index for email lookup (case-insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower
    ON users(lower(email));

-- Partial index for active users
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active
    ON users(role, created_at DESC)
    WHERE status = 'ACTIVE';

-- ============================================
-- FESTIVALS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for active festivals by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_festivals_active_dates
    ON festivals(start_date, end_date)
    WHERE status IN ('PUBLISHED', 'ACTIVE');

-- Partial index for upcoming festivals
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_festivals_upcoming
    ON festivals(start_date ASC)
    WHERE status = 'PUBLISHED' AND start_date > NOW();

-- ============================================
-- AUDIT LOGS OPTIMIZATIONS (if not already optimized)
-- ============================================

-- Composite index for user activity queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_user_resource_time
    ON audit_logs(user_id, resource, timestamp DESC)
    WHERE user_id IS NOT NULL;

-- BRIN index for time-series data (efficient for large tables)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp_brin
    ON audit_logs USING BRIN(timestamp) WITH (pages_per_range = 128);

-- ============================================
-- TICKET SCANS OPTIMIZATIONS
-- ============================================

-- BRIN index for time-series scan data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_scans_timestamp_brin
    ON ticket_scans USING BRIN(scanned_at) WITH (pages_per_range = 128);

-- Composite index for scan statistics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_scans_festival_result
    ON ticket_scans(festival_id, result, scanned_at DESC);

-- ============================================
-- LINEUP TABLES OPTIMIZATIONS
-- ============================================

-- Composite index for schedule queries (if performances table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'performances') THEN
        EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performances_schedule
            ON performances(festival_id, stage_id, start_time)';
        EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performances_artist_festival
            ON performances(artist_id, festival_id)';
    END IF;
END $$;

-- ============================================
-- STAND STAFF OPTIMIZATIONS
-- ============================================

-- Covering index for staff assignments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stand_staff_covering
    ON stand_staff(user_id) INCLUDE (stand_id, role);

-- ============================================
-- FOREIGN KEY INDEXES
-- Ensure all foreign keys have indexes (PostgreSQL doesn't create them automatically)
-- ============================================

-- These should already exist but ensuring they're present
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fk_transactions_staff
    ON transactions(staff_id) WHERE staff_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fk_orders_staff
    ON orders(staff_id) WHERE staff_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fk_tickets_checked_by
    ON tickets(checked_in_by) WHERE checked_in_by IS NOT NULL;

-- ============================================
-- STATISTICS TARGETS
-- Increase statistics targets for frequently filtered columns
-- ============================================

ALTER TABLE transactions ALTER COLUMN status SET STATISTICS 1000;
ALTER TABLE transactions ALTER COLUMN type SET STATISTICS 1000;
ALTER TABLE wallets ALTER COLUMN status SET STATISTICS 500;
ALTER TABLE products ALTER COLUMN status SET STATISTICS 500;
ALTER TABLE products ALTER COLUMN category SET STATISTICS 500;
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 500;
ALTER TABLE tickets ALTER COLUMN status SET STATISTICS 500;
ALTER TABLE festivals ALTER COLUMN status SET STATISTICS 200;
ALTER TABLE users ALTER COLUMN status SET STATISTICS 200;
ALTER TABLE users ALTER COLUMN role SET STATISTICS 200;

-- ============================================
-- ANALYZE UPDATED TABLES
-- ============================================

ANALYZE transactions;
ANALYZE wallets;
ANALYZE products;
ANALYZE orders;
ANALYZE tickets;
ANALYZE stands;
ANALYZE users;
ANALYZE festivals;
ANALYZE audit_logs;
ANALYZE ticket_scans;

-- ============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON INDEX idx_transactions_wallet_created_at IS 'Optimizes wallet transaction history queries with date filtering';
COMMENT ON INDEX idx_transactions_stand_created_at IS 'Optimizes stand sales reporting queries';
COMMENT ON INDEX idx_products_stand_active IS 'Optimizes product menu display for active products';
COMMENT ON INDEX idx_orders_user_created IS 'Optimizes user order history pagination';
COMMENT ON INDEX idx_tickets_valid IS 'Optimizes ticket validation during check-in';
COMMENT ON INDEX idx_wallets_active IS 'Optimizes active wallet lookups';
