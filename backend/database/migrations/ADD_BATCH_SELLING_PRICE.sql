-- Sell batches as separate items at their own price.
--
-- Each batch (e.g. "Grade A" vs "Standard" of the same product) can carry its
-- own selling price. The cashier then lists every sellable batch of a product
-- as a choice, and a sale of a batch takes units off that batch.
--
--   * product_inventory_batches.selling_price already exists; a NULL price means
--     "use the product's price".
--   * product_batch_overview() now also returns selling_price.
--   * add_product_batch() takes an optional p_selling_price.
--   * record_batch_sale() takes units off the batches named in a sale. It skips
--     pharmacy batch_controlled products, whose batches the sale trigger
--     (deduct_inventory_on_transaction) already deducts. Product stock is still
--     deducted by the normal sale path, so totals stay consistent.
--   * Only a store admin can change a batch's selling price.
--
-- Additive and safe to run more than once. Run after ADD_BATCH_QUALITY.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_inventory_batches' AND column_name = 'quality'
  ) THEN
    RAISE EXCEPTION 'Run ADD_BATCH_QUALITY.sql first';
  END IF;
END $$;

ALTER TABLE public.product_inventory_batches
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC(15,2);

-- --------------------------------------------------------------------------
-- product_batch_overview: now also returns selling_price.
-- --------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.product_batch_overview(UUID, UUID);

CREATE FUNCTION public.product_batch_overview(
  p_supermarket_id UUID,
  p_product_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  batch_number TEXT,
  expiry_date DATE,
  batch_stock NUMERIC,
  remaining NUMERIC,
  status TEXT,
  exact BOOLEAN,
  quality TEXT,
  selling_price NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH b AS (
    SELECT
      pb.id, pb.product_id, pb.batch_number, pb.expiry_date, pb.current_stock,
      pb.status, pb.created_at, pb.quality, pb.selling_price,
      COALESCE(p.inventory_mode = 'batch_controlled', FALSE) AS is_exact,
      COALESCE(i.current_stock, 0) AS product_stock,
      -- Units held by batches that are SELLING LATER than this one.
      COALESCE(SUM(CASE WHEN pb.status = 'active' THEN pb.current_stock ELSE 0 END) OVER (
        PARTITION BY pb.product_id
        ORDER BY pb.expiry_date DESC, pb.created_at DESC, pb.id DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ), 0) AS later_units
    FROM public.product_inventory_batches pb
    JOIN public.products p ON p.id = pb.product_id
    LEFT JOIN public.inventory i
      ON i.product_id = pb.product_id AND i.supermarket_id = pb.supermarket_id
    WHERE pb.supermarket_id = p_supermarket_id
      AND (p_product_id IS NULL OR pb.product_id = p_product_id)
  )
  SELECT
    b.id, b.product_id, b.batch_number, b.expiry_date, b.current_stock,
    CASE
      WHEN b.status <> 'active' THEN 0
      WHEN b.is_exact THEN b.current_stock
      ELSE GREATEST(LEAST(b.current_stock, b.product_stock - b.later_units), 0)
    END AS remaining,
    b.status,
    b.is_exact,
    b.quality,
    b.selling_price
  FROM b
  ORDER BY b.product_id, b.expiry_date, b.created_at;
$$;

REVOKE ALL ON FUNCTION public.product_batch_overview(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.product_batch_overview(UUID, UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- add_product_batch: optional selling price.
-- --------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_product_batch(UUID, TEXT, DATE, NUMERIC, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.add_product_batch(UUID, TEXT, DATE, NUMERIC, BOOLEAN, TEXT, NUMERIC);

CREATE FUNCTION public.add_product_batch(
  p_product_id UUID,
  p_batch_number TEXT,
  p_expiry_date DATE,
  p_quantity NUMERIC,
  p_add_to_stock BOOLEAN DEFAULT TRUE,
  p_quality TEXT DEFAULT NULL,
  p_selling_price NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_id UUID;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  IF NOT public._can_manage_clearance(v_product.supermarket_id) THEN
    RAISE EXCEPTION 'Only this store''s admin can add a batch';
  END IF;
  IF COALESCE(btrim(p_batch_number), '') = '' THEN
    RAISE EXCEPTION 'Enter a batch number';
  END IF;
  IF p_expiry_date IS NULL THEN
    RAISE EXCEPTION 'Enter an expiry date';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity cannot be negative';
  END IF;
  IF p_selling_price IS NOT NULL AND p_selling_price < 0 THEN
    RAISE EXCEPTION 'Price cannot be negative';
  END IF;

  INSERT INTO public.product_inventory_batches
    (product_id, supermarket_id, batch_number, expiry_date, current_stock, quality, selling_price, created_by)
  VALUES
    (p_product_id, v_product.supermarket_id, btrim(p_batch_number), p_expiry_date, p_quantity,
     NULLIF(btrim(COALESCE(p_quality, '')), ''), p_selling_price, auth.uid())
  RETURNING id INTO v_id;

  IF COALESCE(p_add_to_stock, FALSE) AND p_quantity > 0
     AND COALESCE(v_product.inventory_mode, 'stock_controlled') <> 'batch_controlled' THEN
    UPDATE public.inventory
    SET current_stock = current_stock + p_quantity, updated_at = now()
    WHERE product_id = p_product_id AND supermarket_id = v_product.supermarket_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_product_batch(UUID, TEXT, DATE, NUMERIC, BOOLEAN, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_product_batch(UUID, TEXT, DATE, NUMERIC, BOOLEAN, TEXT, NUMERIC) TO authenticated;

-- --------------------------------------------------------------------------
-- Only a store admin may change a batch's selling price.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_batch_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.selling_price IS DISTINCT FROM OLD.selling_price
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public._can_manage_clearance(NEW.supermarket_id) THEN
    RAISE EXCEPTION 'Only this store''s admin can change a batch price';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_batch_price_change ON public.product_inventory_batches;
CREATE TRIGGER trg_guard_batch_price_change
  BEFORE UPDATE ON public.product_inventory_batches
  FOR EACH ROW EXECUTE FUNCTION public.guard_batch_price_change();

-- --------------------------------------------------------------------------
-- record_batch_sale: take sold units off the batches named in a sale.
-- p_items: [{ "batch_id": "...", "quantity": 2 }, ...]. Runs as the caller, so
-- the existing row security on product_inventory_batches applies.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_batch_sale(p_items JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_batch UUID;
  v_qty NUMERIC;
  v_count INTEGER := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_batch := NULLIF(v_item->>'batch_id', '')::UUID;
    v_qty := GREATEST(COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 0), 0);
    IF v_batch IS NULL OR v_qty = 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.product_inventory_batches pb
    SET current_stock = GREATEST(pb.current_stock - v_qty, 0),
        status = CASE
                   WHEN pb.status = 'active' AND pb.current_stock - v_qty <= 0 THEN 'depleted'
                   ELSE pb.status
                 END,
        updated_at = now()
    FROM public.products p
    WHERE pb.id = v_batch
      AND p.id = pb.product_id
      -- pharmacy batch_controlled batches are deducted by the sale trigger
      AND COALESCE(p.inventory_mode, 'stock_controlled') <> 'batch_controlled';

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_batch_sale(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_batch_sale(JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ Batch selling price installed (selling_price / record_batch_sale).';
END $$;
