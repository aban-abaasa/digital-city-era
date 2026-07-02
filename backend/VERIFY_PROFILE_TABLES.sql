-- =========================================
-- PROFILE TABLES VERIFICATION SCRIPT
-- Run this to verify all tables and functions are created
-- =========================================

-- 1. CHECK IF ALL PROFILE TABLES EXIST
SELECT 
  tablename,
  'EXISTS ✅' as status
FROM pg_tables 
WHERE tablename IN ('manager_profiles', 'cashier_profiles', 'supplier_profiles')
AND schemaname = 'public'
ORDER BY tablename;

-- Expected output: 3 rows (manager_profiles, cashier_profiles, supplier_profiles)

---

-- 2. CHECK MANAGER PROFILES TABLE STRUCTURE
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'manager_profiles'
AND table_schema = 'public'
ORDER BY ordinal_position;

---

-- 3. CHECK CASHIER PROFILES TABLE STRUCTURE
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cashier_profiles'
AND table_schema = 'public'
ORDER BY ordinal_position;

---

-- 4. CHECK SUPPLIER PROFILES TABLE STRUCTURE
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'supplier_profiles'
AND table_schema = 'public'
ORDER BY ordinal_position;

---

-- 5. CHECK IF RPC FUNCTIONS EXIST
SELECT 
  routine_name,
  'EXISTS ✅' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'update_manager_profile_complete',
  'update_cashier_profile_complete',
  'update_supplier_profile_complete'
)
ORDER BY routine_name;

-- Expected output: 3 rows (all update functions)

---

-- 6. CHECK RLS IS ENABLED ON TABLES
SELECT 
  tablename,
  rowsecurity,
  CASE WHEN rowsecurity THEN 'RLS ENABLED ✅' ELSE 'RLS DISABLED ❌' END as rls_status
FROM pg_tables
WHERE tablename IN ('manager_profiles', 'cashier_profiles', 'supplier_profiles')
AND schemaname = 'public'
ORDER BY tablename;

---

-- 7. COUNT RLS POLICIES
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('manager_profiles', 'cashier_profiles', 'supplier_profiles')
GROUP BY schemaname, tablename
ORDER BY tablename;

---

-- 8. CHECK INDEXES
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('manager_profiles', 'cashier_profiles', 'supplier_profiles')
ORDER BY tablename, indexname;

---

-- 9. TEST INSERT A MANAGER PROFILE (OPTIONAL)
-- Replace with actual UUID
INSERT INTO manager_profiles (
  manager_id,
  full_name,
  phone,
  department,
  location,
  languages,
  avatar,
  employee_id,
  status
) VALUES (
  gen_random_uuid(),  -- Replace with actual manager UUID
  'Test Manager',
  '+256 700 000 000',
  'Operations Management',
  'Kampala, Uganda',
  'English,Luganda',
  '👨‍💼',
  'MGR-TEST-001',
  'active'
)
ON CONFLICT (manager_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  updated_at = NOW()
RETURNING id, manager_id, full_name, created_at;

---

-- 10. TEST CASHIER PROFILE
INSERT INTO cashier_profiles (
  cashier_id,
  full_name,
  phone,
  shift,
  location,
  languages,
  avatar,
  employee_id,
  department,
  status
) VALUES (
  gen_random_uuid(),  -- Replace with actual cashier UUID
  'Test Cashier',
  '+256 700 000 001',
  'Morning',
  'Kampala, Uganda',
  'English',
  '🛒',
  'CSH-TEST-001',
  'Front End Operations',
  'active'
)
RETURNING id, cashier_id, full_name, created_at;

---

-- 11. VIEW ALL RECORDS IN PROFILE TABLES
SELECT 'Manager Profiles' as table_type, COUNT(*) as count FROM manager_profiles
UNION ALL
SELECT 'Cashier Profiles', COUNT(*) FROM cashier_profiles
UNION ALL
SELECT 'Supplier Profiles', COUNT(*) FROM supplier_profiles;

---

-- 12. CHECK VIEW EXISTS
SELECT 
  table_name,
  'VIEW EXISTS ✅' as status
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name = 'user_profiles';

---

-- SUMMARY: Run all queries above in Supabase SQL Editor to verify setup
-- All queries should complete without errors
-- Expected results:
-- ✅ 3 profile tables exist
-- ✅ All columns are present
-- ✅ 3 RPC functions exist
-- ✅ RLS is enabled on all tables
-- ✅ Policies are created (multiple per table)
-- ✅ Indexes are created
-- ✅ user_profiles view exists
