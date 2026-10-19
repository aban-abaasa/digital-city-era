-- ============================================================================
-- Customer shop checkout: points instead of ICAN cashback, and admin history.
--
-- 1. NO MORE ICAN CASHBACK for customers who pay at the shop. Instead each
--    purchase earns loyalty POINTS that are recorded silently (the customer
--    sees nothing) and are monitored by the developer through
--    dev_get_shop_points(). Rate is a developer-tunable setting:
--      loyalty.shop_points_per_100_ugx   (default 1 point per 100 UGX)
--    via mbg_get_setting_numeric(), the same knob style the platform fee uses.
--
-- 2. ADMIN TRANSACTION HISTORY was missing every self-checkout sale: the
--    checkout function inserted into public.transactions WITHOUT a
--    supermarket_id, and the admin/manager screens filter by store. New sales
--    now carry their store, and the existing self-checkout sales are backfilled
--    from the products they contain.
--
-- Safe by design:
--  * customer_self_checkout() is patched IN PLACE from whatever version is
--    deployed. If its shape is not what this expects, the whole migration
--    aborts and nothing changes. Pricing, tax, stock and ICAN payment logic
--    are not touched.
--  * The store is attached with an UPDATE right after the sale is recorded,
--    not in the INSERT. record_sale_in_ican_ledger() runs on INSERT only (and
--    on status changes), so this does not add a second "sale" row on top of the
--    real ICAN transfer - which would double the store's reported revenue.
--  * Run ADD_RECEIPT_STORE_APPROVAL_ICAN_LINK.sql first (receipts.store_name).
-- ============================================================================

-- A. Points storage (no client access; developer reads through an RPC) -------

