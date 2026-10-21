import { useCallback, useEffect, useRef, useState } from 'react';
import { getMobileCardStatus, confirmMobileCardPayment, cancelMobileCardCharge } from '../services/icanMobileCardService';
import { mobileCardPaymentData } from '../utils/mobileCardPayment';
import {
  PENDING_SALES_KEY,
  buildPendingEntry,
  canParkAnother,
  mergeOwnerSales,
  pruneListed,
  recoverInterrupted,
  salesForOwner,
} from '../utils/pendingSales';

// Sales waiting for a payment (IcanEra Mobile / Card) while the cashier serves the next customer.
// Each is a snapshot of its basket plus the server charge that will pay for it. They are kept on the device so a
// refresh does not lose them, watched in the background, and handed to `onPaid` the moment their payment lands —
// exactly once, however it arrives (Mobile Money approved, card, or the customer's wallet).

const POLL_MS = 3000;       // ask the database every 3 s ...
const CONFIRM_EVERY = 3;    // ... and Flutterwave itself every 3rd time
const ENDED = {
  cancelled: 'This sale was cancelled.',
  refunded: 'The payment could not be applied and was refunded.',
  expired: 'The customer did not pay in time.',
};

const readAll = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_SALES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const writeAll = (list) => {
  try { localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(list)); } catch { /* storage full or private mode: still works until refresh */ }
};

/**
 * @param {{ownerKey: string|null, supermarketId: string|null,
 *   onPaid: (entry, paymentData) => Promise<object|null>}} options
 *   onPaid records the sale and returns its receipt (or null).
 */
export default function usePendingMobileCardSales({ ownerKey, supermarketId, onPaid }) {
  const [entries, setEntries] = useState([]);
  const [foregroundId, setForegroundId] = useState(null); // open in the payment screen: its own screen watches it
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const processing = useRef(new Set());

  // Load this cashier's sales once we know who they are.
  useEffect(() => {
    if (!ownerKey) { setEntries([]); return; }
    setEntries(pruneListed(recoverInterrupted(salesForOwner(readAll(), ownerKey))));
  }, [ownerKey]);

  const commit = useCallback((updater) => {
    setEntries((previous) => {
      const next = pruneListed(typeof updater === 'function' ? updater(previous) : updater);
      writeAll(mergeOwnerSales(readAll(), ownerKey, next));
      return next;
    });
  }, [ownerKey]);

  const update = useCallback((id, patch) => commit((previous) => previous.map((e) => (e.id === id ? { ...e, ...patch } : e))), [commit]);
  const remove = useCallback((id) => commit((previous) => previous.filter((e) => e.id !== id)), [commit]);

  // Put a sale on hold: returns its id, or null when too many are already waiting.
  const park = useCallback(({ charge, sale, contact }) => {
    if (!ownerKey || !canParkAnother(entriesRef.current)) return null;
    const entry = buildPendingEntry({ ownerKey, supermarketId, charge, sale, contact });
    commit((previous) => [entry, ...previous.filter((e) => e.id !== entry.id)]);
    return entry.id;
  }, [ownerKey, supermarketId, commit]);

  // The payment arrived: record the sale once. Resolves the receipt, or null.
  const complete = useCallback(async (entry, paymentData) => {
    if (processing.current.has(entry.id)) return null;
    processing.current.add(entry.id);
    update(entry.id, { status: 'recording' });
    try {
      const receipt = (await onPaidRef.current(entry, paymentData)) ?? null;
      update(entry.id, { status: 'paid', receipt, paidAt: Date.now() });
      return receipt;
    } catch (error) {
      console.error('Recording a parked sale failed:', error);
      update(entry.id, {
        status: 'paid',
        receipt: null,
        note: 'The payment arrived, but recording the sale failed. Check My Receipts before dismissing this.',
      });
      return null;
    } finally {
      processing.current.delete(entry.id);
    }
  }, [update]);

  // Leaving a waiting sale: if the customer paid a moment ago it is completed instead; otherwise the charge is voided
  // so a later approval is refunded rather than credited to a sale nobody is serving. Resolves { completed }.
  const cancel = useCallback(async (id) => {
    const entry = entriesRef.current.find((e) => e.id === id);
    if (!entry || entry.status !== 'waiting') return { completed: false };
    try {
      const status = await getMobileCardStatus(id);
      if (status.found && status.status === 'paid') {
        await complete(entry, mobileCardPaymentData(status, { txRef: id, amountUGX: entry.charge.amount_ugx }));
        return { completed: true };
      }
      const confirmed = await confirmMobileCardPayment(id);
      if (confirmed.paid) {
        await complete(entry, mobileCardPaymentData(confirmed, { txRef: id, amountUGX: entry.charge.amount_ugx }));
        return { completed: true };
      }
    } catch {
      // unreachable: still void it below
    }
    cancelMobileCardCharge(id).catch(() => {});
    remove(id);
    return { completed: false };
  }, [complete, remove]);

  // Watch every waiting sale that is not open on screen.
  const watchKey = entries.filter((e) => e.status === 'waiting' && e.id !== foregroundId).map((e) => e.id).join(',');
  useEffect(() => {
    if (!ownerKey || !watchKey) return undefined;
    let stopped = false;
    let busy = false;
    let tick = 0;

    const checkOne = async (id) => {
      const entry = entriesRef.current.find((e) => e.id === id);
      if (!entry || entry.status !== 'waiting') return;
      try {
        const status = await getMobileCardStatus(id);
        if (stopped) return;
        if (status.found && status.status === 'paid') {
          complete(entry, mobileCardPaymentData(status, { txRef: id, amountUGX: entry.charge.amount_ugx }));
          return;
        }
        if (!status.found) { update(id, { status: 'ended', endedReason: 'This payment could not be found any more.' }); return; }
        if (ENDED[status.status]) { update(id, { status: 'ended', endedReason: ENDED[status.status] }); return; }
        // Flutterwave side (card / Mobile Money): the first look, every few looks, and straight away when a payment arrived
        // that could not be applied (the server then retries the refund).
        if (tick % CONFIRM_EVERY === 1 || status.status === 'failed') {
          const confirmed = await confirmMobileCardPayment(id);
          if (!stopped && confirmed.paid) {
            complete(entry, mobileCardPaymentData(confirmed, { txRef: id, amountUGX: entry.charge.amount_ugx }));
          }
        }
      } catch (error) {
        if (!stopped && error.terminal) update(id, { status: 'ended', endedReason: error.message });
        // anything else is a connection blip: look again next time
      }
    };

    const run = async () => {
      if (busy || stopped) return;
      busy = true;
      tick += 1;
      try {
        for (const id of watchKey.split(',')) {
          if (stopped) return;
          await checkOne(id);
        }
      } finally {
        busy = false;
      }
    };

    run();
    const timer = setInterval(run, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [ownerKey, watchKey, complete, update]);

  return {
    entries,
    waitingCount: entries.filter((e) => e.status === 'waiting' || e.status === 'recording').length,
    canPark: canParkAnother(entries),
    setForegroundId,
    park,
    complete,
    cancel,
    remove,
  };
}
