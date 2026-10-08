-- ============================================================================
-- A local server paired to a BUSINESS PROFILE can now sync products and stock
--
-- Before: only a server paired to a supermarket could add products or change stock in the cloud.
-- A server paired to a business profile had every such event refused ("...can only be applied for a
-- server paired to a supermarket") and nothing it added ever reached the cloud.
--
-- Now: the cloud works out which store belongs to the profile, and uses it:
--   1. the store named by business_profiles.supermarket_id, else
--   2. the store whose pichin_business_profile_id is the profile, else
--   3. the store linked to the profile in business_app_links (app 'supermarketa'), else
--   4. a new store is created for the profile (same name, same owner, linked to the profile) - once.
--
-- Everything else flows through the existing store logic:
--   * product.create.v1 / stock.adjustment.v1 from the server are applied to that store
--   * the store's catalog changes are sent DOWN to the profile-paired server too (before, only
--     supermarket-paired servers received them)
--   * a profile-paired server paired later is sent the store's current catalog right away
--   * events the cloud refused earlier for this reason are re-applied (the server marked them as
--     sent, so it would never resend them itself)
--
-- Creating a store: the AFTER INSERT trigger on public.supermarkets would normally create a SECOND
-- business profile (with a wallet) for the new store. The profile already exists, so that trigger is
-- switched off for the one insert (inside the same transaction, so it is always switched back on) and
-- the store is linked to the existing profile the way onboard_supermarket() links it. The owner's
-- users row gets supermarket_id set ONLY when it was empty; its role is never changed.
--
-- Needs the earlier business-local migrations (control plane, team messages, protocol v2, catalog
-- sync, stock adjustments). Safe to re-run.
--
-- Rollback: re-run ADD_BUSINESS_LOCAL_STOCK_ADJUSTMENTS.sql (helpers) and ADD_BUSINESS_LOCAL_CATALOG_SYNC.sql
-- (enqueue function), and DROP TRIGGER trg_business_local_seed_profile_node_catalog ON
-- public.business_local_sync_nodes. Stores already created stay.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The store that belongs to a profile (never creates one)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.business_local_profile_store(p_profile_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_profile_id IS NULL THEN RETURN NULL; END IF;

  SELECT s.id INTO v_id
  FROM public.business_profiles bp
  JOIN public.supermarkets s ON s.id = bp.supermarket_id
  WHERE bp.id = p_profile_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT s.id INTO v_id
  FROM public.supermarkets s
  WHERE s.pichin_business_profile_id = p_profile_id
  ORDER BY s.created_at, s.id
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  IF to_regclass('public.business_app_links') IS NOT NULL THEN
    EXECUTE $q$
      SELECT s.id
      FROM public.business_app_links l
      JOIN public.supermarkets s ON s.id = l.source_entity_id
      WHERE l.business_profile_id = $1 AND l.app_key = 'supermarketa' AND l.status = 'active'
      ORDER BY s.created_at, s.id
      LIMIT 1
    $q$ INTO v_id USING p_profile_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_profile_store(UUID) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. The store a node syncs with: its own supermarket, or its profile's store (created if missing).
--    NULL only when there is nothing to attach a store to (profile has no owner or no name).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.business_local_store_for_node(p_node_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_node RECORD;
  v_profile RECORD;
  v_store UUID;
  v_new UUID := gen_random_uuid();
BEGIN
  SELECT n.business_type, n.business_id INTO v_node
  FROM public.business_local_sync_nodes n
  WHERE n.id = p_node_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_node.business_type = 'supermarket' THEN
    SELECT s.id INTO v_store FROM public.supermarkets s WHERE s.id = v_node.business_id;
    RETURN v_store;
  END IF;

  v_store := public.business_local_profile_store(v_node.business_id);
  IF v_store IS NOT NULL THEN RETURN v_store; END IF;

  -- One creator at a time per profile; the second caller then finds the store the first made.
  PERFORM pg_advisory_xact_lock(hashtextextended('business-local-store:' || v_node.business_id::TEXT, 0));
  v_store := public.business_local_profile_store(v_node.business_id);
  IF v_store IS NOT NULL THEN RETURN v_store; END IF;

  SELECT bp.id, bp.user_id, trim(COALESCE(bp.business_name, '')) AS business_name INTO v_profile
  FROM public.business_profiles bp
  WHERE bp.id = v_node.business_id;
  IF NOT FOUND OR v_profile.user_id IS NULL OR v_profile.business_name = '' THEN RETURN NULL; END IF;

  ALTER TABLE public.supermarkets DISABLE TRIGGER supermarket_pichin_business_account;
  BEGIN
    INSERT INTO public.supermarkets (
      id, name, owner_user_id, onboarding_token, is_active, business_type, pichin_business_profile_id
    ) VALUES (
      v_new, left(v_profile.business_name, 255), v_profile.user_id, gen_random_uuid()::TEXT, true,
      'supermarket', v_profile.id
    );
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.supermarkets ENABLE TRIGGER supermarket_pichin_business_account;
    RAISE;
  END;
  ALTER TABLE public.supermarkets ENABLE TRIGGER supermarket_pichin_business_account;

  IF to_regclass('public.business_app_links') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO public.business_app_links (business_profile_id, app_key, source_entity_id, linked_by, metadata)
      VALUES ($1, 'supermarketa', $2, $3, jsonb_build_object('linked_by', 'business_local_sync'))
      ON CONFLICT (app_key, source_entity_id) DO UPDATE
        SET business_profile_id = EXCLUDED.business_profile_id, status = 'active', updated_at = now()
    $q$ USING v_profile.id, v_new, v_profile.user_id;
  END IF;

  -- Lets the owner find this store in the admin portal. Never changes a role, never moves an owner
  -- who belongs to a store that exists (an empty link, or one pointing at a deleted store, is filled).
  UPDATE public.users u
  SET supermarket_id = v_new
  WHERE (u.auth_id = v_profile.user_id OR u.id = v_profile.user_id)
    AND (u.supermarket_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.supermarkets s WHERE s.id = u.supermarket_id));

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_store_for_node(UUID) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Stock adjustments from a server -> its store (supermarket OR profile paired)
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
  v_store UUID;
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

  v_store := public.business_local_store_for_node(p_node_id);
  IF v_store IS NULL THEN
    RETURN 'This server has no store in the cloud to apply stock changes to.';
  END IF;

  -- Already applied (a retried event): nothing more to do.
  IF EXISTS (SELECT 1 FROM public.business_local_stock_adjustments WHERE event_id = p_event_id) THEN
    RETURN NULL;
  END IF;

  SELECT p.inventory_mode INTO v_mode
  FROM public.products p
  WHERE p.id = v_product_id AND p.supermarket_id = v_store;
  IF NOT FOUND THEN
    RETURN 'That product does not belong to this store.';
  END IF;
  IF COALESCE(v_mode, 'stock_controlled') <> 'stock_controlled' THEN
    RETURN 'That product is not stock-controlled, so its stock cannot be changed.';
  END IF;

  SELECT i.current_stock INTO v_before
  FROM public.inventory i
  WHERE i.product_id = v_product_id AND i.supermarket_id = v_store
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'That product has no inventory record in the cloud yet.';
  END IF;

  -- Stock never goes below zero: if online sales already used the stock this offline change was
  -- based on, the count stops at 0 rather than going negative.
  v_after := GREATEST(0, COALESCE(v_before, 0) + v_delta);

  UPDATE public.inventory
  SET current_stock = v_after, updated_at = now()
  WHERE product_id = v_product_id AND supermarket_id = v_store;

  INSERT INTO public.business_local_stock_adjustments (
    event_id, node_id, supermarket_id, product_id, delta, reason, note, staff_name,
    stock_before, stock_after, occurred_at
  ) VALUES (
    p_event_id, p_node_id, v_store, v_product_id, v_delta, v_reason, v_note, v_staff,
    v_before, v_after, p_occurred_at
  ) ON CONFLICT (event_id) DO NOTHING;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_apply_stock_adjustment(UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Product creation from a server -> its store (supermarket OR profile paired)
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
  v_store UUID;
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

  v_store := public.business_local_store_for_node(p_node_id);
  IF v_store IS NULL THEN
    RETURN 'This server has no store in the cloud to add products to.';
  END IF;

  -- A retried event: the product is already there for this store.
  SELECT p.supermarket_id INTO v_existing_store FROM public.products p WHERE p.id = v_product_id;
  IF FOUND THEN
    IF v_existing_store IS DISTINCT FROM v_store THEN
      RETURN 'That product ID is already used by another store.';
    END IF;
    RETURN NULL;
  END IF;

  BEGIN
    INSERT INTO public.products (
      id, name, barcode, sku, cost_price, price, selling_price, tax_rate, is_active, supermarket_id
    ) VALUES (
      v_product_id, v_name, v_barcode, v_sku, 0, v_price, v_price, v_tax, true, v_store
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN 'That barcode or SKU is already registered (barcodes are unique across all stores).';
  END;

  INSERT INTO public.inventory (
    product_id, supermarket_id, current_stock, reserved_stock, minimum_stock, reorder_point, reorder_quantity
  ) VALUES (
    v_product_id, v_store, v_stock, 0, v_min, v_reorder, 100
  );

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_apply_product_create(UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Catalog changes of a store also go DOWN to the servers paired to that store's profile
--    (same body as before; the node match is the only change)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_business_local_catalog_event(
  p_supermarket_id UUID,
  p_event_id UUID,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.business_local_sync_events (
    event_id, business_type, business_id, direction, target_node_id,
    event_type, schema_version, occurred_at, payload
  )
  SELECT p_event_id, n.business_type, n.business_id, 'cloud_to_node', n.id,
         'catalog.product.v1', 1,
         GREATEST(
           COALESCE((p_payload->>'product_updated_at')::TIMESTAMPTZ, '-infinity'::TIMESTAMPTZ),
           COALESCE((p_payload->>'stock_updated_at')::TIMESTAMPTZ, '-infinity'::TIMESTAMPTZ)
         ), p_payload
  FROM public.business_local_sync_nodes n
  WHERE p_supermarket_id IS NOT NULL
    AND n.revoked_at IS NULL
    AND p_payload IS NOT NULL
    AND (
      (n.business_type = 'supermarket' AND n.business_id = p_supermarket_id)
      OR (n.business_type = 'business_profile'
          AND public.business_local_profile_store(n.business_id) = p_supermarket_id)
    )
  ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.enqueue_business_local_catalog_event(UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. A profile-paired server paired later is sent its store's current catalog (if the store exists)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.business_local_seed_profile_node_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store UUID;
  v_product RECORD;
BEGIN
  IF NEW.business_type <> 'business_profile' THEN RETURN NEW; END IF;
  v_store := public.business_local_profile_store(NEW.business_id);
  IF v_store IS NULL THEN RETURN NEW; END IF;

  FOR v_product IN
    SELECT id, updated_at, created_at FROM public.products WHERE supermarket_id = v_store ORDER BY id
  LOOP
    INSERT INTO public.business_local_sync_events (
      event_id, business_type, business_id, direction, target_node_id,
      event_type, schema_version, occurred_at, payload
    ) VALUES (
      v_product.id, NEW.business_type, NEW.business_id, 'cloud_to_node', NEW.id,
      'catalog.product.v1', 1, COALESCE(v_product.updated_at, v_product.created_at, now()),
      public.business_local_catalog_event_payload(v_store, v_product.id)
    ) ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_seed_profile_node_catalog() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_business_local_seed_profile_node_catalog ON public.business_local_sync_nodes;
CREATE TRIGGER trg_business_local_seed_profile_node_catalog
  AFTER INSERT ON public.business_local_sync_nodes
  FOR EACH ROW EXECUTE FUNCTION public.business_local_seed_profile_node_catalog();

-- Profile-paired servers that already exist and whose store already exists: send the catalog now.
DO $$
DECLARE
  v_row RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(145019777, 1);
  PERFORM pg_advisory_xact_lock(145019777, 2);
  FOR v_row IN
    SELECT n.id AS node_id, n.business_type, n.business_id, p.id AS product_id,
           p.updated_at, p.created_at,
           public.business_local_profile_store(n.business_id) AS store_id
    FROM public.business_local_sync_nodes n
    JOIN public.products p ON p.supermarket_id = public.business_local_profile_store(n.business_id)
    WHERE n.business_type = 'business_profile' AND n.revoked_at IS NULL
    ORDER BY n.id, p.id
  LOOP
    INSERT INTO public.business_local_sync_events (
      event_id, business_type, business_id, direction, target_node_id,
      event_type, schema_version, occurred_at, payload
    ) VALUES (
      v_row.product_id, v_row.business_type, v_row.business_id, 'cloud_to_node', v_row.node_id,
      'catalog.product.v1', 1, COALESCE(v_row.updated_at, v_row.created_at, now()),
      public.business_local_catalog_event_payload(v_row.store_id, v_row.product_id)
    ) ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Re-apply what the cloud refused only because the server was paired to a profile.
--    Oldest first, so a product is created before its stock changes.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  e RECORD;
  v_error TEXT;
  v_done INTEGER := 0;
  v_failed INTEGER := 0;
BEGIN
  FOR e IN
    SELECT id, source_node_id, event_id, event_type, schema_version, occurred_at, payload
    FROM public.business_local_sync_events
    WHERE direction = 'node_to_cloud'
      AND business_type = 'business_profile'
      AND source_node_id IS NOT NULL
      AND processing_error IN (
        'Products can only be created for a server paired to a supermarket.',
        'Stock changes can only be applied for a server paired to a supermarket.'
      )
    ORDER BY id
    FOR UPDATE
  LOOP
    v_error := CASE e.event_type
      WHEN 'product.create.v1' THEN public.business_local_apply_product_create(e.source_node_id, e.event_id, e.schema_version, e.payload, e.occurred_at)
      WHEN 'stock.adjustment.v1' THEN public.business_local_apply_stock_adjustment(e.source_node_id, e.event_id, e.schema_version, e.payload, e.occurred_at)
    END;
    UPDATE public.business_local_sync_events
    SET processed_at = now(), processing_error = v_error
    WHERE id = e.id;
    IF v_error IS NULL THEN v_done := v_done + 1; ELSE v_failed := v_failed + 1; END IF;
  END LOOP;
  RAISE NOTICE 'Re-applied % earlier refused event(s); % still refused.', v_done, v_failed;
END $$;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'Servers paired to a business profile now sync products and stock with the profile''s store.';
END $$;
