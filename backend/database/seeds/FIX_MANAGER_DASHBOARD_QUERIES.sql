-- ============================================================================
-- FIX: ManagerPortal dashboard/reports queries failing with 400s
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) purchase_orders.payment_status / balance_due_ugx don't exist yet
--    (42703 column does not exist) — needed for the payment-issues stat card.
-- ----------------------------------------------------------------------------
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
  ADD COLUMN IF NOT EXISTS balance_due_ugx DECIMAL(15,2) DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 2) transaction_items didn't exist at all (relation does not exist) —
--    every query embedding products(name) was failing because there was no
--    table to resolve the relationship against. Create it.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  transaction_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON public.transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_created ON public.transaction_items(created_at);

ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own supermarket transaction items" ON public.transaction_items;
CREATE POLICY "Users can read own supermarket transaction items" ON public.transaction_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      JOIN public.users u ON u.supermarket_id = t.supermarket_id
      WHERE t.id = transaction_items.transaction_id AND u.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can insert own supermarket transaction items" ON public.transaction_items;
CREATE POLICY "Staff can insert own supermarket transaction items" ON public.transaction_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      JOIN public.users u ON u.supermarket_id = t.supermarket_id
      WHERE t.id = transaction_items.transaction_id
      AND u.auth_id = auth.uid()
      AND u.role IN ('admin', 'manager', 'cashier')
    )
  );

GRANT ALL PRIVILEGES ON TABLE public.transaction_items TO authenticated;

-- Ensure the columns exist even if some other process already created this
-- table with a different shape before this script ran.
ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS quantity INTEGER,
  ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'transaction_items'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'product_id'
  ) THEN
    ALTER TABLE public.transaction_items
      ADD CONSTRAINT transaction_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added transaction_items.product_id -> products.id foreign key';
  ELSE
    RAISE NOTICE '✓ transaction_items.product_id foreign key already exists';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Note: the separate "sales_transactions ... 404" errors were fixed in code,
-- not here — ManagerPortal.jsx had 4 queries against a sales_transactions
-- table that was never created; the real, already-working table is
-- `transactions` (same cashier_id/total_amount/items columns), so those
-- queries were repointed to it instead of creating a duplicate table.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '✅ purchase_orders.payment_status / balance_due_ugx ready.';
  RAISE NOTICE '✅ transaction_items -> products relationship ready for embedded queries.';
END $$;
