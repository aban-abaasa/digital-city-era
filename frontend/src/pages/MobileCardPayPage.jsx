// ===================================================
// 📲 PUBLIC "PAY THIS SALE" PAGE
// Opened from the till's QR code, a WhatsApp/SMS link, or a request in the customer's IcanEra wallet
// inbox (see CashierIcanMobileCardModal.jsx). No account is needed to pay:
//   - Mobile Money or card through Flutterwave (the customer adds a small processing fee), or
//   - from their IcanEra wallet when signed in (no fee).
// The amount, the fee and who is paid are all fixed server-side (imc_pay_create); this page only shows
// them and starts the payment. Money reaches the store's IcanEra wallet once Flutterwave confirms it
// (icanera-mobile-card-pay) - or instantly for a wallet payment. See ADD_ICAN_MOBILE_CARD_PAYMENTS.sql.
// ===================================================

import '../styles/classic-auth.css';
import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiCheckCircle, FiClock } from 'react-icons/fi';
import { supabase } from '../services/supabase';
import {
  getMobileCardCharge,
  takeMobileCardPayment,
  confirmMobileCardPayment,
  payMobileCardFromWallet,
} from '../services/icanMobileCardService';
import { isMobileCardTxRef, mobileCardChannelLabel } from '../utils/mobileCardPayment';

const PENDING_KEY = 'imc_pay_pending';
const formatUGX = (n) => `UGX ${Math.round(Number(n) || 0).toLocaleString()}`;

const readPending = () => {
  try { return localStorage.getItem(PENDING_KEY); } catch { return null; }
};
const writePending = (value) => {
  try {
    if (value) localStorage.setItem(PENDING_KEY, value);
    else localStorage.removeItem(PENDING_KEY);
  } catch { /* private mode: resuming just will not be available */ }
};

