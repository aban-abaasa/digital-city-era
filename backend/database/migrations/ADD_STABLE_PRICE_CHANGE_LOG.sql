-- ============================================================
-- STABLE-COIN PRICING: CHANGE LOG + OFFER-SAFE REPRICING  (ADD-ONLY)
-- ============================================================
-- Run AFTER ADD_STABLECOIN_PRICING.sql. Safe to run multiple times.
--
-- 1. stable_price_changes: every time the shilling price of a product priced in
--    ICEC-S moves because ICEC-S moved, one row records old price -> new price.
--    The admin's "Stable price" screen reads it, so the admin is always told
--    what changed in the local-currency value, including changes made by the
--    scheduled repricer while nobody was logged in.
--
-- 2. reprice_stable_priced_items() is replaced so that it
--      * logs each product price change it makes, and
--      * SKIPS a product that is on an expiry-clearance offer. The clearance
--        guard (ADD_PRODUCT_EXPIRY_CLEARANCE_PRICING.sql) treats ANY write to
--        selling_price as "a deliberate new price" and ends the offer, so
--        repricing such a product would silently cancel its discount. It is
--        repriced as soon as the offer ends. The column is read through
--        to_jsonb() so this works whether or not that migration has been run.
-- ============================================================

-- ── 1. Who may see / manage a store's price log ─────────────────────────────
-- Same rule the clearance functions use: the store's owner, or an admin
-- assigned to it. Defined here so this file does not depend on that one.
CREATE OR REPLACE FUNCTION public._can_manage_stable_prices(p_supermarket_id UUID)
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

REVOKE ALL ON FUNCTION public._can_manage_stable_prices(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._can_manage_stable_prices(UUID) TO authenticated;

-- ── 2. The log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stable_price_changes (
  id              BIGSERIAL PRIMARY KEY,
  supermarket_id  UUID NOT NULL,
  product_id      UUID NOT NULL,
  product_name    TEXT,
  old_price       NUMERIC(15, 2) NOT NULL,
  new_price       NUMERIC(15, 2) NOT NULL,
  stable_price    NUMERIC(24, 8),
  rate_ugx        NUMERIC(24, 8),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at         TIMESTAMPTZ,
  seen_by         UUID
);

CREATE INDEX IF NOT EXISTS idx_stable_price_changes_store
  ON public.stable_price_changes (supermarket_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stable_price_changes_unseen
  ON public.stable_price_changes (supermarket_id) WHERE seen_at IS NULL;

ALTER TABLE public.stable_price_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stable_price_changes_store_admin ON public.stable_price_changes;
CREATE POLICY stable_price_changes_store_admin ON public.stable_price_changes
  FOR ALL TO authenticated
  USING (public._can_manage_stable_prices(supermarket_id))
  WITH CHECK (public._can_manage_stable_prices(supermarket_id));

-- ── 3. Repricer: logs changes, leaves products on an offer alone ────────────
CREATE OR REPLACE FUNCTION public.reprice_stable_priced_items()
RETURNS TABLE (products_updated INTEGER, catalog_updated INTEGER, rate_ugx NUMERIC, skipped_reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote    JSONB;
  v_rate     NUMERIC;
  v_products INTEGER := 0;
  v_catalog  INTEGER := 0;
BEGIN
  v_quote := public.ican_stable_quote();

  IF coalesce((v_quote->>'available')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'ICEC-S has no live price right now';
  END IF;

  v_rate := coalesce(nullif(v_quote->>'dollar_ugx', '')::NUMERIC, nullif(v_quote->>'unit_ugx', '')::NUMERIC);
  IF v_rate IS NULL OR v_rate <= 0 THEN
    RAISE EXCEPTION 'ICEC-S has no usable price';
  END IF;

  IF coalesce((v_quote->>'rates_stale')::BOOLEAN, FALSE) THEN
    products_updated := 0; catalog_updated := 0; rate_ugx := v_rate; skipped_reason := 'rates are stale';
    RETURN NEXT;
    RETURN;
  END IF;

  WITH due AS (
    SELECT p.id, p.supermarket_id, p.name, p.selling_price AS old_price,
           round(p.stable_price * v_rate) AS new_price, p.stable_price
      FROM public.products p
     WHERE p.price_unit = 'ICEC_S'
       AND p.stable_price > 0
       -- on an expiry offer: repricing would end the offer (see header)
       AND to_jsonb(p) ->> 'clearance_original_price' IS NULL
       -- same 0.5% dead band the app uses, so rounding noise doesn't rewrite rows
       AND (coalesce(p.selling_price, 0) <= 0
            OR abs(round(p.stable_price * v_rate) - p.selling_price) / p.selling_price > 0.005)
  ), upd AS (
    UPDATE public.products p
       SET selling_price = d.new_price,
           markup_percentage = CASE WHEN p.cost_price > 0
             THEN round(((d.new_price - p.cost_price) / p.cost_price * 100)::NUMERIC, 2)
             ELSE p.markup_percentage END,
           stable_priced_at = now()
      FROM due d
     WHERE p.id = d.id
    RETURNING p.id
  ), logged AS (
    -- a product that had no price yet is being set, not changed: nothing to tell the admin
    INSERT INTO public.stable_price_changes
      (supermarket_id, product_id, product_name, old_price, new_price, stable_price, rate_ugx)
    SELECT d.supermarket_id, d.id, d.name, d.old_price, d.new_price, d.stable_price, v_rate
      FROM due d
     WHERE coalesce(d.old_price, 0) > 0 AND d.supermarket_id IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_products FROM upd;

  UPDATE public.supplier_catalog_items c
     SET price_tiers = CASE
           WHEN coalesce(c.price_per_unit, 0) > 0 AND jsonb_typeof(c.price_tiers) = 'array' AND jsonb_array_length(c.price_tiers) > 0
           THEN (SELECT coalesce(jsonb_agg(
                   jsonb_set(t, '{unit_price}',
                     to_jsonb(round((t->>'unit_price')::NUMERIC * round(c.stable_price * v_rate) / c.price_per_unit)))
                 ), '[]'::JSONB)
                 FROM jsonb_array_elements(c.price_tiers) t)
           ELSE c.price_tiers END,
         price_per_unit = round(c.stable_price * v_rate),
         stable_priced_at = now()
   WHERE c.price_unit = 'ICEC_S'
     AND c.stable_price > 0
     AND (coalesce(c.price_per_unit, 0) <= 0
          OR abs(round(c.stable_price * v_rate) - c.price_per_unit) / c.price_per_unit > 0.005);
  GET DIAGNOSTICS v_catalog = ROW_COUNT;

  products_updated := v_products;
  catalog_updated := v_catalog;
  rate_ugx := v_rate;
  skipped_reason := NULL;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reprice_stable_priced_items() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reprice_stable_priced_items() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reprice_stable_priced_items() TO service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'stable price change log ready' AS status;
