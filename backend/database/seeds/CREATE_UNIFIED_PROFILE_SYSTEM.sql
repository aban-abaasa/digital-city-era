-- ============================================================================
-- UNIFIED PROFILE SYSTEM - DATABASE MIGRATION
-- ============================================================================
-- Creates a smart, unified profile system where:
-- 1. One profile table for all roles (manager, cashier, customer, admin)
-- 2. Admins can access all portals with role switching
-- 3. Clear onboarding flow with progress tracking
-- ============================================================================

-- ============================================================================
-- STEP 1: Create unified_profiles table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.unified_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Basic Info (All Roles)
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  avatar VARCHAR(10), -- Emoji character
  avatar_url TEXT,
  bio TEXT,
  location VARCHAR(255),
  languages TEXT[], -- Array: ['English', 'Luganda', 'Swahili']
  
  -- Role-Specific Fields
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'cashier', 'employee', 'supplier', 'customer')),
  supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  
  -- Manager-specific
  department VARCHAR(100),
  team_size INTEGER,
  manager_level VARCHAR(50), -- 'Senior', 'Junior', 'Lead', 'Assistant'
  reports_to UUID REFERENCES public.users(id),
  
  -- Cashier-specific
  shift VARCHAR(100), -- 'Morning (6AM-2PM)', 'Afternoon (2PM-10PM)', 'Night (10PM-6AM)'
  register_number VARCHAR(50),
  pos_access BOOLEAN DEFAULT true,
  manager_id UUID REFERENCES public.users(id),
  
  -- Customer-specific
  loyalty_points INTEGER DEFAULT 0,
  membership_tier VARCHAR(50) DEFAULT 'standard', -- 'standard', 'silver', 'gold', 'platinum'
  delivery_addresses JSONB DEFAULT '[]',
  payment_methods JSONB DEFAULT '[]',
  order_count INTEGER DEFAULT 0,
  total_spent DECIMAL(15,2) DEFAULT 0,
  
  -- Admin-specific
  admin_level VARCHAR(50) DEFAULT 'Admin', -- 'Super Admin', 'Admin', 'System Admin', 'Store Admin'
  permissions JSONB DEFAULT '[]',
  can_access_all_portals BOOLEAN DEFAULT true,
  business_name VARCHAR(255),
  business_license VARCHAR(100),
  tax_number VARCHAR(100),
  
  -- Common Fields
  employee_id VARCHAR(50),
  hire_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,
  profile_completion_percentage INTEGER DEFAULT 0,
  preferences JSONB DEFAULT '{}',
  
  -- Social/Professional
  certifications TEXT[],
  skills TEXT[],
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(50),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_profile_update TIMESTAMP WITH TIME ZONE,
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_unified_profiles_user_id ON public.unified_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_profiles_role ON public.unified_profiles(role);
CREATE INDEX IF NOT EXISTS idx_unified_profiles_supermarket_id ON public.unified_profiles(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_unified_profiles_status ON public.unified_profiles(status);
CREATE INDEX IF NOT EXISTS idx_unified_profiles_email ON public.unified_profiles(email);
CREATE INDEX IF NOT EXISTS idx_unified_profiles_manager_id ON public.unified_profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_unified_profiles_membership_tier ON public.unified_profiles(membership_tier);

-- ============================================================================
-- STEP 2: Create admin_portal_access tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  accessed_portal VARCHAR(50) NOT NULL, -- 'manager', 'cashier', 'customer', 'supplier'
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_duration INTEGER, -- in seconds
  actions_performed JSONB DEFAULT '[]',
  notes TEXT,
  
  -- Track what the admin did
  viewed_users INTEGER DEFAULT 0,
  modified_records INTEGER DEFAULT 0,
  exported_data BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_admin_portal_access_admin_id ON public.admin_portal_access(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_portal_access_portal ON public.admin_portal_access(accessed_portal);
CREATE INDEX IF NOT EXISTS idx_admin_portal_access_accessed_at ON public.admin_portal_access(accessed_at DESC);

-- ============================================================================
-- STEP 3: Create onboarding_progress table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 5,
  completed_steps JSONB DEFAULT '[]',
  skipped_steps JSONB DEFAULT '[]',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN DEFAULT false,
  
  -- Progress tracking
  welcome_viewed BOOLEAN DEFAULT false,
  profile_created BOOLEAN DEFAULT false,
  tour_completed BOOLEAN DEFAULT false,
  first_action_taken BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON public.onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_role ON public.onboarding_progress(role);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_completed ON public.onboarding_progress(is_completed);

-- ============================================================================
-- STEP 4: Create triggers for automatic profile management
-- ============================================================================

-- Trigger to auto-create unified profile when user is created
CREATE OR REPLACE FUNCTION public.create_unified_profile()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.unified_profiles (
    user_id,
    full_name,
    email,
    phone,
    role,
    supermarket_id,
    status,
    onboarding_step,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.full_name,
    NEW.email,
    NEW.phone,
    NEW.role,
    NEW.supermarket_id,
    NEW.is_active::TEXT,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    supermarket_id = EXCLUDED.supermarket_id,
    updated_at = NOW();
  
  -- Create onboarding progress record
  INSERT INTO public.onboarding_progress (
    user_id,
    role,
    current_step,
    total_steps,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.role,
    0,
    CASE 
      WHEN NEW.role = 'admin' THEN 6
      WHEN NEW.role IN ('manager', 'cashier') THEN 5
      WHEN NEW.role = 'customer' THEN 4
      ELSE 3
    END,
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RAISE NOTICE '✅ Unified profile created for user: %', NEW.email;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_create_unified_profile ON public.users;

-- Create the trigger
CREATE TRIGGER trigger_create_unified_profile
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_unified_profile();

-- ============================================================================
-- STEP 5: Create trigger to update profile completion percentage
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_profile_completion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  completion_score INTEGER := 0;
  total_fields INTEGER := 0;
BEGIN
  -- Basic fields (all roles) - 40 points
  IF NEW.full_name IS NOT NULL AND LENGTH(NEW.full_name) > 0 THEN completion_score := completion_score + 10; END IF;
  IF NEW.email IS NOT NULL AND LENGTH(NEW.email) > 0 THEN completion_score := completion_score + 10; END IF;
  IF NEW.phone IS NOT NULL AND LENGTH(NEW.phone) > 0 THEN completion_score := completion_score + 10; END IF;
  IF NEW.location IS NOT NULL AND LENGTH(NEW.location) > 0 THEN completion_score := completion_score + 10; END IF;
  
  -- Avatar/Bio - 20 points
  IF NEW.avatar IS NOT NULL OR NEW.avatar_url IS NOT NULL THEN completion_score := completion_score + 10; END IF;
  IF NEW.bio IS NOT NULL AND LENGTH(NEW.bio) > 0 THEN completion_score := completion_score + 10; END IF;
  
  -- Role-specific fields - 40 points
  IF NEW.role = 'admin' THEN
    IF NEW.business_name IS NOT NULL THEN completion_score := completion_score + 10; END IF;
    IF NEW.business_license IS NOT NULL THEN completion_score := completion_score + 10; END IF;
    IF NEW.admin_level IS NOT NULL THEN completion_score := completion_score + 10; END IF;
    IF NEW.permissions IS NOT NULL AND jsonb_array_length(NEW.permissions) > 0 THEN completion_score := completion_score + 10; END IF;
  
  ELSIF NEW.role = 'manager' THEN
    IF NEW.department IS NOT NULL THEN completion_score := completion_score + 10; END IF;
    IF NEW.manager_level IS NOT NULL THEN completion_score := completion_score + 10; END IF;
    IF NEW.team_size IS NOT NULL THEN completion_score := completion_score + 10; END IF;
    IF NEW.employee_id IS NOT NULL THEN completion_score := completion_score + 10; END IF;
  
  ELSIF NEW.role = 'cashier' THEN
    IF NEW.shift IS NOT NULL THEN completion_score := completion_score + 10; END IF;
    IF NEW.register_number IS NOT NULL THEN completion_score := completion_score + 10; END IF;
    IF NEW.employee_id IS NOT NULL THEN completion_score := completion_score + 10; END IF;
    IF NEW.manager_id IS NOT NULL THEN completion_score := completion_score + 10; END IF;
  
  ELSIF NEW.role = 'customer' THEN
    IF NEW.delivery_addresses IS NOT NULL AND jsonb_array_length(NEW.delivery_addresses) > 0 THEN completion_score := completion_score + 20; END IF;
    IF NEW.payment_methods IS NOT NULL AND jsonb_array_length(NEW.payment_methods) > 0 THEN completion_score := completion_score + 20; END IF;
  END IF;
  
  -- Update the completion percentage
  NEW.profile_completion_percentage := LEAST(completion_score, 100);
  NEW.updated_at := NOW();
  NEW.last_profile_update := NOW();
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_calculate_profile_completion ON public.unified_profiles;

-- Create the trigger
CREATE TRIGGER trigger_calculate_profile_completion
  BEFORE INSERT OR UPDATE ON public.unified_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_profile_completion();

-- ============================================================================
-- STEP 6: Create RLS policies for unified_profiles
-- ============================================================================

ALTER TABLE public.unified_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own unified profile" ON public.unified_profiles;
DROP POLICY IF EXISTS "Users can update own unified profile" ON public.unified_profiles;
DROP POLICY IF EXISTS "Admins can read all supermarket profiles" ON public.unified_profiles;
DROP POLICY IF EXISTS "Users can insert own unified profile" ON public.unified_profiles;

-- Users can read their own profile
CREATE POLICY "Users can read own unified profile" ON public.unified_profiles
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own unified profile" ON public.unified_profiles
  FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

-- Users can insert their own profile
CREATE POLICY "Users can insert own unified profile" ON public.unified_profiles
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

-- Admins can read all profiles in their supermarket
CREATE POLICY "Admins can read all supermarket profiles" ON public.unified_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'admin'
      AND users.supermarket_id = unified_profiles.supermarket_id
    )
  );

-- Managers can read profiles of their team members
CREATE POLICY "Managers can read team profiles" ON public.unified_profiles
  FOR SELECT
  USING (
    manager_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================================================
-- STEP 7: Create RLS policies for admin_portal_access
-- ============================================================================

ALTER TABLE public.admin_portal_access ENABLE ROW LEVEL SECURITY;

-- Admins can read their own portal access logs
CREATE POLICY "Admins can read own portal access" ON public.admin_portal_access
  FOR SELECT
  USING (
    admin_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

-- Admins can insert their own portal access logs
CREATE POLICY "Admins can insert portal access" ON public.admin_portal_access
  FOR INSERT
  WITH CHECK (
    admin_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- STEP 8: Create RLS policies for onboarding_progress
-- ============================================================================

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Users can read their own onboarding progress
CREATE POLICY "Users can read own onboarding" ON public.onboarding_progress
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

-- Users can update their own onboarding progress
CREATE POLICY "Users can update own onboarding" ON public.onboarding_progress
  FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 9: Create helper functions
-- ============================================================================

-- Function to get user's unified profile
CREATE OR REPLACE FUNCTION public.get_unified_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  role VARCHAR,
  supermarket_id UUID,
  profile_completion_percentage INTEGER,
  onboarding_completed BOOLEAN,
  status VARCHAR
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.user_id,
    up.full_name,
    up.email,
    up.phone,
    up.role,
    up.supermarket_id,
    up.profile_completion_percentage,
    up.onboarding_completed,
    up.status
  FROM public.unified_profiles up
  WHERE up.user_id = p_user_id;
END;
$$;

-- Function to log admin portal access
CREATE OR REPLACE FUNCTION public.log_admin_portal_access(
  p_admin_id UUID,
  p_portal VARCHAR,
  p_actions JSONB DEFAULT '[]'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  access_id UUID;
BEGIN
  INSERT INTO public.admin_portal_access (
    admin_id,
    accessed_portal,
    actions_performed,
    accessed_at
  )
  VALUES (
    p_admin_id,
    p_portal,
    p_actions,
    NOW()
  )
  RETURNING id INTO access_id;
  
  RETURN access_id;
END;
$$;

-- ============================================================================
-- STEP 10: Grant permissions
-- ============================================================================

GRANT ALL PRIVILEGES ON TABLE public.unified_profiles TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.admin_portal_access TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.onboarding_progress TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_unified_profile TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_portal_access TO authenticated, anon;

-- ============================================================================
-- STEP 11: Migrate existing profile data (if tables exist)
-- ============================================================================

DO $$
BEGIN
  -- Migrate admin profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_profiles') THEN
    INSERT INTO public.unified_profiles (
      user_id, full_name, phone, supermarket_id, location, languages,
      avatar, avatar_url, business_name, business_license, tax_number,
      bio, status, role, email, created_at, updated_at
    )
    SELECT 
      ap.admin_id,
      ap.full_name,
      ap.phone,
      ap.supermarket_id,
      ap.location,
      string_to_array(COALESCE(ap.languages, ''), ','),
      ap.avatar,
      ap.avatar_url,
      ap.business_name,
      ap.business_license,
      ap.tax_number,
      ap.bio,
      ap.status,
      'admin',
      u.email,
      ap.created_at,
      ap.updated_at
    FROM public.admin_profiles ap
    JOIN public.users u ON u.id = ap.admin_id
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE '✅ Migrated admin profiles to unified_profiles';
  END IF;

  -- Migrate manager profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manager_profiles') THEN
    INSERT INTO public.unified_profiles (
      user_id, full_name, phone, department, location, languages,
      avatar, avatar_url, employee_id, hire_date, bio, status,
      role, email, created_at, updated_at
    )
    SELECT 
      mp.manager_id,
      mp.full_name,
      mp.phone,
      mp.department,
      mp.location,
      string_to_array(COALESCE(mp.languages, ''), ','),
      mp.avatar,
      mp.avatar_url,
      mp.employee_id,
      mp.join_date,
      mp.bio,
      mp.status,
      'manager',
      u.email,
      mp.created_at,
      mp.updated_at
    FROM public.manager_profiles mp
    JOIN public.users u ON u.id = mp.manager_id
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE '✅ Migrated manager profiles to unified_profiles';
  END IF;

  -- Migrate cashier profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cashier_profiles') THEN
    INSERT INTO public.unified_profiles (
      user_id, full_name, phone, shift, location, languages,
      avatar, avatar_url, employee_id, hire_date, status,
      manager_id, role, email, created_at, updated_at
    )
    SELECT 
      cp.cashier_id,
      cp.full_name,
      cp.phone,
      cp.shift,
      cp.location,
      string_to_array(COALESCE(cp.languages, ''), ','),
      cp.avatar,
      cp.avatar_url,
      cp.employee_id,
      cp.hire_date,
      cp.status,
      cp.manager_id,
      'cashier',
      u.email,
      cp.created_at,
      cp.updated_at
    FROM public.cashier_profiles cp
    JOIN public.users u ON u.id = cp.cashier_id
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE '✅ Migrated cashier profiles to unified_profiles';
  END IF;
END $$;

-- ============================================================================
-- STEP 12: Success message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ✅ UNIFIED PROFILE SYSTEM CREATED SUCCESSFULLY!               ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📋 WHAT WAS CREATED:';
  RAISE NOTICE '  ✅ unified_profiles table (one profile for all roles)';
  RAISE NOTICE '  ✅ admin_portal_access table (admin tracking)';
  RAISE NOTICE '  ✅ onboarding_progress table (user onboarding)';
  RAISE NOTICE '  ✅ Auto-create profile trigger';
  RAISE NOTICE '  ✅ Profile completion calculation trigger';
  RAISE NOTICE '  ✅ RLS policies for data isolation';
  RAISE NOTICE '  ✅ Helper functions for profile management';
  RAISE NOTICE '  ✅ Migrated existing profile data';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 FEATURES:';
  RAISE NOTICE '  ✅ Single profile page for all roles';
  RAISE NOTICE '  ✅ Role-specific fields automatically shown/hidden';
  RAISE NOTICE '  ✅ Admin can access all portals';
  RAISE NOTICE '  ✅ Profile completion tracking';
  RAISE NOTICE '  ✅ Onboarding progress tracking';
  RAISE NOTICE '  ✅ Admin portal access logging';
  RAISE NOTICE '';
  RAISE NOTICE '📝 NEXT STEPS:';
  RAISE NOTICE '  1. Build UnifiedProfilePage.jsx component';
  RAISE NOTICE '  2. Build AdminPortalSwitcher.jsx component';
  RAISE NOTICE '  3. Build OnboardingWizard.jsx component';
  RAISE NOTICE '  4. Update routing to use /profile';
  RAISE NOTICE '  5. Test with different roles';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
