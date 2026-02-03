-- Create pricing_rules table for happy hour and dynamic pricing support
CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    discount_value BIGINT NOT NULL CHECK (discount_value > 0),
    start_time VARCHAR(5) NOT NULL, -- HH:MM format
    end_time VARCHAR(5) NOT NULL,   -- HH:MM format
    days_of_week INTEGER[] NOT NULL DEFAULT '{}', -- 0=Sunday, 1=Monday, ..., 6=Saturday
    priority INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint to validate time format (basic check)
    CONSTRAINT valid_start_time CHECK (start_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT valid_end_time CHECK (end_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),

    -- Constraint to validate percentage discount is between 1 and 100
    CONSTRAINT valid_percentage CHECK (
        discount_type != 'PERCENTAGE' OR (discount_value >= 1 AND discount_value <= 100)
    )
);

-- Create indexes for efficient queries
CREATE INDEX idx_pricing_rules_stand_id ON pricing_rules(stand_id);
CREATE INDEX idx_pricing_rules_product_id ON pricing_rules(product_id);
CREATE INDEX idx_pricing_rules_active ON pricing_rules(active);
CREATE INDEX idx_pricing_rules_stand_active ON pricing_rules(stand_id, active);

-- Add comment
COMMENT ON TABLE pricing_rules IS 'Dynamic pricing rules including happy hour discounts';
COMMENT ON COLUMN pricing_rules.discount_type IS 'Type of discount: PERCENTAGE or FIXED_AMOUNT';
COMMENT ON COLUMN pricing_rules.discount_value IS 'Discount value: percentage (1-100) or fixed amount in cents';
COMMENT ON COLUMN pricing_rules.start_time IS 'Start time in HH:MM format (24-hour)';
COMMENT ON COLUMN pricing_rules.end_time IS 'End time in HH:MM format (24-hour)';
COMMENT ON COLUMN pricing_rules.days_of_week IS 'Array of days when rule applies: 0=Sunday through 6=Saturday';
COMMENT ON COLUMN pricing_rules.priority IS 'Higher priority rules are applied first when multiple rules match';
