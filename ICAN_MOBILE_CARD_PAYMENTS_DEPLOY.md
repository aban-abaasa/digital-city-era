# IcanEra Mobile / Card — deploy notes

A cashier can now take **IcanEra Mobile / Card** at the till for a customer who has **no IcanEra account**
(or who simply prefers Mobile Money / a card). The money is collected by Flutterwave and credited straight into
the store's IcanEra wallet (the store owner's wallet — the same place the wallet-QR payment lands), priced at the
live icaneracoin value, so the store receives the **full sale amount**. The customer carries the gateway fee
(`guest_checkout_config.gateway_fee_pct`, default 3.5 %), shown openly; paying from an IcanEra wallet is fee-free.

## How the cashier uses it

POS → **Process Payment** → **📲 IcanEra Mobile / Card**. One screen, three ways, whichever happens first settles the sale:

| Tab | What happens |
| --- | --- |
| **Ask them to pay** | Type the customer's **phone number or 16-digit IcanEra wallet number**. A number that belongs to an IcanEra account gets a request in their wallet inbox (no fee). Any other phone number gets a **Mobile Money approval prompt** (MTN / Airtel detected from the number). The customer can be anywhere. |
| **On this till** | Flutterwave's checkout opens on the till (Mobile Money number or card). |
| **Scan or send link** | QR / link / WhatsApp / SMS to the customer's own phone → `/mobile-pay/<ref>`: Mobile Money or card with no account, or their IcanEra wallet when signed in. |

The till keeps checking, so a payment made on another phone — or approved a moment late — still completes the sale.
Cancelling voids the charge; pressing Cancel just after a customer paid completes the sale instead of losing it.
A sale paid from the customer's wallet through the link is booked as **IcanEra Wallet**, not Mobile / Card.

The POS also has a **Products | Scan** switch in the catalogue header. **Scan** hides the product grid and gives
scanning the large catalogue area beside the basket (remembered per device). It pauses while a payment is open.

## Deploy order (shared Supabase project)

1. **SQL** — run `backend/database/migrations/ADD_ICAN_MOBILE_CARD_PAYMENTS.sql` in the Supabase SQL editor.
   It refuses to run (with a clear message) unless these already exist: `ADD_PUBLIC_TRANSACTION_QR.sql`,
   `ICAN_BUY_SELL_COINS_ADDENDUM.sql` + `CLOSE_BUY_ICAN_DIRECT_CALL_HOLE.sql`, the 12-parameter `transfer_ican`
   (`ICAN_TRANSACTION_CONTEXT_MIGRATION.sql`). Safe to run twice.
2. **Edge Function** — from the **ICAN** repo:
   `cd backend/components/supabase && npx supabase functions deploy icanera-mobile-card-pay --no-verify-jwt`
   (`config.toml` already marks it `verify_jwt = false`). It uses the secrets the other Flutterwave functions already
   use: `FLUTTERWAVE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. **Configuration** — the migration seeds `guest_checkout_config.pos_pay_base_url = https://supermartkera.icanera.space`
   (the link put in a customer's wallet inbox). Change it if the store app lives elsewhere:
   `UPDATE public.guest_checkout_config SET value = 'https://your-domain' WHERE key = 'pos_pay_base_url';`
4. **Frontend** — nothing new: `VITE_FLUTTERWAVE_PUBLIC_KEY` and the Flutterwave script in `index.html` are already used.
   The ICAN app's wallet inbox (separate PR in the ICAN repo) opens the pay link when a customer taps the request.

## Check before relying on it

* **Mobile Money prompts use Flutterwave's direct-charge API** (`type=mobile_money_uganda`). Make sure Uganda Mobile
  Money *collections* are enabled on the Flutterwave account, then try a small real amount on MTN and on Airtel. This
  could not be exercised from the development environment (no Flutterwave sandbox access).
* Limits: UGX 500 – 5,000,000 per sale; a sale stays open 30 minutes; at most 4 Mobile Money prompts and 3 wallet requests per sale.

## Known limitation

There is no Flutterwave **webhook** yet. A payment is recorded while the till (or the customer's page) is open and
checking. If a cashier cancels while a Mobile Money approval is still pending and the customer approves afterwards,
nobody is left to confirm it, so that payment is not auto-refunded until someone calls the function for that
reference. A `charge.completed` webhook calling the same function would close this gap.

## Tests

* Database (needs a throwaway Postgres + `psql`, touches no real project):
  `backend/database/tests/imc_payments/run.sh` — 77 checks, including money amounts, double-credit protection,
  refunds, grants and the wallet-inbox link rules.
* Frontend helpers: `node --test frontend/tests/mobileCardPayment.test.js`.
