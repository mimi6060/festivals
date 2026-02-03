-- Create user_favorites table for storing artist favorites
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    festival_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Composite unique constraint to prevent duplicate favorites
    CONSTRAINT user_favorites_unique UNIQUE (user_id, artist_id, festival_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_festival
    ON user_favorites(user_id, festival_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_artist
    ON user_favorites(artist_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_festival
    ON user_favorites(festival_id);

-- Add comments for documentation
COMMENT ON TABLE user_favorites IS 'Stores user favorite artists for each festival';
COMMENT ON COLUMN user_favorites.user_id IS 'ID of the user who favorited the artist';
COMMENT ON COLUMN user_favorites.artist_id IS 'ID of the favorited artist';
COMMENT ON COLUMN user_favorites.festival_id IS 'ID of the festival context';
