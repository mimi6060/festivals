-- Drop indexes
DROP INDEX IF EXISTS idx_festivals_created_by;
DROP INDEX IF EXISTS idx_festivals_start_date;
DROP INDEX IF EXISTS idx_festivals_status;
DROP INDEX IF EXISTS idx_festivals_slug;

-- Drop constraint
ALTER TABLE festivals DROP CONSTRAINT IF EXISTS festivals_slug_unique;

-- Drop festivals table
DROP TABLE IF EXISTS festivals;
