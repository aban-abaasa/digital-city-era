-- Quality / grade label on product batches.
--
-- Lets a store admin record different qualities of the same product (e.g.
-- "Grade A", "Premium", "Standard", "Imported") as separate batches, each with
-- its own expiry date. A batch with no quality keeps behaving exactly as before.
--
-- Notes
--   * Batch numbers stay unique per product, regardless of quality.
--   * Stock is still one number per product, so "remaining" per batch remains an
--     estimate (oldest expiry sold first) across all qualities of the product.
--   * products.expiry_date still follows the batch that will be sold first.
--
-- Additive and safe to run more than once. Run after
-- ADD_PRODUCT_BATCH_EXPIRY_TRACKING.sql.

DO $$
BEGIN
  IF to_regprocedure('public.product_batch_overview(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Run ADD_PRODUCT_BATCH_EXPIRY_TRACKING.sql first';
  END IF;
END $$;

ALTER TABLE public.product_inventory_batches
  ADD COLUMN IF NOT EXISTS quality TEXT;

-- --------------------------------------------------------------------------
-- product_batch_overview: now also returns the quality label.
-- (Return type changes, so the function has to be dropped and recreated.)
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
  quality TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH b AS (
    SELECT
      pb.id, pb.product_id, pb.batch_number, pb.expiry_date, pb.current_stock,
      pb.status, pb.created_at, pb.quality,
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
    b.quality
  FROM b
  ORDER BY b.product_id, b.expiry_date, b.created_at;
$$;

REVOKE ALL ON FUNCTION public.product_batch_overview(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.product_batch_overview(UUID, UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- add_product_batch: optional quality. The old 5-argument version is dropped so
-- the call stays unambiguous; existing callers that omit p_quality still work.
-- --------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_product_batch(UUID, TEXT, DATE, NUMERIC, BOOLEAN);

CREATE FUNCTION public.add_product_batch(
  p_product_id UUID,
  p_batch_number TEXT,
  p_expiry_date DATE,
  p_quantity NUMERIC,
  p_add_to_stock BOOLEAN DEFAULT TRUE,
  p_quality TEXT DEFAULT NULL
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

  INSERT INTO public.product_inventory_batches
    (product_id, supermarket_id, batch_number, expiry_date, current_stock, quality, created_by)
  VALUES
    (p_product_id, v_product.supermarket_id, btrim(p_batch_number), p_expiry_date, p_quantity,
     NULLIF(btrim(COALESCE(p_quality, '')), ''), auth.uid())
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

REVOKE ALL ON FUNCTION public.add_product_batch(UUID, TEXT, DATE, NUMERIC, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_product_batch(UUID, TEXT, DATE, NUMERIC, BOOLEAN, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ Batch quality installed (product_inventory_batches.quality).';
END $$;
