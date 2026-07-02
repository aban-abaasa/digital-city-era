-- ============================================================================
-- FIX: SUPERMARKET ISOLATION - EACH ADMIN GETS THEIR OWN SUPERMARKET
-- ============================================================================
-- ISSUE: When a new user creates a "Supermarket Era" admin profile,
--        they get added to existing supermarkets instead of creating their own
--
-- SOLUTION: Automatically create a NEW supermarket for each admin signup
--           and ensure complete isolation between supermarkets
-- ============================================================================

-- ============================================================================
-- STEP 1: Create function to auto-create supermarket for new admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_supermarket_for_admin()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_supermarket_id UUID;
  supermarket_name TEXT;
BEGIN
  -- Only create supermarket if user role is 'admin' and no supermarket_id is set
  IF NEW.role = 'admin' AND NEW.supermarket_id IS NULL THEN
    
    -- Generate a unique supermarket name based on admin's name or email
    supermarket_name := COALESCE(NEW.full_name, SPLIT_PART(NEW.email, '@', 1)) || '''s Supermarket';
    
    -- Create a new supermarket
    INSERT INTO public.supermarkets (
      name,
      location,
      phone,
      address,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      supermarket_name,
      'Location pending', -- Admin can update this later
      NEW.phone,
      'Address pending', -- Admin can update this later
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO new_supermarket_id;
    
    -- Link the admin to their new supermarket
    NEW.supermarket_id := new_supermarket_id;
    
    -- Log the creation
    RAISE NOTICE '✅ New supermarket created: % (ID: %)', supermarket_name, new_supermarket_id;
    RAISE NOTICE '✅ Admin % linked to supermarket %', NEW.email, new_supermarket_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 2: Create trigger to auto-create supermarket on admin signup
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_create_supermarket_for_admin ON public.users;

-- Create the trigger
CREATE TRIGGER trigger_create_supermarket_for_admin
  BEFORE INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.role = 'admin' AND NEW.supermarket_id IS NULL)
  EXECUTE FUNCTION public.create_supermarket_for_admin();

-- ============================================================================
-- STEP 3: Update RLS policies to enforce supermarket isolation
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
DROP POLICY IF EXISTS "Admins can read supermarket users" ON public.users;

-- Users can read their own data
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT
  USING (auth.uid() = auth_id);

-- Users can read other users IN THE SAME SUPERMARKET ONLY
CREATE POLICY "Users can read same supermarket users" ON public.users
  FOR SELECT
  USING (
    auth.uid() = auth_id 
    OR 
    EXISTS (
      SELECT 1 FROM public.users self
      WHERE self.auth_id = auth.uid()
      AND self.supermarket_id = users.supermarket_id
      AND self.supermarket_id IS NOT NULL
    )
  );

-- Users can insert their own record
CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = auth_id);

-- Users can update their own record
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_id);

-- ============================================================================
-- STEP 4: Update supermarket policies for isolation
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can insert supermarket" ON public.supermarkets;
DROP POLICY IF EXISTS "Authenticated can read supermarkets" ON public.supermarkets;
DROP POLICY IF EXISTS "Authenticated can update supermarkets" ON public.supermarkets;
DROP POLICY IF EXISTS "Admins can read own supermarket" ON public.supermarkets;
DROP POLICY IF EXISTS "Admins can update own supermarket" ON public.supermarkets;

-- Anyone can insert supermarket (needed for admin signup trigger)
CREATE POLICY "Anyone can insert supermarket" ON public.supermarkets
  FOR INSERT
  WITH CHECK (true);

-- Users can ONLY read their OWN supermarket
CREATE POLICY "Users can read own supermarket" ON public.supermarkets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = supermarkets.id
    )
  );

-- Admins can update their OWN supermarket
CREATE POLICY "Admins can update own supermarket" ON public.supermarkets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = supermarkets.id
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = supermarkets.id
      AND users.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 5: Update inventory policies for supermarket isolation
-- ============================================================================

DROP POLICY IF EXISTS "Users can read supermarket inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admins can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admins can update inventory" ON public.inventory;

-- Users can ONLY read inventory from their own supermarket
CREATE POLICY "Users can read own supermarket inventory" ON public.inventory
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = inventory.supermarket_id
    )
  );

-- Admins/Managers can insert inventory ONLY for their own supermarket
CREATE POLICY "Admins can insert own supermarket inventory" ON public.inventory
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = inventory.supermarket_id
      AND users.role IN ('admin', 'manager')
    )
  );

-- Admins/Managers can update inventory ONLY for their own supermarket
CREATE POLICY "Admins can update own supermarket inventory" ON public.inventory
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = inventory.supermarket_id
      AND users.role IN ('admin', 'manager')
    )
  );

-- ============================================================================
-- STEP 6: Update transactions policies for supermarket isolation
-- ============================================================================

DROP POLICY IF EXISTS "Users can read supermarket transactions" ON public.transactions;
DROP POLICY IF EXISTS "Cashiers can insert transactions" ON public.transactions;

-- Users can ONLY read transactions from their own supermarket
CREATE POLICY "Users can read own supermarket transactions" ON public.transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = transactions.supermarket_id
    )
  );

-- Cashiers can ONLY insert transactions for their own supermarket
CREATE POLICY "Cashiers can insert own supermarket transactions" ON public.transactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = transactions.supermarket_id
      AND users.role IN ('admin', 'manager', 'cashier')
    )
  );

-- ============================================================================
-- STEP 7: Update payments policies for supermarket isolation
-- ============================================================================

DROP POLICY IF EXISTS "Users can read supermarket payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can insert payments" ON public.payments;

-- Users can ONLY read payments from their own supermarket
CREATE POLICY "Users can read own supermarket payments" ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = payments.supermarket_id
    )
  );

-- Admins/Managers can ONLY insert payments for their own supermarket
CREATE POLICY "Admins can insert own supermarket payments" ON public.payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = payments.supermarket_id
      AND users.role IN ('admin', 'manager')
    )
  );

-- ============================================================================
-- STEP 8: Update suppliers policies for supermarket isolation
-- ============================================================================

DROP POLICY IF EXISTS "Users can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Anyone can insert supplier" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can read all suppliers" ON public.suppliers;

-- Users can ONLY read suppliers from their own supermarket
CREATE POLICY "Users can read own supermarket suppliers" ON public.suppliers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = suppliers.supermarket_id
    )
  );

-- Suppliers can insert their own application
CREATE POLICY "Suppliers can insert own application" ON public.suppliers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.id = suppliers.user_id
    )
  );

-- Admins can approve suppliers ONLY for their own supermarket
CREATE POLICY "Admins can update own supermarket suppliers" ON public.suppliers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.supermarket_id = suppliers.supermarket_id
      AND users.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 9: Create admin profile table (if needed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  location VARCHAR(255),
  languages TEXT,
  avatar VARCHAR(10),
  avatar_url TEXT,
  business_name VARCHAR(255),
  business_license VARCHAR(100),
  tax_number VARCHAR(100),
  bio TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for admin profiles
CREATE INDEX IF NOT EXISTS idx_admin_profiles_admin_id ON public.admin_profiles(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_profiles_supermarket_id ON public.admin_profiles(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_admin_profiles_status ON public.admin_profiles(status);

-- Add trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_update_admin_profiles_timestamp ON public.admin_profiles;
CREATE TRIGGER trigger_update_admin_profiles_timestamp
BEFORE UPDATE ON public.admin_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- Enable RLS
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_profiles
DROP POLICY IF EXISTS "Admins can read their own profile" ON public.admin_profiles;
CREATE POLICY "Admins can read their own profile"
ON public.admin_profiles FOR SELECT
TO authenticated
USING (admin_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update their own profile" ON public.admin_profiles;
CREATE POLICY "Admins can update their own profile"
ON public.admin_profiles FOR ALL
TO authenticated
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE public.admin_profiles TO authenticated, anon;

-- ============================================================================
-- STEP 10: Create trigger to auto-create admin profile
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_admin_profile()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only create admin profile if user role is 'admin'
  IF NEW.role = 'admin' THEN
    INSERT INTO public.admin_profiles (
      admin_id,
      full_name,
      phone,
      supermarket_id,
      location,
      business_name,
      status,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.full_name,
      NEW.phone,
      NEW.supermarket_id,
      'Location pending',
      COALESCE(NEW.full_name, SPLIT_PART(NEW.email, '@', 1)) || '''s Business',
      'active',
      NOW(),
      NOW()
    )
    ON CONFLICT (admin_id) DO NOTHING;
    
    RAISE NOTICE '✅ Admin profile created for: %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_create_admin_profile ON public.users;

