-- ============================================================================
-- Offline stock changes reach the cloud
--
-- A business LAN server's owner / managers can correct stock while offline. The server queues each
-- change as a  stock.adjustment.v1  sync event carrying the DIFFERENCE ("+24", "-3"), never the final
-- number. This migration teaches the cloud to apply those events:
--
--   * inventory.current_stock = max(0, current_stock + delta) for the store the node is paired to
--   * every applied change is kept in business_local_stock_adjustments (who, why, before, after)
--   * the existing trigger on public.inventory then sends the new stock back down to the node, so
--     the server's own number converges on the cloud's
--
-- Because the change is a difference, an offline adjustment can never overwrite stock the cloud
-- changed in the meantime (online sales, other deliveries).
--
-- Only a node paired to a SUPERMARKET can change stock: products and inventory are keyed by
-- supermarket_id. A node paired to a business profile has no catalog, so its events are quarantined
-- with a clear message instead of guessed at.
--
-- How apply_business_local_sync_events() is extended: the live function is NOT redefined from a copy
-- of the text in another file (it may have been patched in place). This reads the LIVE definition,
-- adds one branch in front of its team-message check that hands stock.adjustment.v1 events to
-- business_local_apply_stock_adjustment(), and re-creates it. Every other line is left exactly as
-- it is. A function that already has the branch is skipped.
--
-- It also lets the server ADD PRODUCTS: a product.create.v1 event creates the product and its
-- inventory row in the store (same id the server gave it), mirroring what the app itself inserts.
-- A barcode or SKU another store already uses is refused with a clear message (barcodes are unique
-- across all stores in the cloud).
--
-- Needs the four earlier business-local migrations (control plane, team messages, protocol v2,
-- catalog sync). Safe to re-run. Try it on a Supabase branch first if you can.
--
-- Rollback: re-run ADD_BUSINESS_LOCAL_SYNC_PROTOCOL_V2.sql's apply_business_local_sync_events()
-- definition (or remove the "stock.adjustment.v1" branch by hand); the table and helper are inert
-- without it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Audit trail of every stock change applied from a local server
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_local_stock_adjustments (
  event_id UUID PRIMARY KEY,
  node_id UUID NOT NULL,
  supermarket_id UUID NOT NULL,
  product_id UUID NOT NULL,
  delta NUMERIC(12,2) NOT NULL CHECK (delta <> 0),
  reason TEXT NOT NULL,
  note TEXT,
  staff_name TEXT,
  stock_before NUMERIC,
  stock_after NUMERIC,
  occurred_at TIMESTAMPTZ NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_local_stock_adjustments_product
  ON public.business_local_stock_adjustments(supermarket_id, product_id, applied_at DESC);

ALTER TABLE public.business_local_stock_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.business_local_stock_adjustments FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.business_local_stock_adjustments TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Apply one stock.adjustment.v1 event. Returns NULL on success, or the reason it was refused
--    (the caller records that as the event's processing_error).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.business_local_apply_stock_adjustment(
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
  v_product_id UUID;
  v_delta NUMERIC;
  v_reason TEXT;
  v_note TEXT;
  v_staff TEXT;
  v_mode TEXT;
  v_before NUMERIC;
  v_after NUMERIC;
BEGIN
  IF p_schema_version IS DISTINCT FROM 1 THEN
    RETURN 'Unsupported stock adjustment event version.';
  END IF;

  BEGIN
    v_product_id := (p_payload->>'product_id')::UUID;
    v_delta := (p_payload->>'delta')::NUMERIC;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'Stock adjustment has an invalid product ID or quantity.';
  END;
  v_reason := p_payload->>'reason';
  v_note := NULLIF(trim(COALESCE(p_payload->>'note', '')), '');
  v_staff := NULLIF(trim(COALESCE(p_payload->>'staff_name', '')), '');

  IF v_product_id IS NULL OR v_delta IS NULL OR v_delta = 0 OR abs(v_delta) > 1000000000 THEN
    RETURN 'Stock adjustment has an invalid product ID or quantity.';
  END IF;
  IF v_reason IS NULL OR v_reason NOT IN ('received', 'returned', 'damaged', 'expired', 'lost', 'correction', 'count')
     OR length(COALESCE(v_note, '')) > 500 OR length(COALESCE(v_staff, '')) > 120 THEN
    RETURN 'Stock adjustment has an invalid reason, note or staff name.';
  END IF;

  SELECT n.business_type, n.business_id INTO v_node
  FROM public.business_local_sync_nodes n
  WHERE n.id = p_node_id;
  IF NOT FOUND OR v_node.business_type <> 'supermarket' THEN
    RETURN 'Stock changes can only be applied for a server paired to a supermarket.';
  END IF;

  -- Already applied (a retried event): nothing more to do.
  IF EXISTS (SELECT 1 FROM public.business_local_stock_adjustments WHERE event_id = p_event_id) THEN
    RETURN NULL;
  END IF;

  SELECT p.inventory_mode INTO v_mode
  FROM public.products p
  WHERE p.id = v_product_id AND p.supermarket_id = v_node.business_id;
  IF NOT FOUND THEN
    RETURN 'That product does not belong to this store.';
  END IF;
  IF COALESCE(v_mode, 'stock_controlled') <> 'stock_controlled' THEN
    RETURN 'That product is not stock-controlled, so its stock cannot be changed.';
  END IF;

  SELECT i.current_stock INTO v_before
  FROM public.inventory i
  WHERE i.product_id = v_product_id AND i.supermarket_id = v_node.business_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'That product has no inventory record in the cloud yet.';
  END IF;

  -- Stock never goes below zero: if online sales already used the stock this offline change was
  -- based on, the count stops at 0 rather than going negative.
  v_after := GREATEST(0, COALESCE(v_before, 0) + v_delta);

  UPDATE public.inventory
  SET current_stock = v_after, updated_at = now()
  WHERE product_id = v_product_id AND supermarket_id = v_node.business_id;

  INSERT INTO public.business_local_stock_adjustments (
    event_id, node_id, supermarket_id, product_id, delta, reason, note, staff_name,
    stock_before, stock_after, occurred_at
  ) VALUES (
    p_event_id, p_node_id, v_node.business_id, v_product_id, v_delta, v_reason, v_note, v_staff,
    v_before, v_after, p_occurred_at
  ) ON CONFLICT (event_id) DO NOTHING;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_apply_stock_adjustment(UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Create a product from a product.create.v1 event (a product added on the server).
--    Mirrors what the app itself inserts: products(name, barcode, sku, cost_price, price,
--    selling_price, tax_rate, is_active, supermarket_id) and inventory(product_id, supermarket_id,
--    current_stock, reserved_stock, minimum_stock, reorder_point, reorder_quantity). The product keeps
--    the id the server gave it, so the catalog event that comes back down updates the same row.
--    Returns NULL on success, or the reason it was refused.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.business_local_apply_product_create(
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
  v_product_id UUID;
  v_name TEXT;
  v_sku TEXT;
  v_barcode TEXT;
  v_price NUMERIC;
  v_tax NUMERIC;
  v_stock NUMERIC;
  v_min NUMERIC;
  v_reorder NUMERIC;
  v_existing_store UUID;
BEGIN
  IF p_schema_version IS DISTINCT FROM 1 THEN
    RETURN 'Unsupported product event version.';
  END IF;

  BEGIN
    v_product_id := (p_payload->>'product_id')::UUID;
    v_price := round((p_payload->>'selling_price')::NUMERIC, 2);
    v_tax := round(COALESCE(NULLIF(p_payload->>'tax_rate', '')::NUMERIC, 0), 3);
    v_stock := round(COALESCE(NULLIF(p_payload->>'initial_stock', '')::NUMERIC, 0), 2);
    v_min := round(COALESCE(NULLIF(p_payload->>'minimum_stock', '')::NUMERIC, 0), 2);
    v_reorder := round(COALESCE(NULLIF(p_payload->>'reorder_point', '')::NUMERIC, 0), 2);
  EXCEPTION WHEN OTHERS THEN
    RETURN 'Product event has an invalid ID, price or quantity.';
  END;
  v_name := trim(COALESCE(p_payload->>'name', ''));
  v_sku := NULLIF(trim(COALESCE(p_payload->>'sku', '')), '');
  v_barcode := NULLIF(trim(COALESCE(p_payload->>'barcode', '')), '');

  IF v_product_id IS NULL OR length(v_name) NOT BETWEEN 1 AND 255
     OR v_price IS NULL OR v_price < 0 OR v_price > 1000000000000
     OR v_tax < 0 OR v_tax > 100
     OR v_stock < 0 OR v_stock > 1000000000 OR v_min < 0 OR v_min > 1000000000 OR v_reorder < 0 OR v_reorder > 1000000000
     OR length(COALESCE(v_sku, '')) > 100 OR v_barcode IS NULL OR length(v_barcode) > 100 THEN
    RETURN 'Product event has invalid details.';
  END IF;

  SELECT n.business_type, n.business_id INTO v_node
  FROM public.business_local_sync_nodes n
  WHERE n.id = p_node_id;
  IF NOT FOUND OR v_node.business_type <> 'supermarket' THEN
    RETURN 'Products can only be created for a server paired to a supermarket.';
  END IF;

  -- A retried event: the product is already there for this store.
  SELECT p.supermarket_id INTO v_existing_store FROM public.products p WHERE p.id = v_product_id;
  IF FOUND THEN
    IF v_existing_store IS DISTINCT FROM v_node.business_id THEN
      RETURN 'That product ID is already used by another store.';
    END IF;
    RETURN NULL;
  END IF;

  BEGIN
    INSERT INTO public.products (
      id, name, barcode, sku, cost_price, price, selling_price, tax_rate, is_active, supermarket_id
    ) VALUES (
      v_product_id, v_name, v_barcode, v_sku, 0, v_price, v_price, v_tax, true, v_node.business_id
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN 'That barcode or SKU is already registered (barcodes are unique across all stores).';
  END;

  INSERT INTO public.inventory (
    product_id, supermarket_id, current_stock, reserved_stock, minimum_stock, reorder_point, reorder_quantity
  ) VALUES (
    v_product_id, v_node.business_id, v_stock, 0, v_min, v_reorder, 100
  );

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_apply_product_create(UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Let apply_business_local_sync_events() hand these events to the helpers
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r       RECORD;
  def     TEXT;
  patched TEXT;
  has_stock BOOLEAN;
  has_product BOOLEAN;
  found_any BOOLEAN := false;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'apply_business_local_sync_events' AND n.nspname = 'public'
  LOOP
    found_any := true;
    def := pg_get_functiondef(r.oid);
    has_stock := position('business_local_apply_stock_adjustment' in def) > 0;
    has_product := position('business_local_apply_product_create' in def) > 0;

    IF has_stock AND has_product THEN
      RAISE NOTICE 'Already handles stock adjustments and new products, skipping: %', r.sig;
      CONTINUE;
    END IF;

    IF has_stock THEN
      -- An earlier run added the stock branch: add the product branch right after it.
      patched := regexp_replace(
        def,
        'ELSIF\s+v_event\.event_type\s*<>\s*''team\.message\.v1''',
        'ELSIF v_event.event_type = ''product.create.v1'' THEN
      v_error := public.business_local_apply_product_create(v_node.id, v_event.event_id, v_event.schema_version, v_payload, v_event.occurred_at);
    ELSIF v_event.event_type <> ''team.message.v1'''
      );
    ELSE
      -- Fresh function: two branches in front of the existing team-message check; everything else
      -- is untouched.
      patched := regexp_replace(
        def,
        'IF\s+v_event\.event_type\s*<>\s*''team\.message\.v1''',
        'IF v_event.event_type = ''stock.adjustment.v1'' THEN
      v_error := public.business_local_apply_stock_adjustment(v_node.id, v_event.event_id, v_event.schema_version, v_payload, v_event.occurred_at);
    ELSIF v_event.event_type = ''product.create.v1'' THEN
      v_error := public.business_local_apply_product_create(v_node.id, v_event.event_id, v_event.schema_version, v_payload, v_event.occurred_at);
    ELSIF v_event.event_type <> ''team.message.v1'''
      );
    END IF;

    IF patched = def THEN
      RAISE EXCEPTION 'Could not find the team-message check in % — inspect it by hand, did not patch.', r.sig;
    END IF;

    EXECUTE patched;
    RAISE NOTICE 'Now applies stock adjustments and new products: %', r.sig;
  END LOOP;

  IF NOT found_any THEN
    RAISE EXCEPTION 'public.apply_business_local_sync_events does not exist — run the earlier business-local migrations first.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'Stock changes and new products made on a supermarket-paired local server now reach the cloud store.';
END $$;
