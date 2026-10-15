# Stable-coin (ICEC-S) pricing + supplier Price Analyst

Admins (store products) and suppliers (catalog items) can fix a price in **ICEC-S**, IcanEra's stable coin,
instead of shillings. One ICEC-S is worth one US dollar at the live rate and never less than its start value
grown by Uganda's inflation (see the ICAN project's `ICEC_S_IN_SYSTEM_DEPLOY.md`), so a price fixed in it keeps
its real value while the shilling loses it.

ICEC-S is the *stability* coin. The community coin (the 5,000 UGX-floor "ICAN" used for cashback and tithe) is
unchanged and is not used for pricing.

## How it works
- On the Add / Edit Product form (admin portal and supplier catalog, same form) pick **ICEC-S (stable coin)** under
  *Pricing*, then type the price in ICEC-S. The shilling price is worked out at today's value of one ICEC-S.
- `products.selling_price` / `supplier_catalog_items.price_per_unit` stay as the **cached shilling price** that POS,
  receipts and the supermarket ordering screen already read, so nothing else had to change. It is recomputed from the
  ICEC-S price whenever ICEC-S moves (0.5% dead band; a supplier's bulk tiers move by the same factor).
- Shelf prices follow the coin's **full dollar value** (`dollar_ugx`), not the pool's share, and nothing is repriced
  while ICEC-S's live rates are stale.
- Suppliers get a **Price Analyst** tab: per-item margin now vs. in 1/3/6/12 months, the inflation figure it used and
  where it came from (the higher of Uganda's official rate and how much dearer a US dollar became in shillings,
  measured from ICEC-S's hourly history), and a one-click "Price in ICEC-S" that keeps today's price so buyers see no change.

## Deploy
1. Make sure ICEC-S is installed in the shared Supabase (ICAN project: `ICEC_S_IN_SYSTEM_PASTE_INTO_SUPABASE.sql`).
   Without it the form hides nothing and breaks nothing: the ICEC-S option is just disabled and says why.
2. Run `backend/database/migrations/ADD_STABLECOIN_PRICING.sql` (safe to run twice). Until it is run, an ICEC-S choice
   is not remembered and the form says so.
3. **Recommended:** schedule the server-side repricer so shelf prices follow ICEC-S even when nobody has the admin
   portal open (the app only reprices a store/supplier's own items when they open their inventory/catalog, at most
   every 10 minutes):

       SELECT cron.schedule('reprice-stable-items', '15 * * * *',
                            $$SELECT * FROM public.reprice_stable_priced_items()$$);

## Known limits
- Customers still settle at checkout in shillings (or IcanEra) at the converted price; this adds ICEC-S *pricing*,
  not a new ICEC-S payment method.
- A store product's quantity-tier prices (`product_price_tiers`) are not scaled by the repricer; supplier catalog
  bulk tiers are.
- The Price Analyst's projection is arithmetic on the stated inflation figure, not a forecast.

Tests: `node --test frontend/tests/stablePricing.test.js`.
