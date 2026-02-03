-- Create security_alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id UUID NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'OTHER',
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location JSONB DEFAULT '{}',
    contact_phone VARCHAR(50),
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolution TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for security_alerts
CREATE INDEX idx_security_alerts_festival_id ON security_alerts(festival_id);
CREATE INDEX idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX idx_security_alerts_status ON security_alerts(status);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX idx_security_alerts_type ON security_alerts(type);
CREATE INDEX idx_security_alerts_assigned_to ON security_alerts(assigned_to);
CREATE INDEX idx_security_alerts_created_at ON security_alerts(created_at DESC);
CREATE INDEX idx_security_alerts_active ON security_alerts(festival_id, status) WHERE status IN ('PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS');

-- Create security_zones table
CREATE TABLE IF NOT EXISTS security_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id UUID NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    coordinates JSONB DEFAULT '[]',
    capacity INTEGER,
    alert_level VARCHAR(20) DEFAULT 'LOW',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for security_zones
CREATE INDEX idx_security_zones_festival_id ON security_zones(festival_id);
CREATE INDEX idx_security_zones_type ON security_zones(type);
CREATE INDEX idx_security_zones_active ON security_zones(festival_id) WHERE is_active = TRUE;

-- Add comment for documentation
COMMENT ON TABLE security_alerts IS 'Security alerts including SOS requests and incident reports';
COMMENT ON TABLE security_zones IS 'Defined security zones within a festival area';

COMMENT ON COLUMN security_alerts.type IS 'Alert type: SOS, MEDICAL, FIRE, THEFT, VIOLENCE, LOST_CHILD, SUSPICIOUS, CROWD_CONTROL, OTHER';
COMMENT ON COLUMN security_alerts.severity IS 'Alert severity: LOW, MEDIUM, HIGH, CRITICAL';
COMMENT ON COLUMN security_alerts.status IS 'Alert status: PENDING, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CANCELLED';
COMMENT ON COLUMN security_alerts.location IS 'JSON object with latitude, longitude, accuracy, zone, and description';
COMMENT ON COLUMN security_zones.type IS 'Zone type: GENERAL, VIP, STAGE, CAMPING, PARKING, ENTRANCE, MEDICAL, RESTRICTED';
COMMENT ON COLUMN security_zones.coordinates IS 'Array of coordinate points defining the zone boundary';
