/**
 * Cashier IcanEra Mobile / Card modal - for a customer who may have NO IcanEra account.
 * The sale becomes one charge on the server (amount + processing fee fixed there), and the cashier
 * chooses how it gets paid - whichever happens first settles the sale. A new sale opens Flutterwave's checkout
 * straight away (like a wallet top-up does); closing it leaves the other ways below:
 *
 *   Pay now           Flutterwave's checkout opens here (Mobile Money number or card)
 *   Ask them to pay   one box: a phone number gets a Mobile Money approval prompt, an IcanEra wallet
 *                     number (or a phone/email that belongs to an account) gets a request in the
 *                     customer's wallet inbox - so the customer can be anywhere
 *   Scan or send link a QR / link / WhatsApp / SMS to the customer's own phone: Flutterwave's page with every
 *                     way to pay (Mobile Money, card, bank transfer ...) with no account, or from their IcanEra
 *                     wallet with no fee
 *
 * The till polls the charge, so a payment made on another phone, or approved a moment late, still
 * completes the sale. "Serve next customer" parks the sale (see hooks/usePendingMobileCardSales.js): the screen
 * closes, the till is free for someone else, and the sale is completed in the background when it is paid; Open on
 * the waiting list brings it back here (resumeCharge). The wallet-QR flow (CashierReceiveIcanModal) is untouched.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader, Copy, CheckCircle } from 'lucide-react';
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
  { id: 'till', label: 'Pay now', icon: '💳' },
  { id: 'request', label: 'Ask them to pay', icon: '📨' },
  { id: 'link', label: 'Scan or send link', icon: '🔗' },
];

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
  const [tab, setTab] = useState(resumeCharge ? 'request' : 'till');
  const [contact, setContact] = useState(initialContact);
  const [customer, setCustomer] = useState(null); // the IcanEra account behind what was typed, if any
  const [lookingUp, setLookingUp] = useState(false);
  const [pickedNetwork, setPickedNetwork] = useState('');
  const [busy, setBusy] = useState(false);        // sending a request, or Flutterwave's checkout is open
  const [closing, setClosing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [checkoutShown, setCheckoutShown] = useState(false); // Flutterwave's checkout has been shown for this charge

  const startedRef = useRef(!!resumeCharge);
  const autoOpenedRef = useRef(!!resumeCharge); // a new sale opens the checkout once; a reopened one does not
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

  // ── actions ────────────────────────────────────────────────────────────────
  const sendWalletRequest = async () => {
    if (!customer || !charge) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await requestWalletPayment(charge.tx_ref, customer.userId);
      setNotice(`Request sent to ${customer.name}'s IcanEra wallet. They can approve it from the notification - waiting for them...`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendMobileMoneyRequest = async () => {
    if (kind.type !== 'phone' || !charge) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await requestMobileMoneyPrompt(charge.tx_ref, { phone: kind.value, network: network || null });
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

  // A new sale goes straight to Flutterwave's checkout, as a wallet top-up does; the cashier does not have to find it.
  useEffect(() => {
    if (phase !== 'ready' || !charge || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    payOnTill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, charge]);

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-4 sm:p-6 max-w-lg max-h-[95vh] overflow-y-auto w-full mx-3 sm:mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900">📲 IcanEra Mobile / Card</h3>
          <button
            onClick={handleClose}
            disabled={busy || closing}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {phase === 'creating' && (
          <div className="text-center py-10">
            <Loader className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-3" />
            <p className="text-gray-600">Starting the payment...</p>
          </div>
        )}

        {phase === 'dead' && (
          <div className="text-center py-6 space-y-4">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">❌ {error || 'This payment cannot continue.'}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  startedRef.current = true;
                  autoOpenedRef.current = false;
                  setCheckoutShown(false);
                  setTab('till');
                  setCharge(null);
                  setContact('');
                  createCharge();
                }}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold"
              >
                Start again
              </button>
              <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                Close
              </button>
            </div>
          </div>
        )}

        {phase === 'paid' && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
            <h4 className="text-2xl font-bold text-green-600 mb-1">Payment received!</h4>
            <p className="text-gray-600">Finishing the sale...</p>
          </div>
        )}

        {phase === 'ready' && charge && (
          <div className="space-y-4">
            {/* What the sale is and what the customer pays */}
            <div className="bg-gradient-to-r from-orange-50 to-rose-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">Sale total - the store receives all of it</p>
              <p className="text-3xl font-bold text-orange-600">{formatUGX(charge.amount_ugx)}</p>
              <p className="text-xs text-gray-600 mt-2">
                Mobile Money / card: customer pays <strong>{formatUGX(charge.charge_ugx)}</strong> (includes a {formatUGX(charge.processing_fee_ugx)} processing fee).
                IcanEra wallet: <strong>{formatUGX(charge.amount_ugx)}</strong>, no fee.
              </p>
            </div>

            {/* How */}
            <div className="grid grid-cols-3 gap-1 bg-gray-100 rounded-lg p-1" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-md px-2 py-2 text-xs sm:text-sm font-semibold transition-colors ${tab === t.id ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <span aria-hidden="true">{t.icon} </span>{t.label}
                </button>
              ))}
            </div>

            {tab === 'request' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700" htmlFor="imc-contact">
                  Customer's phone number or IcanEra wallet number
                </label>
                <input
                  id="imc-contact"
                  type="text"
                  inputMode="tel"
                  autoComplete="off"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="0772 123 456  or  16-digit wallet number"
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />

                {kind.type === 'business' && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    That is a business wallet number - a payment cannot be requested from it here. Use the customer's own number.
                  </p>
                )}
                {lookingUp && <p className="text-xs text-gray-500">Checking for an IcanEra account...</p>}

                {customer && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                    <p className="text-sm text-blue-900">
                      💎 <strong>{customer.name}</strong> has an IcanEra account. Ask their wallet - they pay <strong>{formatUGX(charge.amount_ugx)}</strong> with no processing fee.
                    </p>
                    <button
                      onClick={sendWalletRequest}
                      disabled={busy}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold"
                    >
                      {busy ? 'Sending...' : '💎 Request from IcanEra wallet'}
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
                            className={`px-3 py-1 rounded-full border text-xs font-semibold ${pickedNetwork === n ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300 text-gray-700'}`}
                          >
                            {n === 'MTN' ? 'MTN' : 'Airtel'}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={sendMobileMoneyRequest}
                      disabled={busy || !network || lookingUp}
                      className={`w-full px-4 py-3 rounded-lg font-semibold disabled:opacity-60 ${hasAccount ? 'bg-gray-100 hover:bg-gray-200 text-gray-800' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
                    >
                      {busy ? 'Sending...' : `📲 ${hasAccount ? 'Send a Mobile Money prompt instead' : 'Send Mobile Money request'} to ${formatPhone(kind.value)}${network ? ` (${network === 'MTN' ? 'MTN' : 'Airtel'})` : ''}`}
                    </button>
                    <p className="text-xs text-gray-500">
                      The customer gets a prompt on their phone and approves it with their Mobile Money PIN - no account, no scanning.
                    </p>
                  </div>
                )}

                {(kind.type === 'account' || kind.type === 'email') && !customer && !lookingUp && (
                  <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    No IcanEra account found for that. Ask for their phone number to send a Mobile Money request, or use the link.
                  </p>
                )}
                {!kind.type && contact.trim() && (
                  <p className="text-xs text-gray-500">Type a Ugandan mobile number, a 16-digit wallet number or an email.</p>
                )}
              </div>
            )}

            {tab === 'till' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  Flutterwave's payment page opens on this screen: the customer enters their Mobile Money number or card. Hand them the device, or type it for them.
                  {checkoutShown && !busy ? ' It was closed - open it again, or use another way below.' : ''}
                </p>
                <button
                  onClick={payOnTill}
                  disabled={busy}
                  className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg font-semibold"
                >
                  {busy ? 'Payment screen open...' : `💳 ${checkoutShown ? 'Open the payment page again' : 'Open the payment page'} - ${formatUGX(charge.charge_ugx)}`}
                </button>
              </div>
            )}

            {tab === 'link' && (
              <div className="space-y-3">
                <div className="flex justify-center p-3 bg-gray-50 rounded-lg">
                  <QRCode value={payUrl} size={200} level="H" includeMargin />
                </div>
                <p className="text-xs text-gray-600 text-center">
                  The customer scans this with any camera, or opens the link. They pay on Flutterwave's page - Mobile Money, card, bank transfer or any other way it offers, no account needed - or from their IcanEra wallet with no fee.
                </p>
                <div className="flex gap-2">
                  <input readOnly value={payUrl} className="flex-1 min-w-0 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-700" />
                  <button onClick={copyLink} title="Copy link" className="px-3 py-2 bg-orange-100 hover:bg-orange-200 border border-orange-300 rounded-lg text-orange-700">
                    {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={whatsappShareUrl(kind.type === 'phone' ? kind.value : '', shareText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-center px-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={smsShareUrl(kind.type === 'phone' ? kind.value : '', shareText)}
                    className="text-center px-2 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-semibold"
                  >
                    SMS
                  </a>
                  <button onClick={shareLink} className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold">
                    Share...
                  </button>
                </div>
                {kind.type === 'phone' && (
                  <p className="text-xs text-gray-500 text-center">WhatsApp and SMS open straight to {formatPhone(kind.value)}.</p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">❌ {error}</p>}
            {notice && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">✅ {notice}</p>}

            {onUseWallet && (
              <button onClick={useWalletInstead} disabled={busy || closing} className="w-full text-sm text-blue-600 hover:underline disabled:opacity-50">
                Customer is here with the IcanEra app? Use the wallet QR instead
              </button>
            )}

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Waiting for payment{timeLeft > 0 ? ` - ${formatClock(timeLeft)} left` : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                {onPark && (
                  <button
                    onClick={park}
                    disabled={busy || closing || (!resumed && !!parkDisabledReason)}
                    title={!resumed && parkDisabledReason ? parkDisabledReason : 'Keep this sale waiting and serve the next customer'}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${notice ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-orange-100 hover:bg-orange-200 text-orange-800'}`}
                  >
                    {resumed ? 'Back to my till' : 'Serve next customer'}
                  </button>
                )}
                <button
                  onClick={handleCancel}
                  disabled={busy || closing}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {closing ? 'Checking...' : resumed ? 'Cancel sale' : 'Cancel'}
                </button>
              </div>
            </div>
            {onPark && !resumed && parkDisabledReason && (
              <p className="text-xs text-amber-700 text-right -mt-2">{parkDisabledReason}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierIcanMobileCardModal;
