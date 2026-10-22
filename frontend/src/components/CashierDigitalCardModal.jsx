/**
 * Cashier IcanEra Digital Card modal - for a customer who comes to the till with the digital card from their IcanEra
 * wallet (ICAN app -> Wallet -> Cards). The sale becomes one charge on the server (the same one IcanEra Mobile / Card
 * opens: the amount and the store's wallet are fixed there), and then:
 *
 *   1. scan     the cashier scans the card's QR with the till's camera (or types / pastes the card link)
 *   2. pin      the screen shows whose card it is (first name + last 4 digits) and the customer types their IcanEra
 *               wallet transaction PIN on the till - the server checks it, with the wallet's usual 3-tries lock
 *   3. paid     the sale is paid from the customer's wallet to the store's wallet - no fee - and completes at once
 *
 * Nothing waits here, so there is no "serve next customer": the payment either happens in the next few seconds or the
 * sale is cancelled. The wallet-QR and Mobile / Card screens are untouched; a customer without a card, or who prefers
 * to pay another way, goes back to the list of ways to pay.
 *
 * Laid out in the app's classic style (ivory card, serif amount, brass rule), like CashierIcanMobileCardModal.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader, CheckCircle, CreditCard, Link2, Camera } from 'lucide-react';
import CardQrScanner from './CardQrScanner';
import {
  createMobileCardCharge,
  getMobileCardStatus,
  cancelMobileCardCharge,
} from '../services/icanMobileCardService';
import { lookupDigitalCard, payWithDigitalCard } from '../services/icanDigitalCardService';
import { mobileCardPaymentData } from '../utils/mobileCardPayment';
import { parseCardQr, cardPinProblem, cardHolderLabel, digitalCardPaymentData } from '../utils/digitalCardPayment';

const DEAD_STATES = ['cancelled', 'refunded', 'expired'];

const formatUGX = (n) => `UGX ${Math.round(Number(n) || 0).toLocaleString()}`;

// Classic buttons: ink-indigo primary with a brass ring, ivory secondary with a brass hairline.
const PRIMARY_BTN = 'w-full px-4 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#1e1b4b] to-[#3730a3] ring-1 ring-[#e6c980]/50 hover:shadow-[0_10px_22px_-12px_rgba(30,27,75,0.7)] disabled:opacity-60 transition-shadow';
const SECONDARY_BTN = 'px-3 py-2 rounded-xl text-sm font-semibold text-gray-800 bg-white border border-[#c4a052]/50 hover:border-[#c4a052] hover:bg-gray-50 disabled:opacity-50 transition-colors';
const FIELD = 'w-full px-3 py-3 rounded-xl border border-[#c4a052]/50 bg-white text-lg text-gray-900 focus:outline-none focus:border-[#c4a052] focus:ring-2 focus:ring-[#c4a052]/30';

const CashierDigitalCardModal = ({
  isOpen,
  onClose,
  supermarketId,
  amountUGX,
  orderDescription = '',
  onPaymentReceived = null,
  onChooseAnother = null, // () => the list of ways to pay, for a customer with no card (the sale is voided first)
}) => {
  const [phase, setPhase] = useState('creating'); // creating | scan | pin | paid | dead
  const [charge, setCharge] = useState(null);
  const [error, setError] = useState(null);
  const [card, setCard] = useState(null);         // { token, holder_first_name, last4 } once a card QR was read
  const [reading, setReading] = useState(false);  // looking up whose card a scanned QR is
  const [typing, setTyping] = useState(false);    // typing / pasting the card link instead of using the camera
  const [linkText, setLinkText] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);        // the PIN is with the server
  const [closing, setClosing] = useState(false);

  const startedRef = useRef(false);
  const reportedRef = useRef(false);
  const readingRef = useRef(false);
  const chargeRef = useRef(null);
  const cardRef = useRef(null);
  const pinRef = useRef(null);
  const onPaidRef = useRef(onPaymentReceived);
  onPaidRef.current = onPaymentReceived;
  chargeRef.current = charge;
  cardRef.current = card;

  // ── the sale becomes a charge as soon as the screen opens ──────────────────
  const createCharge = useCallback(async () => {
    setPhase('creating');
    setError(null);
    reportedRef.current = false;
    try {
      const data = await createMobileCardCharge({ supermarketId, amountUGX, description: orderDescription });
      setCharge(data);
      setPhase('scan');
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

  // The customer types their PIN next: put the cursor there.
  useEffect(() => {
    if (phase === 'pin') pinRef.current?.focus();
  }, [phase]);

  // ── a payment, however it arrived, completes the sale exactly once ─────────
  const finish = useCallback((result) => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    setPhase('paid');
    const base = mobileCardPaymentData(result, { txRef: chargeRef.current?.tx_ref, amountUGX });
    onPaidRef.current?.(digitalCardPaymentData({ card_last4: result?.card_last4 || cardRef.current?.last4 }, base));
  }, [amountUGX]);

  // The sale can no longer be paid: void it so nothing can land on a sale nobody is serving.
  const fail = useCallback((message) => {
    setError(message);
    setPhase('dead');
    const ref = chargeRef.current?.tx_ref;
    if (ref) cancelMobileCardCharge(ref).catch(() => {});
  }, []);

  // ── step 1: a card QR was scanned (or its link typed) ──────────────────────
  const readCard = useCallback(async (text) => {
    if (readingRef.current || reportedRef.current) return;
    const token = parseCardQr(text);
    if (!token) {
      setError('That is not an IcanEra card. Ask the customer to open their card in the IcanEra app (Wallet, then Cards) and show its QR.');
      return;
    }
    readingRef.current = true;
    setReading(true);
    setError(null);
    try {
      const info = await lookupDigitalCard(token);
      if (!info) {
        setError('This card QR is not active. Ask the customer to open their card again in the IcanEra app.');
      } else if (!info.pin_pay_enabled) {
        setError('This card cannot be used to pay with a PIN here (the owner turned it off, or it is a business card). Choose another way to pay.');
      } else {
        setCard({ token, holder_first_name: info.holder_first_name, last4: info.last4 });
        setPin('');
        setPhase('pin');
      }
    } catch (err) {
      setError(err.message || 'Could not read this card. Check the connection and try again.');
    } finally {
      readingRef.current = false;
      setReading(false);
    }
  }, []);

  // ── step 2: the customer's PIN ──────────────────────────────────────────────
  // After any failure, look at the sale itself before blaming the PIN: an answer lost on the way back can hide a
  // payment that did go through, and a sale that timed out or was cancelled must say so instead of asking again.
  const checkSettled = useCallback(async () => {
    const ref = chargeRef.current?.tx_ref;
    if (!ref) return false;
    try {
      const status = await getMobileCardStatus(ref);
      if (status.found && status.status === 'paid') { finish(status); return true; }
      if (status.found && DEAD_STATES.includes(status.status)) {
        fail(status.status === 'expired'
          ? 'This sale timed out before it was paid. Start the payment again.'
          : 'This payment was cancelled.');
        return true;
      }
    } catch {
      // unreachable: the message from the failed attempt is all there is to show
    }
    return false;
  }, [finish, fail]);

  const submitPin = async (e) => {
    e?.preventDefault();
    if (busy || !card || !charge) return;
    const problem = cardPinProblem(pin);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await payWithDigitalCard({ txRef: charge.tx_ref, token: card.token, pin });
      finish(result);
    } catch (err) {
      const settled = await checkSettled();
      if (!settled) setError(err.message);
    } finally {
      setBusy(false);
      setPin(''); // never keep a PIN on a shared screen
      pinRef.current?.focus();
    }
  };

  const useAnotherCard = () => {
    if (busy) return;
    setCard(null);
    setPin('');
    setError(null);
    setPhase('scan');
  };

  // Leaving this screen: if the payment went through a moment ago the sale is completed instead (resolves true);
  // otherwise the charge is voided (resolves false).
  const settleOrVoid = async () => {
    if (!charge || reportedRef.current || phase === 'dead' || phase === 'paid') return false;
    try {
      const status = await getMobileCardStatus(charge.tx_ref);
      if (status.found && status.status === 'paid') { finish(status); return true; }
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
    if (!completed) then?.();
  };

  const handleClose = () => leave(onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
      <div className="classic-card bg-white p-4 sm:p-6 max-w-lg max-h-[95vh] overflow-y-auto w-full mx-3 sm:mx-4 shadow-2xl">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <p className="classic-eyebrow">IcanEra Digital Card</p>
            <p className="font-classic-display text-3xl sm:text-4xl font-bold text-gray-900 leading-tight tabular-nums">
              {formatUGX(charge ? charge.amount_ugx : amountUGX)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Paid from the customer's IcanEra wallet &middot; no fee</p>
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
                  setCard(null);
                  setCharge(null);
                  setPin('');
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

        {phase === 'scan' && charge && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Ask the customer to open their card in the IcanEra app (<strong>Wallet</strong>, then <strong>Cards</strong>)
              and hold its QR code in front of the camera.
            </p>

            {!typing && <CardQrScanner onScan={readCard} />}

            {typing && (
              <form
                onSubmit={(e) => { e.preventDefault(); readCard(linkText); }}
                className="space-y-2"
              >
                <label className="block text-sm font-medium text-gray-700" htmlFor="dcard-link">The card link</label>
                <input
                  id="dcard-link"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  autoFocus
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="https://.../card-pay/..."
                  className={FIELD}
                />
                <button type="submit" disabled={reading || !linkText.trim()} className={PRIMARY_BTN}>
                  {reading ? 'Reading the card...' : 'Use this card'}
                </button>
              </form>
            )}

            {reading && !typing && (
              <p className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <Loader className="w-4 h-4 animate-spin" /> Reading the card...
              </p>
            )}

            <button
              type="button"
              onClick={() => { setTyping((v) => !v); setError(null); }}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-[#8a6a1f] hover:underline"
            >
              {typing ? <><Camera className="w-4 h-4" aria-hidden="true" /> Use the camera instead</> : <><Link2 className="w-4 h-4" aria-hidden="true" /> Type or paste the card link instead</>}
            </button>
          </div>
        )}

        {phase === 'pin' && card && (
          <form onSubmit={submitPin} className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-[#c4a052]/40 bg-gray-50 p-3">
              <CreditCard className="w-7 h-7 text-[#8a6a1f] shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{cardHolderLabel(card)}</p>
                <p className="text-xs text-gray-500">IcanEra digital card</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="dcard-pin">
              Card owner: type your IcanEra wallet PIN to pay {formatUGX(charge ? charge.amount_ugx : amountUGX)}
            </label>
            <input
              id="dcard-pin"
              ref={pinRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{4,6}"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="PIN"
              disabled={busy}
              className={`${FIELD} text-center tracking-[0.5em]`}
            />
            <p className="text-xs text-gray-500">
              The PIN goes straight to the IcanEra server to be checked. It is not saved and not shown to the cashier.
            </p>
            <button type="submit" disabled={busy || !pin} className={PRIMARY_BTN}>
              {busy ? 'Paying...' : `Pay ${formatUGX(charge ? charge.amount_ugx : amountUGX)}`}
            </button>
            <button type="button" onClick={useAnotherCard} disabled={busy} className="w-full text-sm text-[#8a6a1f] hover:underline disabled:opacity-50">
              Not this card? Scan a different one
            </button>
          </form>
        )}

        {error && phase !== 'dead' && (
          <p role="alert" className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>
        )}

        {(phase === 'scan' || phase === 'pin') && (
          <div className="mt-4 pt-3 border-t border-[#c4a052]/30 space-y-2">
            <div className="flex items-center justify-end">
              <button
                onClick={handleClose}
                disabled={busy || closing}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50"
              >
                {closing ? 'Checking...' : 'Cancel'}
              </button>
            </div>
            {onChooseAnother && (
              <button
                onClick={() => leave(onChooseAnother)}
                disabled={busy || closing}
                className="w-full text-xs text-[#8a6a1f] hover:underline disabled:opacity-50"
              >
                No card with them? Choose another way to pay
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierDigitalCardModal;
