# Supabase Database Setup & Troubleshooting Guide

## Current Issues & Solutions

### Issue 1: JSX Attribute Warning ✅ FIXED
**Problem**: "Received `true` for a non-boolean attribute `jsx`"
**Solution**: Removed `jsx` attribute from `<style>` tag in AdminPortal.jsx (line 6947)
**File**: `frontend/src/pages/AdminPortal.jsx`

---

### Issue 2: Missing `tax_rate` Column in Products Table
**Problem**: `column products.tax_rate does not exist`
**Solution**: Created new migration file to add products and inventory tables
**Files Created**:
- `backend/database/migrations/CREATE_PRODUCTS_INVENTORY_TABLES.sql`

**Action Required**: Run this SQL in Supabase SQL Editor:
```sql
-- Copy content from: backend/database/migrations/CREATE_PRODUCTS_INVENTORY_TABLES.sql
-- Paste and run in your Supabase dashboard SQL Editor
```

---

### Issue 3: 400 Bad Request on Inventory Queries
**Problem**: `GET /rest/v1/inventory 400 Bad Request`
**Cause**: Inventory table doesn't exist or has wrong schema
**Solution**: Run the CREATE_PRODUCTS_INVENTORY_TABLES.sql migration

---

### Issue 4: Users Not Being Created in Supabase
**Problem**: Admin signup form doesn't create users in database (status message: "no user created")
**Symptoms**:
- Auth user is created (Supabase auth works)
- But database record is not inserted
- Likely RLS policy issue

**Solutions**:

#### Step 1: Check & Fix RLS Policies
Run this SQL in Supabase SQL Editor:
```sql
-- Copy content from: backend/database/migrations/FIX_RLS_USER_CREATION.sql
-- Paste and run in your Supabase dashboard SQL Editor
```

#### Step 2: Verify the Application Migrations
1. **Run COMPLETE_DATABASE_SETUP.sql** first (users table setup)
2. **Run CREATE_PRODUCTS_INVENTORY_TABLES.sql** second (products/inventory setup)
3. **Run FIX_RLS_USER_CREATION.sql** third (fix RLS policies)

#### Step 3: Test User Creation
1. Go to your Admin Auth page
2. Fill in the form:
   - Full Name: Test Admin
   - Email: testadmin@faredeal.ug
   - Password: SecurePassword123!
3. Click "Create Admin Account"
4. Check the browser console for logs:
   - Should see: "📝 Creating user record with admin role..."
   - Should see: "✅ User record created with role=admin"

#### Step 4: Verify in Supabase
1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Run: `SELECT id, email, role, is_active FROM users;`
4. You should see your test admin user

---

## Database Schema Overview

### Tables Created:

**1. users** (already exists)
- Columns: id, email, full_name, phone, role, is_active, auth_id, created_at, etc.

**2. categories**
- id (UUID, Primary Key)
- name (VARCHAR, UNIQUE)
- is_active (BOOLEAN)

**3. products**
- id (UUID, Primary Key)
- sku, name, barcode
- category_id (FK to categories)
- cost_price, selling_price
- **tax_rate** (DECIMAL) ← This was missing
- is_active

**4. suppliers**
- id, supplier_id (FK to users)
- company_name, contact_email, contact_phone

**5. inventory**
- id, product_id (FK to products, UNIQUE)
- current_stock, reserved_stock
- minimum_stock, reorder_point
- last_stocktake_date, last_restock_date

**6. stock_movements** (audit log)
- id, product_id, movement_type
- quantity, reference_id
- created_by, created_at

**7. orders**
- id, order_number (UNIQUE)
- customer_id, supplier_id
- total_amount, tax_amount, discount_amount
- payment_status, delivery_status

**8. order_items**
- id, order_id, product_id
- quantity, unit_price, tax_rate

---

## Migration Order (IMPORTANT!)

Run these in order:

1. **COMPLETE_DATABASE_SETUP.sql** ← Users table (already run)
2. **CREATE_PRODUCTS_INVENTORY_TABLES.sql** ← Products, inventory, orders tables
3. **FIX_RLS_USER_CREATION.sql** ← Fix RLS policies for signup

---

## Running Migrations in Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project: "faredeal"
3. Click "SQL Editor" in left sidebar
4. Click "New Query"
5. Copy-paste the SQL content
6. Click "Run" (or Ctrl+Enter)
7. Wait for "Query Executed Successfully"
8. Repeat for each migration file

---

## Troubleshooting Checklist

- [ ] All 3 migration files have been run in order
- [ ] Products table has tax_rate column
- [ ] Inventory table exists with correct schema
- [ ] RLS policies allow anonymous/authenticated inserts
- [ ] Test admin user created successfully
- [ ] User can see products in inventory
- [ ] No "column does not exist" errors in console

---

## Quick Test Script

Run in backend directory:
```bash
node verify-database.js
```

This will check if all tables exist and are accessible.

---

## Files Modified

1. ✅ `frontend/src/pages/AdminPortal.jsx` - Fixed JSX attribute warning
2. ✅ `frontend/src/pages/AdminAuth.jsx` - Removed 'status' column reference

## Files Created

1. ✅ `backend/database/migrations/CREATE_PRODUCTS_INVENTORY_TABLES.sql`
2. ✅ `backend/database/migrations/FIX_RLS_USER_CREATION.sql`
3. ✅ `backend/verify-database.js`

---

## Next Steps

1. Run the migration SQL files in Supabase
2. Test admin signup
3. Verify users are created in database
4. Check that products and inventory load correctly

Need help? Check the console logs in browser DevTools (F12) for detailed error messages.
