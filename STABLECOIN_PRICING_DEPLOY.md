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
- Admins get a **🪙 Stable price** tab in *Order Inventory – POS* (next to *Bulk price*): put chosen products, or every
  shilling-priced product, on the stable coin **at their current price** (nothing changes on the shelf today), or take
  them back to shillings. Whenever ICEC-S moves a shilling price the admin is told: a notice at the top of the tab
  (old price → new price, % and why) that stays until they press *Got it*, a red count on the button, and a toast when
  they open the screen. Changes made by the scheduled repricer while nobody was logged in are in the same list.
- A product priced in ICEC-S has its shilling price set by ICEC-S, so *Bulk price* skips it and the inline price edit is
  locked (with a pointer to *Stable price*). A product on an expiry offer is left alone, because writing its price
  would end the offer; it is repriced once the offer ends.
- Suppliers get the same **🪙 Stable price** tab in *My Catalog* (next to *+ Add Item*): put chosen items, or the whole
  catalog, on the stable coin at their current price (supermarkets see no change today), or take them back. A supplier is
  told about every shilling change exactly like an admin is: a notice that stays until *Got it*, a red count on the button,
  and a toast on opening My Catalog, including changes the scheduled repricer made while they were away. A supplier's bulk
  tiers move with the price.
- Suppliers also get a **Price Analyst** tab: per-item margin now vs. in 1/3/6/12 months, the inflation figure it used and
  where it came from (the higher of Uganda's official rate and how much dearer a US dollar became in shillings,
  measured from ICEC-S's hourly history), and a one-click "Price in ICEC-S" that keeps today's price so buyers see no change.

## Deploy
1. Make sure ICEC-S is installed in the shared Supabase (ICAN project: `ICEC_S_IN_SYSTEM_PASTE_INTO_SUPABASE.sql`).
   Without it the form hides nothing and breaks nothing: the ICEC-S option is just disabled and says why.
2. Run `backend/database/migrations/ADD_STABLECOIN_PRICING.sql` (safe to run twice). Until it is run, an ICEC-S choice
   is not remembered and the form says so.
3. Run `backend/database/migrations/ADD_STABLE_PRICE_CHANGE_LOG.sql` **after** it (safe to run twice). It adds the
   price-change log the admin is notified from, and replaces the scheduled repricer with a version that logs each change
   and skips products on an expiry offer. **If you already scheduled the repricer from step 2's version, run this too:**
   the earlier version would have ended any expiry offer on an ICEC-S priced product. Without this file the Stable price
   tab still works, but there is no change history.
4. Run `backend/database/migrations/ADD_SUPPLIER_STABLE_PRICE_LOG.sql` **after** step 3 (safe to run twice). It adds the
   suppliers' price-change log (only the owning supplier, or an admin of their business, can read or write it) and extends
   the scheduled repricer to log supplier changes too. Without it the supplier's Stable price tab still works, with no
   change history.
5. **Recommended:** schedule the server-side repricer so shelf prices follow ICEC-S even when nobody has the admin
   portal open (the app only reprices a store/supplier's own items when they open their inventory/catalog, at most
   every 10 minutes):

       SELECT cron.schedule('reprice-stable-items', '15 * * * *',
                            $$SELECT * FROM public.reprice_stable_priced_items()$$);

## Look (light and dark)
All stable-coin screens share one classic ledger theme (`frontend/src/styles/stableCoinTheme.js`): ivory / gold / navy
in light for the admin, ivory / gold / **indigo** for the supplier (matching `supplier-classic.css`), and deep green /
cream / gold in dark. In this app's dark mode the page stays cream while panels go deep green, so every stable-coin
surface carries its own background and text colours rather than inheriting them. Colours come from one token table;
`tests/stableCoinTheme.test.js` checks WCAG AA contrast (4.5:1 text, 3:1 chart line and focus ring) for every pairing in
all four combinations, so a colour can't be changed without it being re-checked.

## Known limits
- Customers still settle at checkout in shillings (or IcanEra) at the converted price; this adds ICEC-S *pricing*,
  not a new ICEC-S payment method.
- Only a store's own admin (or owner) can read or write its price-change log.
- A store product's quantity-tier prices (`product_price_tiers`) are not scaled by the repricer; supplier catalog
  bulk tiers are.
- The Price Analyst's projection is arithmetic on the stated inflation figure, not a forecast.

Tests: `node --test frontend/tests/stablePricing.test.js frontend/tests/stableCoinTheme.test.js`.
