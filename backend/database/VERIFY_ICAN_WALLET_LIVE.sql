-- ============================================================
-- VERIFY: Is the shared ICAN wallet (used by the new "IcanEra
-- Wallet" payment method on purchase orders) actually live on
-- THIS Supabase project?
--
-- Context: digital-city-era's icanWalletService.js assumes these
-- tables/functions already exist as a "shared cross-app" schema
-- (also used by the ICAN app). This project's purchase_orders
-- table has already turned out to be missing columns twice today,
-- so don't assume — check.
--
-- Read-only. Safe to run any time.
-- ============================================================

-- 1) Tables the wallet UI reads/writes directly
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.tables t2
        WHERE t2.table_schema = 'public' AND t2.table_name = t1.table_name) > 0 AS exists
FROM (VALUES ('ican_user_wallets'), ('ican_coin_transactions')) AS t1(table_name);

-- 2) Functions (RPCs) icanWalletService.js calls
SELECT p.proname AS function_name, COUNT(*) AS overload_count
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_or_create_ican_wallet',
    'transfer_ican',
    'ican_get_user_wallet_display',
    'dce_credit_cashback',
    'dce_credit_supplier_delivery',
    'buy_ican_coins',
    'sell_ican_coins'
  )
GROUP BY p.proname
ORDER BY p.proname;
-- Expect all 7 names listed above with overload_count >= 1.
-- Any missing from this result set do NOT exist here — the
-- "Pay with IcanEra Wallet" buttons would fail for that action.

-- 3) Is there real, non-zero activity already (proof this isn't an
--    empty/unused schema, i.e. genuinely "live" rather than just present)?
SELECT
  (SELECT COUNT(*) FROM public.ican_user_wallets)      AS wallet_rows,
  (SELECT COUNT(*) FROM public.ican_coin_transactions)  AS transaction_rows;

-- 4) purchase_orders x payment_transactions cross-check specific to
--    the new "Pay with IcanEra Wallet" feature — any payments already
--    recorded with payment_method = 'ican_wallet'?
SELECT id, purchase_order_id, amount_ugx, payment_reference, confirmed_by_supplier, created_at
FROM public.payment_transactions
WHERE payment_method = 'ican_wallet'
ORDER BY created_at DESC
LIMIT 20;
