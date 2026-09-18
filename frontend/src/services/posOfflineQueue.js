// ===================================================
// 🧾📴 POS OFFLINE SALE QUEUE (Cashier portal)
// ===================================================
// Cash sales only — card/mobile money aren't options on this till (see
// CushierPortal.jsx's paymentMethods: only 'cash_ugx' and 'icanera_wallet'),
// and the IcanEra Wallet path needs a live QR scan/verification round trip
// there's no way to queue. A cash sale is different: the cashier has
// already physically collected the money, so there's nothing left that
// needs the network *at the moment of sale* — only recording it does.
//
// WhatsApp-style pattern (same idea as ICAN's offlineAuthManager/
// syncManager): queue the exact payload the online path would have sent,
// then replay it through the SAME service functions
// (transactionService.saveTransaction / inventoryService.adjustStockAfterSale)
// once back online, so there is no second copy of the insert logic to keep
// in sync with the real one, and every field validates identically.

const DB_NAME = 'CashierPosOfflineDB';
const DB_VERSION = 1;
const STORE = 'pending_sales';

let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const generateLocalId = () => `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// stockPayload is null when there's nothing to deduct (e.g. every line was a
// service/listing-only item) — mirrors the online path's own skip logic in
// CushierPortal.jsx.
export async function queueSale(transactionPayload, stockPayload) {
  const db = await openDB();
  const record = {
    localId: generateLocalId(),
    transactionPayload,
    stockPayload,
    queuedAt: Date.now(),
  };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return record;
}

export async function getPendingSales() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingSalesCount() {
  const pending = await getPendingSales();
  return pending.length;
}

async function removeSale(localId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let syncing = false;
const listeners = new Set();

// state: { status: 'syncing'|'synced'|'sync-error', synced, failed, pendingCount }
export function onSyncStateChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify(state) {
  listeners.forEach((cb) => {
    try { cb(state); } catch (err) { console.error('[POS offline sync] Listener error:', err); }
  });
}

// transactionService/inventoryService are passed in rather than imported
// here, so this module has no dependency cycle with them and stays a plain
// queue the caller drives.
export async function syncPendingSales({ transactionService, inventoryService }) {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const pending = await getPendingSales();
    if (pending.length === 0) return;

    notify({ status: 'syncing', pendingCount: pending.length });

    let synced = 0;
    let failed = 0;

    for (const sale of pending) {
      try {
        const saveResult = await transactionService.saveTransaction(sale.transactionPayload);
        if (!saveResult.success) throw new Error(saveResult.error || 'Failed to save queued sale');

        // Stock deduction is best-effort, same as the online path (see
        // CushierPortal.jsx: a stock-update failure there only shows a
        // warning toast, it never rolls back the sale). The money was
        // already collected and the transaction record above is the
        // financial source of truth; a lost race on stock (e.g. another
        // cashier sold the last unit online while this one was offline)
        // must not un-record a real cash sale.
        if (sale.stockPayload) {
          try {
            await inventoryService.adjustStockAfterSale(
              sale.stockPayload.items,
              sale.stockPayload.saleId,
              sale.stockPayload.supermarketId
            );
          } catch (stockErr) {
            console.warn('[POS offline sync] Sale synced but stock adjustment failed:', stockErr.message);
          }
        }

        await removeSale(sale.localId);
        synced += 1;
      } catch (err) {
        console.error('[POS offline sync] Failed to sync queued sale:', err);
        failed += 1;
      }
    }

    notify({ status: failed === 0 ? 'synced' : 'sync-error', synced, failed });
  } finally {
    syncing = false;
  }
}

// Call once on mount. Syncs immediately if already online, and again every
// time the browser regains connectivity.
export function initPosOfflineSync({ transactionService, inventoryService }) {
  const trigger = () => syncPendingSales({ transactionService, inventoryService });
  window.addEventListener('online', trigger);
  if (navigator.onLine) trigger();
  return () => window.removeEventListener('online', trigger);
}
