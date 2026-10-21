/**
 * IcanEra Mobile / Card — digital-city-era (SupermartKera POS)
 * A customer with NO IcanEra account pays a POS sale with Mobile Money or a card
 * through Flutterwave and the money is credited straight into the store's
 * IcanEra wallet. A customer who HAS one can pay from it instead, with no fee.
 * The cashier can take the payment on the till, show a QR, send the link, ask
 * a phone for a Mobile Money approval, or request it in the customer's IcanEra
 * wallet inbox — so the customer does not have to be at the till.
 *
 * Thin wrapper around the imc_pay_* database functions and the
 * icanera-mobile-card-pay Edge Function (see ADD_ICAN_MOBILE_CARD_PAYMENTS.sql):
 * the amount, the fee and the recipient are always fixed by the server — the
 * browser only ever asks for a charge and shows Flutterwave's checkout.
 */

import { supabase } from './supabase';
import { payWithFlutterwave } from './flutterwaveClient';
import { classifyCustomerInput, maskAccountName } from '../utils/mobileCardPayment';

const unwrap = (response, fallback) => {
  const { data, error } = response;
  if (error) throw new Error(error.message || fallback);
  if (!data?.success) throw new Error(data?.error || fallback);
  return data;
};

// The readable message out of a failed Edge Function call, and whether it is worth retrying.
async function functionError(error, fallback) {
  let body = null;
  try { body = await error.context.json(); } catch { /* no body — network failure */ }
  const err = new Error(body?.error || fallback);
  err.retryable = !body || Number(error.context?.status) >= 500;
  return err;
}

/** Cashier: open a charge for this sale. Resolves { tx_ref, amount_ugx, processing_fee_ugx, charge_ugx, expires_at, ... }. */
export async function createMobileCardCharge({
  supermarketId,
  amountUGX,
  description = '',
  customerName = '',
  customerPhone = '',
}) {
  return unwrap(
    await supabase.rpc('imc_pay_create', {
      p_supermarket_id: supermarketId,
      p_amount_ugx: amountUGX,
      p_description: description || null,
      p_customer_name: customerName || null,
      p_customer_phone: customerPhone || null,
    }),
    'Could not start this Mobile Money / card payment',
  );
}

/** Anyone holding the link: what the customer's pay page shows. Resolves null when the link is not valid. */
export async function getMobileCardCharge(txRef) {
  const { data, error } = await supabase.rpc('imc_pay_info', { p_tx_ref: txRef });
  if (error) throw new Error(error.message || 'Could not load this payment');
  return data?.found ? data : null;
}

/**
 * The till's view of its own charge — cheap, polled every few seconds. It also sees a customer who paid from
 * their wallet (which never touches Flutterwave). Resolves { found, status, ...receipt details once paid }.
 */
export async function getMobileCardStatus(txRef) {
  const { data, error } = await supabase.rpc('imc_pay_status', { p_tx_ref: txRef });
  if (error) throw new Error(error.message || 'Could not check this payment');
  return data || { found: false };
}

/**
 * Ask the server to check the charge with Flutterwave and, when it was paid, credit the store.
 * Safe to call repeatedly: resolves { paid: true, ... } once credited, { paid: false } while nothing has been
 * paid yet. Throws an Error otherwise — .terminal = true when the charge can never succeed (cancelled / refunded),
 * .retryable = true when the server simply could not be reached.
 */
export async function confirmMobileCardPayment(txRef, transactionId = null) {
  const { data, error } = await supabase.functions.invoke('icanera-mobile-card-pay', {
    body: { tx_ref: txRef, transaction_id: transactionId },
  });
  if (error) {
    throw await functionError(error, 'We could not reach the server to confirm the payment. Check the connection — the payment is saved and will be checked again.');
  }
  if (data?.success) return { ...data, paid: true };
  if (data?.pending) return { paid: false };
  const err = new Error(data?.error || 'Payment could not be confirmed');
  err.terminal = !!data?.terminal;
  err.retryable = !data?.terminal;
  throw err;
}

/** Cashier: void a charge nobody has paid. Best effort — a payment that still lands is refunded server-side. */
export async function cancelMobileCardCharge(txRef) {
  const { data, error } = await supabase.rpc('imc_pay_cancel', { p_tx_ref: txRef });
  if (error) throw new Error(error.message || 'Could not cancel this payment');
  return data;
}

/**
 * Show Flutterwave's checkout (Mobile Money + card only — the bank-debit option is too slow for a till)
 * for an already-created charge. Resolves { status: 'successful'|'cancelled'|'failed', transaction_id, tx_ref };
 * the caller then confirms with confirmMobileCardPayment().
 */
export function takeMobileCardPayment(charge, { customerName, customerPhone, storeName = 'SupermartKera' } = {}) {
  return payWithFlutterwave({
    amount: Number(charge.charge_ugx),
    currency: 'UGX',
    txRef: charge.tx_ref,
    paymentOptions: 'card,mobilemoneyuganda',
    customerName: customerName || undefined,
    customerPhone: customerPhone || undefined,
    title: storeName,
    description: `Purchase at ${storeName}`,
  });
}

/**
 * Cashier: have Flutterwave send a Mobile Money approval prompt (MTN / Airtel Uganda) to a phone, so the
 * customer approves with their PIN wherever they are. The till's polling credits the store once they do.
 */
export async function requestMobileMoneyPrompt(txRef, { phone, network = null, name = '' }) {
  const { data, error } = await supabase.functions.invoke('icanera-mobile-card-pay', {
    body: { action: 'request_momo', tx_ref: txRef, phone, network, name },
  });
  if (error) throw await functionError(error, 'Could not send the request. Check the connection and try again.');
  if (!data?.success) throw new Error(data?.error || 'Could not send the request');
  return data;
}

/**
 * Cashier: who is behind what was typed? Phone number, 16-digit IcanEra wallet number or email.
 * Resolves { userId, name } (name shortened to 'Jane K.' — enough to confirm it is the right person) or null.
 */
export async function findIcanCustomer(input) {
  const kind = classifyCustomerInput(input);
  if (!kind.type || kind.type === 'business') return null;

  let query = supabase.from('user_accounts').select('user_id, account_holder_name');
  if (kind.type === 'account') query = query.eq('account_number', kind.value);
  else if (kind.type === 'email') query = query.eq('email', kind.value);
  else query = query.in('phone_number', kind.variants);

  const { data, error } = await query.limit(1);
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row?.user_id) return null;
  return { userId: row.user_id, name: maskAccountName(row.account_holder_name) };
}

/** Cashier: put the request in that customer's IcanEra wallet inbox, with a link that opens this sale's pay page. */
export async function requestWalletPayment(txRef, customerUserId) {
  return unwrap(
    await supabase.rpc('imc_pay_request_wallet', { p_tx_ref: txRef, p_recipient_user_id: customerUserId }),
    'Could not send the request to the customer\'s IcanEra wallet',
  );
}

/** Customer (signed in): pay the sale from their IcanEra wallet — the store gets the full amount, no fee. */
export async function payMobileCardFromWallet(txRef) {
  return unwrap(await supabase.rpc('imc_pay_wallet', { p_tx_ref: txRef }), 'The wallet payment could not be completed');
}
