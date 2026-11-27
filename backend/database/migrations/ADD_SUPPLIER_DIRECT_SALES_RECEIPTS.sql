-- Let suppliers record direct sales to walk-in and other outside-chain
-- customers, issue a receipt/invoice, and deduct their own available stock.
-- Run after LINK_SUPPLIER_QUOTE_LINES_TO_OWN_INVENTORY.sql and, when used,
-- ADD_SUPPLIER_CATALOG_BATCH_EXPIRY.sql. Safe to run more than once.

ALTER TABLE public.supplier_catalog_items
  ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_catalog_items
  ALTER COLUMN stock_quantity TYPE NUMERIC(14, 3)
  USING stock_quantity::NUMERIC(14, 3);

CREATE TABLE IF NOT EXISTS public.supplier_direct_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_user_id UUID NOT NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL DEFAULT 'Walk-in customer',
  customer_phone TEXT,
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  subtotal NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0),
  total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance_due >= 0),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_direct_sales_owner_date
  ON public.supplier_direct_sales (supplier_user_id, created_at DESC);

ALTER TABLE public.supplier_direct_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_direct_sales_read_own ON public.supplier_direct_sales;
CREATE POLICY supplier_direct_sales_read_own
  ON public.supplier_direct_sales FOR SELECT TO authenticated
  USING (supplier_user_id = auth.uid());
