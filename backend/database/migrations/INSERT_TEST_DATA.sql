-- =========================================
-- INSERT TEST ADMIN DATA
-- =========================================

-- Insert test admin user (GANTA ELON)
INSERT INTO users (
  id,
  email,
  full_name,
  phone,
  role,
  is_active,
  email_verified,
  created_at,
  updated_at
) VALUES (
  '399d9128-0b41-4a65-9124-24d8f0c7b4bb',
  'gantaelon@gmail.com',
  'GANTA ELON',
  '+256 700 000 000',
  'admin',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert test admin user 2 (Secondary Admin)
INSERT INTO users (
  id,
  email,
  full_name,
  phone,
  role,
  is_active,
  email_verified,
  created_at,
  updated_at
) VALUES (
  '06b0197e-728d-429a-b109-b21bfb20e8c7',
  'admin@faredeal.ug',
  'Administrator',
  '+256 701 000 000',
  'admin',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert test supplier user
INSERT INTO users (
  id,
  email,
  full_name,
  phone,
  role,
  is_active,
  email_verified,
  created_at,
  updated_at
) VALUES (
  uuid_generate_v4(),
  'supplier@faredeal.ug',
  'Test Supplier',
  '+256 702 000 000',
  'supplier',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert test admin activity logs
INSERT INTO admin_activity_log (
  id,
  admin_id,
  activity_type,
  activity_description,
  ip_address,
  user_agent,
  status,
  created_at
) VALUES 
(
  uuid_generate_v4(),
  '399d9128-0b41-4a65-9124-24d8f0c7b4bb',
  'signup',
  'Admin account created: GANTA ELON',
  '192.168.1.100',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'success',
  NOW() - INTERVAL '2 days'
),
(
  uuid_generate_v4(),
  '399d9128-0b41-4a65-9124-24d8f0c7b4bb',
  'login',
  'Admin logged in',
  '192.168.1.100',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'success',
  NOW() - INTERVAL '1 day'
),
(
  uuid_generate_v4(),
  '399d9128-0b41-4a65-9124-24d8f0c7b4bb',
  'user_created',
  'New user created',
  '192.168.1.100',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'success',
  NOW() - INTERVAL '12 hours'
),
(
  uuid_generate_v4(),
  '399d9128-0b41-4a65-9124-24d8f0c7b4bb',
  'product_added',
  'New product added to inventory',
  '192.168.1.100',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'success',
  NOW() - INTERVAL '6 hours'
),
(
  uuid_generate_v4(),
  '399d9128-0b41-4a65-9124-24d8f0c7b4bb',
  'settings_updated',
  'System settings updated',
  '192.168.1.100',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'success',
  NOW() - INTERVAL '2 hours'
);

-- Insert test supplier (if user exists)
INSERT INTO suppliers (
  id,
  user_id,
  company_name,
  contact_email,
  contact_phone,
  city,
  country,
  is_active,
  created_at,
  updated_at
) SELECT
  uuid_generate_v4(),
  id,
  'Fresh Farms Uganda',
  'contact@freshfarms.ug',
  '+256 700 111 222',
  'Kampala',
  'Uganda',
  true,
  NOW(),
  NOW()
FROM users
WHERE email = 'supplier@faredeal.ug'
AND NOT EXISTS (SELECT 1 FROM suppliers WHERE user_id = users.id)
LIMIT 1;

-- Insert test supplier profile
INSERT INTO supplier_profiles (
  id,
  supplier_id,
  business_license,
  tax_id,
  bank_account,
  bank_name,
  account_holder,
  average_rating,
  total_orders,
  verified,
  verification_date,
  created_at,
  updated_at
) SELECT
  uuid_generate_v4(),
  id,
  'BL-2024-001',
  'TIN-123456789',
  '1234567890',
  'Uganda Commercial Bank',
  'Fresh Farms Limited',
  4.8,
  45,
  true,
  NOW(),
  NOW(),
  NOW()
FROM suppliers
WHERE company_name = 'Fresh Farms Uganda'
AND NOT EXISTS (SELECT 1 FROM supplier_profiles WHERE supplier_id = suppliers.id)
LIMIT 1;

-- Insert test cashier shifts
INSERT INTO cashier_shifts (
  id,
  cashier_id,
  shift_date,
  start_time,
  end_time,
  opening_balance,
  closing_balance,
  total_sales,
  cash_in,
  cash_out,
  status,
  notes,
  created_at,
  updated_at
) VALUES
(
  uuid_generate_v4(),
  '399d9128-0b41-4a65-9124-24d8f0c7b4bb',
  CURRENT_DATE,
  NOW() - INTERVAL '8 hours',
  NULL,
  500000,
  NULL,
  1250000,
  750000,
  0,
  'open',
  'Morning shift',
  NOW(),
  NOW()
),
(
  uuid_generate_v4(),
  '399d9128-0b41-4a65-9124-24d8f0c7b4bb',
  CURRENT_DATE - INTERVAL '1 day',
  NOW() - INTERVAL '32 hours',
  NOW() - INTERVAL '24 hours',
  500000,
  1100000,
  980000,
  500000,
  100000,
  'closed',
  'Completed shift',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
);

-- =========================================
-- SUCCESS MESSAGE
-- =========================================
DO $$
BEGIN
  RAISE NOTICE '✅ TEST DATA INSERTED SUCCESSFULLY!';
  RAISE NOTICE '✅ Admin user: GANTA ELON (gantaelon@gmail.com)';
  RAISE NOTICE '✅ Admin activity logs created';
  RAISE NOTICE '✅ Test supplier and profile created';
  RAISE NOTICE '✅ Cashier shifts created';
END $$;
