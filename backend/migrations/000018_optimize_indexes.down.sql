-- ============================================
-- Rollback Database Index Optimization Migration
-- ============================================

-- Drop transaction indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_wallet_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_stand_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_status_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_pending;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_completed_recent;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_covering_summary;

-- Drop wallet indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_wallets_user_festival_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_wallets_qr_code;
DROP INDEX CONCURRENTLY IF EXISTS idx_wallets_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_wallets_festival_status;

-- Drop product indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_products_stand_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_products_stand_category_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_products_covering_price;
DROP INDEX CONCURRENTLY IF EXISTS idx_products_out_of_stock;
DROP INDEX CONCURRENTLY IF EXISTS idx_products_low_stock;

-- Drop order indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_user_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_festival_status_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_covering_summary;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_pending;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_recent;

-- Drop ticket indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_user_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_festival_checkin;
DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_valid;
DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_holder_email_lower;

-- Drop stand indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_stands_festival_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_stands_covering_list;

-- Drop user indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email_lower;
DROP INDEX CONCURRENTLY IF EXISTS idx_users_active;

-- Drop festival indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_festivals_active_dates;
DROP INDEX CONCURRENTLY IF EXISTS idx_festivals_upcoming;

-- Drop audit log indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_user_resource_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_timestamp_brin;

-- Drop ticket scan indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_ticket_scans_timestamp_brin;
DROP INDEX CONCURRENTLY IF EXISTS idx_ticket_scans_festival_result;

-- Drop performance indexes (if exists)
DROP INDEX CONCURRENTLY IF EXISTS idx_performances_schedule;
DROP INDEX CONCURRENTLY IF EXISTS idx_performances_artist_festival;

-- Drop stand staff indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_stand_staff_covering;

-- Drop foreign key indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_fk_transactions_staff;
DROP INDEX CONCURRENTLY IF EXISTS idx_fk_orders_staff;
DROP INDEX CONCURRENTLY IF EXISTS idx_fk_tickets_checked_by;

-- Reset statistics targets to default
ALTER TABLE transactions ALTER COLUMN status SET STATISTICS -1;
ALTER TABLE transactions ALTER COLUMN type SET STATISTICS -1;
ALTER TABLE wallets ALTER COLUMN status SET STATISTICS -1;
ALTER TABLE products ALTER COLUMN status SET STATISTICS -1;
ALTER TABLE products ALTER COLUMN category SET STATISTICS -1;
ALTER TABLE orders ALTER COLUMN status SET STATISTICS -1;
ALTER TABLE tickets ALTER COLUMN status SET STATISTICS -1;
ALTER TABLE festivals ALTER COLUMN status SET STATISTICS -1;
ALTER TABLE users ALTER COLUMN status SET STATISTICS -1;
ALTER TABLE users ALTER COLUMN role SET STATISTICS -1;

-- Re-analyze tables
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
