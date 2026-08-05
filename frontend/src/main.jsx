import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'
import App from './App.jsx'
import setupMockAxios from './services/mockApi.jsx'
import { initClockDiagnostic } from './utils/clockDiagnostic.js'
import PWAInstallPrompt from './components/PWAInstallPrompt.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('[SupermartKera PWA] Service worker ready'))
      .catch((error) => console.error('[SupermartKera PWA] Service worker registration failed', error));
  })
}

// ============================================================
// CRITICAL: Clear browser cache and prevent Farm Agent redirect
// ============================================================
(() => {
  console.log('🔧 [MAIN] Initializing Supermartkera anti-redirect protection...');
  
  // AGGRESSIVE: Delete Farm Agent specific localStorage keys only
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
  
  // Clear browser cache for OAuth
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name).catch(() => {});
      });
    }).catch(() => {});
  }
  
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <PWAInstallPrompt />
    </BrowserRouter>
  </StrictMode>,
)
