-- =========================================
-- CATEGORIES TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =========================================
-- SUPPLIERS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  company_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =========================================
-- PRODUCTS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  barcode VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  cost_price DECIMAL(15,2) NOT NULL,
  selling_price DECIMAL(15,2) NOT NULL,
  markup_percentage DECIMAL(5,2),
  tax_rate DECIMAL(5,2) DEFAULT 0,
  weight DECIMAL(8,3),
  dimensions JSONB,
  images JSONB DEFAULT '[]',
  specifications JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  is_service BOOLEAN DEFAULT FALSE,
  track_inventory BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_products_name ON products(name); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =========================================
-- INVENTORY TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE UNIQUE,
  current_stock DECIMAL(12,2) DEFAULT 0,
  reserved_stock DECIMAL(12,2) DEFAULT 0,
  minimum_stock DECIMAL(12,2) DEFAULT 10,
  reorder_point DECIMAL(12,2) DEFAULT 20,
  reorder_quantity DECIMAL(12,2) DEFAULT 100,
  last_stocktake_date TIMESTAMP WITH TIME ZONE,
  last_restock_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =========================================
-- STOCK MOVEMENTS TABLE (Audit Log)
-- =========================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL, -- 'in', 'out', 'adjustment', 'return', 'damage'
  quantity DECIMAL(12,2) NOT NULL,
  reference_id UUID, -- Order ID, Return ID, etc
  reference_type VARCHAR(50), -- 'order', 'return', 'adjustment', etc
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id   ON stock_movements(product_id);    EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at    ON stock_movements(created_at);    EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =========================================
-- ORDERS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  order_type VARCHAR(50) NOT NULL, -- 'purchase', 'sales', 'return'
  total_amount DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  discount_amount DECIMAL(15,2),
  net_amount DECIMAL(15,2),
  payment_method VARCHAR(50), -- 'cash', 'card', 'cheque', 'bank_transfer'
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'partial', 'paid'
  delivery_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'shipped', 'delivered'
  delivery_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_orders_order_number   ON orders(order_number);   EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_orders_customer_id    ON orders(customer_id);    EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_orders_supplier_id    ON orders(supplier_id);    EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON orders(created_at);     EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =========================================
-- ORDER ITEMS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items(order_id);   EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =========================================
-- TRIGGERS FOR UPDATED_AT
-- =========================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_categories_timestamp ON categories;
CREATE TRIGGER trigger_update_categories_timestamp
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_update_products_timestamp ON products;
CREATE TRIGGER trigger_update_products_timestamp
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_update_inventory_timestamp ON inventory;
CREATE TRIGGER trigger_update_inventory_timestamp
BEFORE UPDATE ON inventory
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_update_orders_timestamp ON orders;
CREATE TRIGGER trigger_update_orders_timestamp
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- =========================================
-- ENSURE COLUMNS EXIST BEFORE RLS POLICIES
-- (table may have been created without these columns)
-- =========================================
-- Add ALL columns that any index or trigger references
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active         BOOLEAN       DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sku               VARCHAR(100),
  ADD COLUMN IF NOT EXISTS barcode           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cost_price        DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price     DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supermarket_id    UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS price             DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS category          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS image_url         TEXT,
  ADD COLUMN IF NOT EXISTS unit              TEXT DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS category_id       UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id       UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS model             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS markup_percentage DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS tax_rate          DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight            DECIMAL(8,3),
  ADD COLUMN IF NOT EXISTS dimensions        JSONB,
  ADD COLUMN IF NOT EXISTS images            JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS specifications    JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_service        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS track_inventory   BOOLEAN DEFAULT TRUE;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS description  TEXT;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS contact_email  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_phone  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address        TEXT,
  ADD COLUMN IF NOT EXISTS city           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS company_name   VARCHAR(255);

