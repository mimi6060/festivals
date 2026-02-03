-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    category VARCHAR(20) NOT NULL,
    image_url VARCHAR(500),
    sku VARCHAR(100),
    stock INTEGER,
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_products_stand FOREIGN KEY (stand_id)
        REFERENCES stands(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_products_stand_id ON products(stand_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_sort_order ON products(sort_order);

-- Composite index for stand product listings
CREATE INDEX idx_products_stand_category ON products(stand_id, category);
CREATE INDEX idx_products_stand_sort ON products(stand_id, sort_order);

-- Add comments
COMMENT ON TABLE products IS 'Stores products sold at festival stands';
COMMENT ON COLUMN products.price IS 'Price in cents (smallest currency unit)';
COMMENT ON COLUMN products.category IS 'Product category: BEER, COCKTAIL, SOFT, FOOD, SNACK, MERCH, OTHER';
COMMENT ON COLUMN products.status IS 'Product status: ACTIVE, INACTIVE, OUT_OF_STOCK';
COMMENT ON COLUMN products.stock IS 'Stock count, NULL means unlimited';
