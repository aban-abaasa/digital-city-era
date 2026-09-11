// ===================================================
// 🧾 PUBLIC INVOICE PAGE
// Opened by scanning an invoice's QR code (see Receipt.jsx), the IcanEra
// Wallet's Pay scanner recognizing the same code, or a shared link — no
// login required to view. Two different ways to settle the balance, each
// authorized differently server-side:
//   - A signed-in customer can pay it straight from their own ICAN wallet
//     (payInvoiceWithIcan -> settle_invoice_via_ican_transfer, verified by
//     the real transfer having happened, not by who the payer is).
//   - A signed-in cashier/manager/admin of the store can record a cash (or
//     other) payment directly (collect_invoice_payment, staff-only).
// Anyone else attempting either is refused server-side. See
// ADD_PUBLIC_INVOICE_QR_ACCESS.sql and ADD_SETTLE_INVOICE_VIA_ICAN.sql.
// ===================================================

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiDownload, FiShare2, FiMessageSquare, FiDollarSign, FiCheckCircle, FiTool } from 'react-icons/fi';
import transactionService from '../services/transactionService';
import receiptGeneratorService from '../services/receiptGeneratorService';
import { payInvoiceWithIcan } from '../services/icanPaymentRequestService';
import { supabase } from '../services/supabase';

const JOB_STATUS_LABELS = {
  pending: '⏳ Pending',
  in_progress: '🔧 In Progress',
  ready_for_collection: '📦 Ready for Collection',
  collected: '✅ Collected'
};
const JOB_STATUS_FLOW = ['pending', 'in_progress', 'ready_for_collection', 'collected'];

