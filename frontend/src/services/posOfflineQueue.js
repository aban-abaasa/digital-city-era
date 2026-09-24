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

import { isNetworkFailure, requestPersistentStorage, precacheAppForOffline, isInstalledApp } from './posOfflineCache';

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

// Same shape transactionService.saveTransaction generates on its own. Made up
// front and carried in the payload so a sale that was sent but never
// acknowledged (connection died mid-request) can be replayed without
// creating a second row — saveTransaction looks it up before inserting.
export const generateTransactionId = () =>
  `TXN_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`;

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
// quiet: used by the background retry timer — it must not toast "still
// pending" every 30s while the backend stays unreachable, so it only reports
// when it actually got something through.
export async function syncPendingSales({ transactionService, inventoryService, quiet = false }) {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const pending = (await getPendingSales()).sort((a, b) => a.queuedAt - b.queuedAt);
    if (pending.length === 0) return;

    if (!quiet) notify({ status: 'syncing', pendingCount: pending.length });

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
        failed += 1;
        // navigator.onLine can be true with the backend unreachable (captive
        // portal, dead uplink, Supabase down). Every remaining sale would
        // fail the same way, so stop and wait for the next attempt instead of
        // hammering it; the sales stay queued.
        if (isNetworkFailure(err)) {
          console.warn('[POS offline sync] Backend unreachable, will retry later.');
          break;
        }
        console.error('[POS offline sync] Failed to sync queued sale:', err);
      }
    }

    if (!(quiet && synced === 0)) {
      notify({ status: failed === 0 ? 'synced' : 'sync-error', synced, failed });
    }
  } finally {
    syncing = false;
  }
}

const RETRY_INTERVAL_MS = 30 * 1000;

// Call once on mount. Syncs immediately if already online, again every time
// the browser regains connectivity, and on a timer so a sale queued while the
// browser *thought* it was online (but the backend wasn't reachable) is still
// picked up without anyone reloading the page.
export function initPosOfflineSync({ transactionService, inventoryService }) {
  const trigger = () => syncPendingSales({ transactionService, inventoryService });
  const retry = () => syncPendingSales({ transactionService, inventoryService, quiet: true });
  window.addEventListener('online', trigger);
  if (navigator.onLine) trigger();
  const timer = setInterval(retry, RETRY_INTERVAL_MS);
  return () => {
    window.removeEventListener('online', trigger);
    clearInterval(timer);
  };
}

// App-wide version, started once from main.jsx. The queue lives in
// IndexedDB and outlives the page, but the sync above only runs while the
// cashier portal is mounted — so an installed till that's reopened on some
// other screen (or left on the login page) with sales still waiting would
// never send them. This checks for waiting sales on load, on reconnect and on
// a timer, and only then pulls in the (large) service modules.
export function startGlobalPosSync() {
  requestPersistentStorage();

  // Once the app is installed, keep the entire build and protected storage on
  // the device: on install, and on every launch of the installed app (which
  // also refreshes it after a new deploy, since the service worker drops the
  // previous build's files). Browsers usually only grant persistent storage
  // to an installed app, hence asking again at install time.
  const keepOnDevice = () => { requestPersistentStorage(); precacheAppForOffline(); };
  window.addEventListener('appinstalled', keepOnDevice);
  if (isInstalledApp()) keepOnDevice();

  const run = async () => {
    if (!navigator.onLine || syncing) return;
    try {
      if ((await getPendingSalesCount()) === 0) return;
      const [{ default: transactionService }, { default: inventoryService }] = await Promise.all([
        import('./transactionService'),
        import('./inventorySupabaseService'),
      ]);
      await syncPendingSales({ transactionService, inventoryService, quiet: true });
    } catch (err) {
      console.warn('[POS offline sync] Global sync check failed:', err);
    }
  };

  window.addEventListener('online', run);
  setInterval(run, RETRY_INTERVAL_MS);
  run();
}
