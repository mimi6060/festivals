-- Artist Portal Migration
-- Creates tables for the artist portal functionality

-- Artist Profiles table
CREATE TABLE IF NOT EXISTS artist_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    stage_name VARCHAR(255),
    bio TEXT,
    short_bio VARCHAR(500),
    genre VARCHAR(100),
    sub_genres JSONB DEFAULT '[]',
    country VARCHAR(100),
    city VARCHAR(100),
    profile_image_url TEXT,
    cover_image_url TEXT,
    photos JSONB DEFAULT '[]',
    social_links JSONB DEFAULT '{}',
    contact_info JSONB DEFAULT '{}',
    music_links JSONB DEFAULT '{}',
    is_verified BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_artist_profiles_user_id ON artist_profiles(user_id);
-- Index for public profile searches
CREATE INDEX IF NOT EXISTS idx_artist_profiles_public ON artist_profiles(is_public) WHERE is_public = true;
-- Index for genre filtering
CREATE INDEX IF NOT EXISTS idx_artist_profiles_genre ON artist_profiles(genre);
-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_artist_profiles_search ON artist_profiles USING gin(to_tsvector('english', name || ' ' || COALESCE(stage_name, '') || ' ' || COALESCE(genre, '')));

-- Tech Riders table
CREATE TABLE IF NOT EXISTS tech_riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_profile_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    setup_time INTEGER DEFAULT 0, -- minutes
    soundcheck_time INTEGER DEFAULT 0, -- minutes
    teardown_time INTEGER DEFAULT 0, -- minutes
    sound_requirements JSONB DEFAULT '{}',
    light_requirements JSONB DEFAULT '{}',
    backline_requirements JSONB DEFAULT '{}',
    stage_requirements JSONB DEFAULT '{}',
    hospitality_requirements JSONB DEFAULT '{}',
    additional_notes TEXT,
    document_urls JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for artist lookup
CREATE INDEX IF NOT EXISTS idx_tech_riders_artist_profile_id ON tech_riders(artist_profile_id);
-- Index for default rider lookup
CREATE INDEX IF NOT EXISTS idx_tech_riders_default ON tech_riders(artist_profile_id, is_default) WHERE is_default = true;

-- Artist Availabilities table
CREATE TABLE IF NOT EXISTS artist_availabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_profile_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'AVAILABLE',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT check_availability_dates CHECK (end_date >= start_date)
);

-- Index for artist and date range queries
CREATE INDEX IF NOT EXISTS idx_artist_availabilities_artist_profile_id ON artist_availabilities(artist_profile_id);
CREATE INDEX IF NOT EXISTS idx_artist_availabilities_dates ON artist_availabilities(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_artist_availabilities_status ON artist_availabilities(status);

-- Artist Invitations table
CREATE TABLE IF NOT EXISTS artist_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_profile_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
    festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
    sent_by_user_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    proposed_fee DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'EUR',
    proposed_date TIMESTAMP WITH TIME ZONE,
    proposed_stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
    set_duration INTEGER, -- minutes
    message TEXT,
    artist_response TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    contract_url TEXT,
    contract_status VARCHAR(50) DEFAULT 'NONE',
    contract_signed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for artist invitations lookup
CREATE INDEX IF NOT EXISTS idx_artist_invitations_artist_profile_id ON artist_invitations(artist_profile_id);
-- Index for festival invitations lookup
CREATE INDEX IF NOT EXISTS idx_artist_invitations_festival_id ON artist_invitations(festival_id);
-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_artist_invitations_status ON artist_invitations(status);
-- Composite index for checking existing invitations
CREATE INDEX IF NOT EXISTS idx_artist_invitations_artist_festival ON artist_invitations(artist_profile_id, festival_id, status);

-- Artist Documents table
CREATE TABLE IF NOT EXISTS artist_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_profile_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    mime_type VARCHAR(100),
    size BIGINT DEFAULT 0,
    is_public BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for artist documents lookup
CREATE INDEX IF NOT EXISTS idx_artist_documents_artist_profile_id ON artist_documents(artist_profile_id);
-- Index for document type filtering
CREATE INDEX IF NOT EXISTS idx_artist_documents_type ON artist_documents(type);

-- Add user_id column to existing artists table if not exists (for linking)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'artists' AND column_name = 'user_id') THEN
        ALTER TABLE artists ADD COLUMN user_id UUID;
        CREATE INDEX IF NOT EXISTS idx_artists_user_id ON artists(user_id);
    END IF;
END $$;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_artist_profiles_updated_at ON artist_profiles;
CREATE TRIGGER update_artist_profiles_updated_at
    BEFORE UPDATE ON artist_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tech_riders_updated_at ON tech_riders;
CREATE TRIGGER update_tech_riders_updated_at
    BEFORE UPDATE ON tech_riders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_artist_availabilities_updated_at ON artist_availabilities;
CREATE TRIGGER update_artist_availabilities_updated_at
    BEFORE UPDATE ON artist_availabilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_artist_invitations_updated_at ON artist_invitations;
CREATE TRIGGER update_artist_invitations_updated_at
    BEFORE UPDATE ON artist_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_artist_documents_updated_at ON artist_documents;
CREATE TRIGGER update_artist_documents_updated_at
    BEFORE UPDATE ON artist_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE artist_profiles IS 'Extended artist profiles for the artist portal';
COMMENT ON TABLE tech_riders IS 'Technical requirements and specifications for artist performances';
COMMENT ON TABLE artist_availabilities IS 'Artist availability calendar for booking';
COMMENT ON TABLE artist_invitations IS 'Invitations sent from festivals to artists';
COMMENT ON TABLE artist_documents IS 'Documents uploaded by or for artists (contracts, riders, etc.)';
