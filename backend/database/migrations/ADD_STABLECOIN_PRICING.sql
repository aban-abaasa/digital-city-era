-- ============================================================
-- STABLE-COIN (ICEC-S) PRICING  (ADD-ONLY)
-- ============================================================
-- Lets a store admin or a supplier fix an item's price in ICEC-S, IcanEra's
-- stable coin, instead of in shillings. One ICEC-S is worth one US dollar at
-- the live rate and never less than its start value grown by Uganda's
-- inflation (see ICAN repo: ICEC_S_IN_SYSTEM_DEPLOY.md), so a price fixed in
-- ICEC-S keeps its real value while the shilling loses it.
--
--   * price_unit    'LOCAL' (default, today's behaviour) or 'ICEC_S'
--   * stable_price  the fixed price in ICEC-S when price_unit = 'ICEC_S'
--
-- The existing shilling column (products.selling_price,
-- supplier_catalog_items.price_per_unit) stays as the CACHED shilling price
-- that POS, receipts and the supermarket ordering screen already read. The app
-- recomputes it from stable_price whenever the ICEC-S value moves, and
-- reprice_stable_priced_items() below does the same on a schedule so shelf
-- prices don't go stale while nobody is logged in.
--
-- Nothing here stores a rate or a history: ICEC-S already records its own
-- hourly value (public.ican_stable_history), which the supplier Price Analyst
-- reads to measure how fast the shilling is losing value.
--
-- Until this is run the Add Product form still saves normally; it just can't
-- remember that an item is ICEC-S priced, and tells the user so.
-- Safe to run multiple times. Needs the ICEC-S install from the ICAN project
-- (public.ican_stable_quote) to be present in the same database to reprice.
-- ============================================================

-- ── 1. Price columns ────────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_unit TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS stable_price NUMERIC(24, 8),
  ADD COLUMN IF NOT EXISTS stable_priced_at TIMESTAMPTZ;

ALTER TABLE public.supplier_catalog_items
  ADD COLUMN IF NOT EXISTS price_unit TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS stable_price NUMERIC(24, 8),
  ADD COLUMN IF NOT EXISTS stable_priced_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stable_price_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_stable_price_check
      CHECK (price_unit IN ('LOCAL', 'ICEC_S') AND (price_unit = 'LOCAL' OR coalesce(stable_price, 0) > 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_catalog_items_stable_price_check') THEN
    ALTER TABLE public.supplier_catalog_items ADD CONSTRAINT supplier_catalog_items_stable_price_check
      CHECK (price_unit IN ('LOCAL', 'ICEC_S') AND (price_unit = 'LOCAL' OR coalesce(stable_price, 0) > 0));
  END IF;
END $$;

-- Repricing looks up only the ICEC-S priced rows, which are a small slice.
CREATE INDEX IF NOT EXISTS idx_products_stable_priced
  ON public.products (supermarket_id) WHERE price_unit = 'ICEC_S';
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_items_stable_priced
  ON public.supplier_catalog_items (supplier_user_id) WHERE price_unit = 'ICEC_S';

-- ── 2. Scheduled repricing (server side) ────────────────────────────────────
-- Recomputes the cached shilling price of every ICEC-S priced item at the
-- current value of one ICEC-S. Catalog bulk tiers move by the same factor as
-- the item. Not callable by app users (the app reprices the signed-in user's
-- own items itself); run it from a schedule, e.g. with pg_cron:
--
--   SELECT cron.schedule('reprice-stable-items', '15 * * * *',
--                        $$SELECT * FROM public.reprice_stable_priced_items()$$);
--
-- Prices follow the full dollar value of ICEC-S (dollar_ugx), not the pool's
-- share: if the pool is ever short, ICEC-S buyers share that shortfall, but a
-- shop's shelf price shouldn't drop because of it. Nothing is repriced while
-- the live rates are stale (the same rule that pauses ICEC-S swaps): shelf
-- prices simply stay where they were.

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

  UPDATE public.products p
     SET selling_price = round(p.stable_price * v_rate),
         markup_percentage = CASE WHEN p.cost_price > 0
           THEN round(((round(p.stable_price * v_rate) - p.cost_price) / p.cost_price * 100)::NUMERIC, 2)
           ELSE p.markup_percentage END,
         stable_priced_at = now()
   WHERE p.price_unit = 'ICEC_S'
     AND p.stable_price > 0
     -- same 0.5% dead band the app uses, so rounding noise doesn't rewrite rows
     AND (coalesce(p.selling_price, 0) <= 0
          OR abs(round(p.stable_price * v_rate) - p.selling_price) / p.selling_price > 0.005);
  GET DIAGNOSTICS v_products = ROW_COUNT;

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

SELECT 'stable-coin (ICEC-S) pricing ready' AS status;
