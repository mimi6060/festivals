-- Add PostgreSQL full-text search indexes for global search functionality

-- ============================================
-- Artists full-text search index
-- ============================================
-- Create a generated tsvector column for artists
ALTER TABLE artists ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(genre, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(bio, '')), 'C')
    ) STORED;

-- Create GIN index for fast full-text search on artists
CREATE INDEX IF NOT EXISTS idx_artists_search_vector ON artists USING GIN(search_vector);

-- Create trigram index for fuzzy matching on artist names
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm ON artists USING GIN(name gin_trgm_ops);

-- ============================================
-- Stages full-text search index
-- ============================================
-- Create a generated tsvector column for stages
ALTER TABLE stages ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(location, '')), 'C')
    ) STORED;

-- Create GIN index for fast full-text search on stages
CREATE INDEX IF NOT EXISTS idx_stages_search_vector ON stages USING GIN(search_vector);

-- Create trigram index for fuzzy matching on stage names
CREATE INDEX IF NOT EXISTS idx_stages_name_trgm ON stages USING GIN(name gin_trgm_ops);

-- ============================================
-- Stands full-text search index
-- ============================================
-- Create a generated tsvector column for stands
ALTER TABLE stands ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(location, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(category, '')), 'D')
    ) STORED;

-- Create GIN index for fast full-text search on stands
CREATE INDEX IF NOT EXISTS idx_stands_search_vector ON stands USING GIN(search_vector);

-- Create trigram index for fuzzy matching on stand names
CREATE INDEX IF NOT EXISTS idx_stands_name_trgm ON stands USING GIN(name gin_trgm_ops);

-- ============================================
-- Products full-text search index
-- ============================================
-- Create a generated tsvector column for products
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(category, '')), 'C')
    ) STORED;

-- Create GIN index for fast full-text search on products
CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING GIN(search_vector);

-- Create trigram index for fuzzy matching on product names
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);

-- ============================================
-- Helper function for search ranking
-- ============================================
CREATE OR REPLACE FUNCTION search_rank(search_vector tsvector, query text)
RETURNS float AS $$
BEGIN
    RETURN ts_rank(search_vector, plainto_tsquery('english', query));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON COLUMN artists.search_vector IS 'Full-text search vector for artist name, genre, and bio';
COMMENT ON COLUMN stages.search_vector IS 'Full-text search vector for stage name, description, and location';
COMMENT ON COLUMN stands.search_vector IS 'Full-text search vector for stand name, description, location, and category';
COMMENT ON COLUMN products.search_vector IS 'Full-text search vector for product name, description, and category';

COMMENT ON FUNCTION search_rank(tsvector, text) IS 'Helper function to calculate search relevance ranking';
