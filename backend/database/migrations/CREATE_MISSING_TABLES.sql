-- Create missing tables for dashboard functionality

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

GRANT ALL PRIVILEGES ON TABLE public.sales_transactions TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.transactions TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.products_inventory TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.transaction_items TO authenticated, anon;
GRANT ALL PRIVILEGES ON TABLE public.supplier_orders TO authenticated, anon;

GRANT USAGE ON SCHEMA public TO authenticated, anon;
