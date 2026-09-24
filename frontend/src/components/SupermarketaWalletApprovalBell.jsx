import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiBell, FiCheckCircle, FiLock, FiX, FiXCircle } from 'react-icons/fi';
import { supabase } from '../services/supabase';
import { enablePushAlerts, getPushStatus, refreshPushRegistration } from '../services/pushAlertsService';

const SEEN_KEY = 'sk_wallet_approvals_seen';
const readSeen = () => {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
};
const writeSeen = (ids) => {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-200))); } catch { /* private mode: alerts may repeat after reload */ }
};

// Two short rising tones, like a chat "ping". Browsers only allow sound after
// the person has touched the page once, so failure is silent.
const ping = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [[880, 0], [1175, 0.14]].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => undefined), 800);
  } catch { /* no audio available */ }
};

// Device (system) notification: shows on the phone's shade / the PC's corner
// even when the portal is in another tab or app. Goes through the service worker
// so it also works on Android Chrome, where `new Notification()` is not allowed.
const showDeviceNotification = async (title, body) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = {
    body,
    icon: '/icons/supermarketera-192.png',
    badge: '/icons/supermarketera-192.png',
    tag: 'supermartkera-wallet-approval',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: '/admin-portal', source: 'wallet' }
  };
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration?.showNotification) { await registration.showNotification(title, options); return; }
    new Notification(title, options); // eslint-disable-line no-new
  } catch { /* notifications blocked by the browser */ }
};

