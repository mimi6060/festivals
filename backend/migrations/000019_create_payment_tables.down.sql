-- Drop triggers first
DROP TRIGGER IF EXISTS update_payment_intents_updated_at ON payment_intents;
DROP TRIGGER IF EXISTS update_stripe_accounts_updated_at ON stripe_accounts;
DROP TRIGGER IF EXISTS update_stripe_customers_updated_at ON stripe_customers;

-- Drop indexes
DROP INDEX IF EXISTS idx_payment_intents_festival;
DROP INDEX IF EXISTS idx_payment_intents_user;
DROP INDEX IF EXISTS idx_payment_intents_wallet;
DROP INDEX IF EXISTS idx_payment_intents_status;
DROP INDEX IF EXISTS idx_payment_intents_created;
DROP INDEX IF EXISTS idx_payment_intents_stripe_id;
DROP INDEX IF EXISTS idx_stripe_accounts_festival;
DROP INDEX IF EXISTS idx_stripe_accounts_stripe_id;
DROP INDEX IF EXISTS idx_transfers_festival;
DROP INDEX IF EXISTS idx_transfers_stripe_account;
DROP INDEX IF EXISTS idx_transfers_status;
DROP INDEX IF EXISTS idx_transfers_created;
DROP INDEX IF EXISTS idx_stripe_customers_user;
DROP INDEX IF EXISTS idx_stripe_customers_stripe_id;

-- Drop tables
DROP TABLE IF EXISTS stripe_customers;
DROP TABLE IF EXISTS transfers;
DROP TABLE IF EXISTS stripe_accounts;
DROP TABLE IF EXISTS payment_intents;

-- Remove stripe_account_id from festivals
ALTER TABLE festivals DROP COLUMN IF EXISTS stripe_account_id;
