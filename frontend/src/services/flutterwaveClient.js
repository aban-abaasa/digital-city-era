/**
 * Flutterwave inline checkout — public key only, safe for the browser.
 * Payment is verified server-side by the shared verify-flutterwave-payment
 * Supabase Edge Function before any wallet credit happens.
 */

const PUBLIC_KEY = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY;

export function generateTxRef(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

/**
 * `allPaymentOptions: true` sends no payment_options at all, so Flutterwave offers every way to pay that is
 * enabled on the account for the currency (card, Mobile Money, bank transfer, USSD, ...). The server confirms
 * the payment whichever way it was made, so nothing else depends on the channel.
 * `raw_status` is what Flutterwave itself reported ('pending' for a bank transfer that has not landed yet).
 *
 * @param {{amount:number, currency?:string, customerEmail?:string, customerName?:string,
 *   customerPhone?:string, title?:string, description?:string, txRef:string,
 *   paymentOptions?:string, allPaymentOptions?:boolean}} params
 * @returns {Promise<{status:'successful'|'cancelled'|'failed', transaction_id?:string, tx_ref:string, raw_status?:string}>}
 */
export function payWithFlutterwave(params) {
  return new Promise((resolve, reject) => {
    if (!window.FlutterwaveCheckout) {
      reject(new Error('Flutterwave checkout is not available. Please refresh and try again.'));
      return;
    }
    if (!PUBLIC_KEY) {
      reject(new Error('Flutterwave is not configured for this app.'));
      return;
    }

    window.FlutterwaveCheckout({
      public_key: PUBLIC_KEY,
      tx_ref: params.txRef,
      amount: params.amount,
      currency: params.currency || 'UGX',
      // Uganda-supported channels only — 'card' covers Visa/Mastercard,
      // 'mobilemoneyuganda' covers both MTN and Airtel Uganda mobile money
      // (Flutterwave routes by the number's network automatically), 'account'
      // is bank-account/direct-debit. Tokens like 'bank_transfer'/'barter'
      // aren't valid Flutterwave option strings and were silently ignored.
      // Callers can narrow this (e.g. just 'card' or just 'mobilemoneyuganda')
      // via paymentOptions when the user already picked a method in-app.
      ...(params.allPaymentOptions ? {} : { payment_options: params.paymentOptions || 'card,mobilemoneyuganda,account' }),
      customer: {
        email: params.customerEmail || 'customer@supermartkera.app',
        phone_number: params.customerPhone || '',
        name: params.customerName || 'Supermartkera Customer',
      },
      customizations: {
        title: params.title || 'ICAN Wallet',
        description: params.description || 'Buy icaneracoins',
      },
      callback: (response) => {
        resolve({
          status: response.status === 'successful' ? 'successful' : 'failed',
          transaction_id: response.transaction_id ? String(response.transaction_id) : undefined,
          tx_ref: params.txRef,
          raw_status: response.status,
        });
      },
      onclose: () => {
        resolve({ status: 'cancelled', tx_ref: params.txRef });
      },
    });
  });
}