// Pending requests come from the shared business-wallet notification table.
// The PIN is sent only to the approval RPC; balances are never touched here.
export default function SupermarketaWalletApprovalBell() {
  const [requests, setRequests] = useState([]);
  const [open, setOpen] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState(null);
  const [pin, setPin] = useState('');
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [panelTop, setPanelTop] = useState(64);
  const buttonRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const toastTimer = useRef(null);
  // True once this device is subscribed to the server push relay. Then the relay
  // shows the system notification (even with the app closed), so the local
  // fallback below must stay quiet or every alert would appear twice.
  const [pushOn, setPushOn] = useState(false);
  const pushOnRef = useRef(false);
  const [alertNote, setAlertNote] = useState('');

  const load = async () => {
    const { data, error: loadError } = await supabase.rpc('get_ican_business_wallet_notifications', { p_unread_only: false });
    if (loadError) { setError(loadError.message); return; }
    const pending = (data || []).filter((item) => item.status === 'pending_approval' &&
      /supermartkera purchase order|supplier order/i.test(item.note || ''));
    setRequests(pending);
    announceNew(pending);
  };

  // Alert once per request (remembered across reloads): a banner on screen while
  // the portal is in front, a device notification when it is not.
  const announceNew = (pending) => {
    const seen = readSeen();
    const fresh = pending.filter((item) => !seen.has(item.notification_id));
    if (fresh.length === 0) return;
    fresh.forEach((item) => seen.add(item.notification_id));
    writeSeen(seen);

    const title = fresh.length === 1 ? 'Supplier payment awaiting approval' : `${fresh.length} supplier payments need approval`;
    const body = fresh.length === 1
      ? `${fresh[0].note || 'Supplier payment'} · ${Number(fresh[0].amount_ican || 0).toLocaleString()} ICAN`
      : 'Open the bell to review and approve with the business-wallet PIN.';

    const inFront = !document.hidden && document.hasFocus();
    if (inFront) {
      setToast({ key: Date.now(), title, body });
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 9000);
    } else if (!pushOnRef.current) {
      showDeviceNotification(title, body);
    }
    ping();
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    // Messages from the service worker: a push arrived (refresh now instead of
    // waiting for the next 30 s check) or a notification was tapped.
    const onWorkerMessage = (event) => {
      const message = event.data || {};
      if (message.type === 'PUSH_RECEIVED' && message.data?.source === 'wallet') load();
      if (message.type === 'NOTIFICATION_CLICK' && message.source === 'wallet') { placePanel(); setOpen(true); setToast(null); }
    };
    navigator.serviceWorker?.addEventListener('message', onWorkerMessage);

    // Re-attach this device to whoever is signed in, and learn if push is on
    getPushStatus().then((status) => {
      pushOnRef.current = status.enabled;
      setPushOn(status.enabled);
      if (status.enabled) refreshPushRegistration();
    }).catch(() => undefined);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(toastTimer.current);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onWorkerMessage);
    };
  }, []);

  // Must be called from a tap/click - browsers ignore the prompt otherwise.
  // Subscribes this device to the server push relay so alerts arrive even when
  // the portal is closed; permission alone still gives in-browser alerts.
  const enableAlerts = async () => {
    setAlertNote('');
    try {
      await enablePushAlerts();
      pushOnRef.current = true;
      setPushOn(true);
    } catch (pushError) {
      if (!('Notification' in window) || Notification.permission !== 'granted') setAlertNote(pushError.message || 'Could not turn on alerts.');
    }
    if ('Notification' in window) setPermission(Notification.permission);
  };

  const placePanel = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPanelTop(Math.round(rect.bottom + 8));
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', placePanel);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', placePanel);
    };
  }, [open]);

  const decide = async (request, decision) => {
    if (decision === 'approved' && !pin.trim()) { setError('Enter the business-wallet PIN to approve payment.'); return; }
    setWorking(request.transaction_id); setError('');
    const { error: approveError } = await supabase.rpc('approve_pitchin_business_wallet_transaction', {
      p_transaction_id: request.transaction_id, p_decision: decision, p_pin: decision === 'approved' ? pin : null,
    });
    if (approveError) setError(approveError.message);
    else {
      await supabase.rpc('mark_ican_business_wallet_notification_read', { p_notification_id: request.notification_id });
      setPin(''); setApprovalRequest(null);
      await load();
    }
    setWorking('');
  };

  return <div className="relative">
    <button ref={buttonRef} onClick={() => { placePanel(); setOpen((value) => !value); setError(''); setToast(null); if (permission === 'default') enableAlerts(); }} className="relative rounded-lg p-2 text-white hover:bg-white/15" title="Supplier payment approvals" aria-expanded={open}>
      <FiBell className="h-5 w-5" />
      {requests.length > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-xs font-bold text-white">{requests.length}</span>}
    </button>
    {open && createPortal(<>
      {/* Tap outside to close */}
      <div className="fixed inset-0 z-[69]" onClick={() => setOpen(false)} aria-hidden="true" />
      {/* Full-width under the header on phones, a 24rem card at the right edge from sm up — never wider than the screen */}
      <div
        role="dialog"
        aria-label="Supplier payment approvals"
        style={{ top: panelTop, maxHeight: `calc(100vh - ${panelTop}px - 12px)` }}
        className="fixed left-3 right-3 z-[70] overflow-y-auto overscroll-contain rounded-xl border border-indigo-200 bg-white p-4 text-slate-900 shadow-2xl sm:left-auto sm:right-4 sm:w-96">
      <div className="mb-3 flex items-center gap-2"><FiLock className="text-indigo-600" /><div><strong>Supplier payment approvals</strong><p className="text-xs text-slate-500">Only an authorized business-wallet administrator can approve with the business-wallet PIN.</p></div></div>
      {!pushOn && permission !== 'denied' && permission !== 'unsupported' && <button onClick={enableAlerts} className="mb-3 flex w-full items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-left text-sm font-semibold text-indigo-900"><FiBell className="flex-none" />Turn on phone alerts — works even when the app is closed</button>}
      {alertNote && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{alertNote}</p>}
      {permission === 'denied' && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Pop-up alerts are blocked. Allow notifications for this site in your browser settings to get them.</p>}
      {requests.length === 0 ? <p className="text-sm text-slate-500">No supplier payments need approval.</p> : <>
        <div className="space-y-2">{requests.map((request) => <div key={request.notification_id} className="rounded-lg border border-slate-200 p-3 text-sm"><p className="font-semibold">{request.note || 'Supplier payment'}</p><p className="text-slate-500">{Number(request.amount_ican || 0).toLocaleString()} ICAN</p><div className="mt-2 flex gap-2"><button disabled={working === request.transaction_id} onClick={() => decide(request, 'rejected')} className="rounded bg-red-100 px-2 py-1 text-red-700"><FiXCircle className="mr-1 inline" />Reject</button><button disabled={working === request.transaction_id} onClick={() => { setApprovalRequest(request); setPin(''); setError(''); }} className="rounded bg-emerald-600 px-2 py-1 font-semibold text-white"><FiCheckCircle className="mr-1 inline" />Approve</button></div></div>)}</div>
        {approvalRequest && <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3"><p className="mb-2 text-sm font-semibold text-indigo-950">Enter the business-wallet PIN to approve this payment.</p><input autoFocus type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Business-wallet PIN" className="mb-2 w-full rounded border border-slate-300 px-3 py-2" /><div className="flex justify-end gap-2"><button onClick={() => { setApprovalRequest(null); setPin(''); }} className="rounded px-2 py-1 text-slate-700">Cancel</button><button disabled={working === approvalRequest.transaction_id || pin.length < 4} onClick={() => decide(approvalRequest, 'approved')} className="rounded bg-emerald-600 px-2 py-1 font-semibold text-white">Confirm approval</button></div></div>}
      </>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </>, document.body)}
    {toast && createPortal(
      <div
        key={toast.key}
        role="alert"
        onClick={() => { placePanel(); setOpen(true); setToast(null); }}
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)', animation: 'skToastIn 0.35s ease-out' }}
        className="fixed left-3 right-3 z-[80] flex cursor-pointer items-start gap-3 rounded-2xl border border-indigo-200 bg-white p-3 text-slate-900 shadow-2xl sm:left-auto sm:right-4 sm:w-96"
      >
        <style>{'@keyframes skToastIn{from{transform:translateY(-130%);opacity:0}to{transform:none;opacity:1}}'}</style>
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-indigo-700 text-white"><FiBell /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{toast.title}</span>
          <span className="block truncate text-sm text-slate-600">{toast.body}</span>
          <span className="mt-0.5 block text-xs font-semibold text-indigo-700">Tap to review</span>
        </span>
        <button onClick={(event) => { event.stopPropagation(); setToast(null); }} aria-label="Dismiss" className="flex-none rounded-full p-1 text-slate-500 hover:bg-slate-100"><FiX /></button>
      </div>,
      document.body
    )}
  </div>;
}
