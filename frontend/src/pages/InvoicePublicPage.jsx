// ===================================================
// 🧾 PUBLIC INVOICE PAGE
// Opened by scanning an invoice's QR code (see Receipt.jsx) or from a
// shared link — no login required to view. A signed-in cashier/manager/
// admin of the store that made the sale can also collect the outstanding
// balance right here; anyone else who tries is refused server-side (see
// collect_invoice_payment() in ADD_PUBLIC_INVOICE_QR_ACCESS.sql).
// ===================================================

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiDownload, FiShare2, FiMessageSquare, FiDollarSign, FiCheckCircle } from 'react-icons/fi';
import transactionService from '../services/transactionService';
import receiptGeneratorService from '../services/receiptGeneratorService';

const InvoicePublicPage = () => {
  const { transactionId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCollect, setShowCollect] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collecting, setCollecting] = useState(false);

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
        dueDate: invoice.dueDate
      });
      toast.success('📥 PDF downloaded!');
    } catch (err) {
      toast.error('Failed to generate PDF');
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
            <div className="pt-3 border-t">
              {!showCollect ? (
                <button
                  onClick={() => setShowCollect(true)}
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
