-- Drop indexes
DROP INDEX IF EXISTS idx_refunds_payment_intent;
DROP INDEX IF EXISTS idx_refunds_stripe_id;
DROP INDEX IF EXISTS idx_refunds_status;
DROP INDEX IF EXISTS idx_refunds_created;

-- Drop table
DROP TABLE IF EXISTS refunds;
