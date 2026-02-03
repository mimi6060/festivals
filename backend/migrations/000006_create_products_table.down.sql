-- Drop indexes
DROP INDEX IF EXISTS idx_products_stand_sort;
DROP INDEX IF EXISTS idx_products_stand_category;
DROP INDEX IF EXISTS idx_products_sort_order;
DROP INDEX IF EXISTS idx_products_status;
DROP INDEX IF EXISTS idx_products_sku;
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_stand_id;

-- Drop products table
DROP TABLE IF EXISTS products;
