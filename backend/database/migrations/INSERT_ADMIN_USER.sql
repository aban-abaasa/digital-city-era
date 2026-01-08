-- =========================================
-- INSERT ADMIN USER RECORD - SINGLE QUERY
-- =========================================
-- Just run this entire query - it finds the user and inserts in one go!

WITH admin_user AS (
  SELECT id FROM auth.users WHERE email = 'aronnykevin@gmail.com'
)
INSERT INTO public.users (
  id,
  email,
  full_name,
  phone,
  role,
  is_active,
  email_verified,
  created_at,
  updated_at
)
SELECT 
  admin_user.id,
  'aronnykevin@gmail.com',
  'Aronny Kevin',
  '+256700000000',
  'super_admin',
  true,
  true,
  NOW(),
  NOW()
FROM admin_user
ON CONFLICT (id) DO UPDATE SET
  full_name = 'Aronny Kevin',
  phone = '+256700000000',
  role = 'super_admin',
  is_active = true,
  email_verified = true,
  updated_at = NOW();
