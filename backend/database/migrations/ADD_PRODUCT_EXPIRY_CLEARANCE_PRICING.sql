-- Near-expiry clearance pricing.
--
-- Lets a store admin publish a reduced price on stock that is close to its
-- expiry date, and puts the original price back when the offer ends.
--
-- Design notes
--   * Every price path (POS, cashier, customer self-checkout, delivery,
--     dropship) reads products.selling_price, and customer_self_checkout()
--     deliberately ignores any client-supplied price ("Always use DB price").
--     So a reduced price is published BY WRITING selling_price, and the price
--     it replaced is parked in clearance_original_price. No checkout function
--     needs to change and the till can never disagree with the shelf price.
--   * clearance_original_price IS NOT NULL  <=>  the product is on offer.
--   * products.expiry_date already exists (ADD_PHARMACY_FLEXIBLE_INVENTORY.sql)
--     and sales of an expired product are already blocked by
--     deduct_inventory_on_transaction(); this migration only re-asserts it.
--   * An offer must not outlive the batch it was published for, and must not
--     silently overwrite a price someone sets by hand later. The BEFORE UPDATE
--     trigger below enforces both, so bulk pricing, product edits and file
--     imports stay correct without knowing clearance exists.
--   * Only a store admin/owner can publish or end an offer; both RPCs check
--     that against the product's own supermarket.
--
-- Additive and safe to run more than once. Run after
-- ADD_PHARMACY_FLEXIBLE_INVENTORY.sql.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS price NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS clearance_original_price NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS clearance_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clearance_published_by UUID;

CREATE INDEX IF NOT EXISTS idx_products_expiry_date
  ON public.products(expiry_date);

CREATE INDEX IF NOT EXISTS idx_products_clearance_active
  ON public.products(supermarket_id)
  WHERE clearance_original_price IS NOT NULL;

