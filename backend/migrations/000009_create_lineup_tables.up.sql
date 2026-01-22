-- Create artists table
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    bio TEXT,
    genre VARCHAR(100),
    country VARCHAR(100),
    image_url VARCHAR(500),
    website_url VARCHAR(500),
    spotify_url VARCHAR(500),
    instagram_url VARCHAR(500),
    twitter_url VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint on slug
ALTER TABLE artists ADD CONSTRAINT artists_slug_unique UNIQUE (slug);

-- Create indexes for artists
CREATE INDEX idx_artists_slug ON artists(slug);
CREATE INDEX idx_artists_name ON artists(name);
CREATE INDEX idx_artists_genre ON artists(genre);
CREATE INDEX idx_artists_country ON artists(country);

-- Create stages table
CREATE TABLE IF NOT EXISTS stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capacity INTEGER,
    location VARCHAR(255),
    image_url VARCHAR(500),
    settings JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_stages_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE
);

-- Create indexes for stages
CREATE INDEX idx_stages_festival_id ON stages(festival_id);
CREATE INDEX idx_stages_status ON stages(status);

-- Unique constraint: stage name must be unique within a festival
ALTER TABLE stages ADD CONSTRAINT stages_festival_name_unique UNIQUE (festival_id, name);

-- Create performances table
CREATE TABLE IF NOT EXISTS performances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id UUID NOT NULL,
    stage_id UUID NOT NULL,
    artist_id UUID NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    title VARCHAR(255),
    description TEXT,
    is_headliner BOOLEAN DEFAULT FALSE,
    is_secret BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_performances_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE,
    CONSTRAINT fk_performances_stage FOREIGN KEY (stage_id)
        REFERENCES stages(id) ON DELETE CASCADE,
    CONSTRAINT fk_performances_artist FOREIGN KEY (artist_id)
        REFERENCES artists(id) ON DELETE CASCADE
);

-- Create indexes for performances
CREATE INDEX idx_performances_festival_id ON performances(festival_id);
CREATE INDEX idx_performances_stage_id ON performances(stage_id);
CREATE INDEX idx_performances_artist_id ON performances(artist_id);
CREATE INDEX idx_performances_start_time ON performances(start_time);
CREATE INDEX idx_performances_end_time ON performances(end_time);
CREATE INDEX idx_performances_status ON performances(status);
CREATE INDEX idx_performances_is_headliner ON performances(is_headliner);

-- Composite indexes for schedule queries
CREATE INDEX idx_performances_festival_time ON performances(festival_id, start_time);
CREATE INDEX idx_performances_stage_time ON performances(stage_id, start_time);
CREATE INDEX idx_performances_festival_stage_time ON performances(festival_id, stage_id, start_time);

-- Add comments
COMMENT ON TABLE artists IS 'Stores artist information for festival lineups';
COMMENT ON COLUMN artists.metadata IS 'Additional artist data: social links, tags, etc.';

COMMENT ON TABLE stages IS 'Stores stage definitions for festivals';
COMMENT ON COLUMN stages.settings IS 'Stage settings: color, icon, features, etc.';
COMMENT ON COLUMN stages.status IS 'Stage status: ACTIVE, INACTIVE';

COMMENT ON TABLE performances IS 'Stores scheduled performances linking artists to stages';
COMMENT ON COLUMN performances.title IS 'Optional custom title for the performance';
COMMENT ON COLUMN performances.status IS 'Performance status: SCHEDULED, LIVE, COMPLETED, CANCELLED';
COMMENT ON COLUMN performances.is_headliner IS 'Whether this is a headlining performance';
COMMENT ON COLUMN performances.is_secret IS 'Whether the artist is hidden until revealed';
