/**
 * ICAN Payment Request Service - digital-city-era (SupermartKera POS)
 * Real, working "Receive" requests denominated in icaneracoin — reuses the
 * same shared payment_requests table ICAN app already uses for local
 * currency requests. A request generates a real scannable QR value
 * (`ICANPAY:<code>`); paying it calls sendICAN() (0% fee, same as any
 * wallet-to-wallet send) and marks the request completed.
 */

import { supabase } from './supabase';
import { sendICAN, ICAN_TO_UGX, getUserWalletDisplay } from './icanWalletService';

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
  const display = await getUserWalletDisplay(userId);
  const localCurrency = display?.currency_code || 'UGX';
  const localPrice = Number(display?.price_local) > 0 ? Number(display.price_local) : ICAN_TO_UGX;

  const requestFields = {
    user_id: userId,
    payment_code: paymentCode,
    amount: icanAmount,
    currency: 'ICAN',
    description,
    status: 'pending',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  let { data, error } = await supabase
    .from(TABLE)
    .insert(requestFields)
    .select()
    .single();

  // Older deployments reject ICAN in valid_currency. Keep the QR flow
  // working by storing the equivalent UGX amount and marking the request in
  // its description; all reads below convert it back to ICAN before transfer.
  if (error?.code === '23514' && /valid_currency/i.test(error.message || '')) {
    ({ data, error } = await supabase
      .from(TABLE)
      .insert({
        ...requestFields,
        amount: icanAmount * localPrice,
        currency: localCurrency,
        description: `ICAN_REQUEST:${icanAmount}|${localCurrency}|${localPrice}|${description}`,
      })
      .select()
      .single());

    // If a deployment has a narrower currency allow-list, retain the safe
    // UGX fallback while preserving the user's local conversion in the QR
    // request whenever the schema permits it.
    if (error?.code === '23514' && localCurrency !== 'UGX') {
      ({ data, error } = await supabase
        .from(TABLE)
        .insert({
          ...requestFields,
          amount: icanAmount * ICAN_TO_UGX,
          currency: 'UGX',
          description: `ICAN_REQUEST:${icanAmount}|UGX|${ICAN_TO_UGX}|${description}`,
        })
        .select()
        .single());
    }
  }

  if (error) throw error;
  return { ...data, qrValue: `ICANPAY:${paymentCode}` };
}

const getRequestIcanAmount = (request) => {
  if (request.currency === 'ICAN') return Number(request.amount);
  const match = /^ICAN_REQUEST:([\d.]+)\|/.exec(request.description || '');
  return match ? Number(match[1]) : Number(request.amount) / ICAN_TO_UGX;
};

export async function getIcanPaymentRequest(paymentCode, { allowCompleted = false } = {}) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('payment_code', paymentCode)
    .single();

  if (error || !data) throw new Error('Payment request not found');
  if (data.status !== 'pending' && !(allowCompleted && data.status === 'completed')) {
    throw new Error(`This payment request was already ${data.status}`);
  }
  if (new Date(data.expires_at) < new Date()) throw new Error('This payment request has expired');
  return data;
}

/** Parses a scanned QR value; returns the payment code, or null if not an ICAN payment request. */
export function parseIcanPayCode(scannedText) {
  const value = (scannedText || '').trim();
  const qrMatch = /^ICANPAY:(.+)$/i.exec(value);
  if (qrMatch) return qrMatch[1].trim();

  // Manual entry often uses the displayed payment code directly
  // (`ICANPAY_ABC123`) rather than the QR payload (`ICANPAY:ICANPAY_ABC123`).
  return /^ICANPAY_[A-Z0-9]+$/i.test(value) ? value : null;
}

export async function payIcanRequest({ paymentCode, payerUserId }) {
  const request = await getIcanPaymentRequest(paymentCode);
  if (request.user_id === payerUserId) throw new Error('You cannot pay your own request');

  const transfer = await sendICAN({
    fromUserId: payerUserId,
    toUserId: request.user_id,
    amount: getRequestIcanAmount(request),
    note: request.description || 'QR payment',
    referenceId: request.id,
  });
  const payerReceipt = {
    receiptNumber: `ICAN-RCP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    paymentCode,
    transactionId: transfer.out_tx_id || transfer.transaction_id || null,
    amount: Number(request.amount),
    currency: request.currency || 'ICAN',
    payerUserId,
    recipientUserId: request.user_id,
    issuedAt: new Date().toISOString(),
    description: request.description || 'ICAN QR payment',
  };

  const completion = {
    status: 'completed',
    payer_user_id: payerUserId,
    ican_tx_id: transfer.out_tx_id,
    completed_at: new Date().toISOString(),
  };
  let { error: completionError } = await supabase
    .from(TABLE).update(completion).eq('payment_code', paymentCode).eq('status', 'pending');

  // Older shared databases do not have the optional linkage column yet.
  // The transfer is already committed, so close the request without that
  // metadata rather than reporting a false payment failure.
  if (completionError?.message?.includes('ican_tx_id')) {
    ({ error: completionError } = await supabase
      .from(TABLE)
      .update({ status: 'completed', payer_user_id: payerUserId, completed_at: completion.completed_at })
      .eq('payment_code', paymentCode)
      .eq('status', 'pending'));
  }

  if (completionError) {
    throw new Error(`Payment transferred, but the request could not be closed: ${completionError.message}`);
  }

  try {
    const stored = JSON.parse(localStorage.getItem('ican_payment_receipts') || '[]');
    localStorage.setItem('ican_payment_receipts', JSON.stringify([payerReceipt, ...stored].slice(0, 100)));
  } catch {
    // The durable ICAN transaction remains the source of truth if storage is unavailable.
  }

  return { request, transfer, payerReceipt };
}

export async function getActiveIcanPaymentRequests(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).filter(request =>
    request.currency === 'ICAN' || request.description?.startsWith('ICAN_REQUEST:')
  );
}

export async function deleteIcanPaymentRequest(paymentCode) {
  const { error } = await supabase.from(TABLE).delete().eq('payment_code', paymentCode);
  if (error) throw error;
}