-- --------------------------------------------------------------------------
-- Guard: keep an active offer consistent when a product is changed by
-- anything other than the two functions below.
--   * selling_price changed  -> the new price is deliberate, so it wins and
--                               the offer is closed without touching it.
--   * expiry_date changed    -> the shelf was restocked with a new batch, so
--                               the offer for the old batch ends and the
--                               original price is restored.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.products_clearance_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.clearance_original_price IS NULL THEN
    RETURN NEW;
  END IF;

  -- publish_clearance_price()/end_clearance_price() manage the offer columns
  -- themselves and flag their own writes.
  IF COALESCE(current_setting('app.clearance_write', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.selling_price IS DISTINCT FROM OLD.selling_price THEN
    NEW.clearance_original_price := NULL;
    NEW.clearance_published_at := NULL;
    NEW.clearance_published_by := NULL;
  ELSIF NEW.expiry_date IS DISTINCT FROM OLD.expiry_date THEN
    NEW.selling_price := OLD.clearance_original_price;
    IF OLD.price IS NOT DISTINCT FROM OLD.selling_price THEN
      NEW.price := OLD.clearance_original_price;
    END IF;
    NEW.clearance_original_price := NULL;
    NEW.clearance_published_at := NULL;
    NEW.clearance_published_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_clearance_guard ON public.products;
CREATE TRIGGER trg_products_clearance_guard
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_clearance_guard();

-- --------------------------------------------------------------------------
-- Authorization shared by both RPCs: the caller owns the product's store, or
-- is an admin assigned to it. Managers and cashiers cannot change prices.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._can_manage_clearance(p_supermarket_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p_supermarket_id IS NOT NULL AND auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.supermarkets s
      WHERE s.id = p_supermarket_id AND s.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
        AND u.role = 'admin'
        AND u.supermarket_id = p_supermarket_id
    )
  );
$$;

REVOKE ALL ON FUNCTION public._can_manage_clearance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._can_manage_clearance(UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- publish_clearance_price
--   Give exactly one of p_discount_percent (1-90) or p_clearance_price.
--   Calling it again on a product already on offer re-prices the offer from
--   the ORIGINAL price, so discounts never compound.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_clearance_price(
  p_product_id UUID,
  p_discount_percent NUMERIC DEFAULT NULL,
  p_clearance_price NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_base NUMERIC;
  v_new NUMERIC;
  v_top_tier NUMERIC;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF NOT public._can_manage_clearance(v_product.supermarket_id) THEN
    RAISE EXCEPTION 'Only this store''s admin can publish reduced prices';
  END IF;

  IF COALESCE(v_product.is_active, TRUE) = FALSE THEN
    RAISE EXCEPTION 'Activate the product before publishing a reduced price';
  END IF;

  IF v_product.expiry_date IS NULL THEN
    RAISE EXCEPTION 'Set an expiry date on this product first';
  END IF;
  IF v_product.expiry_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'This product has already expired and cannot be sold';
  END IF;

  IF (p_discount_percent IS NULL) = (p_clearance_price IS NULL) THEN
    RAISE EXCEPTION 'Give either a discount percentage or a reduced price';
  END IF;

  v_base := COALESCE(v_product.clearance_original_price, v_product.selling_price);
  IF v_base IS NULL OR v_base <= 0 THEN
    RAISE EXCEPTION 'This product has no selling price to reduce';
  END IF;

  IF p_discount_percent IS NOT NULL THEN
    IF p_discount_percent < 1 OR p_discount_percent > 90 THEN
      RAISE EXCEPTION 'Discount must be between 1%% and 90%%';
    END IF;
    v_new := ROUND(v_base * (1 - p_discount_percent / 100.0), 0);
  ELSE
    v_new := ROUND(p_clearance_price, 0);
  END IF;

  IF v_new < 0 OR v_new >= v_base THEN
    RAISE EXCEPTION 'The reduced price must be lower than the original price';
  END IF;

  -- Wholesale quantity tiers (ADD_PRODUCT_PRICE_TIERS_AND_VARIANTS.sql) take
  -- precedence over the unit price at the till. A tier above the reduced price
  -- would make a bigger purchase cost MORE per unit than a single one.
  IF to_regclass('public.product_price_tiers') IS NOT NULL THEN
    EXECUTE 'SELECT MAX(unit_price) FROM public.product_price_tiers WHERE product_id = $1'
      INTO v_top_tier USING p_product_id;
    IF v_top_tier IS NOT NULL AND v_top_tier > v_new THEN
      RAISE EXCEPTION 'A quantity-tier price (%) is higher than the reduced price (%). Lower or remove the tier prices first.',
        v_top_tier, v_new;
    END IF;
  END IF;

  PERFORM set_config('app.clearance_write', 'on', true);

  UPDATE public.products
  SET clearance_original_price = v_base,
      selling_price = v_new,
      price = CASE WHEN price IS NOT DISTINCT FROM selling_price THEN v_new ELSE price END,
      clearance_published_at = now(),
      clearance_published_by = auth.uid(),
      updated_at = now()
  WHERE id = p_product_id;

  PERFORM set_config('app.clearance_write', 'off', true);

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'original_price', v_base,
    'clearance_price', v_new,
    'discount_percent', ROUND((1 - v_new / v_base) * 100, 1),
    'expiry_date', v_product.expiry_date
  );
END;
$$;

-- --------------------------------------------------------------------------
-- end_clearance_price: take the product off offer and restore its price.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.end_clearance_price(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products%ROWTYPE;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF NOT public._can_manage_clearance(v_product.supermarket_id) THEN
    RAISE EXCEPTION 'Only this store''s admin can end a reduced price';
  END IF;

  IF v_product.clearance_original_price IS NULL THEN
    RETURN jsonb_build_object('product_id', p_product_id, 'restored_price', v_product.selling_price);
  END IF;

  PERFORM set_config('app.clearance_write', 'on', true);

  UPDATE public.products
  SET selling_price = clearance_original_price,
      price = CASE WHEN price IS NOT DISTINCT FROM selling_price THEN clearance_original_price ELSE price END,
      clearance_original_price = NULL,
      clearance_published_at = NULL,
      clearance_published_by = NULL,
      updated_at = now()
  WHERE id = p_product_id;

  PERFORM set_config('app.clearance_write', 'off', true);

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'restored_price', v_product.clearance_original_price
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_clearance_price(UUID, NUMERIC, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_clearance_price(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_clearance_price(UUID, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_clearance_price(UUID) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Near-expiry clearance pricing installed (publish_clearance_price / end_clearance_price).';
END $$;
