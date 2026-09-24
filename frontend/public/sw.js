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
