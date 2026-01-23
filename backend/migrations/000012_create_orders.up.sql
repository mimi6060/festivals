-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id UUID NOT NULL,
    user_id UUID NOT NULL,
    wallet_id UUID NOT NULL,
    stand_id UUID NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    total_amount BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    payment_method VARCHAR(20) NOT NULL,
    transaction_id UUID,
    staff_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_orders_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_wallet FOREIGN KEY (wallet_id)
        REFERENCES wallets(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_stand FOREIGN KEY (stand_id)
        REFERENCES stands(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_transaction FOREIGN KEY (transaction_id)
        REFERENCES transactions(id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_staff FOREIGN KEY (staff_id)
        REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for orders
CREATE INDEX idx_orders_festival_id ON orders(festival_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_wallet_id ON orders(wallet_id);
CREATE INDEX idx_orders_stand_id ON orders(stand_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_method ON orders(payment_method);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_transaction_id ON orders(transaction_id);
CREATE INDEX idx_orders_staff_id ON orders(staff_id);

-- Composite indexes for common queries
CREATE INDEX idx_orders_user_festival ON orders(user_id, festival_id);
CREATE INDEX idx_orders_stand_created ON orders(stand_id, created_at DESC);
CREATE INDEX idx_orders_festival_created ON orders(festival_id, created_at DESC);
CREATE INDEX idx_orders_stand_status ON orders(stand_id, status);

-- Add comments
COMMENT ON TABLE orders IS 'Stores purchase orders at festival stands';
COMMENT ON COLUMN orders.items IS 'JSONB array of order items with productId, productName, quantity, unitPrice, totalPrice';
COMMENT ON COLUMN orders.total_amount IS 'Total order amount in cents';
COMMENT ON COLUMN orders.status IS 'Order status: PENDING, PAID, CANCELLED, REFUNDED';
COMMENT ON COLUMN orders.payment_method IS 'Payment method: wallet, cash, card';
COMMENT ON COLUMN orders.transaction_id IS 'Reference to wallet transaction if payment_method is wallet';
COMMENT ON COLUMN orders.staff_id IS 'Staff member who processed the order';
