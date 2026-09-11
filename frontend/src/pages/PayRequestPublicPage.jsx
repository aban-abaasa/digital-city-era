// ===================================================
// 💎 PUBLIC ICAN PAYMENT REQUEST PAGE
// Opened by scanning a "Receive Money" QR code from the IcanEra Wallet (see
// ReceiveMoneyModal.jsx / icanPaymentRequestService.js) or a shared link —
// no account required to view what's being asked for. Actually paying still
// requires a signed-in wallet: if already signed in, "Pay Now" jumps
// straight into the real pay flow with the code pre-filled (no re-typing or
// re-scanning); if not, it offers to sign in first.
// ===================================================

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiShare2, FiDownload, FiCheckCircle, FiClock } from 'react-icons/fi';
import { supabase } from '../services/supabase';
import { getIcanPaymentRequest, getPaymentRequestDisplay } from '../services/icanPaymentRequestService';
import { formatICAN } from '../services/icanWalletService';

const PayRequestPublicPage = () => {
  const { paymentCode } = useParams();
  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const req = await getIcanPaymentRequest(paymentCode, { allowCompleted: true });
        setRequest(req);
      } catch (err) {
        setError(err.message || 'Payment request not found');
      } finally {
        setLoading(false);
      }
      const { data } = await supabase.auth.getUser();
      setSignedIn(!!data?.user);
    })();
  }, [paymentCode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="bg-white/10 rounded-xl p-6 text-center max-w-sm">
          <p className="text-lg font-bold text-white mb-1">Request not available</p>
          <p className="text-sm text-gray-400 mb-4">{error || 'It may have been paid or has expired.'}</p>
          <Link to="/" className="text-cyan-400 font-semibold">Go home</Link>
        </div>
      </div>
    );
  }

  const shaped = getPaymentRequestDisplay(request);
  const isPaid = request.status === 'completed';
  const isExpired = request.status !== 'completed' && new Date(request.expires_at) < new Date();
  const shareUrl = window.location.href;

  const amountLabel = shaped.icanAmount != null
    ? `${formatICAN(shaped.icanAmount)} ICAN`
    : `${shaped.localAmount?.toLocaleString()} ${shaped.localCurrency}`;

  const handleShare = async () => {
    const text = `Payment request from ${request.merchant_name || 'an ICANera user'}: ${amountLabel}${shaped.description ? ` — ${shaped.description}` : ''}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'ICANera Payment Request', text, url: shareUrl }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      toast.success('📋 Link copied to clipboard!');
    }
  };

  const handleDownload = () => {
    const text = [
      'ICANERA PAYMENT REQUEST',
      '------------------------',
      `From: ${request.merchant_name || 'ICANera user'}`,
      `Amount: ${amountLabel}`,
      shaped.description ? `For: ${shaped.description}` : null,
      `Code: ${request.payment_code}`,
      `Status: ${isPaid ? 'Paid' : isExpired ? 'Expired' : 'Pending'}`,
      `Expires: ${new Date(request.expires_at).toLocaleString()}`
    ].filter(Boolean).join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment-request-${request.payment_code}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-900 py-6 px-3 md:py-10">
      <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-cyan-600 to-blue-700 text-white">
          <p className="text-xs uppercase tracking-wide opacity-90">Payment Request</p>
          <h1 className="text-2xl font-bold mt-1">{amountLabel}</h1>
          <p className="text-sm opacity-90 mt-1">to {request.merchant_name || 'an ICANera user'}</p>
        </div>

        <div className="p-5 space-y-4">
          {shaped.description && (
            <p className="text-gray-200 text-sm bg-white/5 rounded-lg p-3">{shaped.description}</p>
          )}

          <div className="flex items-center gap-2 text-sm">
            {isPaid ? (
              <span className="flex items-center gap-1 text-green-400 font-semibold"><FiCheckCircle /> Already paid</span>
            ) : isExpired ? (
              <span className="flex items-center gap-1 text-red-400 font-semibold"><FiClock /> Expired</span>
            ) : (
              <span className="flex items-center gap-1 text-amber-300 font-semibold">
                <FiClock /> Expires {new Date(request.expires_at).toLocaleString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleShare} className="flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold">
              <FiShare2 /> Share
            </button>
            <button onClick={handleDownload} className="flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold">
              <FiDownload /> Save
            </button>
          </div>

          {!isPaid && !isExpired && (
            signedIn ? (
              <Link
                to={`/ican-wallet?pay=${encodeURIComponent(request.payment_code)}`}
                className="block text-center py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
              >
                💎 Pay Now with IcanEra Wallet
              </Link>
            ) : (
              <Link
                to={`/login?redirect=${encodeURIComponent(`/ican-wallet?pay=${request.payment_code}`)}`}
                className="block text-center py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold"
              >
                Sign in to pay with IcanEra Wallet
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default PayRequestPublicPage;
