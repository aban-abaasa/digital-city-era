# Supermarket Isolation Fix - Deployment Guide

## 🎯 Problem
When users create a "Supermarket Era" admin profile, they're being added to existing supermarkets instead of creating their own separate, independent supermarket.

## ✅ Solution
Each admin signup will automatically:
1. Create a NEW supermarket
2. Link the admin to their new supermarket
3. Create an admin profile
4. Ensure complete data isolation between supermarkets

## 📋 Deployment Steps

### Step 1: Backup Current Database
```sql
-- Run this in Supabase SQL Editor to see current state
SELECT * FROM public.supermarkets;
SELECT * FROM public.users WHERE role = 'admin';
```

### Step 2: Apply the Fix
1. Open **Supabase Dashboard** → Your Project
2. Go to **SQL Editor** → New Query
3. Copy the entire contents of `FIX_SUPERMARKET_ISOLATION.sql`
4. Paste and click **Run**

### Step 3: Verify the Fix
Run these verification queries in SQL Editor:

```sql
-- Check if triggers were created
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_create_supermarket_for_admin',
  'trigger_create_admin_profile'
);

-- Check if admin_profiles table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'admin_profiles';

-- View supermarket ownership (if any admins exist)
SELECT * FROM public.supermarket_ownership;
```

### Step 4: Test New Admin Signup
1. **Create a new test user** with role = 'admin'
2. **Verify** a new supermarket was auto-created
3. **Check** that the admin is linked to their own supermarket

```sql
-- After test signup, check results
SELECT 
  u.email,
  u.role,
  s.name as supermarket_name,
  s.id as supermarket_id
FROM public.users u
LEFT JOIN public.supermarkets s ON u.supermarket_id = s.id
WHERE u.role = 'admin'
ORDER BY u.created_at DESC;
```

## 🔒 What Changed

### Database Changes
- ✅ **New Trigger**: `trigger_create_supermarket_for_admin` - Auto-creates supermarket for new admins
- ✅ **New Table**: `admin_profiles` - Stores admin profile data
- ✅ **New Trigger**: `trigger_create_admin_profile` - Auto-creates admin profile
- ✅ **Updated RLS Policies**: All tables now enforce supermarket-level isolation

### Isolation Enforced On:
- ✅ **Users** - Can only see users in their supermarket
- ✅ **Supermarkets** - Can only see their own supermarket
- ✅ **Inventory** - Can only see/manage their own inventory
- ✅ **Transactions** - Can only see their own transactions
- ✅ **Payments** - Can only see their own payments
- ✅ **Suppliers** - Can only see suppliers for their supermarket

## 🧪 Testing Checklist

- [ ] **Admin Signup**: New admin creates account → New supermarket auto-created
- [ ] **Isolation Test**: Admin A cannot see Admin B's data
- [ ] **Manager Test**: Manager can only see their own supermarket data
- [ ] **Cashier Test**: Cashier can only access their own supermarket POS
- [ ] **Supplier Test**: Supplier can only apply to specific supermarket
- [ ] **Inventory Test**: Each supermarket has separate inventory
- [ ] **Transaction Test**: Transactions are supermarket-specific

## 📊 Monitoring

### View All Supermarkets with Owners
```sql
SELECT * FROM public.supermarket_ownership;
```

### Check Data Isolation
```sql
-- Should show different counts for each supermarket
SELECT 
  s.name,
  COUNT(DISTINCT i.id) as inventory_items,
  COUNT(DISTINCT t.id) as transactions,
  COUNT(DISTINCT u.id) as users
FROM public.supermarkets s
LEFT JOIN public.inventory i ON s.id = i.supermarket_id
LEFT JOIN public.transactions t ON s.id = t.supermarket_id
LEFT JOIN public.users u ON s.id = u.supermarket_id
GROUP BY s.id, s.name;
```

## 🚨 Important Notes

### For Existing Users
If you already have users who are incorrectly sharing supermarkets, you'll need to:

1. **Identify affected users**:
```sql
SELECT 
  s.id,
  s.name,
  COUNT(*) as admin_count
FROM public.supermarkets s
JOIN public.users u ON s.id = u.supermarket_id
WHERE u.role = 'admin'
GROUP BY s.id, s.name
HAVING COUNT(*) > 1;
```

2. **Migrate them** (if needed):
```sql
-- For each extra admin, create their own supermarket
-- Replace 'USER_ID' and 'USER_EMAIL' with actual values

DO $$
DECLARE
  user_to_migrate UUID := 'USER_ID';
  new_supermarket_id UUID;
BEGIN
  -- Create new supermarket
  INSERT INTO public.supermarkets (name, location, is_active)
  VALUES ('New Admin Supermarket', 'Location pending', true)
  RETURNING id INTO new_supermarket_id;
  
  -- Move user to new supermarket
  UPDATE public.users
  SET supermarket_id = new_supermarket_id
  WHERE id = user_to_migrate;
  
  -- Create admin profile
  INSERT INTO public.admin_profiles (admin_id, full_name, supermarket_id)
  SELECT id, full_name, supermarket_id
  FROM public.users
  WHERE id = user_to_migrate;
  
  RAISE NOTICE 'Migrated user % to new supermarket %', user_to_migrate, new_supermarket_id;
END $$;
```

## 🎉 Success Indicators

After deployment, you should see:
- ✅ Each new admin signup creates a separate supermarket
- ✅ Supermarket names include admin's name (e.g., "John's Supermarket")
- ✅ No data leakage between supermarkets
- ✅ RLS policies blocking cross-supermarket queries
- ✅ Admin profiles auto-created with proper linking

## 🆘 Troubleshooting

### Issue: Trigger not firing
```sql
-- Check trigger status
SELECT * FROM pg_trigger WHERE tgname LIKE '%supermarket%';
```

### Issue: RLS blocking legitimate access
```sql
-- Temporarily check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('users', 'supermarkets', 'inventory', 'transactions')
ORDER BY tablename, policyname;
```

### Issue: Admin profile not created
```sql
-- Manually create missing admin profiles
INSERT INTO public.admin_profiles (admin_id, full_name, phone, supermarket_id)
SELECT id, full_name, phone, supermarket_id
FROM public.users
WHERE role = 'admin'
AND id NOT IN (SELECT admin_id FROM public.admin_profiles);
```

## 📞 Support

If you encounter issues:
1. Check the Supabase logs for trigger execution
2. Verify RLS policies are not blocking inserts
3. Ensure the `update_timestamp()` function exists
4. Test with a fresh admin signup

---

**Deployment Date**: _________________

**Deployed By**: _________________

**Verified By**: _________________
