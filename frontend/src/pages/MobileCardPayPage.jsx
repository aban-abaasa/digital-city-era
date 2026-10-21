// ===================================================
// 📲 PUBLIC "PAY THIS SALE" PAGE
// Opened from the till's QR code, a WhatsApp/SMS link, or a request in the customer's IcanEra wallet
// inbox (see CashierIcanMobileCardModal.jsx). The customer is often not at the till - they sent someone to the shop
// and pay from home - so paying from their own IcanEra wallet comes first (signed in, no fee); the app also lists the
// request on their dashboard (StorePaymentRequests.jsx). No account is needed to pay either:
//   - from their IcanEra wallet when signed in (no fee), or
//   - Flutterwave's own page, with every way to pay it has enabled (Mobile Money, card, bank transfer, USSD ...),
//     exactly as for a wallet top-up (the customer adds a small processing fee).
// The amount, the fee and who is paid are all fixed server-side (imc_pay_create); this page only shows
// them and starts the payment. Money reaches the store's IcanEra wallet once Flutterwave confirms it
// (icanera-mobile-card-pay) - or instantly for a wallet payment. See ADD_ICAN_MOBILE_CARD_PAYMENTS.sql.
// ===================================================

import '../styles/classic-auth.css';
import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiCheck, FiChevronDown, FiClock } from 'react-icons/fi';
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

// Classic buttons: ink-indigo primary with a brass ring.
const PRIMARY_BTN = 'block w-full text-center py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#1e1b4b] to-[#3730a3] ring-1 ring-[#e6c980]/50 hover:shadow-[0_10px_22px_-12px_rgba(30,27,75,0.7)] disabled:opacity-60 transition-shadow';

