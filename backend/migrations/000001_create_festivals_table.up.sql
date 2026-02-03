-- Create festivals table
CREATE TABLE IF NOT EXISTS festivals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'Europe/Brussels',
    currency_name VARCHAR(50) DEFAULT 'Jetons',
    exchange_rate DECIMAL(10, 4) DEFAULT 0.10,
    stripe_account_id VARCHAR(255),
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'DRAFT',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint on slug
ALTER TABLE festivals ADD CONSTRAINT festivals_slug_unique UNIQUE (slug);

-- Create indexes
CREATE INDEX idx_festivals_slug ON festivals(slug);
CREATE INDEX idx_festivals_status ON festivals(status);
CREATE INDEX idx_festivals_start_date ON festivals(start_date);
CREATE INDEX idx_festivals_created_by ON festivals(created_by);

-- Add comment
COMMENT ON TABLE festivals IS 'Stores festival information and configuration';
