-- Create transactions table
-- Note: stand_id FK constraint is added in migration 000005 after stands table is created
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount BIGINT NOT NULL,
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    reference VARCHAR(255),
    stand_id UUID,
    staff_id UUID,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_transactions_wallet FOREIGN KEY (wallet_id)
        REFERENCES wallets(id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_staff FOREIGN KEY (staff_id)
        REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_stand_id ON transactions(stand_id);
CREATE INDEX idx_transactions_staff_id ON transactions(staff_id);
CREATE INDEX idx_transactions_reference ON transactions(reference);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Composite index for wallet transaction history queries
CREATE INDEX idx_transactions_wallet_created ON transactions(wallet_id, created_at DESC);

-- Add comments
COMMENT ON TABLE transactions IS 'Stores all wallet transactions';
COMMENT ON COLUMN transactions.amount IS 'Amount in cents (positive for credit, negative for debit)';
COMMENT ON COLUMN transactions.type IS 'Transaction type: TOP_UP, CASH_IN, PURCHASE, REFUND, TRANSFER, CASH_OUT';
COMMENT ON COLUMN transactions.status IS 'Transaction status: PENDING, COMPLETED, FAILED, REFUNDED';
