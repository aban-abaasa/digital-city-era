import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getOrCreateWallet,
  getBalance,
  getUserWalletDisplay,
  getTransactions,
  sendICAN,
  requestIcanPayout,
  resolveRecipient,
  sendICANToBusiness,
  detectUgandaMobileNetwork,
  formatICAN,
  icanToUGX,
  ugxToICAN,
  ICAN_TO_UGX,
} from '@/services/icanWalletService';
import { supabase } from '@/services/supabase';
import BuyIcanModal from '@/components/BuyIcanModal';
import SellIcanModal from '@/components/SellIcanModal';
import SendIcanOutModal from '@/components/SendIcanOutModal';
import PayMoneyModal from '@/components/PayMoneyModal';
import ReceiveMoneyModal from '@/components/ReceiveMoneyModal';
import SetPinPrompt from '@/components/SetPinPrompt';
import { hasPinSet, verifyPin } from '@/services/pinService';
import { parseIcanPayCode, payIcanRequest, payInvoiceWithIcan } from '@/services/icanPaymentRequestService';
import { parseInvoiceTransactionId } from '@/services/transactionService';
import SupplierAvailabilityPanel from '@/components/SupplierAvailabilityPanel';
import { ArrowDown, ArrowUp, Banknote, CheckCircle2, Gem, Landmark, Receipt as ReceiptIcon, RotateCcw, ShoppingBasket, ShoppingCart, Smartphone, Sparkles, Leaf } from 'lucide-react';
import {
  Sheet, StoreCard, ActionTiles, SpendMix, Receipt, ReceiptRow, FilterTabs, Collapsible, AddressQr, CopyButton,
  fmtLocal, Barcode, FIELD, LABEL, BTN_PRIMARY, BTN_OUTLINE, HistoryHeader, SearchBox, compactNumber, formatAmount,
} from '@/components/wallet/SupermartWalletUI';

const PAGE_BG = 'radial-gradient(120% 55% at 50% -8%, #0b4a37 0%, #05201a 45%, #031510 100%)';

// ─── helpers ───────────────────────────────────────────────────────────────

const TX_LABELS = {
  earn: 'Earned',
  cashback: 'Cashback',
  purchase: 'Purchase',
  transfer_in: 'Received',
  transfer_out: 'Sent',
  tithe: 'Tithe (10%)',
  sale: 'Sale',
  refund: 'Refund',
  buy: 'Bought IcanEra',
  sell: 'Sold IcanEra',
  journey_payment: 'Journey payment',
};

const APP_LABEL = { ican: 'ICAN', 'digital-city-era': 'Supermarket', 'farm-agent': 'AgriBone', mybodaguy: 'BodaGoEra' };
/** Receipts carry the coin's code ("ICAN"); people see its name. */
const unitLabel = (code) => (!code || code === 'ICAN' ? 'IcanEra' : code);

const HIDE_KEY = 'ican_wallet_balance_hidden';


function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-UG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── helpers for the till receipt ───────────────────────────────────────────

const timeOf = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Every word typed must appear somewhere in the transaction: its name, the app,
 * the note, the amount (as shown or plain), the direction, the date (as
 * "25 Sep 2026", "September", "Today"…), its status or its id.
 */
function matchesQuery(tx, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const d = new Date(tx.created_at);
  const hay = [
    TX_LABELS[tx.transaction_type] ?? tx.transaction_type,
    tx.transaction_type,
    APP_LABEL[tx.source_app] ?? tx.source_app,
    tx.note,
    tx.direction === 'in' ? 'in received incoming' : 'out sent outgoing',
    formatICAN(tx.ican_amount),
    String(Number(tx.ican_amount)),
    d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }),
    d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }),
    d.toLocaleDateString([], { weekday: 'long' }),
    dayLabel(tx.created_at),
    tx.status,
    tx.id,
    tx.reference_id,
  ].filter(Boolean).join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function txTone(tx) {
  if (tx.transaction_type === 'tithe') return { text: 'text-amber-700', bg: 'bg-amber-100' };
  if (tx.direction === 'in') return { text: 'text-emerald-700', bg: 'bg-emerald-100' };
  return { text: 'text-rose-700', bg: 'bg-rose-100' };
}

