# 🔐 CASHIER POS TABLE ACCESS ANALYSIS

## Current Situation

### 1. **Tables Involved**
| Table | Purpose | Current RLS Status |
|-------|---------|-------------------|
| `products` | Product catalog (SKU, price, description) | ✅ Public can read (is_active=TRUE) |
| `inventory` | Stock levels (current_stock, minimum_stock) | ✅ Managers & Admins only |
| `inventory_movements` | Stock audit trail (purchase, sale, adjustment) | ⚠️ Admin only |
| `orders` | POS transactions | ⚠️ Check needed |
| `order_items` | Line items in transactions | ⚠️ Check needed |

### 2. **Current RLS Policies**

#### ✅ Products Table
```sql
CREATE POLICY "Public can read products"
ON products FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);
```
**Status:** ✅ Cashiers CAN read (all authenticated users can)

#### ⚠️ Inventory Table
```sql
CREATE POLICY "Admin can manage inventory"
ON inventory FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM users 
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'manager'))
)
```
**Status:** ⚠️ **PROBLEM** - Cashiers CANNOT read inventory
- Only `admin` and `manager` roles can access
- Cashiers have role=`'cashier'`
- This blocks cashiers from seeing stock levels!

### 3. **What Cashiers Need Access To**

#### For POS Operations:
- ✅ Read `products` → **WORKING** (public read)
- ❌ Read `inventory` → **BLOCKED** (needs fix)
- ❌ Read `inventory.current_stock` → **BLOCKED**
- ❌ Create `order_items` → **Needs verification**
- ❌ Create `orders` (transactions) → **Needs verification**
- ❌ Update `inventory.current_stock` (when sale is made) → **BLOCKED**

### 4. **Current Cashier Portal Code**
```jsx
// Line 249-250 in CushierPortal.jsx
const { data: productsData, error } = await supabase
  .from('products')  // ✅ Works
  .select(`
    *,
    inventory (    // ❌ BLOCKED - Cashier can't read inventory relationship
      quantity
    )
  `)
  .eq('is_active', true)
```

**Issue:** The query tries to select products WITH their inventory relationship, but RLS policy blocks inventory access for cashiers.

### 5. **Data Flow Requirements**

#### For a Cashier Sale:
1. **Load Products** → `SELECT FROM products` ✅ Works
2. **Check Stock** → `SELECT FROM inventory WHERE product_id=?` ❌ BLOCKED
3. **Create Order** → `INSERT INTO orders` ⚠️ Unknown
4. **Create Order Items** → `INSERT INTO order_items` ⚠️ Unknown
5. **Update Stock** → `UPDATE inventory SET current_stock=...` ❌ BLOCKED
6. **Record Payment** → `INSERT INTO payment_transactions` ⚠️ Unknown

---

## What Needs to Be Fixed

### Option A: **Minimal Access** (Recommended for Security)
Give cashiers READ-ONLY access to:
- `inventory.current_stock` (to see what's available)
- `products` (already working)

Do NOT allow cashiers to:
- Update inventory directly
- Delete products
- Modify prices

### Option B: **Full POS Access**
Give cashiers full POS permissions:
- Read products & inventory
- Create orders
- Create order items
- Update inventory (when completing sale)
- Process payments

### Option C: **Hybrid with RPC Functions** (Most Secure)
Create RPC functions that:
- `complete_pos_sale()` - handles entire sale atomically
- Cashier calls function, system handles stock updates internally
- Cashier never directly updates inventory
- Full audit trail preserved

---

## Recommended Solution: **Hybrid Approach (Option C)**

### Step 1: Allow Cashiers to READ Inventory
```sql
-- NEW POLICY: Cashiers can read inventory for their POS operations
CREATE POLICY "Cashiers can read inventory"
ON inventory FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'manager', 'cashier')
  )
);
```

### Step 2: Create RPC Function for Safe Sales
```sql
CREATE FUNCTION complete_pos_sale(
  p_items JSONB,           -- [{product_id, quantity, price}]
  p_payment_method VARCHAR,
  p_amount_paid NUMERIC
)
RETURNS TABLE (
  order_id UUID,
  status VARCHAR,
  message VARCHAR
)
```

This function:
- ✅ Validates stock availability
- ✅ Creates order atomically
- ✅ Updates inventory safely
- ✅ Records payment
- ✅ Prevents cashiers from manually updating inventory
- ✅ Full audit trail

---

## Current Missing Policies

These need to be created:
1. ❌ Cashier READ policy for `inventory`
2. ❌ Cashier READ policy for `orders` (own cash register)
3. ❌ Cashier INSERT policy for `orders`
4. ❌ Cashier INSERT policy for `order_items`
5. ❌ RPC function: `complete_pos_sale()`

---

## Questions to Answer Before Fixing

1. **Should cashiers see all product inventory or just what's available?**
   - All inventory levels? (for transparency)
   - Only stock > 0? (simplified view)

2. **Should cashiers manually adjust stock or use RPC?**
   - Manual updates? (simpler, less secure)
   - RPC function? (more secure, full audit trail)

3. **Multiple cash registers?**
   - Does each cashier have their own register?
   - Should they only see their own sales?

4. **Concurrent sales?**
   - Can stock go negative momentarily?
   - Need to lock inventory during sale?

---

## Next Steps

**Waiting for your confirmation on:**
1. ✅ Confirm cashiers need inventory READ access
2. ✅ Choose between direct updates vs RPC function
3. ✅ Confirm scope (all products or filtered?)
4. ✅ Confirm audit requirements

Once confirmed, I'll implement the complete solution! 🚀
