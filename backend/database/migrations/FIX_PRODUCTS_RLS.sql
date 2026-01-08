-- =========================================
-- FIX PRODUCTS & CATEGORIES RLS FOR ADMIN ACCESS
-- =========================================
-- The current RLS policies require checking users.role = 'admin'
-- But this can fail due to circular references or timing issues
-- Solution: Disable RLS on products and categories for development

-- Disable RLS on products table
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;

-- Disable RLS on categories table (so dropdown works)
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- Disable RLS on inventory table
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;

-- Verify changes
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('products', 'categories', 'inventory');
