// Sales waiting for a payment (IcanEra Mobile / Card) while the cashier serves the next customer.
// A "parked" sale is a snapshot of its basket plus the server charge that will pay for it. It is kept on the
// device (so a refresh does not lose it), watched in the background, and completed the moment its payment lands.
// These are the small pure rules; the watching lives in hooks/usePendingMobileCardSales.js.

export const PENDING_SALES_KEY = 'cashier_pending_mobile_card_sales';
// How many sales may wait at once. Each is an open charge on the server (which also caps a cashier at 20 an hour).
export const MAX_WAITING_SALES = 5;
// Finished entries (paid / ended) stay listed until dismissed, but never pile up without limit.
export const MAX_LISTED_SALES = 12;

export const isWaiting = (entry) => entry?.status === 'waiting' || entry?.status === 'recording';

export const waitingCount = (entries) => (entries || []).filter(isWaiting).length;

export const canParkAnother = (entries) => waitingCount(entries) < MAX_WAITING_SALES;

export const saleItemCount = (sale) =>
  (sale?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

// What the cashier recognises a waiting customer by: the number they asked, else how big the basket is.
export const pendingSaleLabel = (entry) => {
  const contact = String(entry?.contact || '').trim();
  if (contact) return contact;
  const count = saleItemCount(entry?.sale);
  return `${count} item${count === 1 ? '' : 's'}`;
};

export const buildPendingEntry = ({ ownerKey, supermarketId, charge, sale, contact = '', now = Date.now() }) => ({
  id: charge.tx_ref,
  ownerKey,
  supermarketId: supermarketId || null,
  charge: {
    tx_ref: charge.tx_ref,
    merchant_name: charge.merchant_name || null,
    amount_ugx: Number(charge.amount_ugx),
    processing_fee_ugx: Number(charge.processing_fee_ugx) || 0,
    charge_ugx: Number(charge.charge_ugx),
    expires_at: charge.expires_at,
  },
  // Only what is needed to record the sale later.
  sale: {
    items: sale.items || [],
    subtotal: Number(sale.subtotal) || 0,
    tax: Number(sale.tax) || 0,
    total: Number(sale.total) || 0,
    customer: sale.customer || null,
  },
  contact: String(contact || '').trim(),
  status: 'waiting', // waiting | recording | paid | ended
  createdAt: now,
});

// Each cashier only ever sees (and completes) their own parked sales, even on a shared device.
export const salesForOwner = (all, ownerKey) =>
  ownerKey ? (all || []).filter((entry) => entry && entry.ownerKey === ownerKey) : [];

export const mergeOwnerSales = (all, ownerKey, mine) => [
  ...(all || []).filter((entry) => entry && entry.ownerKey !== ownerKey),
  ...(mine || []),
];

// The page was closed or crashed while a payment was being recorded: that payment HAS arrived, so it is never
// recorded a second time — the cashier is told to check the receipts instead.
export const recoverInterrupted = (entries) =>
  (entries || []).map((entry) => (entry.status === 'recording'
    ? {
      ...entry,
      status: 'paid',
      receipt: null,
      note: 'The payment arrived, but the till was interrupted while recording the sale. Check My Receipts before dismissing this.',
    }
    : entry));

// Newest first, finished entries trimmed so the list stays short.
export const pruneListed = (entries) => {
  const sorted = [...(entries || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const waiting = sorted.filter(isWaiting);
  const finished = sorted.filter((entry) => !isWaiting(entry)).slice(0, Math.max(0, MAX_LISTED_SALES - waiting.length));
  return sorted.filter((entry) => isWaiting(entry) || finished.includes(entry));
};

const clock = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// One line under each parked sale.
export const pendingStatusText = (entry, now = Date.now()) => {
  if (entry.status === 'recording') return 'Payment received - recording the sale...';
  if (entry.status === 'paid') return entry.note || 'Paid';
  if (entry.status === 'ended') return entry.endedReason || 'This payment ended';
  const left = new Date(entry.charge?.expires_at).getTime() - now;
  return left > 0 ? `Waiting for payment - ${clock(left)} left` : 'Waiting for payment - about to time out';
};
