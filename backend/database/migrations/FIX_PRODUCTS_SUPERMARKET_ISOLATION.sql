-- ================================================================
-- FIX PRODUCTS SUPERMARKET ISOLATION
-- ================================================================
-- This migration ensures products are properly isolated by supermarket
-- so managers only see products from their own store
-- ================================================================

-- Step 1: Add supermarket_id column to products table if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'supermarket_id'
    ) THEN
        ALTER TABLE public.products 
        ADD COLUMN supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ supermarket_id column added to products table';
    ELSE
        RAISE NOTICE '✓ supermarket_id column already exists';
    END IF;
END $$;

-- Step 2: Add foreign key constraint if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_products_supermarket'
        AND table_name = 'products'
    ) THEN
        ALTER TABLE public.products
        ADD CONSTRAINT fk_products_supermarket 
        FOREIGN KEY (supermarket_id) REFERENCES public.supermarkets(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Foreign key constraint added';
    END IF;
END $$;

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_supermarket_id 
    ON public.products(supermarket_id);

-- Step 4: Backfill supermarket_id for existing products
-- Strategy: Associate products with the supermarket that has inventory of them
DO $$
DECLARE
    v_updated_count INTEGER := 0;
BEGIN
    -- If products_inventory table exists and has supermarket_id
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'products_inventory'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products_inventory' 
        AND column_name = 'supermarket_id'
    ) THEN
        -- Update products based on inventory records
        UPDATE public.products p
        SET supermarket_id = (
            SELECT pi.supermarket_id 
            FROM public.products_inventory pi 
            WHERE pi.product_id = p.id 
            LIMIT 1
        )
        WHERE p.supermarket_id IS NULL
        AND EXISTS (
            SELECT 1 FROM public.products_inventory pi2 
            WHERE pi2.product_id = p.id
        );
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        RAISE NOTICE '✅ Backfilled supermarket_id for % products from inventory', v_updated_count;
    END IF;
    
    -- If still NULL, try to associate with the first available supermarket
    IF EXISTS (SELECT 1 FROM public.products WHERE supermarket_id IS NULL) THEN
        UPDATE public.products
        SET supermarket_id = (SELECT id FROM public.supermarkets LIMIT 1)
        WHERE supermarket_id IS NULL;
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        RAISE NOTICE '⚠️  Assigned % orphaned products to first supermarket', v_updated_count;
    END IF;
END $$;

-- Step 5: Update users table to ensure supermarket_id exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'supermarket_id'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ supermarket_id column added to users table';
    ELSE
        RAISE NOTICE '✓ supermarket_id column already exists in users table';
    END IF;
END $$;

-- Step 6: Create index for users.supermarket_id
CREATE INDEX IF NOT EXISTS idx_users_supermarket_id 
    ON public.users(supermarket_id);

-- Step 7: Verify the fix
DO $$
DECLARE
    v_total_products INTEGER;
    v_assigned_products INTEGER;
    v_orphaned_products INTEGER;
    v_total_supermarkets INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_products FROM public.products;
    SELECT COUNT(*) INTO v_assigned_products FROM public.products WHERE supermarket_id IS NOT NULL;
    SELECT COUNT(*) INTO v_orphaned_products FROM public.products WHERE supermarket_id IS NULL;
    SELECT COUNT(*) INTO v_total_supermarkets FROM public.supermarkets;
    
    RAISE NOTICE '================================================================';
    RAISE NOTICE '✅ PRODUCTS SUPERMARKET ISOLATION FIX COMPLETE';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Total Products:      %', v_total_products;
    RAISE NOTICE 'Assigned Products:   %', v_assigned_products;
    RAISE NOTICE 'Orphaned Products:   %', v_orphaned_products;
    RAISE NOTICE 'Total Supermarkets:  %', v_total_supermarkets;
    RAISE NOTICE '================================================================';
    
    IF v_orphaned_products > 0 THEN
        RAISE WARNING '⚠️  % products still without supermarket_id - manual assignment may be needed', v_orphaned_products;
    END IF;
END $$;

-- Step 8: Create helper function to get manager's supermarket products
CREATE OR REPLACE FUNCTION get_manager_products(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    sku VARCHAR,
    barcode VARCHAR,
    selling_price DECIMAL,
    cost_price DECIMAL,
    category_id UUID,
    supermarket_id UUID,
    current_stock INTEGER,
    is_active BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_supermarket_id UUID;
BEGIN
    -- Get user's supermarket_id
    SELECT u.supermarket_id INTO v_supermarket_id
    FROM public.users u
    WHERE u.id = p_user_id;
    
    IF v_supermarket_id IS NULL THEN
        RAISE WARNING 'User % has no supermarket_id assigned', p_user_id;
        RETURN;
    END IF;
    
    -- Return products for this supermarket only
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.selling_price,
        p.cost_price,
        p.category_id,
        p.supermarket_id,
        COALESCE(
            (SELECT SUM(pi.quantity) 
             FROM public.products_inventory pi 
             WHERE pi.product_id = p.id AND pi.supermarket_id = v_supermarket_id),
            0
        )::INTEGER AS current_stock,
        p.is_active
    FROM public.products p
    WHERE p.supermarket_id = v_supermarket_id
      AND p.is_active = true
    ORDER BY p.name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_manager_products(UUID) TO authenticated;

-- Step 9: Create RLS policies for products table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
DROP POLICY IF EXISTS "products_delete_policy" ON public.products;

-- Policy: Users can only see products from their supermarket
CREATE POLICY "products_select_policy" ON public.products
    FOR SELECT
    USING (
        supermarket_id IN (
            SELECT u.supermarket_id 
            FROM public.users u 
            WHERE u.auth_id = auth.uid()
        )
    );

-- Policy: Users can insert products for their supermarket
CREATE POLICY "products_insert_policy" ON public.products
    FOR INSERT
    WITH CHECK (
        supermarket_id IN (
            SELECT u.supermarket_id 
            FROM public.users u 
            WHERE u.auth_id = auth.uid()
        )
    );

-- Policy: Users can update products from their supermarket
CREATE POLICY "products_update_policy" ON public.products
    FOR UPDATE
    USING (
        supermarket_id IN (
            SELECT u.supermarket_id 
            FROM public.users u 
            WHERE u.auth_id = auth.uid()
        )
    );

-- Policy: Users can delete products from their supermarket
CREATE POLICY "products_delete_policy" ON public.products
    FOR DELETE
    USING (
        supermarket_id IN (
            SELECT u.supermarket_id 
            FROM public.users u 
            WHERE u.auth_id = auth.uid()
        )
    );

-- Step 10: Verification query
SELECT '================================================================' as "Status";
SELECT '✅ MIGRATION COMPLETE - VERIFY RESULTS BELOW' as "Status";
SELECT '================================================================' as "Status";

-- Show products per supermarket
SELECT 
    s.name as supermarket_name,
    COUNT(p.id) as product_count,
    COUNT(DISTINCT p.category_id) as categories_count
FROM public.supermarkets s
LEFT JOIN public.products p ON p.supermarket_id = s.id
GROUP BY s.id, s.name
ORDER BY product_count DESC;

SELECT '================================================================' as "Status";
SELECT '✅ Products are now isolated by supermarket!' as "Status";
SELECT '================================================================' as "Status";