const MobileCardPayPage = () => {
  const { txRef } = useParams();
  const [charge, setCharge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [working, setWorking] = useState(null); // 'card' | 'wallet' | 'confirming'
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const confirmingRef = useRef(false);

  const refresh = async () => {
    try {
      const info = await getMobileCardCharge(txRef);
      setCharge(info);
      return info;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      if (isMobileCardTxRef(txRef)) await refresh();
      setLoading(false);
      const { data } = await supabase.auth.getUser();
      setSignedIn(!!data?.user);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txRef]);

  // Keep the page honest while it is open: it flips to "paid" when the sale is settled some other way.
  useEffect(() => {
    if (!charge?.payable || receipt) return undefined;
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charge?.payable, receipt]);

  // Paid, then closed the tab before it was confirmed? Finish it on the next visit.
  useEffect(() => {
    if (readPending() !== txRef) return;
    confirmMobileCardPayment(txRef)
      .then((result) => { if (result.paid) { writePending(null); setReceipt(result); refresh(); } })
      .catch((err) => { if (err.terminal) writePending(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txRef]);

  // Flutterwave said it worked: ask the server to confirm and credit the store (Mobile Money can lag a few seconds).
  const confirmUntilDone = async (transactionId) => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setWorking('confirming');
    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
          const result = await confirmMobileCardPayment(txRef, transactionId);
          if (result.paid) {
            writePending(null);
            setReceipt(result);
            await refresh();
            return;
          }
        } catch (err) {
          if (err.terminal) { writePending(null); setError(err.message); return; }
          if (!err.retryable) { setError(err.message); return; }
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      setError('We have not been able to confirm the payment yet. If money left your account it will be returned automatically; otherwise reopen this page in a minute.');
    } finally {
      confirmingRef.current = false;
      setWorking(null);
    }
  };

  const payWithMobileMoneyOrCard = async () => {
    setError(null);
    setWorking('card');
    writePending(txRef);
    try {
      const payment = await takeMobileCardPayment(charge, {
        customerName: name.trim(),
        customerPhone: phone.trim(),
        storeName: charge.merchant_name || 'SupermartKera',
      });
      if (payment.status === 'successful') {
        await confirmUntilDone(payment.transaction_id);
      } else {
        writePending(null);
        if (payment.status === 'failed') setError('The payment did not go through. You have not been charged.');
      }
    } catch (err) {
      writePending(null);
      setError(err.message);
    } finally {
      setWorking((current) => (current === 'confirming' ? current : null));
    }
  };

  const payFromWallet = async () => {
    setError(null);
    setWorking('wallet');
    try {
      const result = await payMobileCardFromWallet(txRef);
      setReceipt(result);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-400" />
      </div>
    );
  }

  if (!charge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="bg-white/10 rounded-xl p-6 text-center max-w-sm">
          <p className="text-lg font-bold text-white mb-1">Payment link not available</p>
          <p className="text-sm text-gray-400 mb-4">Check the link, or ask the cashier for a new one.</p>
          <Link to="/" className="text-orange-400 font-semibold">Go home</Link>
        </div>
      </div>
    );
  }

  const paid = !!receipt || charge.status === 'paid';
  const closed = !paid && !charge.payable;
  const busy = !!working;

  return (
    <div className="cl-auth cl-auth-bg-night min-h-screen py-6 px-3 md:py-10">
      <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-orange-500 to-rose-600 text-white">
          <p className="text-xs uppercase tracking-wide opacity-90">Pay {charge.merchant_name || 'the store'}</p>
          <h1 className="text-3xl font-bold mt-1">{formatUGX(charge.amount_ugx)}</h1>
          {charge.description && <p className="text-sm opacity-90 mt-1">{charge.description}</p>}
        </div>

        <div className="p-5 space-y-4">
          {paid && (
            <div className="text-center py-4">
              <FiCheckCircle className="mx-auto text-green-400 h-14 w-14 mb-2" />
              <p className="text-xl font-bold text-green-400">Paid - thank you!</p>
              <p className="text-sm text-gray-300 mt-1">
                {receipt?.channel === 'wallet'
                  ? `${formatUGX(charge.amount_ugx)} was paid from your IcanEra wallet.`
                  : receipt
                    ? `${formatUGX(receipt.charged_ugx || charge.charge_ugx)} was paid by ${mobileCardChannelLabel(receipt.channel)}.`
                    : 'This sale has been paid.'}
              </p>
              <p className="text-xs text-gray-400 mt-3">Show this screen to the cashier if asked.</p>
            </div>
          )}

          {closed && (
            <div className="text-center py-4">
              <FiClock className="mx-auto text-amber-300 h-12 w-12 mb-2" />
              <p className="text-lg font-bold text-amber-300">
                {charge.status === 'cancelled' ? 'This sale was cancelled' : 'This payment request has ended'}
              </p>
              <p className="text-sm text-gray-300 mt-1">Ask the cashier to start the payment again.</p>
            </div>
          )}

          {!paid && !closed && (
            <>
              {/* No account needed */}
              <div className="bg-white/5 rounded-xl p-4 space-y-3">
                <p className="text-white font-semibold">Pay with Mobile Money or card</p>
                <p className="text-xs text-gray-400">
                  No account needed. You pay {formatUGX(charge.charge_ugx)} - the sale plus a {formatUGX(charge.processing_fee_ugx)} processing fee.
                </p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  autoComplete="name"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile Money number"
                  autoComplete="tel"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm"
                />
                <button
                  onClick={payWithMobileMoneyOrCard}
                  disabled={busy}
                  className="block w-full text-center py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-lg font-bold disabled:opacity-60"
                >
                  {working === 'card' ? 'Opening payment...' : working === 'confirming' ? 'Confirming payment...' : `📲 Pay ${formatUGX(charge.charge_ugx)}`}
                </button>
              </div>

              {/* Has an account: no fee */}
              <div className="bg-white/5 rounded-xl p-4 space-y-3">
                <p className="text-white font-semibold">💎 Have an IcanEra wallet?</p>
                <p className="text-xs text-gray-400">Pay {formatUGX(charge.amount_ugx)} from your wallet - no processing fee.</p>
                {signedIn ? (
                  <button
                    onClick={payFromWallet}
                    disabled={busy}
                    className="block w-full text-center py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg font-bold disabled:opacity-60"
                  >
                    {working === 'wallet' ? 'Paying...' : `Pay ${formatUGX(charge.amount_ugx)} from my IcanEra wallet`}
                  </button>
                ) : (
                  <Link
                    to={`/login?redirect=${encodeURIComponent(`/mobile-pay/${txRef}`)}`}
                    className="block text-center py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold"
                  >
                    Sign in to pay from my wallet
                  </Link>
                )}
              </div>

              <p className="flex items-center gap-1 text-xs text-gray-400">
                <FiClock /> Open until {new Date(charge.expires_at).toLocaleTimeString()}
              </p>
            </>
          )}

          {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-lg p-3">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default MobileCardPayPage;
