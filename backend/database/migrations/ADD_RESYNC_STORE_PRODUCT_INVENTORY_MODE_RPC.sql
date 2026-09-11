-- ============================================================================
-- FIX: stores that already drifted BEFORE
-- ADD_PRODUCT_MODE_SYNC_ON_BUSINESS_TYPE_CHANGE.sql existed are still stuck.
--
-- That migration's trigger only fires on a future business_type UPDATE, and
-- its one-time catch-up only ever moves 'stock_controlled' -> the laundry/
-- restaurant_cafe default (forward direction) — it deliberately skips a
-- blind global reverse sweep, because a script with no audit trail can't
-- tell "this store used to be laundry and switched back" apart from "this
-- boutique always had one deliberate service line item".
--
-- Real example that surfaced this: a store now on a non-laundry business
-- type still has ordinary products (a toy, a rim, shea butter) rung up by
-- the cashier POS as "🧺 Service" because their inventory_mode is still
-- 'service_item' from before this store's business type was last changed.
--
-- Rather than guess globally, this gives the store's own admin/manager/owner
-- an on-demand, scoped fix: resync THIS store's products to its CURRENT
-- business type right now, on request. They can see the result immediately
-- in the POS and hand-correct any one deliberate exception afterward.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resync_store_product_inventory_mode(p_supermarket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_authorized BOOLEAN;
  v_business_type TEXT;
  v_target_default TEXT;
  v_updated_count INTEGER;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.id = v_auth_id OR u.auth_id = v_auth_id)
        AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
        AND u.supermarket_id = p_supermarket_id
    )
    OR EXISTS (
      SELECT 1 FROM public.supermarkets s
      WHERE s.id = p_supermarket_id AND s.owner_user_id = v_auth_id
    )
  INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only this store''s admin, manager or owner can resync its products');
  END IF;

  SELECT business_type INTO v_business_type FROM public.supermarkets WHERE id = p_supermarket_id;
  IF v_business_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Store not found');
  END IF;

  v_target_default := public.default_inventory_mode_for_business_type(v_business_type);

  UPDATE public.products
  SET inventory_mode = v_target_default,
      track_inventory = (v_target_default = 'stock_controlled'),
      updated_at = now()
  WHERE supermarket_id = p_supermarket_id
    AND inventory_mode IN ('stock_controlled', 'service_item', 'listing_only')
    AND inventory_mode <> v_target_default;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated', v_updated_count,
    'businessType', v_business_type,
    'inventoryMode', v_target_default
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resync_store_product_inventory_mode(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resync_store_product_inventory_mode(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
