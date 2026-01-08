-- =========================================
-- CREATE ALL PROFILE TABLES FOR MANAGER, CASHIER, AND SUPPLIER
-- This ensures proper data structure for profile edits
-- =========================================

-- =========================================
-- MANAGER PROFILES TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS public.manager_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  department VARCHAR(100),
  location VARCHAR(255),
  languages TEXT, -- JSON array stored as text: '["English", "Luganda"]'
  avatar VARCHAR(10), -- Emoji character
  avatar_url TEXT,
  employee_id VARCHAR(50),
  join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active',
  bio TEXT,
  years_experience INTEGER,
  education_level VARCHAR(100),
  certifications TEXT,
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for manager profiles
CREATE INDEX IF NOT EXISTS idx_manager_profiles_manager_id ON public.manager_profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_profiles_department ON public.manager_profiles(department);
CREATE INDEX IF NOT EXISTS idx_manager_profiles_status ON public.manager_profiles(status);

-- Add trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_update_manager_profiles_timestamp ON public.manager_profiles;
CREATE TRIGGER trigger_update_manager_profiles_timestamp
BEFORE UPDATE ON public.manager_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- Enable RLS
ALTER TABLE public.manager_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manager_profiles
DROP POLICY IF EXISTS "Managers can read their own profile" ON public.manager_profiles;
CREATE POLICY "Managers can read their own profile"
ON public.manager_profiles FOR SELECT
TO authenticated
USING (manager_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "Managers can update their own profile" ON public.manager_profiles;
CREATE POLICY "Managers can update their own profile"
ON public.manager_profiles FOR UPDATE
TO authenticated
USING (manager_id = auth.uid())
WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "Admin can manage all manager profiles" ON public.manager_profiles;
CREATE POLICY "Admin can manage all manager profiles"
ON public.manager_profiles FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

-- =========================================
-- CASHIER PROFILES TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS public.cashier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  shift VARCHAR(100), -- e.g., "Morning", "Afternoon", "Night"
  location VARCHAR(255),
  languages TEXT, -- JSON array stored as text: '["English", "Luganda"]'
  avatar VARCHAR(10), -- Emoji character
  avatar_url TEXT,
  employee_id VARCHAR(50),
  join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active',
  register_name VARCHAR(100),
  manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  department VARCHAR(100) DEFAULT 'Front End Operations',
  certifications TEXT,
  hire_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for cashier profiles
CREATE INDEX IF NOT EXISTS idx_cashier_profiles_cashier_id ON public.cashier_profiles(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cashier_profiles_manager_id ON public.cashier_profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_cashier_profiles_shift ON public.cashier_profiles(shift);
CREATE INDEX IF NOT EXISTS idx_cashier_profiles_status ON public.cashier_profiles(status);

-- Add trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_update_cashier_profiles_timestamp ON public.cashier_profiles;
CREATE TRIGGER trigger_update_cashier_profiles_timestamp
BEFORE UPDATE ON public.cashier_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- Enable RLS
ALTER TABLE public.cashier_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cashier_profiles
DROP POLICY IF EXISTS "Cashiers can read their own profile" ON public.cashier_profiles;
CREATE POLICY "Cashiers can read their own profile"
ON public.cashier_profiles FOR SELECT
TO authenticated
USING (cashier_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "Cashiers can update their own profile" ON public.cashier_profiles;
CREATE POLICY "Cashiers can update their own profile"
ON public.cashier_profiles FOR UPDATE
TO authenticated
USING (cashier_id = auth.uid())
WITH CHECK (cashier_id = auth.uid());

DROP POLICY IF EXISTS "Manager can update their cashiers' profiles" ON public.cashier_profiles;
CREATE POLICY "Manager can update their cashiers' profiles"
ON public.cashier_profiles FOR UPDATE
TO authenticated
USING (manager_id = auth.uid())
WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "Admin can manage all cashier profiles" ON public.cashier_profiles;
CREATE POLICY "Admin can manage all cashier profiles"
ON public.cashier_profiles FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

-- =========================================
-- SUPPLIER PROFILES TABLE (ENHANCED)
-- =========================================
-- Note: This table may already exist, but we're ensuring it has all needed columns

ALTER TABLE IF EXISTS public.supplier_profiles
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS location VARCHAR(255),
ADD COLUMN IF NOT EXISTS languages TEXT,
ADD COLUMN IF NOT EXISTS avatar VARCHAR(10),
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS business_license VARCHAR(100),
ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100),
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Ensure supplier_profiles has RLS enabled
ALTER TABLE IF EXISTS public.supplier_profiles ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE public.manager_profiles TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.cashier_profiles TO authenticated, anon;

-- Create helpful view to get profile by user
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  'manager' as profile_type,
  json_build_object(
    'id', mp.id,
    'full_name', mp.full_name,
    'phone', mp.phone,
    'department', mp.department,
    'location', mp.location,
    'avatar', mp.avatar,
    'avatar_url', mp.avatar_url,
    'employee_id', mp.employee_id,
    'status', mp.status
  )::TEXT as profile_data
FROM public.users u
LEFT JOIN public.manager_profiles mp ON u.id = mp.manager_id
WHERE u.role = 'manager'

UNION ALL

SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  'cashier' as profile_type,
  json_build_object(
    'id', cp.id,
    'full_name', cp.full_name,
    'phone', cp.phone,
    'shift', cp.shift,
    'location', cp.location,
    'avatar', cp.avatar,
    'avatar_url', cp.avatar_url,
    'employee_id', cp.employee_id,
    'status', cp.status
  )::TEXT as profile_data
FROM public.users u
LEFT JOIN public.cashier_profiles cp ON u.id = cp.cashier_id
WHERE u.role = 'cashier'

UNION ALL

SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  'supplier' as profile_type,
  json_build_object(
    'id', sp.id,
    'full_name', sp.full_name,
    'phone', sp.phone,
    'company_name', sp.company_name,
    'location', sp.location,
    'avatar', sp.avatar,
    'avatar_url', sp.avatar_url,
    'employee_id', sp.employee_id,
    'status', sp.status
  )::TEXT as profile_data
FROM public.users u
LEFT JOIN public.supplier_profiles sp ON u.id = sp.supplier_id
WHERE u.role = 'supplier';

-- Add helper function to update timestamp
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =========================================
-- FINAL STATUS
-- =========================================
-- ✅ manager_profiles table created with all necessary fields
-- ✅ cashier_profiles table created with all necessary fields
-- ✅ supplier_profiles table enhanced with missing fields
-- ✅ RLS policies configured for each table
-- ✅ Indexes created for better query performance
-- ✅ user_profiles view created for unified profile access
-- ✅ Ready for profile editing in UI
