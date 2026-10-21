/**
 * Cashier IcanEra Mobile / Card modal - for a customer who may have NO IcanEra account.
 * The sale becomes one charge on the server (amount + processing fee fixed there), and the cashier
 * chooses how it gets paid - whichever happens first settles the sale. The screen opens on the ways that need
 * nothing typed at the till, because the person at the counter is often not the one whose phone or card is
 * paying (Flutterwave's own checkout asks for a one-time code that goes to the account holder's phone):
 *
 *   Send to phone     one box: a phone number gets a Mobile Money approval prompt (approved with the PIN on that
 *                     phone, no code), an IcanEra wallet number (or a phone/email that belongs to an account)
 *                     gets a request in the customer's wallet inbox - so the customer can be anywhere
 *   Send link         a QR / link / WhatsApp / SMS to the payer's own phone: Flutterwave's page with every way
 *                     to pay (Mobile Money, card, bank transfer ...) with no account, or from their IcanEra
 *                     wallet with no fee - any one-time code lands on, and is typed into, their own phone
 *   Pay here          Flutterwave's checkout on this device (Mobile Money number or card) - only for a payer who
 *                     is at the till with their phone, because they have to read out / type the one-time code
 *
 * Laid out in the app's classic style (ivory card, serif amount, brass rule, underline tabs): one amount, three tabs,
 * one box and one main button, with the explanations folded into "How this works".
 *
 * The till polls the charge, so a payment made on another phone, or approved a moment late, still
 * completes the sale. "Serve next customer" parks the sale (see hooks/usePendingMobileCardSales.js): the screen
 * closes, the till is free for someone else, and the sale is completed in the background when it is paid; Open on
 * the waiting list brings it back here (resumeCharge). The wallet-QR flow (CashierReceiveIcanModal) is untouched.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader, Copy, CheckCircle, Smartphone, Link2, CreditCard } from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import { toast } from 'react-toastify';
import {
  createMobileCardCharge,
  getMobileCardStatus,
  confirmMobileCardPayment,
  cancelMobileCardCharge,
  takeMobileCardPayment,
  requestMobileMoneyPrompt,
  requestWalletPayment,
  findIcanCustomer,
} from '../services/icanMobileCardService';
import { detectUgandaMobileNetwork } from '../services/icanWalletService';
import {
  classifyCustomerInput,
  mobileCardPayUrl,
  mobileCardShareText,
  mobileCardPaymentData,
  whatsappShareUrl,
  smsShareUrl,
} from '../utils/mobileCardPayment';

const POLL_MS = 3000;          // ask the database every 3 s ...
const CONFIRM_EVERY = 3;       // ... and Flutterwave itself every 3rd time (about 9 s)
const DEAD_STATES = ['cancelled', 'refunded', 'expired'];

const formatUGX = (n) => `UGX ${Math.round(Number(n) || 0).toLocaleString()}`;
const formatPhone = (variant) => (variant ? `${variant.slice(0, 4)} ${variant.slice(4, 7)} ${variant.slice(7)}` : '');
const formatClock = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const TABS = [
  { id: 'request', label: 'Send to phone', Icon: Smartphone },
  { id: 'link', label: 'Send link', Icon: Link2 },
  { id: 'till', label: 'Pay here', Icon: CreditCard },
];

// Classic buttons: ink-indigo primary with a brass ring, ivory secondary with a brass hairline.
const PRIMARY_BTN = 'w-full px-4 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#1e1b4b] to-[#3730a3] ring-1 ring-[#e6c980]/50 hover:shadow-[0_10px_22px_-12px_rgba(30,27,75,0.7)] disabled:opacity-60 transition-shadow';
const SECONDARY_BTN = 'px-3 py-2 rounded-xl text-sm font-semibold text-gray-800 bg-white border border-[#c4a052]/50 hover:border-[#c4a052] hover:bg-gray-50 disabled:opacity-50 transition-colors';
const FIELD = 'w-full px-3 py-3 rounded-xl border border-[#c4a052]/50 bg-white text-lg text-gray-900 focus:outline-none focus:border-[#c4a052] focus:ring-2 focus:ring-[#c4a052]/30';

const CashierIcanMobileCardModal = ({
  isOpen,
  onClose,
  supermarketId,
  merchantName = 'SupermartKera',
  amountUGX,
  orderDescription = '',
  onPaymentReceived = null,
  onUseWallet = null,
  resumeCharge = null,       // a charge already open for this sale (reopened from the waiting list)
  initialContact = '',
  onPark = null,             // ({ charge, contact }) => leave this sale waiting and free the till
  parkDisabledReason = null, // why another sale cannot wait right now
}) => {
  const [phase, setPhase] = useState(resumeCharge ? 'ready' : 'creating'); // creating | ready | paid | dead
  const [charge, setCharge] = useState(resumeCharge);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [tab, setTab] = useState('request');
  const [contact, setContact] = useState(initialContact);
  const [customer, setCustomer] = useState(null); // the IcanEra account behind what was typed, if any
  const [lookingUp, setLookingUp] = useState(false);
  const [pickedNetwork, setPickedNetwork] = useState('');
  const [busy, setBusy] = useState(false);        // sending a request, or Flutterwave's checkout is open
  const [closing, setClosing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [checkoutShown, setCheckoutShown] = useState(false); // Flutterwave's checkout has been shown for this charge
  const [sent, setSent] = useState(null);             // 'wallet' | 'momo': a request for what is typed is out, so the button offers "Send again"

  const contactRef = useRef(null);
  const startedRef = useRef(!!resumeCharge);
  const reportedRef = useRef(false);
  const chargeRef = useRef(null);
  const onPaidRef = useRef(onPaymentReceived);
  onPaidRef.current = onPaymentReceived;
  chargeRef.current = charge;
  const resumed = !!resumeCharge;

  const kind = classifyCustomerInput(contact);
  const detectedNetwork = kind.type === 'phone' ? detectUgandaMobileNetwork(kind.value) : null;
  const network = detectedNetwork || pickedNetwork || null;
  const payUrl = charge ? mobileCardPayUrl(window.location.origin, charge.tx_ref) : '';
  const shareText = charge ? mobileCardShareText({ merchantName, amountUGX: charge.amount_ugx, url: payUrl }) : '';

  // ── the sale becomes a charge as soon as the screen opens ──────────────────
  const createCharge = useCallback(async () => {
    setPhase('creating');
    setError(null);
    setNotice(null);
    reportedRef.current = false;
    try {
      const data = await createMobileCardCharge({ supermarketId, amountUGX, description: orderDescription });
      setCharge(data);
      setPhase('ready');
    } catch (err) {
      setError(err.message || 'Could not start this payment');
      setPhase('dead');
    }
  }, [supermarketId, amountUGX, orderDescription]);

  useEffect(() => {
    if (isOpen && !startedRef.current) {
      startedRef.current = true;
      createCharge();
    }
  }, [isOpen, createCharge]);

  // ── a payment, however it arrived, completes the sale exactly once ─────────
  const finish = useCallback((result) => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    setPhase('paid');
    onPaidRef.current?.(mobileCardPaymentData(result, { txRef: chargeRef.current?.tx_ref, amountUGX }));
  }, [amountUGX]);

  // The sale can no longer be paid: void it so a late approval is refunded rather than credited to a sale nobody is serving.
  const fail = useCallback((message) => {
    setError(message);
    setPhase('dead');
    const ref = chargeRef.current?.tx_ref;
    if (ref) cancelMobileCardCharge(ref).catch(() => {});
  }, []);

  // ── watch for the payment ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready' || !charge) return undefined;
    let stopped = false;
    let inFlight = false;
    let tick = 0;

    const run = async () => {
      if (inFlight || stopped) return;
      inFlight = true;
      tick += 1;
      try {
        const status = await getMobileCardStatus(charge.tx_ref);
        if (stopped) return;
        if (status.found && status.status === 'paid') { finish(status); return; }
        if (status.found && DEAD_STATES.includes(status.status)) {
          fail(status.status === 'expired'
            ? 'This sale timed out before it was paid. Start the payment again.'
            : 'This payment was cancelled.');
          return;
        }
        // Flutterwave side (card / Mobile Money): on the first look, every few looks, and straight away when a
        // payment arrived that could not be applied (the server then retries the refund).
        if (tick % CONFIRM_EVERY === 1 || status.status === 'failed') {
          const confirmed = await confirmMobileCardPayment(charge.tx_ref);
          if (!stopped && confirmed.paid) finish(confirmed);
        }
      } catch (err) {
        if (!stopped && err.terminal) fail(err.message);
        // anything else is a connection blip: look again next time
      } finally {
        inFlight = false;
      }
    };

    run();
    const timer = setInterval(run, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [phase, charge, finish, fail]);

  // countdown to the end of the wait
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // ── who is behind what was typed? ──────────────────────────────────────────
  useEffect(() => {
    setCustomer(null);
    setSent(null);
    if (!kind.type || kind.type === 'business') return undefined;
    let cancelled = false;
    setLookingUp(true);
    const timer = setTimeout(async () => {
      const found = await findIcanCustomer(contact).catch(() => null);
      if (!cancelled) { setCustomer(found); setLookingUp(false); }
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact]);

  // The box is the first thing a cashier needs: put the cursor there (not when a waiting sale is reopened).
  useEffect(() => {
    if (phase === 'ready' && tab === 'request' && !resumed) contactRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tab]);

  // ── actions ────────────────────────────────────────────────────────────────
  const sendWalletRequest = async () => {
    if (!customer || !charge || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await requestWalletPayment(charge.tx_ref, customer.userId);
      setSent('wallet');
      setNotice(`Request sent to ${customer.name} - it is on their phone and in their app now. They pay from home, no fee. Waiting...`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendMobileMoneyRequest = async () => {
    if (kind.type !== 'phone' || !charge || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await requestMobileMoneyPrompt(charge.tx_ref, { phone: kind.value, network: network || null });
      setSent('momo');
      setNotice(`${result.message || 'Request sent.'} Waiting for the customer...`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const payOnTill = async () => {
    if (!charge) return;
    setCheckoutShown(true);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payment = await takeMobileCardPayment(charge, {
        customerPhone: kind.type === 'phone' ? kind.value : '',
        storeName: merchantName,
      });
      if (payment.status === 'successful') {
        setNotice('Payment received - confirming with Flutterwave...');
        const result = await confirmMobileCardPayment(charge.tx_ref, payment.transaction_id);
        if (result.paid) finish(result); // otherwise the watcher above finishes it
      } else if (payment.status === 'failed') {
        setError('The payment did not go through - the customer has not been charged. Try again, or choose another way to pay.');
      }
    } catch (err) {
      if (err.terminal) fail(err.message);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(payUrl);
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `Pay ${merchantName}`, text: shareText, url: payUrl }); } catch { /* cancelled */ }
    } else {
      copyLink();
    }
  };

  // Leaving this screen: if the customer approved a moment ago the sale is completed instead (resolves true);
  // otherwise the charge is voided, so a later approval is refunded rather than credited (resolves false).
  const settleOrVoid = async () => {
    if (phase !== 'ready' || !charge || reportedRef.current) return false;
    try {
      const status = await getMobileCardStatus(charge.tx_ref);
      if (status.found && status.status === 'paid') { finish(status); return true; }
      const confirmed = await confirmMobileCardPayment(charge.tx_ref);
      if (confirmed.paid) { finish(confirmed); return true; }
    } catch {
      // offline or unreachable: still void the charge below
    }
    cancelMobileCardCharge(charge.tx_ref).catch(() => {});
    return false;
  };

  const leave = async (then) => {
    if (busy || closing) return;
    setClosing(true);
    const completed = await settleOrVoid();
    setClosing(false);
    if (!completed) then();
  };

  // A sale reopened from the waiting list keeps waiting when its window is closed; only Cancel voids it.
  const park = () => onPark?.({ charge, contact });
  const handleClose = () => (resumed && onPark && phase === 'ready' ? park() : leave(onClose));
  const handleCancel = () => leave(onClose);
  const useWalletInstead = () => leave(onUseWallet);

  if (!isOpen) return null;

  const timeLeft = charge ? new Date(charge.expires_at).getTime() - now : 0;
  const hasAccount = !!customer;
  const canMomo = kind.type === 'phone' && !!network && !lookingUp && !busy;
  // Enter in the box does the obvious thing: ask the wallet if there is one, else send the Mobile Money prompt.
  const onContactKey = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (customer) sendWalletRequest();
    else if (canMomo) sendMobileMoneyRequest();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="classic-card bg-white p-4 sm:p-6 max-w-lg max-h-[95vh] overflow-y-auto w-full mx-3 sm:mx-4 shadow-2xl">
        {/* Eyebrow, the sale in serif type, a brass rule - and the one line about fees */}
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <p className="classic-eyebrow">IcanEra Mobile / Card</p>
            <p className="font-classic-display text-3xl sm:text-4xl font-bold text-gray-900 leading-tight tabular-nums">
              {formatUGX(charge ? charge.amount_ugx : amountUGX)}
            </p>
            {phase === 'ready' && charge && (
              <p className="text-xs text-gray-500 mt-1">
                Wallet: no fee &middot; Mobile Money / card: {formatUGX(charge.charge_ugx)}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={busy || closing}
            aria-label="Close"
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="gold-rule my-4" />

        {phase === 'creating' && (
          <div className="text-center py-8">
            <Loader className="w-9 h-9 animate-spin text-[#c4a052] mx-auto mb-3" />
            <p className="text-gray-600">Starting the payment...</p>
          </div>
        )}

        {phase === 'dead' && (
          <div className="text-center py-4 space-y-4">
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error || 'This payment cannot continue.'}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  startedRef.current = true;
                  setCheckoutShown(false);
                  setTab('request');
                  setCharge(null);
                  setContact('');
                  createCharge();
                }}
                className={PRIMARY_BTN}
              >
                Start again
              </button>
              <button onClick={onClose} className={SECONDARY_BTN}>
                Close
              </button>
            </div>
          </div>
        )}

        {phase === 'paid' && (
          <div className="text-center py-6">
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
            <h4 className="font-classic-display text-2xl font-bold text-gray-900 mb-1">Payment received</h4>
            <p className="text-gray-600">Finishing the sale...</p>
          </div>
        )}

        {phase === 'ready' && charge && (
          <div className="space-y-4">
            {/* How */}
            <div className="flex border-b border-[#c4a052]/30" role="tablist">
              {TABS.map((t) => {
                const { id, label } = t;
                const TabIcon = t.Icon;
                return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={() => setTab(id)}
                  className={`classic-tab flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap ${tab === id ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <TabIcon className="w-4 h-4" aria-hidden="true" />{label}
                </button>
                );
              })}
            </div>

            {tab === 'request' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700" htmlFor="imc-contact">
                  Payer's phone number or IcanEra wallet number
                </label>
                <input
                  id="imc-contact"
                  ref={contactRef}
                  type="text"
                  inputMode="tel"
                  autoComplete="off"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  onKeyDown={onContactKey}
                  placeholder="0772 123 456  or  16-digit wallet number"
                  className={FIELD}
                />
                <p className="text-xs text-gray-500">
                  The payer approves on their own phone, wherever they are - nothing to read out here.
                </p>

                {kind.type === 'business' && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    That is a business wallet number - a payment cannot be requested from it. Use the customer's own number.
                  </p>
                )}
                {lookingUp && <p className="text-xs text-gray-500">Checking for an IcanEra account...</p>}

                {customer && (
                  <div className="rounded-xl border border-[#c4a052]/40 bg-gray-50 p-3 space-y-2">
                    <p className="text-sm text-gray-800">
                      💎 <strong>{customer.name}</strong> is an IcanEra member: the request reaches their phone and app, and they pay from home with no fee.
                    </p>
                    <button onClick={sendWalletRequest} disabled={busy} className={PRIMARY_BTN}>
                      {busy ? 'Sending...' : sent === 'wallet' ? `Send ${customer.name} the request again` : `Send request to ${customer.name}`}
                    </button>
                  </div>
                )}

                {kind.type === 'phone' && (
                  <div className="space-y-2">
                    {!detectedNetwork && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Network:</span>
                        {['MTN', 'AIRTEL'].map((n) => (
                          <button
                            key={n}
                            onClick={() => setPickedNetwork(n)}
                            className={`px-3 py-1 rounded-full border text-xs font-semibold ${pickedNetwork === n ? 'bg-[#1e1b4b] border-[#1e1b4b] text-white' : 'border-[#c4a052]/50 text-gray-700'}`}
                          >
                            {n === 'MTN' ? 'MTN' : 'Airtel'}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={sendMobileMoneyRequest}
                      disabled={!canMomo}
                      className={hasAccount ? `${SECONDARY_BTN} w-full` : PRIMARY_BTN}
                    >
                      {busy
                        ? 'Sending...'
                        : `${hasAccount ? 'Or send a Mobile Money prompt' : sent === 'momo' ? 'Send the Mobile Money request again' : 'Send Mobile Money request'}${network ? ` (${network === 'MTN' ? 'MTN' : 'Airtel'})` : ''}`}
                    </button>
                  </div>
                )}

                {(kind.type === 'account' || kind.type === 'email') && !customer && !lookingUp && (
                  <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    No IcanEra account found for that. Ask for their phone number to send a Mobile Money request, or use the link.
                  </p>
                )}
                {!kind.type && contact.trim() && (
                  <p className="text-xs text-gray-500">Type a Ugandan mobile number, a 16-digit wallet number or an email.</p>
                )}

                <details className="group text-sm text-gray-600">
                  <summary className="cursor-pointer select-none text-[#8a6a1f] font-medium">How this works</summary>
                  <ul className="mt-2 space-y-1.5 list-disc pl-5 text-xs text-gray-600">
                    <li>An IcanEra member gets the request on their phone and in the app, and pays from their wallet - no processing fee.</li>
                    <li>Any other Ugandan number gets a Mobile Money prompt (MTN / Airtel) and approves it with their PIN.</li>
                    <li>Paying by card instead? Use <strong>Send link</strong>: the card's one-time code goes to the cardholder, who types it on their own phone.</li>
                  </ul>
                </details>
              </div>
            )}

            {tab === 'till' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  Flutterwave's payment page opens on this screen: the payer enters their Mobile Money number or card.
                  {checkoutShown && !busy ? ' It was closed - open it again, or use another way.' : ''}
                </p>
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  It may ask for a one-time code that goes to the <strong>account holder's phone</strong>. Use this only when they are here with that phone - otherwise choose <strong>Send to phone</strong> or <strong>Send link</strong>.
                </p>
                <button onClick={payOnTill} disabled={busy} className={PRIMARY_BTN}>
                  {busy ? 'Payment screen open...' : `${checkoutShown ? 'Open the payment page again' : 'Open the payment page'} - ${formatUGX(charge.charge_ugx)}`}
                </button>
              </div>
            )}

            {tab === 'link' && (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="p-2 rounded-xl border border-[#c4a052]/40 bg-white">
                    <QRCode value={payUrl} size={168} level="H" includeMargin />
                  </div>
                </div>
                <p className="text-xs text-gray-600 text-center">
                  Scan or open the link: pay from an IcanEra wallet (no fee), or with Mobile Money, card or bank - no account needed.
                </p>
                <div className="flex gap-2">
                  <input readOnly value={payUrl} aria-label="Payment link" className="flex-1 min-w-0 px-3 py-2 bg-gray-50 border border-[#c4a052]/40 rounded-xl text-xs text-gray-700" />
                  <button onClick={copyLink} title="Copy link" aria-label="Copy link" className="px-3 py-2 rounded-xl border border-[#c4a052]/50 text-[#8a6a1f] hover:bg-gray-50">
                    {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={whatsappShareUrl(kind.type === 'phone' ? kind.value : '', shareText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${SECONDARY_BTN} text-center`}
                  >
                    WhatsApp
                  </a>
                  <a
                    href={smsShareUrl(kind.type === 'phone' ? kind.value : '', shareText)}
                    className={`${SECONDARY_BTN} text-center`}
                  >
                    SMS
                  </a>
                  <button onClick={shareLink} className={SECONDARY_BTN}>
                    Share...
                  </button>
                </div>
                {kind.type === 'phone' && (
                  <p className="text-xs text-gray-500 text-center">WhatsApp and SMS open straight to {formatPhone(kind.value)}.</p>
                )}
              </div>
            )}

            {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
            {notice && <p role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">{notice}</p>}

            <div className="pt-3 border-t border-[#c4a052]/30 space-y-3">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader className="w-4 h-4 animate-spin shrink-0" />
                <span className="whitespace-nowrap">Waiting for payment{timeLeft > 0 ? ` - ${formatClock(timeLeft)} left` : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                {onPark && (
                  <button
                    onClick={park}
                    disabled={busy || closing || (!resumed && !!parkDisabledReason)}
                    title={!resumed && parkDisabledReason ? parkDisabledReason : 'Keep this sale waiting and serve the next customer'}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 ${notice ? 'text-white bg-gradient-to-r from-[#1e1b4b] to-[#3730a3] ring-1 ring-[#e6c980]/50' : 'text-gray-800 bg-white border border-[#c4a052]/50 hover:border-[#c4a052] hover:bg-gray-50'}`}
                  >
                    {resumed ? 'Back to my till' : 'Serve next customer'}
                  </button>
                )}
                <button
                  onClick={handleCancel}
                  disabled={busy || closing}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50"
                >
                  {closing ? 'Checking...' : resumed ? 'Cancel sale' : 'Cancel'}
                </button>
              </div>
            </div>
            {onPark && !resumed && parkDisabledReason && (
              <p className="text-xs text-amber-700 text-right -mt-2">{parkDisabledReason}</p>
            )}
            {onUseWallet && (
              <button onClick={useWalletInstead} disabled={busy || closing} className="w-full text-xs text-[#8a6a1f] hover:underline disabled:opacity-50">
                Customer here with the IcanEra app? Use the wallet QR
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierIcanMobileCardModal;
