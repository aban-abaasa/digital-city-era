/**
 * "A store is waiting for you to pay" - shown at the top of the customer's dashboard, on every tab.
 *
 * The customer is at home and sent someone to the shop; at the till the cashier picked IcanEra Mobile / Card and
 * sent the request to this customer's account (see CashierIcanMobileCardModal.jsx). Here is where it lands inside the
 * app: the store, the amount and a Pay now button that opens the sale's pay page (MobileCardPayPage), where a signed-in
 * customer pays from their IcanEra wallet with no fee. Nothing about the amount is decided here - the list comes from
 * imc_pay_my_requests(), which only returns sales that are still open and were requested from this customer.
 *
 * It looks again when the tab comes back into view, when a push alert arrives and every 30 s, so a request sent a moment
 * ago appears without a refresh, and one that was paid (here, on another phone, or at the till) disappears.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyPaymentRequests } from '../services/icanMobileCardService';
import { mobileCardPayPath, paymentRequestTimeLeft } from '../utils/mobileCardPayment';

const POLL_MS = 30000;
const formatUGX = (n) => `UGX ${Math.round(Number(n) || 0).toLocaleString()}`;

const StorePaymentRequests = ({ userId }) => {
  const [requests, setRequests] = useState([]);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setRequests(await getMyPaymentRequests());
      setNow(Date.now());
    } catch {
      // keep whatever is listed; the pay link in the push / WhatsApp message still works
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setRequests([]);
      return undefined;
    }
    load();
    const refresh = () => { if (!document.hidden) load(); };
    const onWorkerMessage = (event) => { if (event.data?.type === 'PUSH_RECEIVED') load(); };
    navigator.serviceWorker?.addEventListener('message', onWorkerMessage);
    document.addEventListener('visibilitychange', refresh);
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onWorkerMessage);
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(timer);
    };
  }, [userId, load]);

  // the countdown ticks on its own, and a request whose time ran out drops off the list without waiting for the next look
  useEffect(() => {
    if (!requests.length) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [requests.length]);

  const open = requests.filter((request) => paymentRequestTimeLeft(request.expires_at, now));
  if (!open.length) return null;

  return (
    <div className="space-y-3 mb-4" role="region" aria-live="polite" aria-label="Payments waiting for you">
      {open.map((request) => (
        <div
          key={request.tx_ref}
          className="classic-card classic-rise relative overflow-hidden py-3 pl-5 pr-3 flex flex-col sm:flex-row sm:items-center gap-3"
        >
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#c4a052] to-[#e6c980]" />
          <div className="flex-1 min-w-0">
            <p className="classic-eyebrow flex items-center gap-2">
              <span className="shrink-0 inline-block h-1.5 w-1.5 rounded-full bg-[#c4a052] animate-pulse" aria-hidden="true" />
              Waiting for your payment
            </p>
            <p className="font-classic-display text-lg font-bold text-gray-900 truncate">{request.merchant_name || 'A store'}</p>
            <p className="text-xs text-gray-600">{request.description || 'Purchase'} - someone is at the counter &middot; {paymentRequestTimeLeft(request.expires_at, now)}</p>
          </div>
          <Link
            to={mobileCardPayPath(request.tx_ref)}
            className="shrink-0 text-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#1e1b4b] to-[#3730a3] ring-1 ring-[#e6c980]/50 hover:shadow-[0_10px_22px_-12px_rgba(30,27,75,0.7)] transition-shadow"
          >
            Pay {formatUGX(request.amount_ugx)}
          </Link>
        </div>
      ))}
    </div>
  );
};

export default StorePaymentRequests;
