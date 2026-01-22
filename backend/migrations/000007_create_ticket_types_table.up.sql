-- Create ticket_types table
CREATE TABLE IF NOT EXISTS ticket_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    quantity INTEGER,
    quantity_sold INTEGER DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    benefits TEXT[],
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_ticket_types_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_ticket_types_festival_id ON ticket_types(festival_id);
CREATE INDEX idx_ticket_types_status ON ticket_types(status);
CREATE INDEX idx_ticket_types_valid_from ON ticket_types(valid_from);
CREATE INDEX idx_ticket_types_valid_until ON ticket_types(valid_until);

-- Add comments
COMMENT ON TABLE ticket_types IS 'Stores ticket type definitions for festivals';
COMMENT ON COLUMN ticket_types.price IS 'Price in cents (smallest currency unit)';
COMMENT ON COLUMN ticket_types.quantity IS 'Total quantity available, NULL means unlimited';
COMMENT ON COLUMN ticket_types.quantity_sold IS 'Number of tickets sold';
COMMENT ON COLUMN ticket_types.status IS 'Ticket type status: ACTIVE, INACTIVE, SOLD_OUT';
COMMENT ON COLUMN ticket_types.settings IS 'JSON settings: allowReentry, includesTopUp, topUpAmount, requiresId, transferAllowed, maxTransfers, color, accessZones';
