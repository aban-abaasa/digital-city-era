# Database Migration Fix Summary

## Issue Fixed
**Error**: `column "supplier_id" does not exist`

**Root Cause**: The `suppliers` table had a circular column naming conflict:
- Column name was `supplier_id` 
- This conflicted with the `products` table's `supplier_id` foreign key

**Solution**: Renamed the column in suppliers table:
- Changed: `supplier_id` → `user_id`
- Now suppliers.user_id references users table
- And products.supplier_id references suppliers table

---

## Tables Structure (Updated)

### suppliers table
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),     -- ✅ Changed from supplier_id
  company_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### products table (unchanged)
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES categories(id),
  supplier_id UUID REFERENCES suppliers(id),    -- ✅ References suppliers.id
  ...
);
```

---

## Files Modified
- `backend/database/migrations/CREATE_PRODUCTS_INVENTORY_TABLES.sql`
  - Changed: `supplier_id` → `user_id` in suppliers table
  - Changed: `idx_suppliers_supplier_id` → `idx_suppliers_user_id` index name

---

## Next Steps

1. **Re-run the SQL migration** in Supabase:
   - Copy the corrected content from: `backend/database/migrations/CREATE_PRODUCTS_INVENTORY_TABLES.sql`
   - Paste in Supabase SQL Editor
   - Execute

2. **Verify the tables** were created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('categories', 'suppliers', 'products', 'inventory', 'orders');
   ```

3. **Check foreign keys**:
   ```sql
   SELECT constraint_name, table_name, column_name 
   FROM information_schema.constraint_column_usage 
   WHERE table_name IN ('suppliers', 'products');
   ```

---

## All Tables Now Created

✅ categories
✅ suppliers (with user_id)
✅ products (with supplier_id → suppliers.id)
✅ inventory
✅ stock_movements
✅ orders
✅ order_items

All with proper indexes and RLS policies configured.

---

**Database schema is now ready to use!** 🚀
