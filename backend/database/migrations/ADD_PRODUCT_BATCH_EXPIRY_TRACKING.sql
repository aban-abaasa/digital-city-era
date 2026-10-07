-- Batch-level expiry tracking for store products.
--
-- Lets a store admin record the batches of a product (batch number, quantity,
-- expiry date), change a batch's expiry date at any time, and see which batch
-- is about to expire. The product's own expiry_date is kept equal to the
-- expiry of the batch that will be sold first, so everything built on
-- products.expiry_date keeps working unchanged: the near-expiry flags, the
-- "Expiring stock · Reduced prices" panel, and the block on selling expired
-- stock (ADD_PRODUCT_EXPIRY_CLEARANCE_PRICING.sql).
--
-- Design notes
--   * Uses the existing product_inventory_batches table. For pharmacy
--     'batch_controlled' products the till already takes stock off batches
--     (oldest expiry first), so a batch's current_stock is exact.
--   * For every other product the sale path is NOT changed: a batch's
--     current_stock is the quantity received in it, and what is still on the
--     shelf is ESTIMATED by assuming oldest-expiry-first selling, i.e. the
--     product's live stock (inventory.current_stock) is held by the newest
--     batches first. See product_batch_overview(). Add a batch whenever you
--     restock so the estimate stays right.
--   * products.expiry_date follows the earliest batch that still has stock and
--     has not expired. If only expired batches have stock it holds the
--     earliest of those, which keeps the existing block on selling expired
--     stock. When it moves (the oldest batch sold out, or a batch date was
--     edited) the existing clearance guard ends any reduced price published
--     for the old batch and restores the original price.
--   * Only a store admin/owner can change a batch's expiry date; the check
--     reuses _can_manage_clearance() and is enforced in the database.
--   * The sync is wrapped so that it can never make a sale fail.
--
-- Additive and safe to run more than once. Run after
-- ADD_PHARMACY_FLEXIBLE_INVENTORY.sql and ADD_PRODUCT_EXPIRY_CLEARANCE_PRICING.sql.

DO $$
BEGIN
  IF to_regclass('public.product_inventory_batches') IS NULL THEN
    RAISE EXCEPTION 'Run ADD_PHARMACY_FLEXIBLE_INVENTORY.sql first (product_inventory_batches is missing)';
  END IF;
  IF to_regprocedure('public._can_manage_clearance(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Run ADD_PRODUCT_EXPIRY_CLEARANCE_PRICING.sql first (_can_manage_clearance is missing)';
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- product_batch_overview: every batch with its estimated units remaining.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.product_batch_overview(
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
  exact BOOLEAN
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH b AS (
    SELECT
      pb.id, pb.product_id, pb.batch_number, pb.expiry_date, pb.current_stock,
      pb.status, pb.created_at,
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
    b.is_exact
  FROM b
  ORDER BY b.product_id, b.expiry_date, b.created_at;
$$;

REVOKE ALL ON FUNCTION public.product_batch_overview(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.product_batch_overview(UUID, UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- sync_product_expiry_from_batches: point products.expiry_date at the batch
-- that will be sold first.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_product_expiry_from_batches(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supermarket_id UUID;
  v_next DATE;
BEGIN
  SELECT supermarket_id INTO v_supermarket_id FROM public.products WHERE id = p_product_id;
  IF v_supermarket_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(
    MIN(o.expiry_date) FILTER (WHERE o.expiry_date >= CURRENT_DATE),
    MIN(o.expiry_date)
  )
  INTO v_next
  FROM public.product_batch_overview(v_supermarket_id, p_product_id) o
  WHERE o.remaining > 0;

  IF v_next IS NOT NULL THEN
    UPDATE public.products
    SET expiry_date = v_next, updated_at = now()
    WHERE id = p_product_id AND expiry_date IS DISTINCT FROM v_next;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_product_expiry_from_batches(UUID) FROM PUBLIC, anon;

-- Whole-store refresh, called when the admin opens the page, so a batch that
-- passed its date overnight is picked up even if nothing was sold.
CREATE OR REPLACE FUNCTION public.sync_store_batch_expiry(p_supermarket_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product UUID;
  v_count INTEGER := 0;
BEGIN
  IF NOT public._can_manage_clearance(p_supermarket_id) THEN
    RETURN 0;
  END IF;
  FOR v_product IN
    SELECT DISTINCT pb.product_id FROM public.product_inventory_batches pb
    WHERE pb.supermarket_id = p_supermarket_id
  LOOP
    PERFORM public.sync_product_expiry_from_batches(v_product);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_store_batch_expiry(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_store_batch_expiry(UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- Triggers
-- --------------------------------------------------------------------------

-- Only a store admin/owner may move a batch's expiry date.
CREATE OR REPLACE FUNCTION public.guard_batch_expiry_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expiry_date IS DISTINCT FROM OLD.expiry_date
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public._can_manage_clearance(NEW.supermarket_id) THEN
    RAISE EXCEPTION 'Only this store''s admin can change a batch expiry date';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_batch_expiry_change ON public.product_inventory_batches;
CREATE TRIGGER trg_guard_batch_expiry_change
  BEFORE UPDATE ON public.product_inventory_batches
  FOR EACH ROW EXECUTE FUNCTION public.guard_batch_expiry_change();

-- Keep products.expiry_date in step whenever a batch is added, edited or removed.
CREATE OR REPLACE FUNCTION public.trg_sync_expiry_after_batch_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.sync_product_expiry_from_batches(COALESCE(NEW.product_id, OLD.product_id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'batch expiry sync skipped: %', SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_batch_change_sync_expiry ON public.product_inventory_batches;
CREATE TRIGGER trg_batch_change_sync_expiry
  AFTER INSERT OR UPDATE OR DELETE ON public.product_inventory_batches
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_expiry_after_batch_change();

-- A sale that sells out the oldest batch moves the product to the next one.
-- Products without batches are skipped by the EXISTS check, so the checkout
-- path is untouched for them.
CREATE OR REPLACE FUNCTION public.trg_sync_expiry_after_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF EXISTS (SELECT 1 FROM public.product_inventory_batches pb WHERE pb.product_id = NEW.product_id) THEN
      PERFORM public.sync_product_expiry_from_batches(NEW.product_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'batch expiry sync skipped: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_stock_sync_expiry ON public.inventory;
CREATE TRIGGER trg_inventory_stock_sync_expiry
  AFTER UPDATE OF current_stock ON public.inventory
  FOR EACH ROW
  WHEN (OLD.current_stock IS DISTINCT FROM NEW.current_stock)
  EXECUTE FUNCTION public.trg_sync_expiry_after_stock_change();

-- --------------------------------------------------------------------------
-- add_product_batch: record a received batch (admin only). Optionally adds the
-- units to the product's live stock in the same statement, so a restock can
-- never race with a sale and the remaining-per-batch estimate stays right.
-- (Pharmacy batch_controlled products keep their stock on the batch itself.)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_product_batch(
  p_product_id UUID,
  p_batch_number TEXT,
  p_expiry_date DATE,
  p_quantity NUMERIC,
  p_add_to_stock BOOLEAN DEFAULT TRUE
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
    (product_id, supermarket_id, batch_number, expiry_date, current_stock, created_by)
  VALUES
    (p_product_id, v_product.supermarket_id, btrim(p_batch_number), p_expiry_date, p_quantity, auth.uid())
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

REVOKE ALL ON FUNCTION public.add_product_batch(UUID, TEXT, DATE, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_product_batch(UUID, TEXT, DATE, NUMERIC, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ Batch expiry tracking installed (product_batch_overview / sync_store_batch_expiry).';
END $$;
