/**
 * ICAN Payment Request Service - digital-city-era (SupermartKera POS)
 * Real, working "Receive" requests denominated in icaneracoin — reuses the
 * same shared payment_requests table ICAN app already uses for local
 * currency requests. A request generates a real scannable QR value
 * (`ICANPAY:<code>`); paying it calls sendICAN() (0% fee, same as any
 * wallet-to-wallet send) and marks the request completed.
 */

import { supabase } from './supabase';
import { sendICAN, ICAN_TO_UGX, getUserWalletDisplay, ugxToICAN } from './icanWalletService';
import transactionService from './transactionService';

const TABLE = 'payment_requests';

function generatePaymentCode() {
  const baseId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random()}`)
    .replace(/-/g, '')
    .toUpperCase();
  return `ICANPAY_${baseId.substring(0, 12)}`;
}

export async function createIcanPaymentRequest({
  userId,
  icanAmount,
  description = '',
  supermarketId = null,
  merchantName = 'SupermartKera',
  counterpartyType = 'business',
  expenseClassification = 'business_expense',
}) {
  if (!(icanAmount > 0)) throw new Error('Enter a valid ICAN amount');
  const paymentCode = generatePaymentCode();
  // POS payments belong to the store wallet, not the individual cashier.
  // Keep the cashier as a fallback for older/unassigned store records.
  let recipientUserId = userId;
  if (supermarketId) {
    const { data: supermarket } = await supabase
      .from('supermarkets')
      .select('owner_user_id, name')
      .eq('id', supermarketId)
      .maybeSingle();
    recipientUserId = supermarket?.owner_user_id || recipientUserId;
    merchantName = supermarket?.name || merchantName;
  }
  const display = await getUserWalletDisplay(recipientUserId);
  const localCurrency = display?.currency_code || 'UGX';
  const localPrice = Number(display?.price_local) > 0 ? Number(display.price_local) : ICAN_TO_UGX;

  const requestFields = {
    user_id: recipientUserId,
    payment_code: paymentCode,
    amount: icanAmount,
    currency: 'ICAN',
    description,
    status: 'pending',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  const richRequestFields = {
    ...requestFields,
    merchant_name: merchantName,
    counterparty_type: counterpartyType,
    expense_classification: expenseClassification,
    supermarket_id: supermarketId,
  };

  let { data, error } = await supabase
    .from(TABLE)
    .insert(richRequestFields)
    .select()
    .single();

  // Older payment_requests tables do not have the reporting columns yet.
  // Retry with the shared legacy shape while keeping the reporting context in
  // the description for the payer-side ledger fallback.
  if (error && /column|schema cache/i.test(error.message || '')) {
    ({ data, error } = await supabase
      .from(TABLE)
      .insert({
        ...requestFields,
        description: `[${merchantName}|${expenseClassification}] ${description}`,
      })
      .select()
      .single());
  }

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
  // A real, public URL rather than the old app-only `ICANPAY:<code>` scheme:
  // any camera app can open it, not just this wallet's own scanner. Whoever
  // opens it lands on /pay/:paymentCode (see PayRequestPublicPage.jsx), which
  // reads the request straight from payment_requests' existing "Anyone can
  // view valid payment requests by code" RLS policy — no account needed to
  // see what's being asked for; paying still requires a signed-in wallet.
  return { ...data, qrValue: `${window.location.origin}/pay/${paymentCode}` };
}

export const getRequestIcanAmount = (request) => {
  if (request.currency === 'ICAN') return Number(request.amount);
  const match = /^ICAN_REQUEST:([\d.]+)\|/.exec(request.description || '');
  return match ? Number(match[1]) : Number(request.amount) / ICAN_TO_UGX;
};

/**
 * Shapes a raw payment_requests row for display on the public /pay/:code
 * page — strips the internal `ICAN_REQUEST:` encoding some deployments fall
 * back to (see createIcanPaymentRequest) into a plain amount + description.
 */
export const getPaymentRequestDisplay = (request) => {
  const icanMatch = /^ICAN_REQUEST:([\d.]+)\|([A-Z]+)\|([\d.]+)\|([\s\S]*)$/.exec(request.description || '');
  if (icanMatch) {
    return {
      icanAmount: Number(icanMatch[1]),
      localAmount: Number(request.amount),
      localCurrency: icanMatch[2],
      description: icanMatch[4]
    };
  }
  return {
    icanAmount: request.currency === 'ICAN' ? Number(request.amount) : null,
    localAmount: request.currency !== 'ICAN' ? Number(request.amount) : null,
    localCurrency: request.currency !== 'ICAN' ? request.currency : null,
    description: request.description || ''
  };
};

async function findRecentIcanTransfer({ payerUserId, recipientUserId, amount }) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('ican_coin_transactions')
    .select('id')
    .eq('sender_user_id', payerUserId)
    .eq('recipient_user_id', recipientUserId)
    .eq('ican_amount', amount)
    .eq('transaction_type', 'transfer_out')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data?.id || null;
}

export async function getIcanPaymentRequest(paymentCode, { allowCompleted = false } = {}) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('payment_code', paymentCode)
    .single();

  if (error || !data) throw new Error('Payment request not found');
  if (data.status !== 'pending' && !allowCompleted) {
    throw new Error(`This payment request was already ${data.status}`);
  }
  if (data.status === 'pending' && new Date(data.expires_at) < new Date()) {
    throw new Error('This payment request has expired');
  }
  return data;
}

/** Parses a scanned QR value; returns the payment code, or null if not an ICAN payment request. */
export function parseIcanPayCode(scannedText) {
  const value = (scannedText || '').trim();

  // Current QR/link form: a public https://<host>/pay/<code> URL (see
  // createIcanPaymentRequest) — scannable by any camera app, not just this
  // wallet's own scanner.
  const urlMatch = /\/pay\/([A-Za-z0-9_]+)\/?(?:[?#].*)?$/i.exec(value);
  if (urlMatch) return urlMatch[1].trim();

  // Legacy in-app-only scheme from before the public QR page existed —
  // still accepted so an old/cached QR code keeps working.
  const schemeMatch = /^ICANPAY:(.+)$/i.exec(value);
  if (schemeMatch) return schemeMatch[1].trim();

  // Manual entry often uses the displayed payment code directly
  // (`ICANPAY_ABC123`) rather than the QR payload.
  return /^ICANPAY_[A-Z0-9]+$/i.test(value) ? value : null;
}

export async function payIcanRequest({
  paymentCode,
  payerUserId,
  expenseClassification = null,
  counterpartyType = null,
}) {
  const request = await getIcanPaymentRequest(paymentCode);
  if (request.user_id === payerUserId) throw new Error('You cannot pay your own request');

  // Repair a previous wallet transfer whose old RLS-blocked completion update
  // left the request pending; never charge the payer twice.
  const { data: existingCompletion, error: preflightError } = await supabase.rpc(
    'complete_ican_payment_request',
    { p_payment_code: paymentCode, p_payer_user_id: payerUserId },
  );
  if (preflightError) throw preflightError;
  let transfer;
  if (existingCompletion?.success) {
    transfer = { out_tx_id: existingCompletion.ican_tx_id };
  } else if (existingCompletion?.error === 'Payment transfer not found') {
    const amount = getRequestIcanAmount(request);
    const recentTransferId = await findRecentIcanTransfer({
      payerUserId,
      recipientUserId: request.user_id,
      amount,
    });
    transfer = recentTransferId
      ? { out_tx_id: recentTransferId }
      : await sendICAN({
          fromUserId: payerUserId,
          toUserId: request.user_id,
          amount,
          note: request.description || 'QR payment',
          referenceId: request.id,
          localAmount: amount * ICAN_TO_UGX,
          localCurrency: 'UGX',
          merchantName: request.merchant_name || 'SupermartKera',
          counterpartyType: counterpartyType || request.counterparty_type || 'business',
          expenseClassification: expenseClassification || request.expense_classification || 'business_expense',
        });
  } else {
    throw new Error(existingCompletion?.error || 'Payment request could not be prepared');
  }
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

  const { data: completion, error: completionError } = await supabase.rpc(
    'complete_ican_payment_request',
    {
      p_payment_code: paymentCode,
      p_payer_user_id: payerUserId,
      p_ican_tx_id: transfer.out_tx_id,
    },
  );
  if (completionError) throw completionError;
  if (!completion?.success) throw new Error(completion?.error || 'Payment request could not be completed');

  try {
    const stored = JSON.parse(localStorage.getItem('ican_payment_receipts') || '[]');
    localStorage.setItem('ican_payment_receipts', JSON.stringify([payerReceipt, ...stored].slice(0, 100)));
  } catch {
    // The durable ICAN transaction remains the source of truth if storage is unavailable.
  }

  return { request, transfer, payerReceipt };
}

/**
 * Pays a POS invoice/receipt (see get_invoice_public() /
 * ADD_PUBLIC_INVOICE_QR_ACCESS.sql) with ICAN — the other kind of QR code
 * the wallet's Pay scanner (and the public /invoice/:id page itself) can
 * now recognize, alongside its own payment_requests codes. Sends ICAN
 * straight to the selling store's wallet, then settles the *real* POS
 * transaction (payment_status/balance_due_ugx) via
 * settle_invoice_via_ican_transfer() — which independently verifies the
 * transfer server-side (a paying customer isn't the sale's cashier/admin/
 * manager, so collect_invoice_payment's staff-only gate doesn't apply here)
 * — so the sale itself reflects the payment, not just the wallet's ledger.
 */
export async function payInvoiceWithIcan({
  transactionId,
  payerUserId,
  expenseClassification = 'personal_expense',
  counterpartyType = 'business',
}) {
  const invoiceResult = await transactionService.getPublicInvoice(transactionId);
  if (!invoiceResult.success) throw new Error(invoiceResult.error || 'Invoice not found');
  const invoice = invoiceResult.invoice;

  const balanceDue = Number(invoice.balanceDue) || 0;
  if (balanceDue <= 0) throw new Error('This invoice is already fully paid');

  const { data: store, error: storeError } = await supabase
    .from('supermarkets')
    .select('owner_user_id, name')
    .eq('id', invoice.supermarketId)
    .maybeSingle();
  if (storeError || !store?.owner_user_id) throw new Error('Could not find this store\'s wallet');
  if (store.owner_user_id === payerUserId) throw new Error('You cannot pay your own store\'s invoice');

  const icanAmount = ugxToICAN(balanceDue);
  const transfer = await sendICAN({
    fromUserId: payerUserId,
    toUserId: store.owner_user_id,
    amount: icanAmount,
    note: `Invoice ${invoice.receiptNumber}`,
    referenceId: transactionId,
    localAmount: balanceDue,
    localCurrency: 'UGX',
    merchantName: store.name || invoice.storeName || 'SupermartKera',
    counterpartyType,
    expenseClassification,
  });

  const settleResult = await transactionService.settleInvoiceViaIcanTransfer(transactionId, transfer.out_tx_id);
  if (!settleResult.success) {
    // The ICAN transfer already succeeded — surface this distinctly so the
    // customer isn't told the payment failed when their money did move.
    throw new Error(`Payment sent, but the store's records could not be updated automatically: ${settleResult.error}. Show this screen to the cashier.`);
  }

  return { invoice, transfer, amountApplied: settleResult.amountApplied, paymentStatus: settleResult.paymentStatus };
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
