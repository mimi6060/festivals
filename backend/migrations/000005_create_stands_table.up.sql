-- Create stands table
CREATE TABLE IF NOT EXISTS stands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(20) NOT NULL,
    location VARCHAR(255),
    image_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_stands_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE
);

-- Create indexes for stands
CREATE INDEX idx_stands_festival_id ON stands(festival_id);
CREATE INDEX idx_stands_category ON stands(category);
CREATE INDEX idx_stands_status ON stands(status);

-- Create stand_staff table
CREATE TABLE IF NOT EXISTS stand_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    pin_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_stand_staff_stand FOREIGN KEY (stand_id)
        REFERENCES stands(id) ON DELETE CASCADE,
    CONSTRAINT fk_stand_staff_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for stand_staff
CREATE INDEX idx_stand_staff_stand_id ON stand_staff(stand_id);
CREATE INDEX idx_stand_staff_user_id ON stand_staff(user_id);

-- Unique constraint: a user can only have one role per stand
ALTER TABLE stand_staff ADD CONSTRAINT stand_staff_stand_user_unique UNIQUE (stand_id, user_id);

-- Add the foreign key constraint to transactions table for stand_id
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_stand
    FOREIGN KEY (stand_id) REFERENCES stands(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON TABLE stands IS 'Stores point of sale stands at festivals';
COMMENT ON COLUMN stands.category IS 'Stand category: BAR, FOOD, MERCHANDISE, TICKETS, TOP_UP, OTHER';
COMMENT ON COLUMN stands.status IS 'Stand status: ACTIVE, INACTIVE, CLOSED';

COMMENT ON TABLE stand_staff IS 'Stores staff assignments to stands';
COMMENT ON COLUMN stand_staff.role IS 'Staff role: MANAGER, CASHIER, ASSISTANT';
COMMENT ON COLUMN stand_staff.pin_hash IS 'Hashed PIN for transaction authorization';
