/**
 * Installment plans — pay for a storefront / business-website order in
 * instalments, then collect it or have it delivered once it is paid in full.
 *
 * The plans live in the shared IcanEra database (the ICAN repo's
 * supabase/migrations/20261011100000_installment_orders.sql), so a plan started
 * here shows up on icanera.space, on a business website and on SupermartKera,
 * and the other way round. Every amount, fee and date comes from the server;
 * this file only sends the cart, the chosen terms and the amount to pay now.
 *
 * Mobile Money / card / bank goes through the installment-pay Edge Function.
 * Money paid in is held inside the plan and only reaches the seller when the
 * order is collected or delivered.
 */
import { supabase } from './supabase';
import { payWithFlutterwave } from './flutterwaveClient';
/** Plans and business websites live on icanera.space: links from here always open them there. */
export const ICANERA_ORIGIN = 'https://icanera.space';
export const businessSiteUrl = (businessProfileId) => `${ICANERA_ORIGIN}/store/${businessProfileId}`;
export const installmentPlanUrl = (code) => `${ICANERA_ORIGIN}/plan/${code}`;

const PENDING_KEY = 'icanera_installment_pending';
const readPending = () => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
  } catch {
    return null;
  }
};
const writePending = value => {
  try {
    if (value) localStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* private mode — resume just won't be available */
  }
};
const unwrap = (res, fallback) => {
  if (res.error) throw new Error(res.error.message || fallback);
  if (res.data && res.data.success === false) throw new Error(res.data.error || fallback);
  return res.data;
};
/** "UGX 5,000", "USD 12.50", "CNY 264.00" — any ISO currency, always with its code so it is never ambiguous. */
export const formatMoney = (amount, currency = 'UGX') => {
  const cur = String(currency || 'UGX').toUpperCase();
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: cur, currencyDisplay: 'code' }).format(n).replace(/\u00a0/g, ' ');
  } catch {
    return `${cur} ${n.toLocaleString('en', { maximumFractionDigits: 2 })}`;
  }
};
export const formatUGX = amount => formatMoney(amount, 'UGX');
/** Decimals a currency's smallest sensible step ("unit") has: 100 -> 0, 1 -> 0, 0.01 -> 2. */
export const unitDecimals = unit => {
  const u = Number(unit) || 1;
  return u >= 1 ? 0 : Math.min(4, Math.max(0, Math.ceil(-Math.log10(u) - 1e-9)));
};
/** Keep only what can be a money amount in the field: digits and (when the currency has cents) one decimal point. */
export const cleanAmountInput = (value, unit) => {
  const dec = unitDecimals(unit);
  const raw = String(value || '').replace(dec ? /[^0-9.]/g : /[^0-9]/g, '');
  if (!dec) return raw;
  const [whole, ...rest] = raw.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, dec)}` : whole;
};
const roundTo = (n, decimals) => Math.round((n + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
// Flutterwave channels differ by currency: Ugandan Mobile Money only exists for UGX; elsewhere offer cards, bank transfer and the local wallets it supports.
const paymentOptionsFor = currency =>
  String(currency).toUpperCase() === 'UGX' ? 'card,mobilemoneyuganda,account' : 'card,banktransfer,mpesa,mobilemoneyghana,mobilemoneyrwanda,mobilemoneytanzania,mobilemoneyzambia,mobilemoneyfranco';
// ── Before signing in ───────────────────────────────────────────────────────
export async function quoteInstallments(businessProfileId, cart) {
  const { data, error } = await supabase.rpc('installment_quote', { p_reseller_business_profile_id: businessProfileId, p_cart: cart });
  if (error) return { success: false, error: error.message };
  return data;
}
export async function getBusinessSiteInfo(businessProfileId) {
  const { data, error } = await supabase.rpc('business_site_info', { p_business_profile_id: businessProfileId });
  if (error || !data) return { found: false, accounts_enabled: false };
  return data;
}
// ── Starting and paying a plan ──────────────────────────────────────────────
export async function createInstallmentPlan(p) {
  return unwrap(
    await supabase.rpc('installment_create', {
      p_reseller_business_profile_id: p.businessProfileId,
      p_cart: p.cart,
      p_installments: p.installments,
      p_frequency_days: p.frequencyDays,
      p_deposit_amount: p.depositAmount,
      p_pay_with: p.payWith ?? 'wallet',
      p_customer_name: p.customerName || null,
      p_customer_phone: p.customerPhone || null,
    }),
    'Could not start this plan',
  );
}
export async function payInstallmentFromWallet(code, amount) {
  return unwrap(await supabase.rpc('installment_pay_wallet', { p_code: code, p_amount: amount }), 'Could not complete this payment');
}
async function confirmFlutterwavePayment(txRef, transactionId) {
  const { data, error } = await supabase.functions.invoke('installment-pay', {
    body: { tx_ref: txRef, transaction_id: transactionId || null },
  });
  if (error) {
    let body = null;
    try {
      body = await error.context.json();
    } catch {
      /* no body — network failure */
    }
    const err = new Error(body?.error || 'We could not reach the server to confirm your payment. Check your connection and reopen this page — your payment is saved.');
    err.retryable = !body;
    throw err;
  }
  if (!data?.success) {
    const err = new Error(data?.error || 'Payment could not be confirmed');
    err.retryable = false;
    throw err;
  }
  return data;
}
/** Mobile Money / card / bank: record the pending payment, take it with Flutterwave, confirm it on the server. */
export async function payInstallmentWithFlutterwave(code, amount, o = {}) {
  const start = unwrap(await supabase.rpc('installment_pay_start', { p_code: code, p_amount: amount, p_dry_run: false }), 'Could not start this payment');
  writePending({ txRef: start.tx_ref, code });
  let payment;
  try {
    payment = await payWithFlutterwave({
      amount: Number(start.charge_amount),
      currency: start.currency,
      paymentOptions: paymentOptionsFor(start.currency),
      txRef: start.tx_ref,
      customerName: o.name || undefined,
      customerPhone: o.phone || undefined,
      title: o.title || 'IcanEra instalment',
      description: `Instalment on plan ${code}`,
    });
  } catch (err) {
    writePending(null);
    throw err;
  }
  if (payment.status !== 'successful') {
    writePending(null);
    throw new Error(payment.status === 'cancelled' ? 'Payment cancelled — you have not been charged.' : 'The payment did not go through. You have not been charged.');
  }
  try {
    const result = await confirmFlutterwavePayment(start.tx_ref, payment.transaction_id);
    writePending(null);
    return result;
  } catch (err) {
    if (!err.retryable) writePending(null);
    throw err;
  }
}
/** Paid but closed the tab before it was confirmed? Finish it on the next visit to the same plan. */
export async function resumePendingInstallmentPayment(code) {
  const pending = readPending();
  if (!pending?.txRef || pending.code !== code) return null;
  try {
    const result = await confirmFlutterwavePayment(pending.txRef, null);
    writePending(null);
    return result;
  } catch (err) {
    if (!err.retryable) writePending(null);
    return null;
  }
}
// ── Reading plans ───────────────────────────────────────────────────────────
export async function getInstallmentPlan(code) {
  const { data, error } = await supabase.rpc('installment_get', { p_code: code });
  if (error) throw new Error(error.message || 'Could not load this plan');
  return data?.success ? { plan: data.plan, terms: data.terms } : null;
}
export async function getMyInstallmentPlans() {
  const { data, error } = await supabase.rpc('installment_my_plans');
  if (error) throw new Error(error.message || 'Could not load your plans');
  return data || [];
}
export async function getMyBusinessAccounts() {
  const { data, error } = await supabase.rpc('business_site_my_accounts');
  if (error) return [];
  return data || [];
}
// ── Collect or deliver ──────────────────────────────────────────────────────
export async function chooseInstallmentPickup(code) {
  return unwrap(await supabase.rpc('installment_choose_pickup', { p_code: code }), 'Could not arrange collection');
}
export async function quoteInstallmentDelivery(code, lat, lng, vehicleTypes = null) {
  return unwrap(
    await supabase.rpc('installment_delivery_quote', {
      p_code: code,
      p_lat: lat,
      p_lng: lng,
      p_vehicle_types: vehicleTypes && vehicleTypes.length ? vehicleTypes : null,
    }),
    'Could not price this delivery',
  );
}
export async function chooseInstallmentDelivery(code, o) {
  return unwrap(
    await supabase.rpc('installment_choose_delivery', {
      p_code: code,
      p_address: o.address || null,
      p_lat: o.lat,
      p_lng: o.lng,
      p_max_hours: o.maxHours,
      p_vehicle_types: o.vehicleTypes && o.vehicleTypes.length ? o.vehicleTypes : null,
    }),
    'Could not arrange delivery',
  );
}
export async function clearInstallmentDelivery(code) {
  return unwrap(await supabase.rpc('installment_clear_delivery', { p_code: code }), 'Could not change delivery');
}
export async function cancelInstallmentPlan(code) {
  return unwrap(await supabase.rpc('installment_cancel', { p_code: code }), 'Could not cancel this plan');
}
export async function browseProducts(query) {
  const { data } = await supabase.rpc('installment_browse_products', { p_query: query, p_limit: 40 });
  return data || [];
}
export async function productOffers(productId) {
  const { data } = await supabase.rpc('installment_product_offers', { p_product_id: productId });
  return data || [];
}
export async function resellerShelf(businessProfileId) {
  const { data } = await supabase.rpc('installment_shelf', { p_reseller_business_profile_id: businessProfileId });
  return data || [];
}
// ── Shops abroad: ship to me ────────────────────────────────────────────────
/** Paid in full on an order from abroad: tell the seller where to send it. */
export async function chooseInstallmentShipping(code, address) {
  return unwrap(await supabase.rpc('installment_choose_shipping', { p_code: code, p_address: address }), 'Could not save your shipping address');
}
/** The parcel arrived: pays the seller. */
export async function confirmInstallmentReceived(code) {
  return unwrap(await supabase.rpc('installment_confirm_received', { p_code: code }), 'Could not confirm delivery');
}
/** The parcel is wrong, damaged or missing: holds the payment and asks support to look. */
export async function reportInstallmentProblem(code, note) {
  return unwrap(await supabase.rpc('installment_report_problem', { p_code: code, p_note: note }), 'Could not report this');
}
/** The signed-in customer's IcanEra wallet balance in icaneracoin (0 for a brand-new account with no wallet yet); null if unknown. Never throws. */
export async function getWalletCoins() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data } = await supabase.from('ican_user_wallets').select('ican_balance').eq('user_id', auth.user.id).maybeSingle();
    return Number(data?.ican_balance || 0);
  } catch {
    return null;
  }
}
// icaneracoin is one coin for the whole world. Each payment on a plan converts at the coin's price in the plan's currency
// at that moment (UGX is fixed at 5,000 per coin); the server returns that price as `coin_price`.
export const coinsFor = (amount, coinPrice) => (Number(coinPrice) > 0 ? Number(amount || 0) / Number(coinPrice) : null);
export const formatCoinAmount = coins => (coins === null || coins === undefined ? '' : `${Number(coins).toLocaleString('en', { maximumFractionDigits: 4 })} ICAN`);
/** `amount` of a currency, as icaneracoin at `coinPrice` (that currency per coin). '' when the price is unknown. */
export const formatCoins = (amount, coinPrice) => formatCoinAmount(coinsFor(amount, coinPrice));
// Why the wallet is the recommended way to pay a plan. Worded to what is actually true: the plan is held in coins (one
// global coin, not tied to any local currency), the item's price is locked from day one, and the wallet has no payment fee.
export const COIN_RECOMMENDATION =
  "Recommended: pay in icaneracoin. What you pay into a plan is held as icaneracoin — one global coin that isn't tied to any local currency — and your item's price is locked from the day you start, so rising prices can't catch up with what you have set aside. The wallet has no payment fee.";
// ── Helpers shared by the screens ───────────────────────────────────────────
export const FREQUENCY_LABELS = { 7: 'every week', 14: 'every 2 weeks', 30: 'every month' };
/** Preview of the schedule the server will build (same maths as _inst_schedule). installments 0 = pay it all today. */
export function previewSchedule(o) {
  const start = o.start ?? new Date();
  const unit = o.unit ?? 1;
  const dec = unitDecimals(unit);
  if (!o.installments) return [{ n: 0, amount: o.items, due: start }];
  const rest = roundTo(o.items - o.deposit, dec);
  const per = roundTo(Math.ceil(roundTo(rest / o.installments / unit, 6)) * unit, dec);
  const rows = [{ n: 0, amount: o.deposit, due: start }];
  for (let k = 1; k <= o.installments; k += 1) {
    const amount = k === o.installments ? roundTo(rest - per * (o.installments - 1), dec) : per;
    rows.push({ n: k, amount, due: new Date(start.getTime() + k * o.frequencyDays * 86400000) });
  }
  return rows;
}
export const STATUS_LABELS = {
  awaiting_deposit: 'Waiting for deposit',
  active: 'Paying',
  ready: 'Paid in full',
  pickup_ready: 'Ready to collect',
  shipping_pending: 'Waiting for the seller to ship',
  shipped: 'On its way to you',
  disputed: 'Under review',
  dispatched: 'On its way',
  completed: 'Completed',
  cancelled: 'Cancelled',
  lapsed: 'Lapsed',
};
