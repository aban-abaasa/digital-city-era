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
export const formatUGX = amount => `UGX ${Number(amount || 0).toLocaleString('en-UG', { maximumFractionDigits: 0 })}`;
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
      p_deposit_ugx: p.depositUgx,
      p_pay_with: p.payWith ?? 'wallet',
      p_customer_name: p.customerName || null,
      p_customer_phone: p.customerPhone || null,
    }),
    'Could not start this plan',
  );
}
export async function payInstallmentFromWallet(code, amountUgx) {
  return unwrap(await supabase.rpc('installment_pay_wallet', { p_code: code, p_amount_ugx: amountUgx }), 'Could not complete this payment');
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
export async function payInstallmentWithFlutterwave(code, amountUgx, o = {}) {
  const start = unwrap(await supabase.rpc('installment_pay_start', { p_code: code, p_amount_ugx: amountUgx, p_dry_run: false }), 'Could not start this payment');
  writePending({ txRef: start.tx_ref, code });
  let payment;
  try {
    payment = await payWithFlutterwave({
      amount: Number(start.charge_ugx),
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
  const { data } = await supabase.rpc('get_dropship_browsable_products', { p_query: query, p_limit: 40, p_offset: 0 });
  return data || [];
}
export async function productOffers(productId) {
  const { data } = await supabase.rpc('get_dropship_product_offers', { p_product_id: productId });
  return data || [];
}
export async function resellerShelf(businessProfileId) {
  const { data } = await supabase.rpc('get_dropship_storefront', { p_reseller_business_profile_id: businessProfileId });
  return data || [];
}
// ── Helpers shared by the screens ───────────────────────────────────────────
export const FREQUENCY_LABELS = { 7: 'every week', 14: 'every 2 weeks', 30: 'every month' };
export function previewSchedule(o) {
  const start = o.start ?? new Date();
  const rest = o.itemsUgx - o.depositUgx;
  const per = Math.ceil(rest / o.installments / 100) * 100;
  const rows = [{ n: 0, amount: o.depositUgx, due: start }];
  for (let k = 1; k <= o.installments; k += 1) {
    const amount = k === o.installments ? rest - per * (o.installments - 1) : per;
    rows.push({ n: k, amount, due: new Date(start.getTime() + k * o.frequencyDays * 86400000) });
  }
  return rows;
}
export const STATUS_LABELS = {
  awaiting_deposit: 'Waiting for deposit',
  active: 'Paying',
  ready: 'Paid in full',
  pickup_ready: 'Ready to collect',
  dispatched: 'On its way',
  completed: 'Completed',
  cancelled: 'Cancelled',
  lapsed: 'Lapsed',
};