CREATE TABLE IF NOT EXISTS public.dce_customer_points (
  customer_id     UUID PRIMARY KEY,
  points_balance  BIGINT      NOT NULL DEFAULT 0,
  lifetime_points BIGINT      NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dce_customer_points_ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID        NOT NULL,
  points         BIGINT      NOT NULL,
  source         TEXT        NOT NULL DEFAULT 'shop_purchase',
  receipt_number TEXT,
  transaction_id UUID,
  supermarket_id UUID,
  order_total    NUMERIC,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One award per receipt, ever (a retry can never double-credit).
CREATE UNIQUE INDEX IF NOT EXISTS dce_points_ledger_receipt_uniq
  ON public.dce_customer_points_ledger (source, receipt_number);
CREATE INDEX IF NOT EXISTS dce_points_ledger_customer_idx
  ON public.dce_customer_points_ledger (customer_id, created_at DESC);

ALTER TABLE public.dce_customer_points        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dce_customer_points_ledger ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: customers cannot read or write points directly.
REVOKE ALL ON public.dce_customer_points        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.dce_customer_points_ledger FROM PUBLIC, anon, authenticated;

-- B. Award function (called only from the checkout function) -----------------

CREATE OR REPLACE FUNCTION public.dce_award_shop_points(
  p_customer_id    UUID,
  p_order_total    NUMERIC,   -- in UGX
  p_receipt_no     TEXT,
  p_supermarket_id UUID,
  p_tx_id          UUID
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rate   NUMERIC;
  v_points BIGINT;
  v_rows   INTEGER;
BEGIN
  IF p_customer_id IS NULL OR COALESCE(p_order_total, 0) <= 0 THEN RETURN 0; END IF;

  v_rate   := COALESCE(public.mbg_get_setting_numeric('loyalty.shop_points_per_100_ugx', 1), 1);
  v_points := FLOOR(p_order_total / 100.0 * v_rate);
  IF v_points <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.dce_customer_points_ledger
    (customer_id, points, source, receipt_number, transaction_id, supermarket_id, order_total, note)
  VALUES
    (p_customer_id, v_points, 'shop_purchase', p_receipt_no, p_tx_id, p_supermarket_id, p_order_total,
     format('Shop purchase | receipt %s', p_receipt_no))
  ON CONFLICT (source, receipt_number) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN 0; END IF;

  INSERT INTO public.dce_customer_points AS cp (customer_id, points_balance, lifetime_points)
  VALUES (p_customer_id, v_points, v_points)
  ON CONFLICT (customer_id) DO UPDATE
     SET points_balance  = cp.points_balance  + EXCLUDED.points_balance,
         lifetime_points = cp.lifetime_points + EXCLUDED.lifetime_points,
         updated_at      = now();

  RETURN v_points;
END;
$$;
REVOKE ALL ON FUNCTION public.dce_award_shop_points(UUID, NUMERIC, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- C. Developer monitoring ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.dev_get_shop_points(p_limit INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lim INTEGER := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'Developer access required';
  END IF;

  RETURN jsonb_build_object(
    'rate_points_per_100_ugx', COALESCE(public.mbg_get_setting_numeric('loyalty.shop_points_per_100_ugx', 1), 1),
    'totals', (
      SELECT jsonb_build_object(
               'customers',        COUNT(*),
               'points_balance',   COALESCE(SUM(points_balance), 0),
               'lifetime_points',  COALESCE(SUM(lifetime_points), 0))
        FROM public.dce_customer_points),
    'customers', COALESCE((
      SELECT jsonb_agg(row_to_json(c) ORDER BY c.lifetime_points DESC)
        FROM (
          SELECT cp.customer_id, u.full_name, u.email,
                 cp.points_balance, cp.lifetime_points, cp.updated_at
            FROM public.dce_customer_points cp
            LEFT JOIN public.users u ON u.id = cp.customer_id
           ORDER BY cp.lifetime_points DESC
           LIMIT v_lim) c), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(row_to_json(l) ORDER BY l.created_at DESC)
        FROM (
          SELECT pl.created_at, pl.customer_id, u.full_name, pl.points, pl.receipt_number,
                 pl.order_total, sm.name AS store_name
            FROM public.dce_customer_points_ledger pl
            LEFT JOIN public.users u        ON u.id  = pl.customer_id
            LEFT JOIN public.supermarkets sm ON sm.id = pl.supermarket_id
           ORDER BY pl.created_at DESC
           LIMIT v_lim) l), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.dev_get_shop_points(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_get_shop_points(INTEGER) TO authenticated;

-- D. Receipts get the store too (used by the receipt approval feature) --------
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS supermarket_id UUID,
  ADD COLUMN IF NOT EXISTS store_name     TEXT;

-- E. Patch customer_self_checkout() in place ---------------------------------
DO $patch$
DECLARE
  d  TEXT;
  d0 TEXT;
  v_points_call TEXT;
BEGIN
  SELECT pg_get_functiondef('public.customer_self_checkout(jsonb,text,boolean,text)'::regprocedure)
    INTO d;
  d0 := d;

  IF position('dce_award_shop_points' in d) > 0 THEN
    RAISE NOTICE 'customer_self_checkout already awards points; skipping patch';
    RETURN;
  END IF;

  -- Points are earned on the UGX value of the order. A store priced in another
  -- currency (newer function versions) is converted through its ICAN price.
  IF position('v_price_per_ican' in d) > 0 THEN
    v_points_call := $c$PERFORM public.dce_award_shop_points(
      v_auth_id,
      CASE WHEN v_price_per_ican IS NOT NULL AND v_price_per_ican > 0
           THEN v_net_total / v_price_per_ican * 5000 ELSE v_net_total END,
      v_receipt_no, v_supermarket_id, v_tx_id);$c$;
  ELSE
    v_points_call := $c$PERFORM public.dce_award_shop_points(
      v_auth_id, v_net_total, v_receipt_no, v_supermarket_id, v_tx_id);$c$;
  END IF;

  -- 1. ICAN cashback block  ->  silent shop points
  d := regexp_replace(
    d,
    $re$IF p_pay_with_ican = FALSE[^;]*?THEN\s+BEGIN\s+SELECT credit_ican_earning\(.*?\)\s+INTO v_ican_result;\s+EXCEPTION WHEN OTHERS THEN\s+v_ican_result := jsonb_build_object\('success', false, 'error', SQLERRM\);\s+END;\s+END IF;$re$,
    $r$-- Shop points (replaces the old ICAN cashback). Silent: the customer sees
  -- nothing; the developer monitors them via dev_get_shop_points().
  BEGIN
    $r$ || v_points_call || $r$
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dce_award_shop_points failed for receipt %: %', v_receipt_no, SQLERRM;
  END;$r$
  );

  -- 2. Attach the store to the sale so admin/manager history can see it.
  d := replace(
    d,
    'RETURNING id INTO v_tx_id;',
    $u$RETURNING id INTO v_tx_id;

  -- Attach the store AFTER the insert (not in it): the revenue-ledger trigger
  -- only runs on INSERT, so this cannot double-count an ICAN-paid sale.
  UPDATE public.transactions SET supermarket_id = v_supermarket_id WHERE id = v_tx_id;$u$
  );

  -- 3. The receipt row carries its store too.
  d := replace(
    d,
    'RETURNING id INTO v_receipt_id;',
    $u$RETURNING id INTO v_receipt_id;

  UPDATE public.receipts r
     SET supermarket_id = v_supermarket_id,
         store_name     = (SELECT s.name FROM public.supermarkets s WHERE s.id = v_supermarket_id)
   WHERE r.id = v_receipt_id;$u$
  );

  -- 4. No cashback in the response any more.
  d := regexp_replace(d, ',\s*''ican_cashback'',\s*v_ican_result', '');

  IF d = d0
     OR position('credit_ican_earning' in d) > 0
     OR position('ican_cashback' in d) > 0
     OR position('dce_award_shop_points' in d) = 0
     OR position('UPDATE public.transactions SET supermarket_id' in d) = 0
     OR position('UPDATE public.receipts r' in d) = 0 THEN
    RAISE EXCEPTION 'customer_self_checkout does not have the expected shape; nothing was changed';
  END IF;

  EXECUTE d;
END;
$patch$;

-- F. Backfill: existing self-checkout sales get their store -------------------
-- A plain UPDATE (not of status), so no ledger row and no stock movement fires.
UPDATE public.transactions t
   SET supermarket_id = s.sm
  FROM (
    SELECT t2.id,
           (SELECT p.supermarket_id
              FROM jsonb_array_elements(COALESCE(t2.items, '[]'::jsonb)) it
              JOIN public.products p ON p.id = (it->>'product_id')::UUID
             LIMIT 1) AS sm
      FROM public.transactions t2
     WHERE t2.register_number = 'SELF-CHECKOUT' AND t2.supermarket_id IS NULL
  ) s
 WHERE t.id = s.id AND s.sm IS NOT NULL;

UPDATE public.receipts r
   SET supermarket_id = t.supermarket_id,
       store_name     = COALESCE(r.store_name, sm.name)
  FROM public.transactions t
  JOIN public.supermarkets sm ON sm.id = t.supermarket_id
 WHERE r.transaction_id = t.transaction_id
   AND t.register_number = 'SELF-CHECKOUT'
   AND r.supermarket_id IS NULL;

NOTIFY pgrst, 'reload schema';