// One way to pay: a heading that always shows its price, and a body that opens on tap - only one is open at a time.
const Option = ({ open, onToggle, icon, title, hint, children }) => (
  <div className={`rounded-xl border transition-colors ${open ? 'border-[#c4a052]/70 bg-[#faf8f3]' : 'border-[#c4a052]/30 bg-white'}`}>
    <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 px-4 py-3 text-left">
      <span aria-hidden="true" className="text-xl">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
      <FiChevronDown aria-hidden="true" className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
  </div>
);

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
  const [method, setMethod] = useState('wallet'); // which way to pay is open: 'wallet' | 'other'
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
      // who is signed in is known before the page first draws, so a signed-in customer never sees the guest layout flash by
      const [, auth] = await Promise.all([
        isMobileCardTxRef(txRef) ? refresh() : null,
        supabase.auth.getUser().catch(() => null),
      ]);
      setSignedIn(!!auth?.data?.user);
      setLoading(false);
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
        allMethods: true,
      });
      // 'pending': a bank transfer / USSD payment that has not landed yet - the server decides when it has.
      if (payment.status === 'successful' || payment.raw_status === 'pending') {
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
      if (/insufficient/i.test(err.message || '')) {
        setError(`${String(err.message).replace(/[.\s]+$/, '')}. Top up your IcanEra wallet, or pay another way.`);
        setMethod('other');
      } else {
        setError(err.message);
      }
    } finally {
      setWorking(null);
    }
  };

  if (loading) {
    return (
      <div className="cl-auth cl-paper min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#c4a052]" />
      </div>
    );
  }

  if (!charge) {
    return (
      <div className="cl-auth cl-paper min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 text-center max-w-sm">
          <p className="text-lg font-bold text-gray-900 mb-1">Payment link not available</p>
          <p className="text-sm text-gray-600 mb-4">Check the link, or ask the cashier for a new one.</p>
          <Link to="/" className="text-[#8a6a1f] font-semibold">Go home</Link>
        </div>
      </div>
    );
  }

  const paid = !!receipt || charge.status === 'paid';
  const closed = !paid && !charge.payable;
  const busy = !!working;
  const toggle = (id) => setMethod((current) => (current === id ? null : id));

  return (
    <div className="cl-auth cl-paper min-h-screen py-6 px-3 md:py-10">
      <div className="max-w-md mx-auto bg-white rounded-2xl overflow-hidden">
        {/* The sale: store, amount, what it is - on ink-indigo with a brass rule */}
        <div className="px-5 pt-6 pb-5 text-center text-white bg-gradient-to-br from-[#1e1b4b] via-[#26226b] to-[#3730a3]">
          <p className="classic-eyebrow !text-[#f3dc9b]">Pay {charge.merchant_name || 'the store'}</p>
          <h1 className="font-classic-display text-4xl font-bold mt-1 tabular-nums">{formatUGX(charge.amount_ugx)}</h1>
          {charge.description && <p className="text-sm text-white/75 mt-1">{charge.description}</p>}
          <div className="gold-rule mt-4" />
          {!paid && !closed && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-white/70 mt-3">
              <FiClock aria-hidden="true" /> Waiting at the counter - open until {new Date(charge.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        <div className="p-5 space-y-3">
          {paid && (
            <div className="text-center py-4">
              <span className="cl-emblem inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
                <FiCheck aria-hidden="true" className="h-9 w-9" />
              </span>
              <p className="font-classic-display text-2xl font-bold text-gray-900">Paid - thank you</p>
              <p className="text-sm text-gray-600 mt-1">
                {receipt?.channel === 'wallet'
                  ? `${formatUGX(charge.amount_ugx)} was paid from your IcanEra wallet.`
                  : receipt
                    ? `${formatUGX(receipt.charged_ugx || charge.charge_ugx)} was paid by ${mobileCardChannelLabel(receipt.channel)}.`
                    : 'This sale has been paid.'}
              </p>
              <p className="text-xs text-gray-500 mt-3">
                {signedIn ? 'The till updates by itself - whoever is at the counter can leave with the purchase now.' : 'Show this screen to the cashier if asked.'}
              </p>
              {signedIn && (
                <Link to="/customer-portal" className="inline-block mt-4 px-5 py-2 rounded-xl border border-[#c4a052]/50 text-gray-800 hover:bg-[#faf8f3] text-sm font-semibold">
                  Back to my dashboard
                </Link>
              )}
            </div>
          )}

          {closed && (
            <div className="text-center py-4">
              <FiClock aria-hidden="true" className="mx-auto text-amber-500 h-10 w-10 mb-2" />
              <p className="font-classic-display text-xl font-bold text-gray-900">
                {charge.status === 'cancelled' ? 'This sale was cancelled' : 'This payment request has ended'}
              </p>
              <p className="text-sm text-gray-600 mt-1">Ask the cashier to start the payment again.</p>
            </div>
          )}

          {!paid && !closed && (
            <>
              <Option
                open={method === 'wallet'}
                onToggle={() => toggle('wallet')}
                icon="💎"
                title="Pay from your IcanEra wallet"
                hint={`${formatUGX(charge.amount_ugx)} - no fee`}
              >
                {signedIn ? (
                  <button onClick={payFromWallet} disabled={busy} className={PRIMARY_BTN}>
                    {working === 'wallet' ? 'Paying...' : `Pay ${formatUGX(charge.amount_ugx)}`}
                  </button>
                ) : (
                  <>
                    <Link to={`/login?redirect=${encodeURIComponent(`/mobile-pay/${txRef}`)}`} className={PRIMARY_BTN}>
                      Sign in to pay
                    </Link>
                    <p className="text-xs text-gray-500 text-center">Sign in with the account you use in the app. You come straight back here.</p>
                  </>
                )}
              </Option>

              <Option
                open={method === 'other'}
                onToggle={() => toggle('other')}
                icon="📲"
                title="Mobile Money, card or bank"
                hint={`${formatUGX(charge.charge_ugx)} with fee - no account needed`}
              >
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  autoComplete="name"
                  className="w-full px-3 py-2.5 rounded-xl border bg-white text-gray-900 placeholder-gray-400 text-sm"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile Money number"
                  autoComplete="tel"
                  className="w-full px-3 py-2.5 rounded-xl border bg-white text-gray-900 placeholder-gray-400 text-sm"
                />
                <button onClick={payWithMobileMoneyOrCard} disabled={busy} className={PRIMARY_BTN}>
                  {working === 'card' ? 'Opening payment...' : working === 'confirming' ? 'Confirming payment...' : `Pay ${formatUGX(charge.charge_ugx)}`}
                </button>
              </Option>
            </>
          )}

          {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default MobileCardPayPage;