-- All indexes created inside DO blocks so they NEVER fail regardless of DB state
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_categories_is_active   ON public.categories(is_active);           EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_categories_is_active skipped: %', SQLERRM; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_suppliers_is_active    ON public.suppliers(is_active);             EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_suppliers_is_active skipped: %', SQLERRM;  END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_products_sku           ON public.products(sku);                    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_products_sku skipped: %', SQLERRM;          END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_products_is_active     ON public.products(is_active);              EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_products_is_active skipped: %', SQLERRM;    END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_products_barcode       ON public.products(barcode);                EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_products_barcode skipped: %', SQLERRM;       END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_products_category_id   ON public.products(category_id);            EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_products_category_id skipped: %', SQLERRM;  END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_products_supplier_id   ON public.products(supplier_id);            EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_products_supplier_id skipped: %', SQLERRM;  END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_products_supermarket   ON public.products(supermarket_id);         EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_products_supermarket skipped: %', SQLERRM;  END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS current_stock     DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_stock    DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_stock     DECIMAL(12,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS reorder_point     DECIMAL(12,2) DEFAULT 20,
  ADD COLUMN IF NOT EXISTS reorder_quantity  DECIMAL(12,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS supermarket_id    UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS last_restocked_at TIMESTAMPTZ;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_inventory_current_stock ON public.inventory(current_stock); EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idx_inventory_current_stock skipped: %', SQLERRM; END $$;

-- Drop old unique constraint on product_id alone so multiple supermarkets can stock same product
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_product_id_key'
      AND conrelid = 'public.inventory'::regclass
  ) THEN
    ALTER TABLE public.inventory DROP CONSTRAINT inventory_product_id_key;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_product_supermarket_key
  ON public.inventory(product_id, supermarket_id);

-- =========================================
-- ROW LEVEL SECURITY POLICIES
-- =========================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read products (POS + MyBodaGuy)
DROP POLICY IF EXISTS "Public can read products" ON products;
CREATE POLICY "Public can read products"
  ON products FOR SELECT TO anon, authenticated
  USING (TRUE);

-- Authenticated users can read categories
DROP POLICY IF EXISTS "Users can read categories" ON categories;
CREATE POLICY "Users can read categories"
  ON categories FOR SELECT TO anon, authenticated
  USING (TRUE);

-- Admin/manager can manage products (write access)
DROP POLICY IF EXISTS "Admin can manage products" ON products;
CREATE POLICY "Admin can manage products"
  ON products FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

-- Admin/manager can manage inventory
DROP POLICY IF EXISTS "Admin can manage inventory" ON inventory;
CREATE POLICY "Admin can manage inventory"
  ON inventory FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

-- =========================================
-- ADD FOREIGN KEY CONSTRAINTS (idempotent)
-- =========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ser_id'
  ) THEN
    ALTER TABLE suppliers
      ADD CONSTRAINT ser_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;


-- =========================================
-- PURCHASE ORDERS TABLE (manager → supplier)
-- =========================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id  UUID        REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  manager_id      UUID,                        -- auth.uid() of manager who placed order
  supplier_id     UUID,                        -- auth.uid() of supplier
  supplier_name   TEXT,
  po_number       TEXT,
  status          TEXT        DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval','sent_to_supplier','approved','confirmed','received','cancelled')),
  items           JSONB       DEFAULT '[]',    -- [{product_id, name, qty, unit_price}]
  subtotal        DECIMAL(15,2) DEFAULT 0,
  tax_rate        DECIMAL(5,2)  DEFAULT 18,
  tax_amount      DECIMAL(15,2) DEFAULT 0,
  total_amount    DECIMAL(15,2) DEFAULT 0,
  notes           TEXT,
  ordered_at      TIMESTAMPTZ DEFAULT now(),
  approved_at     TIMESTAMPTZ,                 -- set when supplier approves
  confirmed_at    TIMESTAMPTZ,                 -- set when manager confirms receipt
  received_at     TIMESTAMPTZ,                 -- triggers inventory update
  expected_delivery_date TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Idempotent column additions if table already existed from MULTI_TENANT_PLATFORM.sql
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS supermarket_id  UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS manager_id      UUID,
  ADD COLUMN IF NOT EXISTS supplier_id     UUID,
  ADD COLUMN IF NOT EXISTS supplier_name   TEXT,
  ADD COLUMN IF NOT EXISTS po_number       TEXT,
  ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS items           JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS subtotal        DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate        DECIMAL(5,2)  DEFAULT 18,
  ADD COLUMN IF NOT EXISTS tax_amount      DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount    DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS ordered_at      TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supermarket ON public.purchase_orders(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier    ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status      ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created     ON public.purchase_orders(created_at);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "po_authenticated_access" ON public.purchase_orders;
CREATE POLICY "po_authenticated_access" ON public.purchase_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================
-- TRIGGER: auto-update inventory when PO status → 'received'
-- =========================================
CREATE OR REPLACE FUNCTION public.update_inventory_on_po_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item       JSONB;
  v_product_id UUID;
  v_qty        INTEGER;
BEGIN
  IF NEW.status = 'received' AND (OLD.status IS DISTINCT FROM 'received') THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'))
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_qty        := COALESCE((v_item->>'quantity')::INTEGER, 0);
      IF v_product_id IS NOT NULL AND v_qty > 0 THEN
        INSERT INTO public.inventory
          (product_id, supermarket_id, current_stock, last_restocked_at, updated_at)
        VALUES
          (v_product_id, NEW.supermarket_id, v_qty, now(), now())
        ON CONFLICT (product_id, supermarket_id)
        DO UPDATE SET
          current_stock     = public.inventory.current_stock + v_qty,
          last_restocked_at = now(),
          updated_at        = now();
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS po_received_update_inventory ON public.purchase_orders;
CREATE TRIGGER po_received_update_inventory
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_inventory_on_po_received();

-- =========================================
-- TRIGGER: auto-deduct inventory on POS sale
-- =========================================
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item       JSONB;
  v_product_id UUID;
  v_qty        INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed' OR TG_OP = 'INSERT') THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'))
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_qty        := COALESCE((v_item->>'quantity')::INTEGER, 1);
      IF v_product_id IS NOT NULL THEN
        UPDATE public.inventory
        SET current_stock = GREATEST(0, current_stock - v_qty),
            updated_at    = now()
        WHERE product_id     = v_product_id
          AND supermarket_id = NEW.supermarket_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- =========================================
