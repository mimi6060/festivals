-- Create map_configs table for storing festival map configuration
CREATE TABLE IF NOT EXISTS map_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id UUID NOT NULL UNIQUE,
    center_lat DECIMAL(10, 8) NOT NULL,
    center_lng DECIMAL(11, 8) NOT NULL,
    default_zoom DECIMAL(4, 2) DEFAULT 16,
    min_zoom DECIMAL(4, 2) DEFAULT 14,
    max_zoom DECIMAL(4, 2) DEFAULT 20,
    bounds_north_lat DECIMAL(10, 8),
    bounds_south_lat DECIMAL(10, 8),
    bounds_east_lng DECIMAL(11, 8),
    bounds_west_lng DECIMAL(11, 8),
    style_url VARCHAR(500) DEFAULT 'mapbox://styles/mapbox/streets-v12',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key to festivals
    CONSTRAINT fk_map_configs_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE
);

-- Create index on festival_id
CREATE INDEX idx_map_configs_festival_id ON map_configs(festival_id);

-- Create map_zones table for defining areas on the map
CREATE TABLE IF NOT EXISTS map_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    color VARCHAR(20) DEFAULT '#6366F1',
    fill_color VARCHAR(20) DEFAULT '#6366F180',
    fill_opacity DECIMAL(3, 2) DEFAULT 0.3,
    border_color VARCHAR(20) DEFAULT '#6366F1',
    border_width DECIMAL(3, 1) DEFAULT 2,
    coordinates JSONB NOT NULL DEFAULT '[]',
    center_lat DECIMAL(10, 8),
    center_lng DECIMAL(11, 8),
    capacity INTEGER,
    is_restricted BOOLEAN DEFAULT FALSE,
    requires_pass BOOLEAN DEFAULT FALSE,
    is_visible BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key to festivals
    CONSTRAINT fk_map_zones_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE
);

-- Create indexes for map_zones
CREATE INDEX idx_map_zones_festival_id ON map_zones(festival_id);
CREATE INDEX idx_map_zones_type ON map_zones(type);
CREATE INDEX idx_map_zones_is_visible ON map_zones(is_visible);
CREATE INDEX idx_map_zones_is_restricted ON map_zones(is_restricted);

-- Unique constraint: zone name must be unique within a festival
ALTER TABLE map_zones ADD CONSTRAINT map_zones_festival_name_unique UNIQUE (festival_id, name);

-- Create map_pois table for Points of Interest
CREATE TABLE IF NOT EXISTS map_pois (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    icon_url VARCHAR(500),
    image_url VARCHAR(500),
    color VARCHAR(20),
    stand_id UUID,
    stage_id UUID,
    zone_id UUID,
    opening_hours VARCHAR(100),
    capacity INTEGER,
    is_accessible BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_map_pois_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE,
    CONSTRAINT fk_map_pois_zone FOREIGN KEY (zone_id)
        REFERENCES map_zones(id) ON DELETE SET NULL
);

-- Create indexes for map_pois
CREATE INDEX idx_map_pois_festival_id ON map_pois(festival_id);
CREATE INDEX idx_map_pois_type ON map_pois(type);
CREATE INDEX idx_map_pois_status ON map_pois(status);
CREATE INDEX idx_map_pois_zone_id ON map_pois(zone_id);
CREATE INDEX idx_map_pois_stand_id ON map_pois(stand_id);
CREATE INDEX idx_map_pois_stage_id ON map_pois(stage_id);
CREATE INDEX idx_map_pois_is_accessible ON map_pois(is_accessible);
CREATE INDEX idx_map_pois_is_featured ON map_pois(is_featured);
CREATE INDEX idx_map_pois_location ON map_pois(latitude, longitude);

-- Composite indexes for common queries
CREATE INDEX idx_map_pois_festival_type ON map_pois(festival_id, type);
CREATE INDEX idx_map_pois_festival_status ON map_pois(festival_id, status);

-- Add comments for documentation
COMMENT ON TABLE map_configs IS 'Stores map configuration settings for each festival';
COMMENT ON COLUMN map_configs.settings IS 'Additional settings: showTraffic, show3dBuildings, customTileUrl, etc.';

COMMENT ON TABLE map_zones IS 'Stores geographic zones/areas on the festival map';
COMMENT ON COLUMN map_zones.type IS 'Zone type: GENERAL, VIP, CAMPING, PARKING, BACKSTAGE, RESTRICTED, FOOD, STAGE';
COMMENT ON COLUMN map_zones.coordinates IS 'Array of lat/lng coordinates defining the polygon boundary';
COMMENT ON COLUMN map_zones.metadata IS 'Additional zone data: accessRules, allowedTickets, features, etc.';

COMMENT ON TABLE map_pois IS 'Stores Points of Interest on the festival map';
COMMENT ON COLUMN map_pois.type IS 'POI type: STAGE, BAR, FOOD, TOILET, FIRST_AID, ENTRANCE, EXIT, CHARGING, CAMPING, VIP, INFO, ATM, PARKING, MERCH, SECURITY, WATER, SMOKING, LOCKERS, LOST_FOUND, ACCESSIBILITY, OTHER';
COMMENT ON COLUMN map_pois.status IS 'POI status: ACTIVE, INACTIVE, CLOSED, BUSY';
COMMENT ON COLUMN map_pois.metadata IS 'Additional POI data: phoneNumber, website, tags, amenities, waitTime, etc.';
