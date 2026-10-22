# IcanEra Digital Card at the till — deploy notes

A customer who comes to the till with the **digital card from their IcanEra wallet** (ICAN app → Wallet → Cards) can now
pay the sale with it. The cashier scans the card's QR, the customer types their wallet **transaction PIN** on the till, and
the sale is paid from their IcanEra wallet to the store's IcanEra wallet — priced at the live icaneracoin value, **no fee**,
the store receives the full sale amount. It is booked as an **IcanEra Wallet** sale (that is where the money comes from).

It sits beside the other ways to pay in the cashier portal (`/employee-portal`): **IcanEra Wallet** (customer scans the till's
QR), **IcanEra Digital Card** (this), **IcanEra Mobile / Card** (Mobile Money or a card, no account needed) and **Cash**.

## How the cashier uses it

POS → **Process Payment** → **💳 IcanEra Digital Card**.

1. The sale opens on the server (the same charge IcanEra Mobile / Card uses): the amount and the store's wallet are fixed there.
2. The till's camera opens. The customer opens their card in the IcanEra app (**Wallet → Cards**, tap the card to turn it over to
   see the QR) and holds it up. No camera, or a customer who can send the link? **Type or paste the card link** instead.
3. The screen shows **whose card it is** — first name and last 4 digits, enough to be sure it is the right person — and a PIN box.
4. The **customer types their own IcanEra wallet PIN** (the PIN is masked and goes straight to the server; it is not stored).
5. Paid: the sale completes — receipt, stock and the "Payment received" push to the cashier and the store owner, exactly like any
   other IcanEra payment — and the customer gets a note in their wallet inbox saying what was taken and from which card.

If the PIN is wrong the screen says how many tries are left (3 wrong tries lock the card for 30 minutes — the same lock the
wallet uses everywhere, and it is shared with the card QR's own scan page). **No card with them? Choose another way to pay**
voids the sale and goes back to the list. A sale is paid by the card or cancelled: there is nothing to wait for, so there is no
"serve next customer" here.

### What can stop a card payment (and what the cashier sees)

| Situation | What happens |
| --- | --- |
| The QR is not an IcanEra card (a product barcode, a website ...) | "That is not an IcanEra card." — nothing is sent to the server |
| The card QR is switched off, rotated, or the card frozen | "This card QR is not active. Ask the customer to open their card again." |
| The owner turned **PIN approval at scan** off, or it is a business card | "This card cannot be used to pay with a PIN here …" — choose another way |
| Wrong PIN | "Wrong PIN. Attempts remaining: n" — the PIN box clears |
| Locked after 3 wrong PINs | "Too many wrong PIN attempts. This card is locked for a while." |
| Not enough ICAN coins in the wallet | "Insufficient ICAN balance …" — nothing moves; the sale stays open for another way to pay |
| The store owner's own card | Refused: a store cannot pay itself |
| The answer is lost on the way back (bad connection) | The screen looks at the sale itself: if it was paid, the sale completes once; otherwise it shows the error |
| Offline | "A card payment needs an internet connection." (cash still works offline) |

Limits are the same as every IcanEra till payment: **UGX 500 – 5,000,000** per sale.

### The customer's side

In the ICAN app, Wallet → Cards → **PIN approval at scan** must be **ON** (it is by default; the card screen now says so). The customer
needs a **transaction PIN** set, and enough **ICAN coins** — like "Pay from your IcanEra wallet" on the pay page, a card sale is taken
from the wallet's ICAN coin balance at the live price.

## Why it is safe to type a PIN on the till

* The till sends only `{ sale reference, card QR token, PIN }`. The **amount, the store and the recipient** were fixed by the sale the
  cashier opened — the till cannot pay itself an amount or a destination of its own choosing.
* Only **the cashier who opened that sale** (or the store owner) can start a card payment on it, only while the sale is open, at most
  **5 card tries per sale** (so a till cannot be used to hammer a PIN), and never the store's own card (`imc_card_begin`).
* The PIN is checked on the server (`icanera-card-pos-pay`) with the wallet's 3-tries / 30-minute lock. The card holder can switch the
  QR or PIN approval off at any time in Wallet → Cards.
* The debit and the credit are **one atomic transfer** (`imc_pay_with_card`, the same maths as a customer paying from their wallet at
  home): both happen or neither does, so there is never anything to refund.
* `imc_card_begin` and `imc_pay_with_card` are **service_role only** — a signed-in browser cannot call them and skip the PIN.

## Deploy order (shared Supabase project)

1. **SQL** — run `backend/database/migrations/ADD_ICAN_CARD_POS_PAYMENTS.sql` in the Supabase SQL editor. It refuses to run (with a clear
   message) unless these already exist: `ADD_ICAN_MOBILE_CARD_PAYMENTS.sql` (this repo — run its latest version, see the Mobile / Card notes),
   `ICAN_DIGITAL_CARD_QR.sql` (ICAN repo, `backend/`) and the 12-parameter `transfer_ican`. Safe to run twice.
2. **Edge Function** — from the **ICAN** repo:
   `cd backend/components/supabase && npx supabase functions deploy icanera-card-pos-pay --no-verify-jwt`
   (`config.toml` already marks it `verify_jwt = false`; the function checks the cashier's own session itself). It needs only the secrets
   every function already has: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. **Frontend** — deploy this repo as usual (no new environment variables; the card scanner uses `jsqr`, already a dependency).
4. **ICAN app** — the wording on Wallet → Cards → *PIN approval at scan* now mentions paying at a SupermartKera till (ICAN repo, separate PR).

## Check before relying on it

* Try a small sale with a real card and a real PIN on a phone **and** on a PC (the camera needs HTTPS or localhost, like every browser camera).
  This could not be done from the development environment (no access to the shared project).
* The card number is an IcanEra number, not a Visa / Mastercard number: it only works here, at a till running this app.

## Not covered

* Customers who only hold **local-currency (non-coin) wallet money** cannot pay this way yet — as with "Pay from your IcanEra wallet" on the pay
  page, the till takes ICAN coins. They can top up coins in the app, or pay by IcanEra Mobile / Card or cash.
* The older standalone `/cashier-portal` page (`CushierPortal.jsx`) is untouched: like IcanEra Mobile / Card, this is in the cashier portal
  everyone signs in to (`/employee-portal`).

## Tests

* Database (needs a throwaway Postgres + `psql`, touches no real project): `backend/database/tests/imc_payments/run.sh` — 153 checks in all,
  51 of them for the card payment: who may call what, the gate (wrong cashier, closed / expired / paid sale, the store's own card, the 5-try
  cap), money amounts and rounding, no double charge, nothing moves when the wallet is short or the price is unavailable, the notifications.
* Frontend helpers: `node --test frontend/tests/digitalCardPayment.test.js` (what a card QR may look like, the PIN rule, the limits, the data
  handed to the till).