-- TRANSACTIONS TABLE (POS sales + history)
-- =========================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id     UUID        REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  cashier_id         UUID,
  cashier_name       TEXT        DEFAULT 'Cashier',
  customer_id        UUID,
  customer_name      TEXT        DEFAULT 'Walk-in Customer',
  customer_phone     TEXT,
  user_id            UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  items              JSONB       DEFAULT '[]',
  items_count        INTEGER     DEFAULT 0,
  subtotal           DECIMAL(12,2) DEFAULT 0,
  tax_amount         DECIMAL(12,2) DEFAULT 0,
  tax_rate           DECIMAL(5,2)  DEFAULT 18,
  total_amount       DECIMAL(12,2) DEFAULT 0,
  amount             DECIMAL(12,2) DEFAULT 0,
  payment_method     TEXT        DEFAULT 'cash',
  payment_reference  TEXT,
  change_given       DECIMAL(12,2) DEFAULT 0,
  receipt_number     TEXT,
  transaction_id     TEXT,
  transaction_type   TEXT,
  status             TEXT        DEFAULT 'completed',
  voided_at          TIMESTAMPTZ,
  void_reason        TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- Idempotent column additions if table already existed with fewer columns
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS supermarket_id    UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cashier_id        UUID,
  ADD COLUMN IF NOT EXISTS cashier_name      TEXT DEFAULT 'Cashier',
  ADD COLUMN IF NOT EXISTS customer_id       UUID,
  ADD COLUMN IF NOT EXISTS customer_name     TEXT DEFAULT 'Walk-in Customer',
  ADD COLUMN IF NOT EXISTS customer_phone    TEXT,
  ADD COLUMN IF NOT EXISTS items             JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS items_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal          DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount        DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate          DECIMAL(5,2)  DEFAULT 18,
  ADD COLUMN IF NOT EXISTS total_amount      DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount            DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method    TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS change_given      DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_number    TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id    TEXT,
  ADD COLUMN IF NOT EXISTS transaction_type  TEXT,
  ADD COLUMN IF NOT EXISTS status            TEXT DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS voided_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason       TEXT,
  ADD COLUMN IF NOT EXISTS notes             TEXT;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transactions_access" ON public.transactions;
