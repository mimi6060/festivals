-- Drop indexes
DROP INDEX IF EXISTS idx_users_status;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_auth0_id;
DROP INDEX IF EXISTS idx_users_email;

-- Drop constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth0_id_unique;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;

-- Drop users table
DROP TABLE IF EXISTS users;
