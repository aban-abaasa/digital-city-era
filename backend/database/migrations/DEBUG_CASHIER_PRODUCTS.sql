-- =========================================
-- DEBUG CASHIER PRODUCT VISIBILITY ISSUE
-- =========================================
-- Problem: Books product exists with 3720 stock but Cashier can't see it
-- Investigation: Check product + inventory join

-- =========================================
-- 1. CHECK IF PRODUCT EXISTS AND IS ACTIVE
-- =========================================
SELECT id, sku, name, is_active, created_at
FROM public.products
WHERE sku = 'TL372' OR name ILIKE '%Books%'
LIMIT 10;

-- =========================================
-- 2. CHECK IF INVENTORY RECORD EXISTS FOR THIS PRODUCT
-- =========================================
SELECT i.id, i.product_id, i.current_stock, i.reserved_stock, p.name, p.sku
FROM public.inventory i
LEFT JOIN public.products p ON i.product_id = p.id
WHERE p.sku = 'TL372' OR p.name ILIKE '%Books%'
LIMIT 10;

-- =========================================
-- 3. VERIFY RLS IS DISABLED (so joins work)
-- =========================================
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('products', 'inventory');

-- =========================================
-- 4. CHECK WHAT CASHIER QUERY SHOULD RETURN
-- =========================================
-- This is exactly what Cashier portal queries:
SELECT 
  p.id,
  p.sku,
  p.name,
  p.is_active,
  p.selling_price,
  p.category,
  i.current_stock,
  i.id as inventory_id
FROM public.products p
LEFT JOIN public.inventory i ON p.id = i.product_id
WHERE p.is_active = TRUE
ORDER BY p.name;

-- =========================================
-- 5. CHECK IF PRODUCT IS MARKED AS SERVICE (might be excluded)
-- =========================================
SELECT id, sku, name, is_active, is_service, track_inventory
FROM public.products
WHERE sku = 'TL372' OR name ILIKE '%Books%'
LIMIT 10;

-- =========================================
-- NOTES
-- =========================================
-- If this returns the Books product with inventory data, then:
-- 1. The database is fine
-- 2. The issue is with the Supabase join in the frontend query
-- 3. OR there's an authentication/RLS issue on the frontend query
-- 
-- Solution: May need to update the frontend query to use explicit join syntax
-- Or check if the Supabase client is properly authenticated as a cashier user
