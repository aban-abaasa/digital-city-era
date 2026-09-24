import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'
import App from './App.jsx'
import setupMockAxios from './services/mockApi.jsx'
import { initClockDiagnostic } from './utils/clockDiagnostic.js'
import PWAInstallPrompt from './components/PWAInstallPrompt.jsx'
import { startGlobalPosSync } from './services/posOfflineQueue.js'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[SupermartKera PWA] Service worker ready');

        // A tab left open across a deploy keeps running the JS/CSS it
        // already loaded — the server's cache headers only force a fresh
        // fetch on the *next* navigation, they can't reach into an
        // already-rendered page. This till/POS app is typically left open
        // for hours on shop computers, so without this a cashier would
        // keep seeing a stale build until someone manually reloads.
        // sw.js already calls skipWaiting()+clients.claim() on every
        // install, so the moment a new deploy's service worker activates,
        // 'controllerchange' fires here and we reload once to pick it up.
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });

        // Proactively poll for a new deploy every 5 minutes instead of
        // only checking when the browser happens to re-navigate.
        setInterval(() => registration.update().catch(() => undefined), 5 * 60 * 1000);
      })
      .catch((error) => console.error('[SupermartKera PWA] Service worker registration failed', error));
  })
}

// ============================================================
// CRITICAL: Clear browser cache and prevent Farm Agent redirect
// ============================================================
(() => {
  console.log('🔧 [MAIN] Initializing Supermartkera anti-redirect protection...');

  // Get the correct base URL
  const protocol = window.location.protocol;
  const host = window.location.host;
  const correctBase = `${protocol}//${host}`;

  console.log('✅ [MAIN] Expected base URL:', correctBase);
  console.log('📍 Current URL:', window.location.href);

  // CRITICAL: Check if we're on Farm Agent or wrong domain
  const currentUrl = window.location.href.toLowerCase();
  if (currentUrl.includes('farm-agent.vercel.app')) {
    console.error('🚨 CRITICAL: You are on the WRONG DOMAIN!', currentUrl);
    console.error('🔄 Forcing redirect to:', correctBase);

    // Storage/cache from the wrong domain is genuinely stale here, so purge
    // it as part of recovering — but ONLY in this branch. This used to run
    // unconditionally on every single load (right domain included), which
    // meant the service worker's offline cache (sw.js) got wiped the moment
    // the app loaded even once more. An installed PWA opened a second time
    // offline then had nothing left to fall back to -- the browser's own
    // "No internet" page instead of the app, on every normal load, not just
    // this wrong-domain recovery case.
    console.log('🧹 Clearing Farm Agent related storage...');
    const keysToDelete = ['farm_agent_session', 'farm_agent_user', 'farm_agent_token'];
    keysToDelete.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (e) {
        // Ignore errors
      }
    });
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name).catch(() => {});
        });
      }).catch(() => {});
    }

    window.location.href = `${correctBase}/customer-login`;
    throw new Error('Preventing redirect to wrong domain');
  }

  // Set Supermartkera context
  localStorage.setItem('current_app', 'supermartkera');
  localStorage.setItem('correct_base_url', correctBase);
  localStorage.setItem('app_initialized', Date.now().toString());
  
  // Verify we're on the right app
  console.log('✅ [MAIN] Supermartkera initialization complete');
  console.log('✅ [MAIN] Domain verified:', correctBase);
})();

// Setup mock API for development
setupMockAxios();

// Initialize clock diagnostic to detect time sync issues
initClockDiagnostic();

// Sales rung up while offline live in IndexedDB and outlive the page — send
// them whenever the app is open and the backend is reachable, whichever
// screen it happens to be on.
startGlobalPosSync();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <PWAInstallPrompt />
    </BrowserRouter>
  </StrictMode>,
)
