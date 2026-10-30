/**
 * What to tell someone when a mobile-money or bank payout fails.
 *
 * A payout the server REFUSED was refunded, and the cheapest way forward is IcanEra itself: sending to any
 * IcanEra wallet is instant, free and never touches the payment provider. So a refusal carries that
 * recommendation, plus a link that opens the IcanEra wallet. When nothing answered (the connection dropped) the payout
 * may still have gone through, so nothing is recommended - sending again could pay twice.
 *
 * Pure (no network, no UI) so it can be tested on its own.
 */

export const ICANERA_WALLET_URL = 'https://icanera.space/#wallet';
export const ICANERA_FALLBACK_HINT = 'You can still send IcanEra to any IcanEra wallet instantly, with no fee.';
// Problems the person fixes themselves (balance, PIN, a typo): another way of paying would not help.
const NOT_A_PAYOUT_FAULT = /insufficient|not enough|own (registered )?phone number|\bpin\b|\bvalid\b|required|enter |choose |too small/i;

/**
 * An Error for a refused payout. `rawMessage` is the server's own wording (without our advice); `suggestIcanEra` and
 * `icanEraWalletUrl` let a screen offer an "Open IcanEra Wallet" button.
 */
export function icanEraFallbackError(message) {
  const text = String(message || '').trim();
  if (!text || NOT_A_PAYOUT_FAULT.test(text)) return Object.assign(new Error(text || 'Transfer failed'), { rawMessage: text });
  const sentence = /[.!?]$/.test(text) ? text : `${text}.`;
  return Object.assign(new Error(`${sentence} ${ICANERA_FALLBACK_HINT}`), {
    rawMessage: text,
    suggestIcanEra: true,
    icanEraWalletUrl: ICANERA_WALLET_URL,
  });
}

/** The payment provider's raw refusal, in words a rider or shopper can act on. */
export function friendlyPayoutError(message) {
  if (/ip whitelist/i.test(message)) {
    return "Cash-out isn't available right now - the payment provider hasn't approved our server yet. Your IcanEra has been refunded.";
  }
  if (/unrecognized bank_code/i.test(message)) return 'Choose your bank from the list.';
  return message;
}

/**
 * The error for a failed supabase.functions.invoke(). invoke() only says "Edge Function returned a non-2xx status code";
 * the function's own {error: "..."} reply sits on error.context and has to be read out. If it answered, the refusal is final.
 */
export async function payoutFailure(error, fallback = 'Payout failed') {
  const response = error?.context;
  if (response && typeof response.json === 'function') {
    try {
      const parsed = await (typeof response.clone === 'function' ? response.clone() : response).json();
      if (parsed?.error) return icanEraFallbackError(friendlyPayoutError(String(parsed.error)));
    } catch {
      // The reply was not JSON (e.g. a gateway error page): nothing of ours answered.
    }
  }
  return new Error(`${error?.message || fallback}. If your connection dropped, check your balance and history before trying again - the payout may have gone through.`);
}
