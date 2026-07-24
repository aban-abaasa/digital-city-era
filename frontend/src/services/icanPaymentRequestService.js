/**
 * ICAN Payment Request Service
 * Real, working "Receive" requests denominated in icaneracoin — reuses the
 * same shared payment_requests table ICAN app already uses for local
 * currency requests (see ALLOW_ICAN_PAYMENT_REQUESTS.sql, which adds 'ICAN'
 * as a valid currency). A request generates a real scannable QR value
 * (`ICANPAY:<code>`); paying it calls sendICAN() (0% fee, same as any
 * wallet-to-wallet send) and marks the request completed.
 */

import { supabase } from './supabase';
import { sendICAN } from './icanWalletService';

const TABLE = 'payment_requests';

function generatePaymentCode() {
  const baseId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random()}`)
    .replace(/-/g, '')
    .toUpperCase();
  return `ICANPAY_${baseId.substring(0, 12)}`;
}

export async function createIcanPaymentRequest({ userId, icanAmount, description = '' }) {
  if (!(icanAmount > 0)) throw new Error('Enter a valid ICAN amount');
  const paymentCode = generatePaymentCode();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      payment_code: paymentCode,
      amount: icanAmount,
      currency: 'ICAN',
      description,
      status: 'pending',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return { ...data, qrValue: `ICANPAY:${paymentCode}` };
}

export async function getIcanPaymentRequest(paymentCode) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('payment_code', paymentCode)
    .eq('currency', 'ICAN')
    .single();

  if (error || !data) throw new Error('Payment request not found');
  if (data.status !== 'pending') throw new Error(`This payment request was already ${data.status}`);
  if (new Date(data.expires_at) < new Date()) throw new Error('This payment request has expired');
  return data;
}

/** Parses a scanned QR value; returns the payment code, or null if not an ICAN payment request. */
export function parseIcanPayCode(scannedText) {
  const match = /^ICANPAY:(.+)$/.exec((scannedText || '').trim());
  return match ? match[1] : null;
}

export async function payIcanRequest({ paymentCode, payerUserId }) {
  const request = await getIcanPaymentRequest(paymentCode);
  if (request.user_id === payerUserId) throw new Error('You cannot pay your own request');

  const transfer = await sendICAN({
    fromUserId: payerUserId,
    toUserId: request.user_id,
    amount: parseFloat(request.amount),
    note: request.description || 'QR payment',
    referenceId: request.id,
  });

  // Best-effort close-out — the transfer itself already succeeded above;
  // if another payer's update races this one, the request just ends up
  // marked completed by whichever update lands first.
  const { error: completionError } = await supabase
    .from(TABLE)
    .update({
      status: 'completed',
      payer_user_id: payerUserId,
      ican_tx_id: transfer.out_tx_id,
      completed_at: new Date().toISOString(),
    })
    .eq('payment_code', paymentCode)
    .eq('status', 'pending');

  if (completionError) {
    throw new Error(`Payment transferred, but the request could not be closed: ${completionError.message}`);
  }

  return { request, transfer };
}

export async function getActiveIcanPaymentRequests(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('currency', 'ICAN')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteIcanPaymentRequest(paymentCode) {
  const { error } = await supabase.from(TABLE).delete().eq('payment_code', paymentCode);
  if (error) throw error;
}
