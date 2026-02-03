-- Drop indexes
DROP INDEX IF EXISTS idx_wallets_status;
DROP INDEX IF EXISTS idx_wallets_festival_id;
DROP INDEX IF EXISTS idx_wallets_user_id;

-- Drop constraint
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_festival_unique;

-- Drop wallets table
DROP TABLE IF EXISTS wallets;