const InvoicePublicPage = () => {
  const { transactionId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCollect, setShowCollect] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [showJobUpdate, setShowJobUpdate] = useState(false);
  const [updatingJob, setUpdatingJob] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [payingWithIcan, setPayingWithIcan] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [sendingMagicLink, setSendingMagicLink] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data?.user?.id || null));
  }, []);

  // Any of the staff/customer actions below needs a signed-in account —
  // rather than let them click through and get a server-side rejection with
  // no path forward, offer to sign in right here (Google or a typed email),
  // landing back on this exact page afterward (see AuthCallback.jsx's
  // ?redirect handling).
  const requireAuth = (action) => {
    if (!currentUserId) {
      setShowSignIn(true);
      return;
    }
    action();
  };

  const authRedirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(window.location.pathname)}`;

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectTo, queryParams: { prompt: 'select_account' } }
    });
    if (error) toast.error('Unable to connect with Google right now.');
  };

  const handleMagicLink = async () => {
    if (!signInEmail.trim()) return;
    setSendingMagicLink(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: signInEmail.trim(),
        options: { emailRedirectTo: authRedirectTo }
      });
      if (error) throw error;
      toast.success(`📧 Sign-in link sent to ${signInEmail.trim()} — open it on this device.`);
    } catch (err) {
      toast.error(err.message || 'Could not send sign-in link');
    } finally {
      setSendingMagicLink(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount || 0);

  const loadInvoice = async () => {
    setLoading(true);
    const result = await transactionService.getPublicInvoice(transactionId);
    if (result.success) {
      setInvoice(result.invoice);
      setCollectAmount(String(Math.round(result.invoice.balanceDue || 0)));
      setError(null);
    } else {
      setError(result.error || 'Invoice not found');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  const isInvoice = invoice && invoice.paymentStatus && invoice.paymentStatus !== 'paid';
  const docLabel = isInvoice ? 'Invoice' : 'Receipt';
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleShare = async () => {
    const shareText = `${docLabel} ${invoice.receiptNumber} from ${invoice.storeName} — Total ${formatCurrency(invoice.total)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${docLabel} ${invoice.receiptNumber}`, text: shareText, url: shareUrl });
      } catch (err) {
        // User cancelled the native share sheet — not an error worth surfacing.
      }
    } else {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('📋 Link copied to clipboard!');
    }
  };

  const handleWhatsApp = () => {
    const text = `🧾 *${invoice.storeName}* - ${docLabel.toUpperCase()}\n${docLabel}: ${invoice.receiptNumber}\nTotal: ${formatCurrency(invoice.total)}${isInvoice ? `\nBalance Due: ${formatCurrency(invoice.balanceDue)}` : ''}\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadPDF = async () => {
    try {
      const items = Array.isArray(invoice.items) ? invoice.items : [];
      await receiptGeneratorService.downloadPDFReceipt({
        id: invoice.id,
        saleNumber: invoice.receiptNumber,
        createdAt: invoice.createdAt,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.selling_price || item.price || 0
        })),
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        paymentMethod: invoice.paymentMethod || 'cash',
        cashier: invoice.cashierName,
        customer: invoice.customerName ? { firstName: invoice.customerName, lastName: '' } : null,
        paymentStatus: invoice.paymentStatus,
        amountPaid: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
        dueDate: invoice.dueDate,
        jobStatus: invoice.jobStatus
      });
      toast.success('📥 PDF downloaded!');
    } catch (err) {
      toast.error('Failed to generate PDF');
    }
  };

  const handleUpdateJobStatus = async (newStatus) => {
    setUpdatingJob(true);
    try {
      const result = await transactionService.updateJobStatus(invoice.id, newStatus);
      if (result.success) {
        toast.success(`✅ Job status updated to ${JOB_STATUS_LABELS[newStatus] || newStatus}`);
        setShowJobUpdate(false);
        await loadInvoice();
      } else {
        toast.error(result.error || 'Failed to update job status');
      }
    } finally {
      setUpdatingJob(false);
    }
  };

  const handlePayWithIcan = async () => {
    if (!currentUserId) return;
    setPayingWithIcan(true);
    try {
      const result = await payInvoiceWithIcan({ transactionId: invoice.id, payerUserId: currentUserId });
      toast.success(
        result.paymentStatus === 'paid'
          ? '✅ Invoice fully paid with your IcanEra Wallet!'
          : `✅ Payment sent — balance due updated.`
      );
      await loadInvoice();
    } catch (err) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setPayingWithIcan(false);
    }
  };

  const handleCollectPayment = async () => {
    setCollecting(true);
    try {
      const result = await transactionService.collectInvoicePayment(invoice.id, collectAmount);
      if (result.success) {
        toast.success(
          result.paymentStatus === 'paid'
            ? '✅ Invoice fully paid!'
            : `✅ Payment recorded — balance due ${formatCurrency(result.balanceDue)}`
        );
        setShowCollect(false);
        await loadInvoice();
      } else {
        toast.error(result.error || 'Failed to record payment');
      }
    } finally {
      setCollecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow p-6 text-center max-w-sm">
          <p className="text-lg font-bold text-gray-900 mb-1">Invoice not found</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <Link to="/" className="text-emerald-600 font-semibold">Go home</Link>
        </div>
      </div>
    );
  }

  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-3 md:py-10">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className={`p-5 text-white ${isInvoice ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'bg-gradient-to-r from-green-600 to-emerald-600'}`}>
          <p className="text-xs uppercase tracking-wide opacity-90">{invoice.storeName}</p>
          <h1 className="text-xl font-bold flex items-center gap-2 mt-1">
            🧾 {docLabel}{isInvoice ? ` (${invoice.paymentStatus === 'partial' ? 'Partially Paid' : 'Unpaid'})` : ''}
          </h1>
          <p className="text-sm opacity-90">#{invoice.receiptNumber}</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-sm text-gray-500">
            {new Date(invoice.createdAt).toLocaleString('en-UG')}
          </div>

          <div className="border-t border-b divide-y">
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between py-2 text-sm">
                <span className="text-gray-700">{item.name} × {item.quantity}</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency((item.selling_price || item.price || 0) * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal (excl. VAT)</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>VAT (18%, included)</span>
              <span>{formatCurrency(invoice.tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
              <span>Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            {isInvoice && (
              <>
                <div className="flex justify-between text-gray-600 pt-1">
                  <span>Amount Paid</span>
                  <span>{formatCurrency(invoice.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-700">
                  <span>Balance Due</span>
                  <span>{formatCurrency(invoice.balanceDue)}</span>
                </div>
              </>
            )}
          </div>

          {invoice.jobStatus && (
            <div className="flex items-center justify-between text-sm bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              <span className="text-indigo-900 font-semibold">
                {JOB_STATUS_LABELS[invoice.jobStatus] || invoice.jobStatus}
              </span>
              {invoice.jobStatus !== 'collected' && (
                <button
                  onClick={() => requireAuth(() => setShowJobUpdate((v) => !v))}
                  className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                >
                  <FiTool className="h-3 w-3" /> Update
                </button>
              )}
            </div>
          )}

          {showJobUpdate && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
              <p className="text-xs text-indigo-800">
                Only this sale's cashier, or the store's manager/admin, can update this — sign in with that account first if you haven't already.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {JOB_STATUS_FLOW.filter((s) => s !== invoice.jobStatus).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleUpdateJobStatus(status)}
                    disabled={updatingJob}
                    className="py-2 px-2 bg-white border border-indigo-300 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {JOB_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2">
            <button onClick={handleShare} className="flex flex-col items-center gap-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">
              <FiShare2 /> Share
            </button>
            <button onClick={handleWhatsApp} className="flex flex-col items-center gap-1 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-semibold">
              <FiMessageSquare /> WhatsApp
            </button>
            <button onClick={handleDownloadPDF} className="flex flex-col items-center gap-1 py-2 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold">
              <FiDownload /> PDF
            </button>
          </div>

          {isInvoice && (
            <button
              onClick={() => requireAuth(handlePayWithIcan)}
              disabled={payingWithIcan}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50"
            >
              💎 {payingWithIcan ? 'Paying...' : 'Pay Balance with IcanEra Wallet'}
            </button>
          )}

          {showSignIn && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 space-y-3">
              <p className="text-xs text-cyan-900">
                Sign in to continue — you'll land right back on this page afterward.
              </p>
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="flex-1 px-3 py-2 border border-cyan-300 rounded-lg text-sm"
                />
                <button
                  onClick={handleMagicLink}
                  disabled={sendingMagicLink || !signInEmail.trim()}
                  className="px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {sendingMagicLink ? 'Sending...' : 'Email me a link'}
                </button>
              </div>
              <button onClick={() => setShowSignIn(false)} className="text-xs text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          )}

          {isInvoice && (
            <div className="pt-3 border-t">
              {!showCollect ? (
                <button
                  onClick={() => requireAuth(() => setShowCollect(true))}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 text-white rounded-lg font-semibold text-sm"
                >
                  <FiDollarSign /> Store staff: Collect Payment
                </button>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
                  <p className="text-xs text-amber-800">
                    Only this sale's cashier, or the store's manager/admin, can record a payment here — sign in with that account first if you haven't already.
                  </p>
                  <input
                    type="number"
                    min="0"
                    max={invoice.balanceDue}
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm"
                    placeholder="Amount received now (UGX)"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCollect(false)}
                      disabled={collecting}
                      className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCollectPayment}
                      disabled={collecting || !collectAmount || parseFloat(collectAmount) <= 0}
                      className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      {collecting ? 'Recording...' : 'Record Payment'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isInvoice && (
            <div className="flex items-center gap-2 text-green-700 text-sm font-semibold pt-2 border-t">
              <FiCheckCircle /> Fully paid
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoicePublicPage;
