-- Payment Intent table for tracking Stripe payments
CREATE TABLE IF NOT EXISTS payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_intent_id VARCHAR(255) NOT NULL UNIQUE,
    festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    amount BIGINT NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) DEFAULT 'eur',
    platform_fee BIGINT DEFAULT 0 CHECK (platform_fee >= 0),
    status VARCHAR(50) DEFAULT 'PENDING',
    client_secret VARCHAR(255),
    customer_email VARCHAR(255),
    failure_reason TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stripe Connect accounts for festivals
CREATE TABLE IF NOT EXISTS stripe_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id UUID NOT NULL UNIQUE REFERENCES festivals(id) ON DELETE CASCADE,
    stripe_account_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255),
    country VARCHAR(2) DEFAULT 'BE',
    charges_enabled BOOLEAN DEFAULT FALSE,
    payouts_enabled BOOLEAN DEFAULT FALSE,
    details_submitted BOOLEAN DEFAULT FALSE,
    onboarding_status VARCHAR(50) DEFAULT 'PENDING',
    disabled_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transfers to connected accounts
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_transfer_id VARCHAR(255) NOT NULL UNIQUE,
    festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
    stripe_account_id VARCHAR(255) NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'eur',
    description TEXT,
    source_transaction_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stripe Customers (optional, for storing customer IDs)
CREATE TABLE IF NOT EXISTS stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Indexes for payment_intents
CREATE INDEX IF NOT EXISTS idx_payment_intents_festival ON payment_intents(festival_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_wallet ON payment_intents(wallet_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_created ON payment_intents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_id ON payment_intents(stripe_intent_id);

-- Indexes for stripe_accounts
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_festival ON stripe_accounts(festival_id);
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_stripe_id ON stripe_accounts(stripe_account_id);

-- Indexes for transfers
CREATE INDEX IF NOT EXISTS idx_transfers_festival ON transfers(festival_id);
CREATE INDEX IF NOT EXISTS idx_transfers_stripe_account ON transfers(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_created ON transfers(created_at DESC);

-- Indexes for stripe_customers
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user ON stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to payment tables
DROP TRIGGER IF EXISTS update_payment_intents_updated_at ON payment_intents;
CREATE TRIGGER update_payment_intents_updated_at
    BEFORE UPDATE ON payment_intents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stripe_accounts_updated_at ON stripe_accounts;
CREATE TRIGGER update_stripe_accounts_updated_at
    BEFORE UPDATE ON stripe_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stripe_customers_updated_at ON stripe_customers;
CREATE TRIGGER update_stripe_customers_updated_at
    BEFORE UPDATE ON stripe_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add stripe_account_id to festivals table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'festivals' AND column_name = 'stripe_account_id'
    ) THEN
        ALTER TABLE festivals ADD COLUMN stripe_account_id VARCHAR(255);
    END IF;
END $$;
