-- Create missing tables for dashboard functionality
-- Updated: adds full POS + purchase-order workflow + MyBodaGuy customer access

-- =========================================
-- USERS: add columns queried by portal components
-- =========================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name  TEXT,
  ADD COLUMN IF NOT EXISTS email      TEXT,
  ADD COLUMN IF NOT EXISTS phone      TEXT,
  ADD COLUMN IF NOT EXISTS auth_id    UUID;

UPDATE public.users SET auth_id = id WHERE auth_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_key ON public.users(auth_id);

-- =========================================
-- FIX SUPERMARKETS RLS (removes infinite-recursion policy)
-- =========================================
ALTER TABLE public.supermarkets DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supermarket_owner_all"   ON public.supermarkets;
DROP POLICY IF EXISTS "supermarket_public_read" ON public.supermarkets;
DROP POLICY IF EXISTS "supermarket_staff_read"  ON public.supermarkets;
ALTER TABLE public.supermarkets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supermarket_owner_all" ON public.supermarkets
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "supermarket_public_read" ON public.supermarkets
  FOR SELECT TO authenticated USING (status = 'active');

-- 1. sales_transactions table (for POS/sales tracking)
CREATE TABLE IF NOT EXISTS public.sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cashier_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  items JSONB,
  payment_method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sales_transactions_supermarket ON public.sales_transactions(supermarket_id);
CREATE INDEX idx_sales_transactions_created ON public.sales_transactions(created_at);

-- 2. transactions table (generic transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  transaction_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_created ON public.transactions(created_at);

-- 3. products_inventory table (inventory tracking)
CREATE TABLE IF NOT EXISTS public.products_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supermarket_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  last_restocked TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, supermarket_id)
);

CREATE INDEX idx_products_inventory_product ON public.products_inventory(product_id);
CREATE INDEX idx_products_inventory_supermarket ON public.products_inventory(supermarket_id);

-- 4. transaction_items table (items in transactions)
CREATE TABLE IF NOT EXISTS public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  transaction_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transaction_items_transaction ON public.transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_created ON public.transaction_items(created_at);

-- 5. supplier_orders table
CREATE TABLE IF NOT EXISTS public.supplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_supplier_orders_created ON public.supplier_orders(created_at);

-- =========================================
-- TRANSACTIONS: add all POS columns
-- (AdminPortal, cashier POS, MyBodaGuy all read this)
-- =========================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS supermarket_id   UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cashier_id       UUID,
  ADD COLUMN IF NOT EXISTS cashier_name     TEXT DEFAULT 'Cashier',
  ADD COLUMN IF NOT EXISTS customer_id      UUID,   -- mybodaguy customer auth.uid()
  ADD COLUMN IF NOT EXISTS customer_name    TEXT DEFAULT 'Walk-in Customer',
  ADD COLUMN IF NOT EXISTS customer_phone   TEXT,
  ADD COLUMN IF NOT EXISTS items            JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS items_count      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal         DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount       DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate         DECIMAL(5,2)  DEFAULT 18,
  ADD COLUMN IF NOT EXISTS total_amount     DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method   TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS change_given     DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_number   TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id   TEXT,
  ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS voided_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason      TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_supermarket ON public.transactions(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier     ON public.transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer    ON public.transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status      ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created     ON public.transactions(created_at);

-- =========================================
-- ORDERS: customer orders from POS / MyBodaGuy
-- =========================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS supermarket_id  UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS customer_id     UUID,
  ADD COLUMN IF NOT EXISTS customer_name   TEXT DEFAULT 'Walk-in Customer',
  ADD COLUMN IF NOT EXISTS customer_phone  TEXT,
  ADD COLUMN IF NOT EXISTS customer_email  TEXT,
  ADD COLUMN IF NOT EXISTS items           JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS subtotal        DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee    DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount    DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS order_type      TEXT DEFAULT 'in_store',
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS payment_method  TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_status  TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_orders_supermarket ON public.orders(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer    ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created     ON public.orders(created_at);

-- =========================================
-- DEDUCT INVENTORY TRIGGER ON POS TRANSACTION
-- =========================================
DROP TRIGGER IF EXISTS transaction_deduct_inventory ON public.transactions;
CREATE TRIGGER transaction_deduct_inventory
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.deduct_inventory_on_transaction();

-- =========================================
-- GRANTS
-- =========================================
GRANT ALL PRIVILEGES ON TABLE public.sales_transactions  TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.transactions        TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.products_inventory  TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.transaction_items   TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.supplier_orders     TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.orders              TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.purchase_orders     TO authenticated, anon;

GRANT USAGE ON SCHEMA public TO authenticated, anon;
