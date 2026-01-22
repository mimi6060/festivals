-- Drop indexes
DROP INDEX IF EXISTS idx_transactions_wallet_created;
DROP INDEX IF EXISTS idx_transactions_status;
DROP INDEX IF EXISTS idx_transactions_reference;
DROP INDEX IF EXISTS idx_transactions_staff_id;
DROP INDEX IF EXISTS idx_transactions_stand_id;
DROP INDEX IF EXISTS idx_transactions_type;
DROP INDEX IF EXISTS idx_transactions_created_at;
DROP INDEX IF EXISTS idx_transactions_wallet_id;

-- Drop transactions table
DROP TABLE IF EXISTS transactions;
