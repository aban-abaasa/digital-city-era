/**
 * IcanEra Digital Card — digital-city-era (SupermartKera POS)
 * A customer who comes to the till with the digital card from their IcanEra wallet pays the sale with it: the
 * cashier scans the card's QR, the customer types their wallet transaction PIN on the till, and the sale is paid
 * from their IcanEra wallet to the store's, with no fee.
 *
 * Thin wrapper around two server pieces (see ADD_ICAN_CARD_POS_PAYMENTS.sql and the icanera-card-pos-pay Edge
 * Function in the ICAN repo). The browser only ever sends the sale's reference, the card's QR token and the PIN —
 * the amount, the store and the recipient are fixed by the sale the cashier opened (icanMobileCardService.js), and
 * the PIN is checked on the server.
 */

import { supabase } from './supabase';

/**
 * Who is behind a scanned card QR — the same public lookup the card's own scan page uses. Resolves
 * { holder_first_name, last4, pin_pay_enabled } or null when the QR is not an active IcanEra card.
 */
export async function lookupDigitalCard(token) {
  const { data, error } = await supabase.rpc('get_card_qr_info', { p_token: token });
  if (error) throw new Error(error.message || 'Could not read this card');
  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

/**
 * Pay an open sale with a digital card. Resolves the settled sale { tx_ref, amount_ugx, channel, payer_name, ican_amount,
 * ican_tx_id, card_last4, ... }. Throws an Error with the server's message (wrong PIN, not enough coins, card switched
 * off ...); .retryable = true when the server simply could not be reached, in which case the payment may or may not have
 * gone through — check the sale before asking for the PIN again.
 */
export async function payWithDigitalCard({ txRef, token, pin }) {
  const { data, error } = await supabase.functions.invoke('icanera-card-pos-pay', {
    body: { tx_ref: txRef, token, pin },
  });
  if (error) {
    let body = null;
    try { body = await error.context.json(); } catch { /* no body — network failure */ }
    const err = new Error(body?.error || 'We could not reach the server. Check the connection — then check whether the customer was charged before trying again.');
    err.retryable = !body;
    throw err;
  }
  if (!data?.success) throw new Error(data?.error || 'The card payment could not be completed');
  return data;
}
