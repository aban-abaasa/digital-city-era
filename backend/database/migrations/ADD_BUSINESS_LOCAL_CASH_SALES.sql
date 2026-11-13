-- Cash-only sales written to a paired business LAN server are durable on that
-- node first, then arrive here through the existing business sync outbox.
-- Apply after ADD_BUSINESS_LOCAL_STOCK_ADJUSTMENTS.sql.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS cashier_id UUID,
  ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'Cashier',
  ADD COLUMN IF NOT EXISTS register_number TEXT DEFAULT 'POS-001',
  ADD COLUMN IF NOT EXISTS store_location TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT 'Walk-in Customer',
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 18,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS change_given NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transaction_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS amount_paid_ugx NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS balance_due_ugx NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tax_included BOOLEAN NOT NULL DEFAULT true;

-- Local staff IDs only exist on the LAN node; the shared transaction keeps
-- cashier_name and intentionally leaves cloud user/cashier IDs empty.
ALTER TABLE public.transactions
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN cashier_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.sales_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  product_barcode TEXT,
  category_name TEXT,
  unit_price NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(15,2) NOT NULL,
  tax_included BOOLEAN NOT NULL DEFAULT true,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_transaction_items
  ADD COLUMN IF NOT EXISTS tax_included BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales_transaction_items
  ALTER COLUMN quantity TYPE NUMERIC(12,3) USING quantity::NUMERIC;

CREATE TABLE IF NOT EXISTS public.business_local_cash_sale_sync (
  event_id UUID PRIMARY KEY,
  node_id UUID NOT NULL REFERENCES public.business_local_sync_nodes(id) ON DELETE RESTRICT,
  supermarket_id UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE RESTRICT,
  transaction_row_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  client_transaction_id TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supermarket_id, client_transaction_id),
  UNIQUE (supermarket_id, receipt_number)
);

