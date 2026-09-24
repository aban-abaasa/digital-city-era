// ===================================================
// 🧾📦 POS OFFLINE CACHE (Cashier portal)
// ===================================================
// The sale queue (posOfflineQueue.js) lets a cash sale be *recorded* with no
// connection, but the till also has to be able to *open* and *show products*
// with no connection, or there's nothing to sell. This keeps the last
// successfully loaded copy of everything the till needs on this device:
//
//   - product catalog (+ stock) per supermarket  -> IndexedDB
//   - cashier profile                             -> IndexedDB
//   - "who is signed in and what role" identity   -> localStorage (read
//     synchronously by RoleProtectedRoute before the app can render)
//
// It's only ever a fallback: every live load still goes to Supabase first and
// overwrites this on success, so a cached copy is never preferred over a
// reachable backend.

const DB_NAME = 'CashierPosCacheDB';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

async function kvGet(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[POS offline cache] read failed:', err);
    return null;
  }
}

async function kvSet(key, value) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[POS offline cache] write failed:', err);
  }
}

// True when an error/message means "couldn't reach the backend" (as opposed
// to the backend answering with a real rejection like a validation or RLS
// error). Supabase-js reports fetch failures as message strings
// ("TypeError: Failed to fetch"), not always as thrown errors, so this takes
// either. A queued sale is only ever retried for these — a genuine rejection
// would fail identically on every retry.
const NETWORK_FAILURE_RE = /failed to fetch|networkerror|network request failed|network error|load failed|fetch failed|timeout|timed out|err_internet|err_network|econn|enotfound|bad gateway|service unavailable|gateway time-?out|\b(502|503|504|522|523|524)\b/i;
export function isNetworkFailure(errOrMessage) {
  if (!errOrMessage) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (errOrMessage.name === 'AuthRetryableFetchError') return true;
  const message = typeof errOrMessage === 'string' ? errOrMessage : errOrMessage.message;
  return NETWORK_FAILURE_RE.test(message || '');
}

// ---- Product catalog ----

export async function saveCatalog(supermarketId, products, { keepSavedAt = false } = {}) {
  if (!supermarketId || !Array.isArray(products)) return;
  const key = `catalog:${supermarketId}`;
  let savedAt = Date.now();
  if (keepSavedAt) {
    const existing = await kvGet(key);
    if (existing?.savedAt) savedAt = existing.savedAt;
  }
  await kvSet(key, { products, savedAt });
}

// -> { products, savedAt } | null
export async function loadCatalog(supermarketId) {
  if (!supermarketId) return null;
  const entry = await kvGet(`catalog:${supermarketId}`);
  return entry && Array.isArray(entry.products) ? entry : null;
}

// ---- Cashier profile ----

export async function saveCachedProfile(profile) {
  if (!profile?.user_id) return;
  await kvSet('profile', profile);
}

export async function loadCachedProfile() {
  return kvGet('profile');
}

// ---- Signed-in identity (localStorage, synchronous) ----
// RoleProtectedRoute needs to decide "may this person see this portal" on
// the very first render, before any async work; and supabase-js can't
// answer that offline once the access token has expired (it tries to
// refresh it over the network and returns no session). The role was already
// verified against the users table the last time the till was online.
const IDENTITY_KEY = 'pos_offline_identity_v1';

export function getCachedIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCachedIdentity(partial) {
  try {
    const existing = getCachedIdentity() || {};
    // A different person signing in on this device starts from a clean slate —
    // never inherit the previous cashier's role or supermarket.
    const base = partial.userId && existing.userId && partial.userId !== existing.userId ? {} : existing;
    const merged = { ...base, ...partial, savedAt: Date.now() };
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(merged));
  } catch { /* storage unavailable */ }
}

export function clearCachedIdentity() {
  try { localStorage.removeItem(IDENTITY_KEY); } catch { /* storage unavailable */ }
}

// Tells the service worker to download the whole app build (every lazy chunk)
// onto this device. Cheap to repeat: it skips files it already has.
export async function precacheAppForOffline() {
  try {
    if (!navigator.onLine || !('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'PRECACHE_APP' });
  } catch { /* no service worker — nothing to download into */ }
}

export const isInstalledApp = () => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
};

// Ask the browser not to evict this origin's storage under disk pressure.
// The pending-sales queue is real money that hasn't reached the server yet;
// best-effort storage can be silently wiped, persistent storage can't.
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* unsupported — nothing more to do */ }
}
