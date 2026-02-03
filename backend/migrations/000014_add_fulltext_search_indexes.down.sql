-- Remove PostgreSQL full-text search indexes

-- Drop search ranking helper function
DROP FUNCTION IF EXISTS search_rank(tsvector, text);

-- Remove products search indexes and column
DROP INDEX IF EXISTS idx_products_name_trgm;
DROP INDEX IF EXISTS idx_products_search_vector;
ALTER TABLE products DROP COLUMN IF EXISTS search_vector;

-- Remove stands search indexes and column
DROP INDEX IF EXISTS idx_stands_name_trgm;
DROP INDEX IF EXISTS idx_stands_search_vector;
ALTER TABLE stands DROP COLUMN IF EXISTS search_vector;

-- Remove stages search indexes and column
DROP INDEX IF EXISTS idx_stages_name_trgm;
DROP INDEX IF EXISTS idx_stages_search_vector;
ALTER TABLE stages DROP COLUMN IF EXISTS search_vector;

-- Remove artists search indexes and column
DROP INDEX IF EXISTS idx_artists_name_trgm;
DROP INDEX IF EXISTS idx_artists_search_vector;
ALTER TABLE artists DROP COLUMN IF EXISTS search_vector;

-- Note: We don't drop the pg_trgm extension as it might be used elsewhere
