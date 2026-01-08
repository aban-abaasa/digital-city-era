-- =========================================
-- FIX CASHIER PRODUCT VISIBILITY
-- =========================================
-- Problem: Cashier sees "No products in inventory" even though Admin sees products
-- Root Cause: Products exist but don't have corresponding inventory records
-- Solution: Ensure every active product has an inventory record

-- =========================================
-- 1. CHECK FOR ORPHANED PRODUCTS (no inventory record)
-- =========================================
SELECT 
  p.id,
  p.sku,
  p.name,
  p.is_active,
  p.created_at,
  i.id as inventory_id,
  CASE 
    WHEN i.id IS NULL THEN '❌ MISSING - No inventory record'
    ELSE '✓ OK - Has inventory record'
  END as status
FROM public.products p
LEFT JOIN public.inventory i ON p.id = i.product_id
WHERE p.is_active = TRUE
ORDER BY p.created_at DESC;

-- =========================================
-- 2. CREATE INVENTORY RECORDS FOR PRODUCTS WITHOUT THEM
-- =========================================
-- This will create inventory records for all active products that are missing them
INSERT INTO public.inventory (product_id, current_stock, reserved_stock, minimum_stock, reorder_point, reorder_quantity)
SELECT 
  p.id,
  0 as current_stock,  -- Start with 0 stock (admin can update)
  0 as reserved_stock,
  10 as minimum_stock,
  20 as reorder_point,
  100 as reorder_quantity
FROM public.products p
WHERE p.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory i WHERE i.product_id = p.id
  );

-- Verify the fix
SELECT COUNT(*) as products_with_inventory
FROM public.products p
INNER JOIN public.inventory i ON p.id = i.product_id
WHERE p.is_active = TRUE;

SELECT COUNT(*) as products_without_inventory
FROM public.products p
LEFT JOIN public.inventory i ON p.id = i.product_id
WHERE p.is_active = TRUE
  AND i.id IS NULL;

-- =========================================
-- 3. IF YOU WANT TO SHOW ALL ACTIVE PRODUCTS IN CASHIER (even with 0 stock)
-- =========================================
-- OPTIONAL: Update Cashier Portal to show products with 0 stock
-- Change line in cashier portal.jsx from:
--   .filter(p => p.inventory && p.inventory.length > 0)
-- To:
--   .filter(p => p.inventory !== null) // Show all, even 0 stock
-- This allows admins to add stock AFTER creating the product

-- =========================================
-- 4. VERIFY ALL PRODUCTS ARE NOW VISIBLE TO CASHIER
-- =========================================
-- This is what Cashier portal queries:
SELECT 
  p.id,
  p.sku,
  p.name,
  p.is_active,
  i.current_stock,
  CASE 
    WHEN i.current_stock > 0 THEN '✓ In Stock'
    WHEN i.current_stock = 0 THEN '⚠️ Out of Stock'
    ELSE '❓ Unknown'
  END as stock_status
FROM public.products p
LEFT JOIN public.inventory i ON p.id = i.product_id
WHERE p.is_active = TRUE
ORDER BY p.name;
