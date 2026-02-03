-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    festival_id UUID NOT NULL,
    balance BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_wallets_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_wallets_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE
);

-- Add unique constraint on user_id and festival_id
ALTER TABLE wallets ADD CONSTRAINT wallets_user_festival_unique UNIQUE (user_id, festival_id);

-- Create indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_festival_id ON wallets(festival_id);
CREATE INDEX idx_wallets_status ON wallets(status);

-- Add comments
COMMENT ON TABLE wallets IS 'Stores user wallets for festival token balances';
COMMENT ON COLUMN wallets.balance IS 'Balance in cents (smallest currency unit)';
COMMENT ON COLUMN wallets.status IS 'Wallet status: ACTIVE, FROZEN, CLOSED';
