-- ============================================================================
-- VERIFY MANAGER & ADMIN SUPERMARKET_ID LINKAGE
-- ============================================================================
-- This script checks that all managers and admins have supermarket_id set
-- and that inventory is properly linked to supermarkets
-- ============================================================================

-- ============================================================================
-- 1. CHECK ALL ADMINS HAVE SUPERMARKET_ID
-- ============================================================================
SELECT 
  'ADMINS WITHOUT SUPERMARKET_ID' AS check_type,
  COUNT(*) AS count
FROM public.users
WHERE role = 'admin' AND supermarket_id IS NULL;

-- ============================================================================
-- 2. CHECK ALL MANAGERS HAVE SUPERMARKET_ID
-- ============================================================================
SELECT 
  'MANAGERS WITHOUT SUPERMARKET_ID' AS check_type,
  COUNT(*) AS count
FROM public.users
WHERE role = 'manager' AND supermarket_id IS NULL;

-- ============================================================================
-- 3. LIST ALL ADMINS WITH THEIR SUPERMARKETS
-- ============================================================================
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.supermarket_id,
  s.name AS supermarket_name
FROM public.users u
LEFT JOIN public.supermarkets s ON s.id = u.supermarket_id
WHERE u.role = 'admin'
ORDER BY u.created_at DESC
LIMIT 10;

-- ============================================================================
-- 4. LIST ALL MANAGERS WITH THEIR SUPERMARKETS
-- ============================================================================
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.supermarket_id,
  s.name AS supermarket_name
FROM public.users u
LEFT JOIN public.supermarkets s ON s.id = u.supermarket_id
WHERE u.role = 'manager'
ORDER BY u.created_at DESC
LIMIT 10;

-- ============================================================================
-- 5. CHECK INVENTORY HAS SUPERMARKET_ID COLUMN
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'inventory'
  AND column_name IN ('supermarket_id', 'product_id', 'current_stock');

-- ============================================================================
-- 6. CHECK INVENTORY RECORDS PER SUPERMARKET
-- ============================================================================
SELECT 
  s.name AS supermarket_name,
  s.id AS supermarket_id,
  COUNT(DISTINCT i.product_id) AS unique_products,
  SUM(i.current_stock) AS total_stock
FROM public.supermarkets s
LEFT JOIN public.inventory i ON i.supermarket_id = s.id
GROUP BY s.id, s.name
ORDER BY total_stock DESC NULLS LAST
LIMIT 10;

-- ============================================================================
-- 7. CHECK FOR INVENTORY WITHOUT SUPERMARKET_ID
-- ============================================================================
SELECT 
  'INVENTORY WITHOUT SUPERMARKET_ID' AS check_type,
  COUNT(*) AS count
FROM public.inventory
WHERE supermarket_id IS NULL;

-- ============================================================================
-- 8. SAMPLE PRODUCT QUERY (LIKE OrderItemsSelector DOES)
-- ============================================================================
-- This simulates what the frontend query does
SELECT 
  p.id,
  p.name,
  p.sku,
  p.selling_price,
  p.cost_price,
  p.supermarket_id AS product_supermarket_id,
  i.current_stock,
  i.supermarket_id AS inventory_supermarket_id
FROM public.products p
INNER JOIN public.inventory i ON i.product_id = p.id
WHERE p.is_active = TRUE
  AND p.supermarket_id = (
    SELECT supermarket_id 
    FROM public.users 
    WHERE role IN ('admin', 'manager') 
    LIMIT 1
  )
  AND i.supermarket_id = p.supermarket_id
ORDER BY p.name
LIMIT 10;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- 1. ADMINS WITHOUT SUPERMARKET_ID: Should be 0
-- 2. MANAGERS WITHOUT SUPERMARKET_ID: Should be 0
-- 3. All admins should have supermarket_name populated
-- 4. All managers should have supermarket_name populated
-- 5. inventory table should have supermarket_id column
-- 6. Each supermarket should have inventory records
-- 7. INVENTORY WITHOUT SUPERMARKET_ID: Should be 0
-- 8. Should return products with matching inventory
-- ============================================================================