CREATE POLICY "transactions_access" ON public.transactions
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_transactions_supermarket ON public.transactions(supermarket_id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_transactions_cashier     ON public.transactions(cashier_id);     EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_transactions_customer    ON public.transactions(customer_id);    EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_transactions_status      ON public.transactions(status);         EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_transactions_created     ON public.transactions(created_at);     EXCEPTION WHEN OTHERS THEN NULL; END $$;

GRANT ALL ON public.transactions TO authenticated, anon;

-- Wire inventory-deduction trigger onto transactions
DROP TRIGGER IF EXISTS transaction_deduct_inventory ON public.transactions;
CREATE TRIGGER transaction_deduct_inventory
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.deduct_inventory_on_transaction();

-- =========================================
-- USERS: missing columns queried by AdminProfile + portal
-- =========================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name      TEXT,
  ADD COLUMN IF NOT EXISTS email          TEXT,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS auth_id        UUID,
  ADD COLUMN IF NOT EXISTS role           TEXT DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS supermarket_id UUID,
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

UPDATE public.users SET auth_id = id WHERE auth_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_key ON public.users(auth_id);

-- =========================================
-- ADMIN ACTIVITY LOG
-- =========================================
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin  ON public.admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON public.admin_activity_log(created_at);
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_log_access" ON public.admin_activity_log;
CREATE POLICY "activity_log_access" ON public.admin_activity_log
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- =========================================
-- SUPPLIER PROFILES
-- =========================================
CREATE TABLE IF NOT EXISTS public.supplier_profiles (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID  REFERENCES public.users(id) ON DELETE CASCADE,
  company_name TEXT,
  contact_name TEXT,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  city         TEXT,
  country      TEXT  DEFAULT 'Uganda',
  categories   JSONB DEFAULT '[]',
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.supplier_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supplier_profiles_access" ON public.supplier_profiles;
CREATE POLICY "supplier_profiles_access" ON public.supplier_profiles
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- =========================================
-- CASHIER SHIFTS
-- =========================================
CREATE TABLE IF NOT EXISTS public.cashier_shifts (
  id             UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id UUID  REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  cashier_id     UUID  REFERENCES public.users(id) ON DELETE CASCADE,
  status         TEXT  DEFAULT 'open' CHECK (status IN ('open','closed')),
  opening_cash   DECIMAL(12,2) DEFAULT 0,
  closing_cash   DECIMAL(12,2),
  total_sales    DECIMAL(12,2) DEFAULT 0,
  opened_at      TIMESTAMPTZ DEFAULT now(),
  closed_at      TIMESTAMPTZ,
  notes          TEXT
);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_status    ON public.cashier_shifts(status);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_cashier   ON public.cashier_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_supermarket ON public.cashier_shifts(supermarket_id);
ALTER TABLE public.cashier_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cashier_shifts_access" ON public.cashier_shifts;
CREATE POLICY "cashier_shifts_access" ON public.cashier_shifts
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON public.admin_activity_log TO authenticated;
GRANT ALL ON public.supplier_profiles  TO authenticated;
GRANT ALL ON public.cashier_shifts     TO authenticated;

-- =========================================
-- SUPERMARKET STAFF (manager / cashier assignments)
-- =========================================
CREATE TABLE IF NOT EXISTS public.supermarket_staff (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT 'staff',
  status         TEXT DEFAULT 'active',
  assigned_by    UUID,
  invited_email  TEXT,
  invited_by     UUID,
  invited_at     TIMESTAMPTZ,
  accepted_at    TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
-- Idempotent column additions for databases where this table already existed
ALTER TABLE public.supermarket_staff
  ADD COLUMN IF NOT EXISTS assigned_by   UUID,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS invited_email TEXT,
  ADD COLUMN IF NOT EXISTS invited_by    UUID,
  ADD COLUMN IF NOT EXISTS invited_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes         TEXT;
-- Drop NOT NULL on any columns that may have been created with that constraint
ALTER TABLE public.supermarket_staff ALTER COLUMN invited_email DROP NOT NULL;
ALTER TABLE public.supermarket_staff ALTER COLUMN invited_by    DROP NOT NULL;
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS supermarket_staff_uniq ON public.supermarket_staff(supermarket_id, user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
ALTER TABLE public.supermarket_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_rw" ON public.supermarket_staff;
CREATE POLICY "staff_rw" ON public.supermarket_staff FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
GRANT ALL ON public.supermarket_staff TO authenticated;

-- =========================================
-- USER APPLICATIONS (supplier / mybodaguy / manager / cashier)
-- =========================================
CREATE TABLE IF NOT EXISTS public.user_applications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id     UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  applicant_name     TEXT NOT NULL,
  applicant_email    TEXT NOT NULL,
  applicant_phone    TEXT,
  application_type   TEXT NOT NULL DEFAULT 'supplier',
  business_name      TEXT,
  business_address   TEXT,
  product_categories JSONB DEFAULT '[]',
  vehicle_type       TEXT,
  license_number     TEXT,
  id_number          TEXT,
  notes              TEXT,
  status             TEXT DEFAULT 'pending',
  reviewed_by        UUID,
  reviewed_at        TIMESTAMPTZ,
  user_id            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT now()
);
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_user_applications_status ON public.user_applications(status); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_user_applications_sm     ON public.user_applications(supermarket_id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
ALTER TABLE public.user_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "applications_rw" ON public.user_applications;
CREATE POLICY "applications_rw" ON public.user_applications FOR ALL TO authenticated, anon USING (TRUE) WITH CHECK (TRUE);
GRANT ALL ON public.user_applications TO authenticated, anon;

-- =========================================
-- SUCCESS MESSAGE
-- =========================================
-- =========================================
-- RPC: get all auth users (joined with public.users profile)
-- SECURITY DEFINER reads auth.users — safe because only authenticated callers
-- =========================================
CREATE OR REPLACE FUNCTION public.get_auth_users_for_admin()
RETURNS TABLE (
  id               UUID,
  email            TEXT,
  phone            TEXT,
  full_name        TEXT,
  role             TEXT,
  is_active        BOOLEAN,
  created_at       TIMESTAMPTZ,
  last_sign_in_at  TIMESTAMPTZ,
  user_meta        JSONB,
  public_user_id   UUID
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    au.id,
    au.email,
    COALESCE(pu.phone, au.phone::TEXT)                                        AS phone,
    COALESCE(
      pu.full_name,
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      split_part(au.email, '@', 1)
    )                                                                         AS full_name,
    COALESCE(pu.role, 'customer')                                             AS role,
    COALESCE(pu.is_active, TRUE)                                              AS is_active,
    au.created_at,
    au.last_sign_in_at,
    au.raw_user_meta_data                                                     AS user_meta,
    pu.id                                                                     AS public_user_id
  FROM auth.users au
  LEFT JOIN public.users pu
         ON pu.auth_id = au.id OR pu.id = au.id
  ORDER BY au.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_auth_users_for_admin() TO authenticated;

-- =========================================
-- BLOCKCHAIN: immutable staff access ledger
-- Every role assignment/revocation is hash-chained
-- =========================================
CREATE TABLE IF NOT EXISTS public.staff_access_ledger (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  block_number    BIGSERIAL   NOT NULL,
  supermarket_id  UUID,
  admin_id        UUID        NOT NULL,
  target_user_id  UUID        NOT NULL,
  action          TEXT        NOT NULL,   -- 'assign_manager', 'assign_cashier', 'revoke', etc.
  previous_hash   TEXT,                   -- hash of previous block (NULL for genesis)
  block_hash      TEXT        NOT NULL,   -- SHA-256 of (previous_hash + payload)
  payload         JSONB,                  -- full audit payload
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.staff_access_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ledger_read" ON public.staff_access_ledger;
CREATE POLICY "ledger_read" ON public.staff_access_ledger FOR SELECT TO authenticated USING (TRUE);
GRANT SELECT ON public.staff_access_ledger TO authenticated;

-- =========================================
-- RPC: assign_staff_with_blockchain
-- Atomically: updates users.role + upserts supermarket_staff + appends signed block
-- =========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.assign_staff_with_blockchain(
  p_supermarket_id  UUID,
  p_admin_id        UUID,
  p_target_auth_id  UUID,   -- auth.users.id of the person being assigned
  p_role            TEXT
) RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_prev_hash  TEXT;
  v_block_hash TEXT;
  v_payload    JSONB;
  v_pub_id     UUID;
BEGIN
  -- Resolve public.users.id (may differ from auth id)
  SELECT id INTO v_pub_id FROM public.users
  WHERE auth_id = p_target_auth_id OR id = p_target_auth_id
  LIMIT 1;

  -- Ensure user row exists
  IF v_pub_id IS NULL THEN
    INSERT INTO public.users (id, auth_id, role, is_active)
    VALUES (p_target_auth_id, p_target_auth_id, p_role, TRUE)
    ON CONFLICT DO NOTHING;
    v_pub_id := p_target_auth_id;
  END IF;

  -- Update role in public.users
  UPDATE public.users
  SET role = p_role, is_active = TRUE, updated_at = now()
  WHERE id = v_pub_id;

  -- Upsert supermarket_staff
  IF p_role IN ('manager', 'cashier', 'staff') THEN
    INSERT INTO public.supermarket_staff (supermarket_id, user_id, role, status, assigned_by)
    VALUES (p_supermarket_id, v_pub_id, p_role, 'active', p_admin_id)
    ON CONFLICT (supermarket_id, user_id)
    DO UPDATE SET role = p_role, status = 'active', assigned_by = p_admin_id, updated_at = now();
  ELSE
    -- Non-staff role (supplier, customer) → remove from staff table if present
    DELETE FROM public.supermarket_staff
    WHERE supermarket_id = p_supermarket_id AND user_id = v_pub_id;
  END IF;

  -- Build blockchain block
  SELECT block_hash INTO v_prev_hash
  FROM public.staff_access_ledger
  ORDER BY block_number DESC LIMIT 1;

  v_payload := jsonb_build_object(
    'supermarket_id', p_supermarket_id,
    'admin_id',       p_admin_id,
    'user_id',        v_pub_id,
    'role',           p_role,
    'ts',             now()
  );

  v_block_hash := encode(
    extensions.digest(
      (COALESCE(v_prev_hash, 'genesis') || v_payload::TEXT)::bytea,
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.staff_access_ledger
    (supermarket_id, admin_id, target_user_id, action, previous_hash, block_hash, payload)
  VALUES
    (p_supermarket_id, p_admin_id, v_pub_id, 'assign_' || p_role, v_prev_hash, v_block_hash, v_payload);

  RETURN v_block_hash;
END;
$$;
GRANT EXECUTE ON FUNCTION public.assign_staff_with_blockchain(UUID, UUID, UUID, TEXT) TO authenticated;

-- =========================================
-- RPC: revoke_staff_with_blockchain
-- Removes role (→ 'customer'), removes from supermarket_staff, appends revoke block
-- =========================================
CREATE OR REPLACE FUNCTION public.revoke_staff_with_blockchain(
  p_supermarket_id  UUID,
  p_admin_id        UUID,
  p_target_auth_id  UUID
) RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_prev_hash  TEXT;
  v_block_hash TEXT;
  v_payload    JSONB;
  v_pub_id     UUID;
  v_old_role   TEXT;
BEGIN
  -- Resolve public user id
  SELECT id, role INTO v_pub_id, v_old_role
  FROM public.users
  WHERE auth_id = p_target_auth_id OR id = p_target_auth_id
  LIMIT 1;

  IF v_pub_id IS NULL THEN
    v_pub_id := p_target_auth_id;
  END IF;

  -- Reset role to customer
  UPDATE public.users
  SET role = 'customer', updated_at = now()
  WHERE id = v_pub_id;

  -- Remove from supermarket_staff
  DELETE FROM public.supermarket_staff
  WHERE supermarket_id = p_supermarket_id AND user_id = v_pub_id;

  -- Build revoke block
  SELECT block_hash INTO v_prev_hash
  FROM public.staff_access_ledger
  ORDER BY block_number DESC LIMIT 1;

  v_payload := jsonb_build_object(
    'supermarket_id', p_supermarket_id,
    'admin_id',       p_admin_id,
    'user_id',        v_pub_id,
    'revoked_role',   COALESCE(v_old_role, 'unknown'),
    'ts',             now()
  );

  v_block_hash := encode(
    extensions.digest(
      (COALESCE(v_prev_hash, 'genesis') || v_payload::TEXT)::bytea,
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.staff_access_ledger
    (supermarket_id, admin_id, target_user_id, action, previous_hash, block_hash, payload)
  VALUES
    (p_supermarket_id, p_admin_id, v_pub_id, 'revoke_' || COALESCE(v_old_role, 'role'), v_prev_hash, v_block_hash, v_payload);

  RETURN v_block_hash;
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_staff_with_blockchain(UUID, UUID, UUID) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ ALL TABLES CREATED/UPDATED!';
  RAISE NOTICE '✅ products: is_active, sku, barcode, supermarket_id added';
  RAISE NOTICE '✅ users: full_name, email, role, auth_id, is_active added';
  RAISE NOTICE '✅ purchase_orders: full workflow ready';
  RAISE NOTICE '✅ admin_activity_log, supplier_profiles, cashier_shifts created';
  RAISE NOTICE '✅ Inventory triggers installed';
  RAISE NOTICE '✅ get_auth_users_for_admin() RPC created';
END $$;
