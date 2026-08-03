-- ============================================================================
-- FIX ADMINS WITH NULL SUPERMARKET_ID
-- ============================================================================
-- This script ensures ALL admins and managers have a supermarket_id set
-- Without it, they can bypass supermarket filtering and see ALL stores' data
-- ============================================================================

-- ============================================================================
-- 1. CHECK FOR ADMINS WITHOUT SUPERMARKET_ID
-- ============================================================================
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM public.users
  WHERE role = 'admin' AND supermarket_id IS NULL;
  
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Found % admins without supermarket_id', admin_count;
  RAISE NOTICE '================================================';
END $$;

-- ============================================================================
-- 2. CHECK FOR MANAGERS WITHOUT SUPERMARKET_ID
-- ============================================================================
DO $$
DECLARE
  manager_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO manager_count
  FROM public.users
  WHERE role = 'manager' AND supermarket_id IS NULL;
  
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Found % managers without supermarket_id', manager_count;
  RAISE NOTICE '================================================';
END $$;

-- ============================================================================
-- 3. LIST AFFECTED USERS (FOR REVIEW)
-- ============================================================================
SELECT 
  id,
  email,
  full_name,
  role,
  supermarket_id,
  created_at
FROM public.users
WHERE role IN ('admin', 'manager')
  AND supermarket_id IS NULL
ORDER BY role, created_at;

-- ============================================================================
-- 4. CREATE SUPERMARKETS FOR ADMINS WITHOUT ONE
-- ============================================================================
-- This creates a dedicated supermarket for each admin that doesn't have one
DO $$
DECLARE
  admin_rec RECORD;
  new_supermarket_id UUID;
  supermarket_name TEXT;
BEGIN
  FOR admin_rec IN 
    SELECT id, email, full_name, auth_id
    FROM public.users
    WHERE role = 'admin' AND supermarket_id IS NULL
  LOOP
    -- Generate supermarket name from admin's name or email
    supermarket_name := COALESCE(
      NULLIF(admin_rec.full_name, ''),
      split_part(admin_rec.email, '@', 1)
    ) || '''s Supermarket';
    
    -- Create the supermarket
    INSERT INTO public.supermarkets (name, location, is_active, owner_user_id)
    VALUES (
      supermarket_name,
      'To be updated',
      TRUE,
      admin_rec.auth_id
    )
    RETURNING id INTO new_supermarket_id;
    
    -- Link the admin to their new supermarket
    UPDATE public.users
    SET supermarket_id = new_supermarket_id,
        updated_at = NOW()
    WHERE id = admin_rec.id;
    
    RAISE NOTICE '✅ Created supermarket "%" (ID: %) for admin %', 
      supermarket_name, new_supermarket_id, admin_rec.email;
  END LOOP;
  
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ All admins now have supermarket_id assigned';
  RAISE NOTICE '================================================';
END $$;

-- ============================================================================
-- 5. HANDLE MANAGERS WITHOUT SUPERMARKET_ID
-- ============================================================================
-- Managers without supermarket_id should be assigned to an existing supermarket
-- This is typically done by the admin who hired them
DO $$
DECLARE
  manager_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO manager_count
  FROM public.users
  WHERE role = 'manager' AND supermarket_id IS NULL;
  
  IF manager_count > 0 THEN
    RAISE WARNING '================================================';
    RAISE WARNING '⚠️  Found % managers without supermarket_id', manager_count;
    RAISE WARNING '⚠️  These managers must be assigned to a supermarket by an admin';
    RAISE WARNING '⚠️  Until assigned, they cannot access the manager portal';
    RAISE WARNING '================================================';
  ELSE
    RAISE NOTICE '✅ All managers have supermarket_id assigned';
  END IF;
END $$;

-- ============================================================================
-- 6. VERIFY THE FIX
-- ============================================================================
SELECT 
  'VERIFICATION' AS status,
  role,
  COUNT(*) AS total_users,
  COUNT(supermarket_id) AS users_with_supermarket,
  COUNT(*) - COUNT(supermarket_id) AS users_without_supermarket
FROM public.users
WHERE role IN ('admin', 'manager')
GROUP BY role;

-- ============================================================================
-- 7. SAMPLE CHECK: SHOW ADMINS WITH THEIR SUPERMARKETS
-- ============================================================================
SELECT 
  u.email,
  u.full_name,
  u.role,
  s.id AS supermarket_id,
  s.name AS supermarket_name,
  s.location
FROM public.users u
LEFT JOIN public.supermarkets s ON s.id = u.supermarket_id
WHERE u.role = 'admin'
ORDER BY u.created_at DESC
LIMIT 10;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- After running this script:
-- 1. All admins should have supermarket_id set (NOT NULL)
-- 2. Each admin without a supermarket gets their own supermarket created
-- 3. Managers without supermarket_id are flagged for manual assignment
-- 4. Verification query shows 0 users_without_supermarket for admins
-- ============================================================================

-- ============================================================================
-- SECURITY IMPACT:
-- ============================================================================
-- Before Fix: Admin with NULL supermarket_id → Sees ALL products from ALL stores
-- After Fix:  Admin with supermarket_id set → Sees ONLY their store's products
-- 
-- This prevents data leakage and ensures proper multi-tenant isolation
-- ============================================================================
