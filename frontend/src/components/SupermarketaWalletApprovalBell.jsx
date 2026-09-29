import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiBell, FiCheckCircle, FiLock, FiX, FiXCircle } from 'react-icons/fi';
import ClassicNotificationList from './ClassicNotificationList';
import { supabase } from '../services/supabase';
import { enablePushAlerts, getPushStatus, refreshPushRegistration } from '../services/pushAlertsService';

const SEEN_KEY = 'sk_wallet_approvals_seen';
const DISMISSED_APPROVALS_KEY = 'sk_wallet_approvals_dismissed';
const readSeen = () => {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
};
const readDismissedApprovals = () => {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_APPROVALS_KEY) || '[]').map(String)); } catch { return new Set(); }
};
const writeDismissedApprovals = (ids) => {
  try { localStorage.setItem(DISMISSED_APPROVALS_KEY, JSON.stringify([...ids])); } catch { /* dismissal still applies in memory */ }
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
  const dismissedApprovalIdsRef = useRef(readDismissedApprovals());
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
    setRequests(pending.filter((item) => !dismissedApprovalIdsRef.current.has(String(item.notification_id))));
    announceNew(pending);
  };

  const dismissApprovalNotification = (request) => {
    const nextDismissed = new Set(dismissedApprovalIdsRef.current);
    nextDismissed.add(String(request.notification_id));
    dismissedApprovalIdsRef.current = nextDismissed;
    writeDismissedApprovals(nextDismissed);
    setRequests((current) => current.filter((item) => item.notification_id !== request.notification_id));
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
        className="classic-wallet-notification-dialog fixed left-3 right-3 z-[70] overflow-y-auto overscroll-contain rounded-xl p-4 shadow-2xl sm:left-auto sm:right-4 sm:w-96">
      <div className="classic-wallet-notification-heading mb-3 flex items-center gap-2"><FiLock /><div><strong>Supplier payment approvals</strong><p className="text-xs">Only an authorized business-wallet administrator can approve with the business-wallet PIN.</p></div></div>
      {!pushOn && permission !== 'denied' && permission !== 'unsupported' && <button onClick={enableAlerts} className="mb-3 flex w-full items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-left text-sm font-semibold text-indigo-900"><FiBell className="flex-none" />Turn on phone alerts — works even when the app is closed</button>}
      {alertNote && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{alertNote}</p>}
      {permission === 'denied' && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Pop-up alerts are blocked. Allow notifications for this site in your browser settings to get them.</p>}
      {requests.length === 0 ? <p className="classic-wallet-notification-empty text-sm">No supplier payments need approval.</p> : <>
        <ClassicNotificationList
          notifications={requests}
          showHeading={false}
          variant="embedded"
          idPrefix="ican-wallet-approval"
          storageKey={DISMISSED_APPROVALS_KEY}
          getId={(request) => request.notification_id}
          getTitle={(request) => request.note || 'Supplier payment'}
          getType={() => 'Approval'}
          getTime={() => 'Waiting for approval'}
          getMessage={(request) => `Amount: ${Number(request.amount_ican || 0).toLocaleString()} ICAN`}
          onDelete={dismissApprovalNotification}
          renderExpanded={(request) => (
            <div className="classic-notification-actions">
              <button disabled={working === request.transaction_id} onClick={() => decide(request, 'rejected')} className="classic-notification-action is-danger"><FiXCircle className="mr-1 inline" />Reject</button>
              <button disabled={working === request.transaction_id} onClick={() => { setApprovalRequest(request); setPin(''); setError(''); }} className="classic-notification-action is-primary"><FiCheckCircle className="mr-1 inline" />Approve</button>
            </div>
          )}
        />
        {approvalRequest && <div className="classic-wallet-pin-panel mt-3 rounded-lg p-3"><p className="mb-2 text-sm font-semibold">Enter the business-wallet PIN to approve this payment.</p><input autoFocus type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Business-wallet PIN" className="mb-2 w-full rounded border px-3 py-2" /><div className="flex justify-end gap-2"><button onClick={() => { setApprovalRequest(null); setPin(''); }} className="classic-wallet-cancel rounded px-2 py-1">Cancel</button><button disabled={working === approvalRequest.transaction_id || pin.length < 4} onClick={() => decide(approvalRequest, 'approved')} className="rounded bg-emerald-600 px-2 py-1 font-semibold text-white">Confirm approval</button></div></div>}
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
        className="classic-wallet-approval-toast fixed left-3 right-3 z-[80] flex cursor-pointer items-start gap-3 rounded-2xl p-3 shadow-2xl sm:left-auto sm:right-4 sm:w-96"
      >
        <style>{'@keyframes skToastIn{from{transform:translateY(-130%);opacity:0}to{transform:none;opacity:1}}'}</style>
        <span className="classic-wallet-approval-toast-icon flex h-10 w-10 flex-none items-center justify-center rounded-full text-white"><FiBell /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{toast.title}</span>
          <span className="classic-wallet-approval-toast-body block truncate text-sm">{toast.body}</span>
          <span className="classic-wallet-approval-toast-link mt-0.5 block text-xs font-semibold">Tap to review</span>
        </span>
        <button onClick={(event) => { event.stopPropagation(); setToast(null); }} aria-label="Dismiss" className="classic-wallet-approval-toast-dismiss flex-none rounded-full p-1"><FiX /></button>
      </div>,
      document.body
    )}
  </div>;
}
