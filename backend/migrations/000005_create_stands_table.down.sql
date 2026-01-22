-- Remove the foreign key constraint from transactions table
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_transactions_stand;

-- Drop stand_staff indexes and table
DROP INDEX IF EXISTS idx_stand_staff_user_id;
DROP INDEX IF EXISTS idx_stand_staff_stand_id;
ALTER TABLE stand_staff DROP CONSTRAINT IF EXISTS stand_staff_stand_user_unique;
DROP TABLE IF EXISTS stand_staff;

-- Drop stands indexes and table
DROP INDEX IF EXISTS idx_stands_status;
DROP INDEX IF EXISTS idx_stands_category;
DROP INDEX IF EXISTS idx_stands_festival_id;
DROP TABLE IF EXISTS stands;