GRANT SELECT ON public.supplier_direct_sales TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.supplier_direct_sales FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_supplier_direct_sale_v1(
  p_items JSONB,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_amount_paid NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_item_id UUID;
  v_quantity NUMERIC(14, 3);
  v_stock NUMERIC(14, 3);
  v_batches_exist BOOLEAN;
  v_batches_available NUMERIC(14, 3);
  v_remaining NUMERIC(14, 3);
  v_batch RECORD;
  v_name TEXT;
  v_price NUMERIC(14, 2);
  v_line_total NUMERIC(14, 2);
  v_subtotal NUMERIC(14, 2) := 0;
  v_sale_items JSONB := '[]'::JSONB;
  v_line JSONB;
  v_sale_id UUID := gen_random_uuid();
  v_receipt_number TEXT;
  v_paid NUMERIC(14, 2);
  v_balance NUMERIC(14, 2);
  v_status TEXT;
  v_method TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to create a supplier receipt'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Add sale items';
  END IF;
  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 80 THEN
    RAISE EXCEPTION 'Add between 1 and 80 sale items';
  END IF;

  SELECT u.id INTO v_user_id
  FROM public.users u
  WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
  ORDER BY CASE WHEN u.auth_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;

  v_method := lower(trim(COALESCE(p_payment_method, 'cash')));
  IF v_method NOT IN ('cash', 'mobile money', 'bank transfer', 'credit') THEN
    RAISE EXCEPTION 'Choose a valid payment method';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_item_id := (v_line->>'productId')::UUID;
      v_quantity := (v_line->>'quantity')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'A sale item is missing a valid product or quantity';
    END;
    IF v_quantity IS NULL OR NOT (v_quantity > 0 AND v_quantity <= 1000000) THEN
      RAISE EXCEPTION 'Sale quantities must be greater than zero';
    END IF;

    SELECT i.name, round(i.price_per_unit::NUMERIC, 2), i.stock_quantity
      INTO v_name, v_price, v_stock
    FROM public.supplier_catalog_items i
    WHERE i.id = v_item_id
      AND i.is_available IS TRUE
      AND i.supplier_user_id IN (auth.uid(), v_user_id)
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A product is unavailable or does not belong to this supplier'; END IF;
    IF v_price IS NULL OR v_price < 0 THEN RAISE EXCEPTION 'A product has no valid selling price'; END IF;

    v_batches_exist := FALSE;
    IF to_regclass('public.supplier_catalog_batches') IS NOT NULL THEN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.supplier_catalog_batches WHERE catalog_item_id = $1)'
        INTO v_batches_exist USING v_item_id;
    END IF;
    IF v_batches_exist THEN
      EXECUTE 'SELECT COALESCE(SUM(quantity), 0) FROM public.supplier_catalog_batches
               WHERE catalog_item_id = $1 AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)'
        INTO v_batches_available USING v_item_id;
      IF v_batches_available < v_quantity THEN
        RAISE EXCEPTION 'Not enough unexpired stock for % (available: %)', v_name, v_batches_available;
      END IF;

      v_remaining := v_quantity;
      FOR v_batch IN EXECUTE
        'SELECT id, quantity FROM public.supplier_catalog_batches
         WHERE catalog_item_id = $1 AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE) AND quantity > 0
         ORDER BY expiry_date NULLS LAST, created_at, id FOR UPDATE'
        USING v_item_id
      LOOP
        EXIT WHEN v_remaining <= 0;
        IF v_batch.quantity >= v_remaining THEN
          EXECUTE 'UPDATE public.supplier_catalog_batches SET quantity = quantity - $1, updated_at = now() WHERE id = $2'
            USING v_remaining, v_batch.id;
          v_remaining := 0;
        ELSE
          v_remaining := v_remaining - v_batch.quantity;
          EXECUTE 'UPDATE public.supplier_catalog_batches SET quantity = 0, updated_at = now() WHERE id = $1'
            USING v_batch.id;
        END IF;
      END LOOP;
    ELSE
      IF COALESCE(v_stock, 0) < v_quantity THEN
        RAISE EXCEPTION 'Not enough stock for % (available: %)', v_name, COALESCE(v_stock, 0);
      END IF;
    END IF;

    UPDATE public.supplier_catalog_items
    SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - v_quantity, 0)
    WHERE id = v_item_id;

    v_line_total := round(v_price * v_quantity, 2);
    v_subtotal := v_subtotal + v_line_total;
    v_sale_items := v_sale_items || jsonb_build_array(jsonb_build_object(
      'productId', v_item_id, 'name', v_name, 'quantity', v_quantity,
      'price', v_price, 'line_total', v_line_total
    ));
  END LOOP;

  v_paid := round(COALESCE(p_amount_paid, 0), 2);
  IF NOT (v_paid >= 0 AND v_paid <= v_subtotal) THEN RAISE EXCEPTION 'Amount paid must be between zero and the sale total'; END IF;
  v_balance := v_subtotal - v_paid;
  v_status := CASE WHEN v_balance = 0 THEN 'paid' WHEN v_paid = 0 THEN 'unpaid' ELSE 'partial' END;
  v_receipt_number := 'SUP-' || to_char(now() AT TIME ZONE 'Africa/Kampala', 'YYYYMMDD')
    || '-' || upper(substr(replace(v_sale_id::TEXT, '-', ''), 1, 8));

  INSERT INTO public.supplier_direct_sales (
    id, supplier_user_id, receipt_number, customer_name, customer_phone, items,
    subtotal, total_amount, amount_paid, balance_due, payment_status, payment_method
  ) VALUES (
    v_sale_id, auth.uid(), v_receipt_number,
    COALESCE(NULLIF(left(trim(p_customer_name), 120), ''), 'Walk-in customer'),
    NULLIF(left(trim(COALESCE(p_customer_phone, '')), 40), ''), v_sale_items,
    v_subtotal, v_subtotal, v_paid, v_balance, v_status, v_method
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'sale', jsonb_build_object(
      'id', v_sale_id, 'receipt_number', v_receipt_number,
      'customer_name', COALESCE(NULLIF(left(trim(p_customer_name), 120), ''), 'Walk-in customer'),
      'customer_phone', NULLIF(left(trim(COALESCE(p_customer_phone, '')), 40), ''),
      'items', v_sale_items, 'subtotal', v_subtotal, 'total_amount', v_subtotal,
      'amount_paid', v_paid, 'balance_due', v_balance, 'payment_status', v_status,
      'payment_method', v_method, 'created_at', now()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_supplier_direct_sale_v1(JSONB, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_supplier_direct_sale_v1(JSONB, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
