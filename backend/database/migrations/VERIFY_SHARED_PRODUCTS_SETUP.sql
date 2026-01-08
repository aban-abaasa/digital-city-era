-- =========================================
-- VERIFY SHARED PRODUCTS SETUP FOR ALL PORTALS
-- =========================================
-- This script verifies that Admin, Manager, and Cashier portals
-- can all access and modify the same Product table in Supabase
-- without any frontend changes needed.

-- =========================================
-- 1. VERIFY RLS IS DISABLED ON CRITICAL TABLES
-- =========================================
-- RLS disabled = all authenticated users have full access
SELECT 
  tablename, 
  rowsecurity,
  CASE 
    WHEN rowsecurity = FALSE THEN '✓ SHARED ACCESS - All roles can read/write'
    WHEN rowsecurity = TRUE THEN '✗ RESTRICTED - RLS Enabled, check policies'
  END AS status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('products', 'categories', 'inventory', 'order_items')
ORDER BY tablename;

-- =========================================
-- 2. VERIFY PRODUCTS TABLE STRUCTURE
-- =========================================
-- Check that products table has all necessary columns for POS operations
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
ORDER BY ordinal_position;

-- =========================================
-- 3. VERIFY USER ROLES EXIST
-- =========================================
-- Verify admin, manager, and cashier roles are properly set up
SELECT DISTINCT role, COUNT(*) as user_count
FROM public.users
WHERE role IN ('admin', 'manager', 'cashier', 'supplier')
GROUP BY role
ORDER BY role;

-- =========================================
-- 4. SAMPLE PRODUCT ACCESS TEST
-- =========================================
-- This shows how each role can access products
-- (Run after connecting with each portal's auth token)

-- For ADMIN: Should see all products
SELECT id, sku, name, selling_price, is_active
FROM public.products
LIMIT 5;

-- For MANAGER: Should see all products (same table, RLS disabled)
SELECT id, sku, name, selling_price, is_active
FROM public.products
LIMIT 5;

-- For CASHIER: Should see all active products (same table, RLS disabled)
SELECT id, sku, name, selling_price, is_active
FROM public.products
WHERE is_active = TRUE
LIMIT 5;

-- =========================================
-- 5. VERIFY INVENTORY ACCESS
-- =========================================
-- All roles need to see current stock for POS operations
SELECT 
  p.id,
  p.sku,
  p.name,
  i.current_stock,
  i.reserved_stock,
  (i.current_stock - i.reserved_stock) as available_stock
FROM public.products p
LEFT JOIN public.inventory i ON p.id = i.product_id
WHERE p.is_active = TRUE
LIMIT 10;

-- =========================================
-- 6. VERIFY CATEGORIES FOR FILTERING
-- =========================================
-- Categories used by all portals for product filtering
SELECT id, name, description, is_active
FROM public.categories
ORDER BY name;

-- =========================================
-- SETUP CHECKLIST FOR SHARED PRODUCTS
-- =========================================
/*
✓ Step 1: RLS is DISABLED on products table
  - All authenticated users (admin, manager, cashier) can read/write products
  
✓ Step 2: RLS is DISABLED on inventory table
  - All authenticated users can view and update stock levels
  
✓ Step 3: RLS is DISABLED on categories table
  - All authenticated users can read categories for filtering
  
✓ Step 4: RLS is DISABLED on order_items table
  - All authenticated users can create order items with products
  
✓ Step 5: User roles are properly set in users table
  - Verify each user has correct role: 'admin', 'manager', or 'cashier'
  
✓ Step 6: No frontend changes needed
  - Database enforces no restrictions
  - Each portal's frontend can query products normally
  - All three portals access the SAME products table

RESULT: All three portals share the same Product data in Supabase!
*/

-- =========================================
-- ENSURE ALL AUTHENTICATED USERS CAN ACCESS PRODUCTS
-- =========================================
-- If you need to restore access, run these:

-- Ensure RLS is disabled on products
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;

-- Ensure RLS is disabled on inventory
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;

-- Ensure RLS is disabled on categories
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- Ensure RLS is disabled on order_items
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;

-- Verify all are disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('products', 'categories', 'inventory', 'order_items');
