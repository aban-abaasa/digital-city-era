# IcanEra Mobile / Card — deploy notes

A cashier can now take **IcanEra Mobile / Card** at the till for a customer who has **no IcanEra account**
(or who simply prefers Mobile Money / a card). The money is collected by Flutterwave and credited straight into
the store's IcanEra wallet (the store owner's wallet — the same place the wallet-QR payment lands), priced at the
live icaneracoin value, so the store receives the **full sale amount**. The customer carries the gateway fee
(`guest_checkout_config.gateway_fee_pct`, default 3.5 %), shown openly; paying from an IcanEra wallet is fee-free.

## How the cashier uses it

POS → **Process Payment** → **📲 IcanEra Mobile / Card** (the chooser is classic too: the total in serif type and one slim row per way to pay; its Cancel and the payment screens sit above the phone's bottom tab bar, which used to cover them). One screen, three ways, whichever happens first settles the sale.
The screen opens on **Send to phone**, because the person at the counter is often not the person who is paying (the account
holder is at home and sent someone). Flutterwave's own checkout asks for a one-time code (OTP) that goes to the **account
holder's phone**, so it is a deliberate choice (**Pay here**) rather than something that opens by itself:

| Tab | What happens |
| --- | --- |
| **Send to phone** (opens first) | Type the payer's **phone number or 16-digit IcanEra wallet number** (Enter sends). A number that belongs to an IcanEra account gets the request **in the app and as a phone alert** (no fee) - see "The customer at home" below. Any other phone number gets a **Mobile Money approval prompt** (MTN / Airtel detected from the number), approved with the PIN on that phone — nothing is typed or read out at the till. The payer can be anywhere. |
| **Send link** | QR / link / WhatsApp / SMS to the payer's own phone → `/mobile-pay/<ref>`: **Flutterwave's page with every way to pay it has enabled** (Mobile Money, card, bank transfer, USSD …) with no account, or their IcanEra wallet when signed in. Any OTP (e.g. a card's) lands on, and is typed into, the payer's own phone — use this for card payments when the cardholder is not at the till. |
| **Pay here** | Flutterwave's checkout on the till (Mobile Money number or card), opened with a button. Only for a payer who is at the till with their phone, since they must read out / type the OTP. The tab says so. |

The till's own page offers Mobile Money + card only (bank transfer is too slow at a counter); the customer's QR/link page asks
Flutterwave for everything enabled on the account (Flutterwave Dashboard → Settings → Payment methods), so enable or disable
methods there. Whatever the method, the server confirms it with Flutterwave before the store is credited.

The till keeps checking, so a payment made on another phone — or approved a moment late — still completes the sale.
Cancelling voids the charge; pressing Cancel just after a customer paid completes the sale instead of losing it.
A sale paid from the customer's wallet through the link is booked as **IcanEra Wallet**, not Mobile / Card.

The screen is in the app's classic style (ivory card, serif amount, brass rule, underline tabs) and shows only what the
moment needs: the sale amount with one fee line, three tabs, one box and one main button. The explanations (how an
IcanEra member, a plain phone number and a card each pay) are folded into **How this works**. After a request is sent the
button offers "send again" and **Serve next customer** becomes the main button.

### The customer at home (sent someone to buy)

The person at the till is often not the one paying: the account holder is at home and sent someone to the shop. Flutterwave's
own checkout (one-time code to the account holder's phone) is never opened for them. Instead:

1. The cashier chooses **IcanEra Mobile / Card**, types the account holder's phone number and presses **Send request**.
2. The account holder gets a **phone alert** (if device alerts are on) and, inside the app, a **"Waiting for your payment"**
   card at the top of their dashboard, on every tab (`StorePaymentRequests`; it refreshes on its own and disappears once the
   sale is paid, cancelled or out of time). Tapping the alert or the card opens `/mobile-pay/<ref>`.
3. The pay page shows the store, the amount and **Pay from your IcanEra wallet** (no fee) first; **Mobile Money, card or bank**
   is the second, collapsed option with its price (fee included) in the heading. Not enough in the wallet? The other option
   opens by itself. A customer who is not signed in taps **Sign in to pay** and comes straight back to the sale
   (`/login?redirect=/mobile-pay/<ref>`; only a path on this site is honoured, for email, wallet and Google sign-in).
4. The till sees the payment within seconds, and the sale completes.

A phone number with no IcanEra account gets a Mobile Money approval prompt, or the cashier uses **Send link**.

### Serving other customers while a payment is pending
**Serve next customer** puts the sale on hold: the till is cleared for the next customer and the waiting sale appears in a
**Waiting for payment** list in the POS sidebar (up to 5 at once). It is kept on the device, so a refresh does not lose it,
and it **records itself — receipt, stock, sale — the moment its payment lands**, exactly once, even while another customer is
being served (their basket, cash and screen are never touched). **Open** brings a waiting sale's payment screen back to change
how it is paid; **Cancel** voids it (or completes it, if the customer paid a moment ago). A sale that times out is listed as
ended. Each cashier only ever sees and completes their own waiting sales, even on a shared device. Stock is deducted when the
payment is confirmed, not while waiting. If the page is closed mid-recording, that payment is flagged "check My Receipts"
rather than recorded twice.

### Notifications: only pushed ones
The cashier portal no longer shows routine pop-ups ("Loaded 2 products", "Added Milk to cart", "scanned and added", "Scanner
ready", "saved successfully", …) — the screen itself shows the outcome. Real problems (errors, warnings, "no products found")
still appear. The **Notifications** tab now lists only the signed-in user's real wallet-inbox notifications — the same rows the
ICANera push relay delivers to their phone/PC — and its badge is their real unread count. The made-up placeholders ("Welcome",
"System Status: all payment systems operational", "Performance Update") and the dashboard quick-action messages that claimed
to have sent a restock request / opened issue reporting (they did neither) are gone.

A paid Mobile / Card sale **pushes a "Payment received" notification** to the cashier who rang it up and to the store owner;
tapping the cashier's push opens the till (`/cashier-portal`).

The POS also has a **Products | Scan** switch in the catalogue header. **Scan** hides the product grid and gives
scanning the large catalogue area beside the basket (remembered per device). It pauses while a payment is open.

## Deploy order (shared Supabase project)

1. **SQL** — run `backend/database/migrations/ADD_ICAN_MOBILE_CARD_PAYMENTS.sql` in the Supabase SQL editor
   (**run it again if you ran an earlier version**: it adds `imc_pay_my_requests()`, which the dashboard card needs, and makes
   a wallet request's phone alert open the pay page inside the app instead of the admin page).
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
4. **Push relay** — from the **ICAN** repo, redeploy the relay so a cashier's payment push opens the till (it also lets a
   customer's "please pay" alert open `/mobile-pay/<ref>`, from the `push_path` the SQL now sets; no relay change beyond this):
   `cd backend && npx supabase functions deploy wallet-push --no-verify-jwt`. (Without this the push still arrives, but
   tapping it opens the admin page.)
5. **Frontend** — nothing new: `VITE_FLUTTERWAVE_PUBLIC_KEY` and the Flutterwave script in `index.html` are already used.
   The ICAN app's wallet inbox (separate PR in the ICAN repo) opens the pay link when a customer taps the request.
   For the cashier to receive the payment push, they must have turned on device alerts once (the existing prompt).

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
  `backend/database/tests/imc_payments/run.sh` — 102 checks, including money amounts, double-credit protection,
  refunds, grants, the wallet-inbox link rules and the payment push.
* Frontend helpers: `node --test frontend/tests/mobileCardPayment.test.js frontend/tests/pendingSales.test.js`.
