// ===================================================
// ✅ STAFF RECEIPT APPROVAL PAGE
// Opened by scanning the QR code on a customer's shop receipt
// (CustomerSelfCheckout -> /receipt-approve/:token). The staff member signs
// in, sees the store, the products and the total, and approves. The approval
// stores their NAME on the receipt, and it is mirrored onto the customer's ICAN
// transactions (see ADD_RECEIPT_STORE_APPROVAL_ICAN_LINK.sql).
//
// Only staff of the store that sold the products can approve (enforced
// server-side in approve_receipt()); the customer can never approve their own
// purchase.
// ===================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';

const money = (n, currency = 'UGX') => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code' }).format(Number(n) || 0);
  } catch {
    return `${currency} ${Number(n || 0).toLocaleString()}`;
  }
};

const ReceiptApprovePage = () => {
  const { token } = useParams();
  const [userId, setUserId] = useState(undefined); // undefined = still checking
  const [receipt, setReceipt] = useState(null);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc('get_receipt_for_approval', { p_token: token });
    if (rpcError || !data?.success) {
      setError(rpcError?.message || data?.error || 'Receipt not found');
      setReceipt(null);
    } else {
      setError(null);
      setReceipt(data.receipt);
      setCanApprove(!!data.can_approve);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (userId) load();
    else if (userId === null) setLoading(false);
  }, [userId, load]);

  const authRedirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(window.location.pathname)}`;

  const handleGoogleSignIn = async () => {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectTo, queryParams: { prompt: 'select_account' } },
    });
    if (authError) toast.error('Unable to connect with Google right now.');
  };

  const handleMagicLink = async () => {
    if (!signInEmail.trim()) return;
    setSendingLink(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: signInEmail.trim(),
        options: { emailRedirectTo: authRedirectTo },
      });
      if (otpError) throw otpError;
      toast.success(`Sign-in link sent to ${signInEmail.trim()}. Open it on this device.`);
    } catch (err) {
      toast.error(err.message || 'Could not send sign-in link');
    } finally {
      setSendingLink(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('approve_receipt', { p_token: token });
      if (rpcError || !data?.success) throw new Error(rpcError?.message || data?.error || 'Approval failed');
      toast.success(data.already_approved ? 'This receipt was already approved' : 'Receipt approved');
      await load();
    } catch (err) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const approved = receipt?.approval_status === 'approved';

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="mb-1 text-center text-xl font-bold text-slate-900">Approve receipt</h1>
        <p className="mb-5 text-center text-sm text-slate-500">Confirm this purchase was made at your store.</p>

        {userId === undefined || loading ? (
          <p className="py-10 text-center text-slate-500">Loading…</p>
        ) : userId === null ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">Sign in with your staff account to view and approve this receipt.</p>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 py-3 font-semibold text-white"
            >
              Continue with Google
            </button>
            <div className="flex gap-2">
              <input
                type="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                placeholder="Staff email"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={sendingLink || !signInEmail.trim()}
                className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-600 disabled:opacity-50"
              >
                {sendingLink ? 'Sending…' : 'Email link'}
              </button>
            </div>
          </div>
        ) : error ? (
          <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">{error}</p>
        ) : receipt ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-lg font-bold text-slate-900">{receipt.store_name}</p>
              {receipt.store_location && <p className="text-xs text-slate-500">{receipt.store_location}</p>}
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-slate-500">Receipt #</span>
                <span className="font-mono font-semibold text-slate-900">{receipt.receipt_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Customer</span>
                <span className="font-semibold text-slate-900">{receipt.customer_name || 'Customer'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date</span>
                <span className="text-slate-900">{new Date(receipt.purchased_at).toLocaleString()}</span>
              </div>
              {(receipt.items || []).map((item, index) => (
                <div key={`${item.product_id}-${index}`} className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 text-sm">
                  <span className="text-slate-900">{item.product_name || item.name || 'Product'} × {item.quantity}</span>
                  <span className="whitespace-nowrap font-semibold text-slate-900">{money(item.line_total, receipt.currency)}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
                <span>Total paid</span>
                <span className="text-orange-600">{money(receipt.total, receipt.currency)}</span>
              </div>
            </div>

            {approved ? (
              <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-center">
                <p className="font-bold text-green-700">Approved</p>
                <p className="text-sm text-slate-700">by {receipt.approved_by_name || 'Store staff'}</p>
                {receipt.approved_at && <p className="text-xs text-slate-500">{new Date(receipt.approved_at).toLocaleString()}</p>}
              </div>
            ) : canApprove ? (
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 py-3 font-semibold text-white disabled:opacity-60"
              >
                {approving ? 'Approving…' : 'Approve this receipt'}
              </button>
            ) : (
              <p className="rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-800">
                Only staff of {receipt.store_name} can approve this receipt. Sign in with your staff account.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ReceiptApprovePage;
