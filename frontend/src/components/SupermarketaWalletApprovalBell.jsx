import React, { useEffect, useState } from 'react';
import { FiBell, FiCheckCircle, FiLock, FiXCircle } from 'react-icons/fi';
import { supabase } from '../services/supabase';

// Pending requests come from the shared business-wallet notification table.
// The PIN is sent only to the approval RPC; balances are never touched here.
export default function SupermarketaWalletApprovalBell() {
  const [requests, setRequests] = useState([]);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const { data, error: loadError } = await supabase.rpc('get_ican_business_wallet_notifications', { p_unread_only: false });
    if (loadError) { setError(loadError.message); return; }
    setRequests((data || []).filter((item) => item.status === 'pending_approval' &&
      /supermartkera purchase order|supplier order/i.test(item.note || '')));
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const decide = async (request, decision) => {
    if (decision === 'approved' && !pin.trim()) { setError('Enter the business-wallet PIN to approve payment.'); return; }
    setWorking(request.transaction_id); setError('');
    const { error: approveError } = await supabase.rpc('approve_pitchin_business_wallet_transaction', {
      p_transaction_id: request.transaction_id, p_decision: decision, p_pin: decision === 'approved' ? pin : null,
    });
    if (approveError) setError(approveError.message);
    else {
      await supabase.rpc('mark_ican_business_wallet_notification_read', { p_notification_id: request.notification_id });
      setPin('');
      await load();
    }
    setWorking('');
  };

  return <div className="relative">
    <button onClick={() => { setOpen((value) => !value); setError(''); }} className="relative rounded-lg p-2 text-white hover:bg-white/15" title="Supplier payment approvals">
      <FiBell className="h-5 w-5" />
      {requests.length > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-xs font-bold text-white">{requests.length}</span>}
    </button>
    {open && <div className="absolute right-0 z-50 mt-2 w-[min(24rem,90vw)] rounded-xl border border-indigo-200 bg-white p-4 shadow-2xl text-slate-900">
      <div className="mb-3 flex items-center gap-2"><FiLock className="text-indigo-600" /><div><strong>Supplier payment approvals</strong><p className="text-xs text-slate-500">Approval requires the store business-wallet PIN.</p></div></div>
      {requests.length === 0 ? <p className="text-sm text-slate-500">No supplier payments need approval.</p> : <>
        <input type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Business-wallet PIN" className="mb-3 w-full rounded border border-slate-300 px-3 py-2" />
        <div className="space-y-2">{requests.map((request) => <div key={request.notification_id} className="rounded-lg border border-slate-200 p-3 text-sm"><p className="font-semibold">{request.note || 'Supplier payment'}</p><p className="text-slate-500">{Number(request.amount_ican || 0).toLocaleString()} ICAN</p><div className="mt-2 flex gap-2"><button disabled={working === request.transaction_id} onClick={() => decide(request, 'rejected')} className="rounded bg-red-100 px-2 py-1 text-red-700"><FiXCircle className="mr-1 inline" />Reject</button><button disabled={working === request.transaction_id} onClick={() => decide(request, 'approved')} className="rounded bg-emerald-600 px-2 py-1 font-semibold text-white"><FiCheckCircle className="mr-1 inline" />Approve & pay</button></div></div>)}</div>
      </>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>}
  </div>;
}
