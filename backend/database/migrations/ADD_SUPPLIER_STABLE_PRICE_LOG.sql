-- ============================================================
-- STABLE-COIN PRICING FOR SUPPLIERS: CHANGE LOG  (ADD-ONLY)
-- ============================================================
-- Run AFTER ADD_STABLECOIN_PRICING.sql and ADD_STABLE_PRICE_CHANGE_LOG.sql.
-- Safe to run multiple times.
--
-- The supplier's "Stable price" tab (My Catalog) works like the admin's: items
-- priced in ICEC-S have their shilling price follow it, and the supplier is told
-- every time that changes a shilling price. That needs somewhere to keep what
-- changed, so:
--
-- 1. supplier_stable_price_changes: one row per shilling-price change of a
--    catalog item caused by ICEC-S (old -> new, rate, when, and whether the
--    supplier has acknowledged it).
--    Access mirrors supplier_catalog_batches: the owning supplier, or an admin
--    of the supplier's business (public.supplier_business_admin), checked
--    through the catalog item itself.
--
-- 2. reprice_stable_priced_items() is replaced once more so that the scheduled
--    repricer logs catalog changes too. Everything else in it (products, offers,
--    the 0.5% dead band, stale-rate and no-price handling) is unchanged from
--    ADD_STABLE_PRICE_CHANGE_LOG.sql.
-- ============================================================

-- ── 1. The log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_stable_price_changes (
  id               BIGSERIAL PRIMARY KEY,
  supplier_user_id UUID NOT NULL,
  catalog_item_id  UUID NOT NULL,
  item_name        TEXT,
  old_price        NUMERIC(14, 2) NOT NULL,
  new_price        NUMERIC(14, 2) NOT NULL,
  stable_price     NUMERIC(24, 8),
  rate_ugx         NUMERIC(24, 8),
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at          TIMESTAMPTZ,
  seen_by          UUID
);

CREATE INDEX IF NOT EXISTS idx_supplier_stable_price_changes_supplier
  ON public.supplier_stable_price_changes (supplier_user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_stable_price_changes_unseen
  ON public.supplier_stable_price_changes (supplier_user_id) WHERE seen_at IS NULL;

ALTER TABLE public.supplier_stable_price_changes ENABLE ROW LEVEL SECURITY;

-- The business-admin rule needs supplier_business_admin() and the item's
-- supplier_business_profile_id. Both come with the supplier business migration;
-- on a database that hasn't had it the policy falls back to "the owning supplier
-- only" instead of failing.
DROP POLICY IF EXISTS supplier_stable_price_changes_owner ON public.supplier_stable_price_changes;
DO $$
BEGIN
  IF to_regprocedure('public.supplier_business_admin(uuid,uuid)') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'supplier_catalog_items'
                    AND column_name = 'supplier_business_profile_id') THEN
    EXECUTE $p$
      CREATE POLICY supplier_stable_price_changes_owner ON public.supplier_stable_price_changes
        FOR ALL TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.supplier_catalog_items i
          WHERE i.id = catalog_item_id
            AND (i.supplier_user_id = auth.uid()
                 OR public.supplier_business_admin(i.supplier_business_profile_id, i.supplier_user_id))))
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.supplier_catalog_items i
          WHERE i.id = catalog_item_id
            AND (i.supplier_user_id = auth.uid()
                 OR public.supplier_business_admin(i.supplier_business_profile_id, i.supplier_user_id))))
    $p$;
  ELSE
    EXECUTE $p$
      CREATE POLICY supplier_stable_price_changes_owner ON public.supplier_stable_price_changes
        FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM public.supplier_catalog_items i
                        WHERE i.id = catalog_item_id AND i.supplier_user_id = auth.uid()))
        WITH CHECK (EXISTS (SELECT 1 FROM public.supplier_catalog_items i
                             WHERE i.id = catalog_item_id AND i.supplier_user_id = auth.uid()))
    $p$;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.supplier_stable_price_changes TO authenticated;
GRANT USAGE ON SEQUENCE public.supplier_stable_price_changes_id_seq TO authenticated;

-- ── 2. Repricer: now logs catalog changes too ───────────────────────────────
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

  -- Store products (unchanged from ADD_STABLE_PRICE_CHANGE_LOG.sql): logs changes, skips products on an expiry offer.
  WITH due AS (
    SELECT p.id, p.supermarket_id, p.name, p.selling_price AS old_price,
           round(p.stable_price * v_rate) AS new_price, p.stable_price
      FROM public.products p
     WHERE p.price_unit = 'ICEC_S'
       AND p.stable_price > 0
       AND to_jsonb(p) ->> 'clearance_original_price' IS NULL
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
    INSERT INTO public.stable_price_changes
      (supermarket_id, product_id, product_name, old_price, new_price, stable_price, rate_ugx)
    SELECT d.supermarket_id, d.id, d.name, d.old_price, d.new_price, d.stable_price, v_rate
      FROM due d
     WHERE coalesce(d.old_price, 0) > 0 AND d.supermarket_id IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_products FROM upd;

  -- Supplier catalog items: shilling price and bulk tiers follow ICEC-S, and each real change is logged for the supplier.
  WITH due AS (
    SELECT c.id, c.supplier_user_id, c.name, c.price_per_unit AS old_price,
           round(c.stable_price * v_rate) AS new_price, c.stable_price
      FROM public.supplier_catalog_items c
     WHERE c.price_unit = 'ICEC_S'
       AND c.stable_price > 0
       AND (coalesce(c.price_per_unit, 0) <= 0
            OR abs(round(c.stable_price * v_rate) - c.price_per_unit) / c.price_per_unit > 0.005)
  ), upd AS (
    UPDATE public.supplier_catalog_items c
       SET price_tiers = CASE
             WHEN coalesce(c.price_per_unit, 0) > 0 AND jsonb_typeof(c.price_tiers) = 'array' AND jsonb_array_length(c.price_tiers) > 0
             THEN (SELECT coalesce(jsonb_agg(
                     jsonb_set(t, '{unit_price}',
                       to_jsonb(round((t->>'unit_price')::NUMERIC * d.new_price / c.price_per_unit)))
                   ), '[]'::JSONB)
                   FROM jsonb_array_elements(c.price_tiers) t)
             ELSE c.price_tiers END,
           price_per_unit = d.new_price,
           stable_priced_at = now()
      FROM due d
     WHERE c.id = d.id
    RETURNING c.id
  ), logged AS (
    -- an item that had no price yet is being set, not changed: nothing to tell the supplier
    INSERT INTO public.supplier_stable_price_changes
      (supplier_user_id, catalog_item_id, item_name, old_price, new_price, stable_price, rate_ugx)
    SELECT d.supplier_user_id, d.id, d.name, d.old_price, d.new_price, d.stable_price, v_rate
      FROM due d
     WHERE coalesce(d.old_price, 0) > 0 AND d.supplier_user_id IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_catalog FROM upd;

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

SELECT 'supplier stable price change log ready' AS status;
