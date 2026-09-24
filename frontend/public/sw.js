const CACHE_NAME = 'supermartkera-v4';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/images/supermarketera-apk.jpg', '/icons/supermarketera-192.png', '/icons/supermarketera-512.png'];

// How long a same-origin request may wait on the network before falling back
// to the saved copy. A till on a dead uplink is often "online" as far as the
// browser knows, so without this every page load hangs until the OS gives up.
const NETWORK_TIMEOUT_MS = 5000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// The cashier portal asks for this once it has loaded online. Runtime caching
// below only saves the chunks a session happened to open, so a lazily-loaded
// modal never opened before going offline would be missing. asset-manifest.json
// (written at build time, see vite.config.js) lists every JS/CSS file of this
// build; this stores all of them, and drops files from older builds.
async function precacheApp() {
  const response = await fetch('/asset-manifest.json', { cache: 'no-store' });
  if (!response.ok) return;
  const { files } = await response.json();
  if (!Array.isArray(files)) return;

  const cache = await caches.open(CACHE_NAME);
  const wanted = new Set(files.map((file) => new URL(file, self.location.origin).href));

  await Promise.allSettled(files.map(async (file) => {
    if (await cache.match(file)) return; // content-hashed name: same name = same bytes
    const asset = await fetch(file);
    if (asset.ok) await cache.put(file, asset);
  }));

  const stale = (await cache.keys()).filter((request) => {
    const { pathname, href } = new URL(request.url);
    return pathname.startsWith('/assets/') && !wanted.has(href);
  });
  await Promise.all(stale.map((request) => cache.delete(request)));
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'PRECACHE_APP') {
    event.waitUntil(precacheApp().catch(() => undefined));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  network.catch(() => undefined); // if the timeout below wins, don't leave this as an unhandled rejection

  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow network')), NETWORK_TIMEOUT_MS))
    ]);
  } catch {
    const cached = await cache.match(request)
      // Any app route (/cashier-portal, /login, ...) is the same SPA shell.
      || (request.mode === 'navigate' ? (await cache.match('/index.html') || await cache.match('/')) : undefined);
    if (cached) return cached;
    return network; // nothing saved to fall back on: keep waiting for the real response
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  // Build output is content-hashed (/assets/name-HASH.js), so a saved copy is
  // always the right one — serve it instantly, no network wait, and fetch only
  // on a miss.
  if (new URL(event.request.url).pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  event.respondWith(networkFirst(event.request));
});

// ---- Push alerts (ICANera relay) --------------------------------------------
// The relay sends { title, body, tag, url, urgent, data }. Like a chat app, a
// system banner is only shown when the person is NOT looking at the app - when
// the portal is in front it gets a message instead and shows its own banner.
// (iPhone requires every push to show a notification, so it always does.)
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data ? event.data.text() : '' }; }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach((client) => client.postMessage({ type: 'PUSH_RECEIVED', ...payload }));

    const inFront = windows.some((client) => client.visibilityState === 'visible' && client.focused);
    const isIos = /iPhone|iPad|iPod/i.test(self.navigator.userAgent || '');
    if (inFront && !isIos) return;

    await self.registration.showNotification(payload.title || 'SupermartKera', {
      body: payload.body || 'You have a new notification.',
      icon: '/icons/supermarketera-192.png',
      badge: '/icons/supermarketera-192.png',
      tag: payload.tag || 'supermartkera-notification',
      renotify: true,
      requireInteraction: Boolean(payload.urgent),
      vibrate: payload.urgent ? [300, 150, 300, 150, 300] : [200, 100, 200],
      data: { url: payload.url || '/', ...(payload.data || {}) }
    });
  })());
});

// Tapping a notification brings the portal forward (or opens it) and tells it
// what was tapped, so a supplier-payment alert can open the approvals panel.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.url || '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (!open) return self.clients.openWindow(target);
    try {
      if ('navigate' in open && new URL(target, self.location.origin).pathname !== new URL(open.url).pathname) {
        await open.navigate(target);
      }
    } catch { /* cross-page navigation not allowed - just focus */ }
    open.postMessage({ type: 'NOTIFICATION_CLICK', ...data, url: target });
    return open.focus();
  })());
});
