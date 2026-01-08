-- =========================================
-- CHECK FOR MULTIPLE PRODUCT/INVENTORY TABLES
-- =========================================
-- Verify Cashier and Admin are using the SAME tables

-- 1. List all tables that contain 'product' in the name
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%product%'
ORDER BY tablename;

-- 2. List all tables that contain 'inventory' in the name
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%inventory%'
ORDER BY tablename;

-- 3. Check products table row count
SELECT COUNT(*) as total_products,
       SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_products
FROM public.products;

-- 4. Check inventory table row count
SELECT COUNT(*) as total_inventory_records
FROM public.inventory;

-- 5. CHECK IF BOOKS PRODUCT HAS INVENTORY IN BOTH TABLES
-- Get the Books product ID
SELECT id, sku, name, is_active
FROM public.products
WHERE name = 'Books' OR sku LIKE '%TL%'
LIMIT 1;

-- 6. CHECK INVENTORY FOR BOOKS (using the product ID from above)
-- Replace 'PRODUCT_ID_HERE' with actual ID
SELECT i.id, i.product_id, i.current_stock, i.reserved_stock, i.minimum_stock
FROM public.inventory i
WHERE i.product_id = '8bae34f9-d062-43f9-b697-dffd1765360d'; -- Books product ID

-- 7. VERIFY THE JOIN WORKS
SELECT 
  p.id,
  p.sku,
  p.name,
  p.selling_price,
  i.current_stock,
  i.reserved_stock,
  i.id as inventory_id
FROM public.products p
LEFT JOIN public.inventory i ON p.id = i.product_id
WHERE p.name = 'Books'
LIMIT 1;

-- 8. CHECK IF THERE'S A PRODUCTS_INVENTORY TABLE (different from products table)
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%product%' OR table_name LIKE '%inventory%')
ORDER BY table_name;