ALTER TABLE public.business_local_cash_sale_sync ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.business_local_cash_sale_sync FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.business_local_cash_sale_sync TO service_role;
CREATE INDEX IF NOT EXISTS idx_business_local_cash_sale_sync_recent
  ON public.business_local_cash_sale_sync(supermarket_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.business_local_apply_cash_sale(
  p_node_id UUID,
  p_event_id UUID,
  p_schema_version INTEGER,
  p_payload JSONB,
  p_occurred_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_node RECORD;
  v_existing RECORD;
  v_transaction_id TEXT := NULLIF(trim(COALESCE(p_payload->>'client_transaction_id', '')), '');
  v_receipt_number TEXT := NULLIF(trim(COALESCE(p_payload->>'receipt_number', '')), '');
  v_cashier TEXT := COALESCE(NULLIF(trim(COALESCE(p_payload->>'cashier_name', '')), ''), 'Local cashier');
  v_register TEXT := COALESCE(NULLIF(trim(COALESCE(p_payload->>'register_number', '')), ''), 'Local Till');
  v_customer TEXT := COALESCE(NULLIF(trim(COALESCE(p_payload->>'customer_name', '')), ''), 'Walk-in Customer');
  v_customer_phone TEXT := NULLIF(trim(COALESCE(p_payload->>'customer_phone', '')), '');
  v_payment_reference TEXT := NULLIF(trim(COALESCE(p_payload->>'payment_reference', '')), '');
  v_items JSONB := p_payload->'items';
  v_cloud_items JSONB := p_payload->'items';
  v_item JSONB;
  v_line RECORD;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_line_tax NUMERIC;
  v_expected_subtotal NUMERIC := 0;
  v_expected_tax NUMERIC := 0;
  v_expected_total NUMERIC := 0;
  v_subtotal NUMERIC;
  v_tax NUMERIC;
  v_total NUMERIC;
  v_amount_paid NUMERIC;
  v_change NUMERIC;
  v_inventory_mode TEXT;
  v_stock NUMERIC;
  v_needed NUMERIC;
  v_transaction_row_id UUID;
  v_index INTEGER;
BEGIN
  IF p_schema_version IS DISTINCT FROM 1 THEN
    RETURN 'Unsupported local cash sale event version.';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object' OR v_transaction_id IS NULL OR length(v_transaction_id) > 100
     OR v_receipt_number IS NULL OR length(v_receipt_number) > 80
     OR p_payload->>'payment_method' IS DISTINCT FROM 'cash'
     OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) NOT BETWEEN 1 AND 100 THEN
    RETURN 'Local cash sale has invalid identity, payment method or items.';
  END IF;
  IF length(v_cashier) > 120 OR length(v_register) > 80 OR length(v_customer) > 255
     OR length(COALESCE(v_customer_phone, '')) > 80 OR length(COALESCE(v_payment_reference, '')) > 120 THEN
    RETURN 'Local cash sale has invalid cashier, customer or register details.';
  END IF;

  SELECT n.business_type, n.business_id INTO v_node
  FROM public.business_local_sync_nodes n
  WHERE n.id = p_node_id AND n.revoked_at IS NULL;
  IF NOT FOUND OR v_node.business_type <> 'supermarket' THEN
    RETURN 'Cash sales can only sync for a server paired to a supermarket.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.business_local_cash_sale_sync WHERE event_id = p_event_id) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_existing
  FROM public.business_local_cash_sale_sync
  WHERE supermarket_id = v_node.business_id
    AND client_transaction_id = v_transaction_id;
  IF FOUND THEN
    RETURN NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.supermarket_id = v_node.business_id
      AND t.transaction_id = v_transaction_id
  ) THEN
    RETURN 'That local transaction ID already belongs to a different sale.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.supermarket_id = v_node.business_id
      AND t.receipt_number = v_receipt_number
  ) THEN
    RETURN 'That local receipt number is already in use.';
  END IF;

  BEGIN
    v_subtotal := round((p_payload->>'subtotal')::NUMERIC, 2);
    v_tax := round((p_payload->>'tax_amount')::NUMERIC, 2);
    v_total := round((p_payload->>'total_amount')::NUMERIC, 2);
    v_amount_paid := round((p_payload->>'amount_paid_ugx')::NUMERIC, 2);
    v_change := round(COALESCE((p_payload->>'change_given')::NUMERIC, 0), 2);
  EXCEPTION WHEN OTHERS THEN
    RETURN 'Local cash sale totals are not valid numbers.';
  END;
  IF v_subtotal IS NULL OR v_tax IS NULL OR v_total IS NULL OR v_amount_paid IS NULL
     OR v_subtotal < 0 OR v_tax < 0 OR v_total <= 0 OR v_amount_paid < v_total
     OR v_change < 0 OR abs(v_change - (v_amount_paid - v_total)) > 0.02 THEN
    RETURN 'Local cash sale must be paid in full and include valid change.';
  END IF;

  FOR v_line IN
    SELECT value, ordinality FROM jsonb_array_elements(v_items) WITH ORDINALITY
  LOOP
    v_item := v_line.value;
    BEGIN
      v_product_id := COALESCE(NULLIF(v_item->>'product_id', ''), NULLIF(v_item->>'id', ''))::UUID;
      v_quantity := (v_item->>'quantity')::NUMERIC;
      v_unit_price := COALESCE(NULLIF(v_item->>'selling_price', '')::NUMERIC, NULLIF(v_item->>'price', '')::NUMERIC);
      v_line_total := (v_item->>'line_total')::NUMERIC;
      v_line_tax := COALESCE((v_item->>'tax_amount')::NUMERIC, 0);
    EXCEPTION WHEN OTHERS THEN
      RETURN 'A local sale line has invalid product, price, quantity or tax details.';
    END;
    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 1000000
       OR v_unit_price IS NULL OR v_unit_price < 0 OR v_line_total IS NULL OR v_line_tax IS NULL
       OR v_line_total < 0 OR v_line_tax < 0
       OR v_line_tax > v_line_total THEN
      RETURN 'A local sale line has invalid product, price, quantity or tax details.';
    END IF;
    v_expected_subtotal := v_expected_subtotal + v_line_total - v_line_tax;
    v_expected_tax := v_expected_tax + v_line_tax;
    v_expected_total := v_expected_total + v_line_total;
  END LOOP;

  v_expected_subtotal := round(v_expected_subtotal, 2);
  v_expected_tax := round(v_expected_tax, 2);
  v_expected_total := round(v_expected_total, 2);
  IF abs(v_subtotal - v_expected_subtotal) > 0.02
     OR abs(v_tax - v_expected_tax) > 0.02
     OR abs(v_total - v_expected_total) > 0.02 THEN
    RETURN 'Local sale item totals do not match its receipt totals.';
  END IF;

  -- Keep a real cash sale even if cloud stock changed while this node was
  -- offline. Stock that can cover the complete line is deducted by the normal
  -- transaction trigger; a short or missing cloud balance is clamped to zero
  -- and left visible in this cash-sale audit trail instead of quarantining the
  -- money the cashier already collected.
  FOR v_line IN
    SELECT value, ordinality FROM jsonb_array_elements(v_cloud_items) WITH ORDINALITY
  LOOP
    v_item := v_line.value;
    v_index := v_line.ordinality::INTEGER - 1;
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;
    SELECT p.inventory_mode INTO v_inventory_mode
    FROM public.products p
    WHERE p.id = v_product_id AND p.supermarket_id = v_node.business_id;
    IF NOT FOUND THEN
      v_cloud_items := jsonb_set(v_cloud_items, ARRAY[v_index::TEXT, 'product_id'], 'null'::JSONB, true);
      CONTINUE;
    END IF;
    IF COALESCE(v_inventory_mode, 'stock_controlled') = 'stock_controlled' THEN
      SELECT i.current_stock INTO v_stock
      FROM public.inventory i
      WHERE i.product_id = v_product_id AND i.supermarket_id = v_node.business_id
      FOR UPDATE;
      SELECT COALESCE(sum((line->>'quantity')::NUMERIC), 0) INTO v_needed
      FROM jsonb_array_elements(v_items) AS requested(line)
      WHERE line->>'product_id' = v_product_id::TEXT OR line->>'id' = v_product_id::TEXT;
      IF NOT FOUND OR v_stock IS NULL OR v_stock < v_needed THEN
        IF v_stock IS NOT NULL THEN
          UPDATE public.inventory
          SET current_stock = 0, updated_at = now()
          WHERE product_id = v_product_id AND supermarket_id = v_node.business_id;
        END IF;
        FOR v_index IN
          SELECT ordinality::INTEGER - 1
          FROM jsonb_array_elements(v_cloud_items) WITH ORDINALITY AS requested(line, ordinality)
          WHERE line->>'product_id' = v_product_id::TEXT OR line->>'id' = v_product_id::TEXT
        LOOP
          v_cloud_items := jsonb_set(v_cloud_items, ARRAY[v_index::TEXT, 'product_id'], 'null'::JSONB, true);
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.transactions (
    supermarket_id, cashier_id, cashier_name, register_number, store_location, user_id, customer_name, customer_phone,
    items, items_count, subtotal, tax_amount, tax_rate, total_amount, amount,
    payment_method, payment_provider, payment_reference, change_given, receipt_number,
    transaction_id, transaction_type, status, created_at, updated_at,
    payment_status, amount_paid_ugx, balance_due_ugx, tax_included
  ) VALUES (
    v_node.business_id, NULL, v_cashier, v_register, 'Business LAN', NULL, v_customer, v_customer_phone,
    v_cloud_items, jsonb_array_length(v_items), v_subtotal, v_tax,
    CASE WHEN v_subtotal > 0 THEN round(v_tax / v_subtotal * 100, 2) ELSE 0 END, v_total, v_total,
    'cash', COALESCE(NULLIF(trim(COALESCE(p_payload->>'payment_provider', '')), ''), 'Cash (UGX)'),
    COALESCE(v_payment_reference, v_transaction_id), v_change, v_receipt_number,
    v_transaction_id, 'sale', 'completed', COALESCE(p_occurred_at, now()), now(),
    'paid', v_amount_paid, 0, COALESCE((p_payload->>'tax_included')::BOOLEAN, true)
  ) RETURNING id INTO v_transaction_row_id;

  FOR v_line IN
    SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_item := v_line.value;
    BEGIN
      v_product_id := COALESCE(NULLIF(v_item->>'product_id', ''), NULLIF(v_item->>'id', ''))::UUID;
      v_quantity := (v_item->>'quantity')::NUMERIC;
      v_unit_price := COALESCE(NULLIF(v_item->>'selling_price', '')::NUMERIC, NULLIF(v_item->>'price', '')::NUMERIC);
      v_line_total := round((v_item->>'line_total')::NUMERIC, 2);
      v_line_tax := round(COALESCE((v_item->>'tax_amount')::NUMERIC, 0), 2);
    EXCEPTION WHEN OTHERS THEN
      RETURN 'A local sale line has invalid product, price, quantity or tax details.';
    END;
    INSERT INTO public.sales_transaction_items (
      transaction_id, product_id, product_name, product_sku, product_barcode,
      category_name, unit_price, quantity, line_total, tax_included, tax_amount, created_at
    ) VALUES (
      v_transaction_row_id,
      CASE WHEN EXISTS (SELECT 1 FROM public.products p WHERE p.id = v_product_id AND p.supermarket_id = v_node.business_id) THEN v_product_id ELSE NULL END,
      left(COALESCE(NULLIF(trim(COALESCE(v_item->>'name', '')), ''), 'Item'), 255),
      NULLIF(left(COALESCE(v_item->>'sku', ''), 100), ''),
      NULLIF(left(COALESCE(v_item->>'barcode', ''), 100), ''),
      left(COALESCE(NULLIF(COALESCE(v_item->>'categoryName', v_item->>'category'), ''), 'General'), 255),
      v_unit_price, v_quantity, v_line_total,
      COALESCE((v_item->>'tax_included')::BOOLEAN, true), v_line_tax,
      COALESCE(p_occurred_at, now())
    );
  END LOOP;

  INSERT INTO public.business_local_cash_sale_sync (
    event_id, node_id, supermarket_id, transaction_row_id, client_transaction_id,
    receipt_number, occurred_at
  ) VALUES (
    p_event_id, p_node_id, v_node.business_id, v_transaction_row_id,
    v_transaction_id, v_receipt_number, COALESCE(p_occurred_at, now())
  );

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN left('Could not apply local cash sale: ' || SQLERRM, 500);
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_apply_cash_sale(UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

-- Extend the live sync dispatcher in place, preserving earlier stock/product
-- branches and any safe local edits to its function body.
DO $$
DECLARE
  r RECORD;
  def TEXT;
  patched TEXT;
  found_any BOOLEAN := false;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'apply_business_local_sync_events' AND n.nspname = 'public'
  LOOP
    found_any := true;
    def := pg_get_functiondef(r.oid);
    IF position('business_local_apply_cash_sale' in def) > 0 THEN
      RAISE NOTICE 'Already handles local cash sales, skipping: %', r.sig;
      CONTINUE;
    END IF;
    patched := regexp_replace(
      def,
      'IF v_event\.event_type\s*=\s*''stock\.adjustment\.v1'' THEN',
      'IF v_event.event_type = ''sale.cash.v1'' THEN
      v_error := public.business_local_apply_cash_sale(v_node.id, v_event.event_id, v_event.schema_version, v_payload, v_event.occurred_at);
    ELSIF v_event.event_type = ''stock.adjustment.v1'' THEN'
    );
    IF patched = def THEN
      patched := regexp_replace(
        def,
        'IF\s+v_event\.event_type\s*<>\s*''team\.message\.v1''',
        'IF v_event.event_type = ''sale.cash.v1'' THEN
      v_error := public.business_local_apply_cash_sale(v_node.id, v_event.event_id, v_event.schema_version, v_payload, v_event.occurred_at);
    ELSIF v_event.event_type <> ''team.message.v1'''
      );
    END IF;
    IF patched = def THEN
      RAISE EXCEPTION 'Could not find a supported cash-sale insertion point in %; the dispatcher was not changed.', r.sig;
    END IF;
    EXECUTE patched;
    RAISE NOTICE 'Now applies local cash sales: %', r.sig;
  END LOOP;
  IF NOT found_any THEN
    RAISE EXCEPTION 'public.apply_business_local_sync_events does not exist; run the earlier business-local migrations first.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