function txIcon(tx) {
  const t = tx.transaction_type;
  if (t === 'tithe') return <span className="text-[11px] font-bold">10%</span>;
  if (t === 'buy' || t === 'purchase') return <ShoppingCart size={15} />;
  if (t === 'sell' || t === 'sale') return <Banknote size={15} />;
  if (t === 'refund') return <RotateCcw size={15} />;
  if (t === 'earn' || t === 'cashback') return <Sparkles size={15} />;
  return tx.direction === 'in' ? <ArrowDown size={15} /> : <ArrowUp size={15} />;
}

const SEND_DESTINATIONS = [
  { key: 'wallet', label: 'IcanEra wallet', Icon: Gem },
  { key: 'mobilemoneyuganda', label: 'Mobile Money', Icon: Smartphone },
  { key: 'bank', label: 'Bank', Icon: Landmark },
];

function SendModal({ userId, balance, onClose, onDone }) {
  const [destination, setDestination] = useState('wallet');
  const [step, setStep] = useState('form'); // 'form' | 'confirm'

  // ICAN-to-ICAN fields - numbers only: the recipient's 16-digit account number
  // (or a 3... business wallet number, or a phone number), never an "ICA-"/"BIZ" code.
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [resolved, setResolved] = useState(null);
  const [pin, setPin] = useState('');

  // Real-money payout fields (mobile money / bank)
  const [network, setNetwork] = useState('MTN');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');

  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const available = balance?.ican ?? 0;
  const amountNum = parseFloat(amount) || 0;
  const isPayout = destination !== 'wallet';
  const feePercent = 3; // flat 3% cash-out fee (mobile money / bank) - sending to another ICAN wallet is 0%
  const ugxGross = amountNum * ICAN_TO_UGX;
  const ugxNet = ugxGross - Math.round((ugxGross * feePercent) / 100);

  // The network comes from the number's prefix; the MTN/Airtel picker only
  // appears when the prefix isn't recognised (same as the ICAN app).
  const detectedNetwork = destination === 'mobilemoneyuganda' ? detectUgandaMobileNetwork(phoneNumber) : null;
  const payoutNetwork = detectedNetwork || network;

  const canSend = isPayout
    ? amountNum > 0 && amountNum <= available &&
      (destination === 'mobilemoneyuganda' ? !!phoneNumber : !!accountNumber && !!bankCode && !!beneficiaryName)
    : !!recipient.trim() && amountNum > 0;

  // Step 1: check the form and (for a wallet) find out who is really being paid.
  const handleContinue = async () => {
    if (!canSend) { toast.error('Fill in all fields'); return; }
    if (amountNum > available) { toast.error('Insufficient balance'); return; }
    if (destination === 'wallet') {
      setLoading(true);
      try {
        const found = await resolveRecipient(recipient);
        if (!found) { toast.error(`Recipient not found: ${recipient.trim()}`); return; }
        if (found.kind === 'user' && found.userId === userId) { toast.error('Cannot send IcanEra to yourself'); return; }
        setResolved(found);
      } catch (e) {
        toast.error(e.message || 'Could not look up the recipient');
        return;
      } finally {
        setLoading(false);
      }
    }
    setPin('');
    setStep('confirm');
  };

  // Step 2: the transaction PIN, then the money moves.
  const handleConfirm = async () => {
    setLoading(true);
    try {
      const pinCheck = await verifyPin(userId, pin);
      if (!pinCheck.success) { toast.error(pinCheck.error || 'Incorrect transaction PIN. Transfer cancelled.'); return; }

      if (destination === 'wallet' && resolved) {
        const memo = note.trim() || `Transfer to ${resolved.name}`;
        if (resolved.kind === 'business') {
          await sendICANToBusiness({ fromUserId: userId, businessProfileId: resolved.businessProfileId, amount: amountNum, note: memo });
        } else {
          await sendICAN({ fromUserId: userId, toUserId: resolved.userId, amount: amountNum, note: memo });
        }
        toast.success(`Sent ${formatICAN(amountNum)} IcanEra to ${resolved.name}. No fee.`);
      } else {
        const data = await requestIcanPayout({
          icanAmount: amountNum,
          channel: destination,
          phoneNumber: destination === 'mobilemoneyuganda' ? phoneNumber : undefined,
          network: destination === 'mobilemoneyuganda' ? payoutNetwork : undefined,
          accountNumber: destination === 'bank' ? accountNumber : undefined,
          bankCode: destination === 'bank' ? bankCode : undefined,
          beneficiaryName: destination === 'bank' ? beneficiaryName : undefined,
        });
        toast.success(`${data.message} You'll receive UGX ${Number(data.ugx_net).toLocaleString()}.`);
      }
      onDone();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'confirm') {
    const rows = destination === 'wallet' && resolved
      ? [
          ['To', resolved.name],
          [resolved.kind === 'business' ? 'Business wallet' : 'Account', resolved.identifier],
          ['Amount', `${formatICAN(amountNum)} IcanEra`],
          ['Fee', 'None'],
        ]
      : [
          ['To', destination === 'mobilemoneyuganda' ? `${phoneNumber} (${payoutNetwork})` : `${beneficiaryName} · ${accountNumber}`],
          ['Amount', `${formatICAN(amountNum)} IcanEra`],
          [`Fee (${feePercent}%)`, `−UGX ${(ugxGross - ugxNet).toLocaleString()}`],
          ['Recipient gets', `UGX ${ugxNet.toLocaleString()}`],
        ];
    return (
      <Sheet title="Confirm" onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-800/20 bg-white/80 p-4 text-[13px] text-stone-700">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-baseline py-1.5">
                <span className="shrink-0">{k}</span>
                <span className="mx-2 flex-1 border-b border-dotted border-emerald-900/30" />
                <span className="min-w-0 max-w-[62%] break-words text-right font-semibold text-stone-900">{v}</span>
              </div>
            ))}
          </div>
          <div>
            <label className={LABEL} htmlFor="w-send-pin">Transaction PIN</label>
            <input
              id="w-send-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} autoFocus
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••" className={`${FIELD} text-center text-[20px] tracking-[0.5em]`}
            />
          </div>
          <div className="grid grid-cols-[1fr_1.4fr] gap-3 pt-1">
            <button type="button" onClick={() => setStep('form')} disabled={loading} className={BTN_OUTLINE}>Back</button>
            <button type="button" onClick={handleConfirm} disabled={loading || pin.length < 4} className={BTN_PRIMARY}>
              {loading ? 'Sending…' : isPayout ? 'Cash out' : 'Send'}
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Send" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <span className={LABEL}>Send to</span>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Send to">
            {SEND_DESTINATIONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={destination === key}
                onClick={() => setDestination(key)}
                disabled={loading}
                className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-center transition ${
                  destination === key ? 'border-emerald-700 bg-emerald-50 shadow-[inset_0_0_0_1px_rgba(4,120,87,0.9)]' : 'border-emerald-800/25 bg-white hover:border-emerald-700'
                }`}
              >
                <Icon size={18} className="text-emerald-700" />
                <span className="text-[11.5px] font-semibold leading-tight text-stone-800">{label}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-stone-500">
            Cards can only receive top-ups, not payouts — sending to a card isn't supported by any provider we integrate with.
          </p>
        </div>

        {destination === 'wallet' && (
          <div>
            <label className={LABEL} htmlFor="w-send-recipient">Recipient account number</label>
            <input
              id="w-send-recipient" value={recipient}
              onChange={(e) => setRecipient(e.target.value.replace(/[^\d+]/g, ''))}
              placeholder="1002345678901234" inputMode="numeric" autoComplete="off"
              className={`${FIELD} font-mono tabular-nums`}
            />
            <p className="mt-1.5 text-[11px] leading-snug text-stone-500">
              Numbers only — their 16-digit account number or phone number. A business wallet number starts with 3.
            </p>
          </div>
        )}

        {destination === 'mobilemoneyuganda' && (
          <>
            <div>
              <label className={LABEL} htmlFor="w-send-phone">Mobile Money number</label>
              <input id="w-send-phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="e.g. 0770123456" inputMode="tel" className={FIELD} />
            </div>
            {phoneNumber.trim() && (detectedNetwork ? (
              <p className="-mt-2 text-[12px] text-stone-500">Network detected: <span className="font-semibold text-stone-800">{detectedNetwork === 'AIRTEL' ? 'Airtel' : 'MTN'}</span></p>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Network">
                  {['MTN', 'AIRTEL'].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={network === n}
                      onClick={() => setNetwork(n)}
                      disabled={loading}
                      className={`rounded-2xl border p-2.5 text-center text-sm font-semibold transition ${
                        network === n ? 'border-emerald-700 bg-emerald-50 text-emerald-900 shadow-[inset_0_0_0_1px_rgba(4,120,87,0.9)]' : 'border-emerald-800/25 bg-white text-stone-700'
                      }`}
                    >
                      {n === 'AIRTEL' ? 'Airtel' : n}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500">Couldn't tell the network from this number — pick which one it's on.</p>
              </div>
            ))}
          </>
        )}

        {destination === 'bank' && (
          <>
            <div>
              <label className={LABEL} htmlFor="w-send-bank">Bank code</label>
              <input id="w-send-bank" value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="w-send-acc">Account number</label>
              <input id="w-send-acc" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="w-send-name">Account holder name</label>
              <input id="w-send-name" value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} className={FIELD} />
            </div>
          </>
        )}

        <div>
          <label className={LABEL} htmlFor="w-send-amount">Amount (IcanEra)</label>
          <input
            id="w-send-amount"
            type="number" min="0.0001" step="0.0001" inputMode="decimal" max={available}
            value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0000"
            className={`${FIELD} font-classic-display text-[18px] font-bold tabular-nums lining-nums`}
          />
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-stone-500">
            <span className="min-w-0 truncate">{amount && !isPayout ? `≈ UGX ${(amountNum * ICAN_TO_UGX).toLocaleString()}` : ' '}</span>
            <button type="button" className="shrink-0 font-semibold text-emerald-800 hover:underline" onClick={() => setAmount(String(available))}>
              Max {formatICAN(available)}
            </button>
          </div>
        </div>

        {destination === 'wallet' && (
          <div>
            <label className={LABEL} htmlFor="w-send-note">Note (optional)</label>
            <input id="w-send-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's this for?" className={FIELD} />
          </div>
        )}

        {isPayout && amountNum > 0 && (
          <div className="rounded-2xl border border-emerald-800/20 bg-white/80 p-4 font-mono text-[12.5px] text-stone-700">
            <div className="flex items-baseline"><span>Gross</span><span className="mx-2 flex-1 border-b border-dotted border-emerald-900/30" /><span>UGX {ugxGross.toLocaleString()}</span></div>
            <div className="mt-1.5 flex items-baseline"><span>Fee ({feePercent}%)</span><span className="mx-2 flex-1 border-b border-dotted border-emerald-900/30" /><span>−UGX {(ugxGross - ugxNet).toLocaleString()}</span></div>
            <div className="mt-1.5 flex items-baseline font-bold text-stone-900"><span>Recipient gets</span><span className="mx-2 flex-1 border-b border-dotted border-emerald-900/30" /><span>UGX {ugxNet.toLocaleString()}</span></div>
          </div>
        )}

        <p className="rounded-2xl border border-[#c4a052]/40 bg-[#fdf8ea] px-4 py-3 text-[12px] leading-relaxed text-[#5c4410]">
          {isPayout
            ? 'Sent via Flutterwave. A 3% cash-out fee applies. IcanEra leaves your wallet immediately; if the transfer fails, it is refunded automatically.'
            : 'No fee — the recipient receives the full amount you send.'}
        </p>

        <div className="grid grid-cols-[1fr_1.4fr] gap-3 pt-1">
          <button type="button" onClick={onClose} className={BTN_OUTLINE}>Cancel</button>
          <button type="button" onClick={handleContinue} disabled={!canSend || loading} className={BTN_PRIMARY}>
            {loading ? 'Checking…' : 'Continue'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ICANWalletPage({
  embedded = false,
  userId: propUserId = null,
  initialModal = null,
  receiveAmount = null,
  receiveDescription = '',
  showSupplierAvailability = false
}) {
  const [userId, setUserId] = useState(propUserId);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState({ ican: 0, ugx: 0, address: null });
  const [display, setDisplay] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(initialModal); // 'send' | 'pay' | 'receive' | 'buy' | 'sell' | 'sendout' | null
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [historyOpen, setHistoryOpen] = useState(false); // collapsed until asked for
  const [query, setQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
  });
  const toggleHidden = () => setHidden((h) => {
    try { localStorage.setItem(HIDE_KEY, h ? '0' : '1'); } catch { /* private mode: just don't remember it */ }
    return !h;
  });
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!propUserId) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) setUserId(data.user.id);
      });
    }
  }, [propUserId]);

  const loadWallet = useCallback(async () => {
    if (!userId) return;
    try {
      await getOrCreateWallet(userId);
      const [bal, txs, disp] = await Promise.all([
        getBalance(userId),
        getTransactions(userId, 50),
        getUserWalletDisplay(userId),
      ]);
      setBalance(bal);
      setTransactions(txs);
      setDisplay(disp);
      hasPinSet(userId).then((has) => setNeedsPin(!has)).catch(() => {});
    } catch (e) {
      toast.error('Could not load wallet: ' + e.message);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    loadWallet().finally(() => setLoading(false));
  }, [userId, loadWallet]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWallet();
    setRefreshing(false);
  };

  const handlePaymentScanned = async (scannedValue, paymentPurpose = 'personal', businessProfileId = null) => {
    if (!userId) {
      toast.error('Wallet is still loading. Please try again.');
      return;
    }

    // Smart about which of the two QR/link shapes this is — a merchant's
    // "Receive Money" request (payment_requests), or a POS invoice/receipt
    // (transactions, via the /invoice/:id public page's QR code) — so the
    // Pay scanner isn't limited to only one kind of code.
    const paymentCode = parseIcanPayCode(scannedValue);
    const invoiceTransactionId = paymentCode ? null : parseInvoiceTransactionId(scannedValue);

    if (!paymentCode && !invoiceTransactionId) {
      toast.error('This QR code is not an IcanEra payment request or invoice');
      return;
    }

    try {
      const pin = window.prompt('Enter your transaction PIN to authorize this payment:');
      if (pin === null) {
        toast.info('Payment cancelled.');
        return;
      }

      const pinCheck = await verifyPin(userId, pin);
      if (!pinCheck.success) {
        toast.error(pinCheck.error || 'PIN verification failed. Payment was not sent.');
        return;
      }

      const expenseClassification = paymentPurpose === 'business' ? 'business_expense' : 'personal_expense';

      if (invoiceTransactionId) {
        console.log('[ICAN PAY] Paying invoice via ICAN:', { invoiceTransactionId, payerUserId: userId });
        const result = await payInvoiceWithIcan({
          transactionId: invoiceTransactionId,
          payerUserId: userId,
          expenseClassification,
          counterpartyType: 'business',
        });
        setPaymentReceipt({
          receiptNumber: result.invoice.receiptNumber,
          transactionId: result.transfer.out_tx_id,
          amount: result.transfer.amount_sent,
          currency: 'IcanEra',
          payerUserId: userId,
          issuedAt: new Date().toISOString(),
          description: `Invoice payment — ${result.invoice.storeName}`,
        });
        toast.success(
          result.paymentStatus === 'paid'
            ? `Invoice fully paid and recorded with the store!`
            : `Payment sent and recorded — balance due updated.`
        );
      } else {
        console.log('[ICAN PAY] Starting real transfer:', { paymentCode, payerUserId: userId });
        const paymentResult = await payIcanRequest({
          paymentCode,
          payerUserId: userId,
          expenseClassification,
          counterpartyType: 'business',
          businessProfileId,
        });
        setPaymentReceipt(paymentResult.payerReceipt);
        toast.success(`Payment sent and recorded. Receipt: ${paymentResult.payerReceipt?.receiptNumber || 'available in transaction history'}`);
      }
      setModal(null);
      await loadWallet();
    } catch (e) {
      toast.error(e.message || 'Payment failed');
    }
  };

  // Arriving here via a scanned "Receive Money" QR/link (PayRequestPublicPage
  // -> /ican-wallet?pay=<code>) while already signed in should be as smart as
  // scanning in-app: no re-entering the code, no separate account-linking
  // step — just go straight into the same PIN-authorized pay flow.
  useEffect(() => {
    const payCode = searchParams.get('pay');
    if (!payCode || !userId) return;
    handlePaymentScanned(payCode);
    searchParams.delete('pay');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userId]);

  const downloadPaymentReceipt = () => {
    if (!paymentReceipt) return;
    const receiptText = [
      'ICANERA WALLET PAYMENT RECEIPT',
      '--------------------------------',
      `Receipt: ${paymentReceipt.receiptNumber}`,
      `Transaction: ${paymentReceipt.transactionId || 'N/A'}`,
      `Amount: ${formatICAN(paymentReceipt.amount)} ${unitLabel(paymentReceipt.currency)}`,
      `Description: ${paymentReceipt.description || 'IcanEra payment'}`,
      `Payment code: ${paymentReceipt.paymentCode}`,
      `Date: ${new Date(paymentReceipt.issuedAt).toLocaleString('en-UG')}`,
      '',
      'Payment successful.'
    ].join('\n');
    const url = URL.createObjectURL(new Blob([receiptText], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${paymentReceipt.receiptNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredTx = useMemo(() => transactions.filter((tx) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'in') return tx.direction === 'in';
    if (activeTab === 'out') return tx.direction === 'out';
    if (activeTab === 'tithe') return tx.transaction_type === 'tithe';
    return true;
  }).filter((tx) => matchesQuery(tx, query)), [transactions, activeTab, query]);

  // History grouped by day, newest first (the query already returns it that way).
  const groups = useMemo(() => {
    const out = [];
    for (const tx of filteredTx) {
      const label = dayLabel(tx.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(tx);
      else out.push({ label, items: [tx] });
    }
    return out;
  }, [filteredTx]);

  const cashback = useMemo(
    () => transactions.filter((tx) => tx.transaction_type === 'cashback' && tx.direction === 'in').reduce((sum, tx) => sum + Number(tx.ican_amount), 0),
    [transactions],
  );

  // Live, country-aware currency (falls back to the UGX floor price if the
  // pricing RPC — or the user's sign-up country — isn't resolved yet).
  const currencyCode = display?.currency_code || 'UGX';
  const priceLocal    = Number(display?.price_local ?? ICAN_TO_UGX);

  if (!userId) {
    return (
      <div className={`${embedded ? '' : 'min-h-screen bg-gray-950'} flex items-center justify-center ${embedded ? 'py-10' : ''}`}>
        <div className="text-white text-center">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-gray-400">Please sign in to access your IcanEra Wallet</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${embedded ? '' : 'min-h-screen'} px-4 py-6`} style={embedded ? undefined : { background: PAGE_BG }} role="status" aria-label="Loading your wallet">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="h-[290px] animate-pulse rounded-[26px] bg-gradient-to-br from-[#04281e] to-[#0b6b4f] opacity-80" />
          <div className="h-32 animate-pulse rounded-[22px] bg-emerald-900/10" />
          <div className="h-44 animate-pulse rounded-[22px] bg-emerald-900/10" />
        </div>
      </div>
    );
  }

  const valueOf = (ican) => fmtLocal(Number(ican) * priceLocal, currencyCode);
  const dash = hidden ? '••••' : null;

  return (
    <div className={embedded ? '' : 'min-h-screen text-white'} style={embedded ? undefined : { background: PAGE_BG }}>
      <div className={`mx-auto max-w-2xl space-y-4 px-4 ${embedded ? 'py-5' : 'py-8'}`}>

        {/* Header - only show if not embedded */}
        {!embedded && (
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-[#e6c980] ring-1 ring-[#c4a052]/60"><ShoppingBasket size={19} /></span>
            <div>
              <h1 className="font-classic-display text-xl font-bold">IcanEra Wallet</h1>
              <p className="text-[12px] text-emerald-100/60">Supermarket — powered by IcanEra</p>
            </div>
          </div>
        )}

        <StoreCard
          balanceText={formatAmount(balance.ican)}
          exactText={formatICAN(balance.ican)}
          hidden={hidden}
          onToggleHidden={toggleHidden}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          display={display}
          fallbackPrice={ICAN_TO_UGX}
          localBalance={balance.ican * priceLocal}
          currency={currencyCode}
          address={balance.address}
          onShowQr={() => setModal('qr')}
        />

        <ActionTiles embedded={embedded} onAction={(a) => setModal(a)} />

        {/* Supplier availability — confirmed suppliers only, see SupplierAvailabilityPanel */}
        {showSupplierAvailability && <SupplierAvailabilityPanel embedded={embedded} />}

        <SpendMix
          transactions={transactions}
          earned={compactNumber(balance.totalEarned ?? 0)}
          spent={compactNumber(balance.totalSpent ?? 0)}
          tithe={compactNumber(balance.totalTithe ?? 0)}
          cashback={cashback}
          hidden={hidden}
          embedded={embedded}
          fmt={compactNumber}
        />

        {!embedded && (
          <Collapsible embedded={embedded} icon={<Leaf size={16} />} title="Earn IcanEra at the Supermarket" subtitle="Cashback, deliveries and tithe">
            <ul className="space-y-2 text-[13px] leading-snug text-emerald-50/80">
              {[
                'Pay with IcanEra at checkout — 1% cashback on every purchase.',
                'Suppliers earn IcanEra on every approved delivery.',
                'A 10% tithe is deducted automatically from all earnings.',
              ].map((item) => (
                <li key={item} className="flex gap-2"><span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4a052]" />{item}</li>
              ))}
            </ul>
          </Collapsible>
        )}

        {/* Transaction history — a till receipt, collapsed by default, searchable once open */}
        <section id="tx-section" aria-label="Transaction history">
          <HistoryHeader
            open={historyOpen}
            onToggle={() => setHistoryOpen((o) => !o)}
            count={transactions.length}
            embedded={embedded}
            preview={transactions[0]
              ? `Latest: ${TX_LABELS[transactions[0].transaction_type] ?? transactions[0].transaction_type} · ${dayLabel(transactions[0].created_at)}, ${timeOf(transactions[0].created_at)}`
              : 'No receipts yet'}
          />

          {historyOpen && (
            <div id="tx-panel" className="mt-3 space-y-3">
              <SearchBox value={query} onChange={setQuery} embedded={embedded} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FilterTabs value={activeTab} onChange={setActiveTab} embedded={embedded} />
                {(query || activeTab !== 'all') && (
                  <p className={`text-[12px] ${embedded ? 'text-stone-500' : 'text-emerald-100/60'}`} aria-live="polite">{filteredTx.length} {filteredTx.length === 1 ? 'result' : 'results'}</p>
                )}
              </div>
          <Receipt
            groups={groups}
            footerId={balance.address}
            empty={{
              title: query ? 'No matches' : activeTab === 'all' ? 'Nothing on the till yet' : 'Nothing matches this filter',
              body: query ? `Nothing matches “${query}”. Try a name, an amount or a date.` : activeTab === 'all' ? 'Pay or receive IcanEra at the supermarket checkout.' : 'Try another filter.',
            }}
            renderRow={(tx) => {
              const isIn = tx.direction === 'in';
              return (
                <ReceiptRow
                  key={tx.id}
                  label={TX_LABELS[tx.transaction_type] ?? tx.transaction_type}
                  sub={`${APP_LABEL[tx.source_app] ?? tx.source_app} · ${timeOf(tx.created_at)}${tx.note ? ` · ${tx.note}` : ''}`}
                  amount={dash || `${isIn ? '+' : '−'}${formatAmount(tx.ican_amount)}`}
                  local={dash ? ' ' : valueOf(tx.ican_amount)}
                  tone={txTone(tx)}
                  icon={txIcon(tx)}
                  onClick={() => setSelectedTx(tx)}
                />
              );
            }}
          />
            </div>
          )}
        </section>

        {/* Transaction detail */}
        {selectedTx && (() => {
          const tx = selectedTx;
          const isIn = tx.direction === 'in';
          const tone = txTone(tx);
          const rows = [
            ['Value today', valueOf(tx.ican_amount)],
            ['App', APP_LABEL[tx.source_app] ?? tx.source_app],
            ['Date', formatDate(tx.created_at)],
            ['Status', String(tx.status || 'completed')],
            ['Note', tx.note || '—'],
          ];
          return (
            <Sheet title="Receipt" onClose={() => setSelectedTx(null)} z={60}>
              <div className="text-center">
                <span className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${tone.bg} ${tone.text}`}>{txIcon(tx)}</span>
                <p className="mt-2 text-[13px] font-semibold text-stone-600">{TX_LABELS[tx.transaction_type] ?? tx.transaction_type}</p>
                <p className={`mt-1 font-classic-display text-[34px] font-bold leading-none tabular-nums lining-nums ${tone.text}`}>{isIn ? '+' : '−'}{formatAmount(tx.ican_amount)}</p>
              </div>
              <div className="mt-5 rounded-2xl border border-emerald-800/20 bg-white/80 p-4 font-mono text-[12.5px]">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline py-1.5">
                    <span className="text-stone-500">{k}</span>
                    <span className="mx-2 flex-1 border-b border-dotted border-emerald-900/30" />
                    <span className="max-w-[55%] truncate text-right font-bold text-stone-800">{v}</span>
                  </div>
                ))}
              </div>
              {tx.id && (
                <div className="mt-4 space-y-3">
                  <Barcode value={tx.id} color="#052e22" height={30} className="opacity-70" />
                  <div className="flex items-center gap-3">
                    <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-stone-400" title={tx.id}>ID {tx.id}</p>
                    <div className="w-32 shrink-0"><CopyButton text={tx.id} label="Copy ID" /></div>
                  </div>
                </div>
              )}
            </Sheet>
          );
        })()}

      </div>

      {/* Modals */}
      {modal === 'send' && (
        <SendModal
          userId={userId}
          walletAddress={balance.address}
          balance={balance}
          onClose={() => setModal(null)}
          onDone={loadWallet}
        />
      )}
      {modal === 'receive' && balance.address && (
        <ReceiveMoneyModal 
          isOpen 
          userId={userId} 
          onClose={() => setModal(null)} 
          onSuccess={loadWallet}
          prefilledAmount={receiveAmount}
          prefilledDescription={receiveDescription}
        />
      )}
      {modal === 'pay' && (
        <PayMoneyModal isOpen userId={userId} onClose={() => setModal(null)} onPaymentScanned={handlePaymentScanned} />
      )}
      {modal === 'qr' && balance.address && (
        <Sheet title="Your wallet code" onClose={() => setModal(null)}>
          <AddressQr address={balance.address} />
        </Sheet>
      )}
      {modal === 'buy' && (
        <BuyIcanModal userId={userId} onClose={() => setModal(null)} onSuccess={loadWallet} />
      )}
      {modal === 'sell' && (
        <SellIcanModal userId={userId} balance={balance} onClose={() => setModal(null)} onSuccess={loadWallet} />
      )}
      {modal === 'sendout' && (
        <SendIcanOutModal userId={userId} balance={balance} onClose={() => setModal(null)} onSuccess={loadWallet} />
      )}
      {paymentReceipt && (
        <Sheet title="Payment successful" onClose={() => setPaymentReceipt(null)} z={60}>
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={28} /></span>
            <p className="mt-2 text-[13px] text-stone-500">Your IcanEra payment has been sent and recorded.</p>
          </div>
          <div className="mt-4 rounded-2xl border border-emerald-800/20 bg-white/80 p-4 font-mono text-[12.5px]">
            {[
              ['Receipt', paymentReceipt.receiptNumber],
              ['Amount', `${formatICAN(paymentReceipt.amount)} ${unitLabel(paymentReceipt.currency)}`],
              ['Transaction', paymentReceipt.transactionId || 'N/A'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline py-1.5">
                <span className="text-stone-500">{k}</span>
                <span className="mx-2 flex-1 border-b border-dotted border-emerald-900/30" />
                <span className="max-w-[55%] truncate text-right font-bold text-stone-800">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-[1.4fr_1fr] gap-3">
            <button type="button" onClick={downloadPaymentReceipt} className={BTN_PRIMARY}>Download receipt</button>
            <button type="button" onClick={() => setPaymentReceipt(null)} className={BTN_OUTLINE}>Close</button>
          </div>
        </Sheet>
      )}
      {needsPin && (
        <SetPinPrompt userId={userId} onDone={() => setNeedsPin(false)} />
      )}
    </div>
  );
}
