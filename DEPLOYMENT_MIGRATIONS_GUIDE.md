# 🚀 Database Migration Deployment Guide

All missing SQL migrations are ready to deploy to Supabase. Follow these steps:

## 📋 Migrations to Deploy (In Order)

1. **CREATE_MISSING_TABLES.sql** - Creates 5 new tables
   - `sales_transactions` - POS sales tracking
   - `transactions` - Generic transactions
   - `products_inventory` - Inventory by supermarket
   - `transaction_items` - Line items in transactions
   - `supplier_orders` - Supplier order tracking

2. **ADD_PRODUCTS_COLUMNS.sql** - Fixes products table
   - Adds: `quantity`, `is_active`, `category`, `selling_price`, `price`, `sku`

3. **ADD_SUPPLIERS_COLUMNS.sql** - Fixes suppliers table
   - Adds: `status`, `email`, `phone`, `address`, `city`, `contact_person`

4. **ADD_PURCHASE_ORDERS_COLUMNS.sql** - Fixes purchase_orders table
   - Adds: `total_amount_ugx`, `po_number`, `supplier_id`, `status`, `items`

5. **ADD_SUPPLIER_TABLES.sql** - Creates supplier-related tables
   - `supplier_profiles` - Supplier profile data with status
   - `supplier_deliveries` - Delivery tracking
   - `supplier_invoices` - Invoice tracking

## 🌐 How to Deploy to Supabase

### Option 1: Manual via SQL Editor (Recommended)
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** → **New Query**
4. Copy the entire content from each SQL file (in order above)
5. Paste into the query editor
6. Click **Run**
7. Repeat for all 5 files

### Option 2: Command Line Script
Run this command to check and deploy:
```bash
cd C:\Users\MACROS\Desktop\fare\Faredeal-main\backend
node deploy-all-migrations.js
```

## ✅ After Deployment

1. **Hard refresh browser:** Ctrl+Shift+R
2. **Log in** with username: `Aban123`
3. **Verify:** No more 404 or 42703 errors in console
4. **Test dashboard:** All panels should load with data

## 📁 File Locations

All SQL files are in:
```
backend/database/migrations/
├── CREATE_MISSING_TABLES.sql
├── ADD_PRODUCTS_COLUMNS.sql
├── ADD_SUPPLIERS_COLUMNS.sql
├── ADD_PURCHASE_ORDERS_COLUMNS.sql
└── ADD_SUPPLIER_TABLES.sql
```

## 🔍 Troubleshooting

**Error: "table already exists"**
- This is fine - we use `IF NOT EXISTS`, so it won't cause issues

**Error: "column already exists"**
- Also fine - we use `IF NOT EXISTS` for columns too

**Still getting 404 errors after deployment?**
- Make sure you ran ALL 5 migration files
- Check Supabase SQL Editor history to confirm execution
- Refresh browser cache (Ctrl+Shift+R)

**Need to verify tables exist?**
```bash
node check-tables.js
```

---
**Current Status:** ✅ All migrations ready to deploy
**Next Step:** Run migrations in Supabase SQL Editor
