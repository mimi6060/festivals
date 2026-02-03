-- Refunds table for tracking Stripe refunds
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
    stripe_refund_id VARCHAR(255) NOT NULL UNIQUE,
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'eur',
    status VARCHAR(50) DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for refunds
CREATE INDEX IF NOT EXISTS idx_refunds_payment_intent ON refunds(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_refunds_stripe_id ON refunds(stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created ON refunds(created_at DESC);
