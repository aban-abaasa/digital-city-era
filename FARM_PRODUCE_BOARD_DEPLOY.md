# Farm Produce: see what farmers have on offer (Supplier Portal)

Farmers post what they have, how much and at what price in the AgriBone app (the **farm-agentera** project).
Suppliers see those offers live in a new **Farm Produce** tab of the Supplier Portal, compare them, and call,
WhatsApp or tap **I’m interested**. The farmer then sees who is interested.

## Deploy
1. In the shared Supabase, run **`backend/db/schemas/farm/12_produce_offers.sql` from the farm-agentera project**
   (safe to run twice). It creates `farm_produce_offers` and `farm_produce_interests`, their row-level security and
   live updates. Nothing in this repo creates those tables.
2. Ship this app. Until step 1 is done the tab shows a setup note instead of the board; the rest of the portal is
   unaffected.

## What the supplier gets
- **Live offers**: new ones appear with a notice; the list also refreshes when the tab regains focus after a minute.
- **Market strip** per crop: how many offers and the typical price (the median of the live offers).
- **Compared with the market**: “12% under market” / “46% above market” and a bar showing where the price sits between
  the cheapest and dearest offer. Needs at least 3 offers of the crop in the same unit; otherwise it says so.
- **Best deal / Newest / Nearest / Biggest**. Choose your area (a sub-region) to put the closest farms first; the choice
  is remembered on the device.
- **Matched to My Catalog**: “In your catalog”, the margin if you bought at the farmer’s price and sold at your catalog
  price (only when both are in the same unit), and “Low in your stock” when the catalog item is at or below its
  minimum stock (or unavailable).
- Search, filters (In my catalog, Organic, Ready now, Near me only) and “New” badges since the last visit.
- **Call**, **WhatsApp** (message pre-written with the farmer, produce and price), and **I’m interested** with an optional
  message. The farmer sees your business name, phone and message; you can withdraw it.

## Rules (enforced by the database, not just this screen)
- An offer is visible only while it is active and before its closing time, so a stale price never shows.
- Only supplier-capable accounts can show interest (`supplier`, `admin`, or a `manager` of a supply-enabled store: the
  same rule as `frontend/src/utils/supplierAccess.js`). One interest per supplier per offer.
- Your business name and phone come from your supplier profile. Add a phone number there, or the farmer can’t call back.

## Known limits
- UGX only. No in-app chat, order or payment for farm produce yet, and no push/SMS when a supplier shows interest.
- “Nearest” is by sub-region, then region, not distance.
- Catalog matching is by crop name; a similar item (“Green beans” for “Beans”) is flagged but gets no margin.
- The market arithmetic (`frontend/src/utils/farmProduce.js`) deliberately matches
  `farm-agentera/frontend/src/utils/produceOffers.js` so farmer and supplier agree on what “typical” means. Change both together.

Tests: `npm run test:farm-produce` (in `frontend/`).
