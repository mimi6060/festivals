-- Artist Portal Migration Rollback
-- Drops all tables created for the artist portal functionality

-- Drop triggers first
DROP TRIGGER IF EXISTS update_artist_documents_updated_at ON artist_documents;
DROP TRIGGER IF EXISTS update_artist_invitations_updated_at ON artist_invitations;
DROP TRIGGER IF EXISTS update_artist_availabilities_updated_at ON artist_availabilities;
DROP TRIGGER IF EXISTS update_tech_riders_updated_at ON tech_riders;
DROP TRIGGER IF EXISTS update_artist_profiles_updated_at ON artist_profiles;

-- Drop tables in reverse order (respecting foreign key constraints)
DROP TABLE IF EXISTS artist_documents;
DROP TABLE IF EXISTS artist_invitations;
DROP TABLE IF EXISTS artist_availabilities;
DROP TABLE IF EXISTS tech_riders;
DROP TABLE IF EXISTS artist_profiles;

-- Remove user_id column from artists table if it was added
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'artists' AND column_name = 'user_id') THEN
        DROP INDEX IF EXISTS idx_artists_user_id;
        ALTER TABLE artists DROP COLUMN IF EXISTS user_id;
    END IF;
END $$;
