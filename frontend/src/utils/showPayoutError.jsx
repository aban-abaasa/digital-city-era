import { toast } from 'react-toastify';
import { ICANERA_WALLET_URL } from './payoutErrors';

/** Show a failed payout; when it was refused, add a link that opens the IcanEra wallet. */
export function showPayoutError(error, fallback = 'Payout failed') {
  const message = error?.message || fallback;
  if (!error?.suggestIcanEra) {
    toast.error(message);
    return;
  }
  toast.error(
    <div>
      <div>{message}</div>
      <a
        href={error.icanEraWalletUrl || ICANERA_WALLET_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'inline-block', marginTop: 6, fontWeight: 700, textDecoration: 'underline' }}
      >
        Open IcanEra Wallet
      </a>
    </div>,
    { autoClose: 12000 },
  );
}