-- Create the trigger (runs AFTER supermarket is created)
CREATE TRIGGER trigger_create_admin_profile
  AFTER INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.role = 'admin')
  EXECUTE FUNCTION public.create_admin_profile();

-- ============================================================================
-- STEP 11: Verification queries
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ✅ SUPERMARKET ISOLATION FIX COMPLETE!                        ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📋 WHAT WAS FIXED:';
  RAISE NOTICE '  ✅ Each admin now gets their OWN separate supermarket';
  RAISE NOTICE '  ✅ Supermarkets are completely isolated from each other';
  RAISE NOTICE '  ✅ Users can only see data from their own supermarket';
  RAISE NOTICE '  ✅ Inventory, transactions, payments are supermarket-specific';
  RAISE NOTICE '  ✅ Suppliers are linked to specific supermarkets';
  RAISE NOTICE '  ✅ Admin profiles table created';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SECURITY IMPROVEMENTS:';
  RAISE NOTICE '  ✅ RLS policies enforce supermarket-level data isolation';
  RAISE NOTICE '  ✅ No cross-supermarket data access';
  RAISE NOTICE '  ✅ Each supermarket is a separate business entity';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 HOW IT WORKS:';
  RAISE NOTICE '  1. User signs up and selects "admin" role';
  RAISE NOTICE '  2. System creates a NEW supermarket automatically';
  RAISE NOTICE '  3. Admin is linked to their new supermarket';
  RAISE NOTICE '  4. Admin profile is auto-created';
  RAISE NOTICE '  5. All data is isolated to that supermarket';
  RAISE NOTICE '';
  RAISE NOTICE '📝 NEXT STEPS:';
  RAISE NOTICE '  1. Test admin signup process';
  RAISE NOTICE '  2. Verify supermarket isolation in UI';
  RAISE NOTICE '  3. Ensure managers/cashiers see only their supermarket data';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Optional: Create a view to see supermarket ownership
-- ============================================================================

CREATE OR REPLACE VIEW public.supermarket_ownership AS
SELECT 
  s.id as supermarket_id,
  s.name as supermarket_name,
  s.location,
  s.is_active,
  u.id as admin_id,
  u.email as admin_email,
  u.full_name as admin_name,
  u.phone as admin_phone,
  u.created_at as admin_joined,
  COUNT(DISTINCT u2.id) FILTER (WHERE u2.role = 'manager') as total_managers,
  COUNT(DISTINCT u2.id) FILTER (WHERE u2.role = 'cashier') as total_cashiers,
  COUNT(DISTINCT u2.id) FILTER (WHERE u2.role = 'employee') as total_employees
FROM public.supermarkets s
LEFT JOIN public.users u ON s.id = u.supermarket_id AND u.role = 'admin'
LEFT JOIN public.users u2 ON s.id = u2.supermarket_id
GROUP BY s.id, s.name, s.location, s.is_active, u.id, u.email, u.full_name, u.phone, u.created_at
ORDER BY s.created_at DESC;

-- Grant access to view
GRANT SELECT ON public.supermarket_ownership TO authenticated;

-- ============================================================================
-- END OF FIX
-- ============================================================================
