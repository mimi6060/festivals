-- +migrate Up

-- Inventory items table - tracks stock levels for products at stands
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 10,
    max_capacity INTEGER,
    last_restock_at TIMESTAMP WITH TIME ZONE,
    last_count_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_inventory_product_stand UNIQUE (product_id, stand_id)
);

CREATE INDEX idx_inventory_items_stand ON inventory_items(stand_id);
CREATE INDEX idx_inventory_items_festival ON inventory_items(festival_id);
CREATE INDEX idx_inventory_items_low_stock ON inventory_items(festival_id, quantity, min_threshold);

-- Stock movements table - tracks all stock changes
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'LOSS', 'RETURN')),
    quantity INTEGER NOT NULL,
    previous_qty INTEGER NOT NULL,
    new_qty INTEGER NOT NULL,
    reason TEXT,
    reference VARCHAR(255),
    performed_by UUID NOT NULL,
    performed_by_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_item ON stock_movements(inventory_item_id);
CREATE INDEX idx_stock_movements_stand ON stock_movements(stand_id);
CREATE INDEX idx_stock_movements_festival ON stock_movements(festival_id);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);

-- Stock alerts table - tracks low stock and out of stock alerts
CREATE TABLE IF NOT EXISTS stock_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('LOW_STOCK', 'OUT_OF_STOCK', 'OVER_STOCK')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
    current_qty INTEGER NOT NULL,
    threshold_qty INTEGER NOT NULL,
    message TEXT NOT NULL,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_alerts_item ON stock_alerts(inventory_item_id);
CREATE INDEX idx_stock_alerts_festival ON stock_alerts(festival_id);
CREATE INDEX idx_stock_alerts_stand ON stock_alerts(stand_id);
CREATE INDEX idx_stock_alerts_status ON stock_alerts(status);
CREATE INDEX idx_stock_alerts_active ON stock_alerts(festival_id, status) WHERE status = 'ACTIVE';

-- Inventory counts table - periodic inventory counts
CREATE TABLE IF NOT EXISTS inventory_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    started_by UUID,
    completed_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_counts_stand ON inventory_counts(stand_id);
CREATE INDEX idx_inventory_counts_festival ON inventory_counts(festival_id);
CREATE INDEX idx_inventory_counts_status ON inventory_counts(status);

-- Inventory count items table - individual items in a count
CREATE TABLE IF NOT EXISTS inventory_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_id UUID NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    expected_qty INTEGER NOT NULL,
    counted_qty INTEGER,
    variance INTEGER,
    notes TEXT,
    counted_at TIMESTAMP WITH TIME ZONE,
    counted_by UUID,
    reconciliation_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_count_items_count ON inventory_count_items(count_id);
CREATE INDEX idx_inventory_count_items_item ON inventory_count_items(inventory_item_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_updated_at();

CREATE TRIGGER trigger_stock_alerts_updated_at
    BEFORE UPDATE ON stock_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_updated_at();

CREATE TRIGGER trigger_inventory_counts_updated_at
    BEFORE UPDATE ON inventory_counts
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_updated_at();

CREATE TRIGGER trigger_inventory_count_items_updated_at
    BEFORE UPDATE ON inventory_count_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_updated_at();

-- +migrate Down

DROP TRIGGER IF EXISTS trigger_inventory_count_items_updated_at ON inventory_count_items;
DROP TRIGGER IF EXISTS trigger_inventory_counts_updated_at ON inventory_counts;
DROP TRIGGER IF EXISTS trigger_stock_alerts_updated_at ON stock_alerts;
DROP TRIGGER IF EXISTS trigger_inventory_items_updated_at ON inventory_items;
DROP FUNCTION IF EXISTS update_inventory_updated_at();

DROP TABLE IF EXISTS inventory_count_items;
DROP TABLE IF EXISTS inventory_counts;
DROP TABLE IF EXISTS stock_alerts;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS inventory_items;
