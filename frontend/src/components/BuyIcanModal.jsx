import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ICAN_TO_UGX, SOURCE_APP, formatICAN } from '@/services/icanWalletService';
import { supabase } from '@/services/supabase';
import { payWithFlutterwave, generateTxRef } from '@/services/flutterwaveClient';

const PAYMENT_METHODS = [
  { key: 'mtn', label: '📱 MTN', paymentOptions: 'mobilemoneyuganda' },
  { key: 'airtel', label: '📱 Airtel', paymentOptions: 'mobilemoneyuganda' },
  { key: 'card', label: '💳 Card', paymentOptions: 'card' },
  { key: 'bank', label: '🏦 Bank Account', paymentOptions: 'account' },
];

export default function BuyIcanModal({ userId, onClose, onSuccess }) {
  const [ugxAmount, setUgxAmount] = useState('');
  const [method, setMethod] = useState('mtn');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [processing, setProcessing] = useState(false);

  const icanAmount = ugxAmount ? parseFloat(ugxAmount) / ICAN_TO_UGX : 0;
  const isMobileMoney = method === 'mtn' || method === 'airtel';
  const canBuy = ugxAmount && parseFloat(ugxAmount) >= ICAN_TO_UGX && (!isMobileMoney || !!phoneNumber);

  const handleBuy = async () => {
    if (!ugxAmount || parseFloat(ugxAmount) < ICAN_TO_UGX) {
      toast.error(`Minimum purchase: UGX ${ICAN_TO_UGX.toLocaleString()}`);
      return;
    }
    if (isMobileMoney && !phoneNumber) {
      toast.error('Enter your mobile money number');
      return;
    }

    setProcessing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const txRef = generateTxRef('DCE-BUY');
      const selectedMethod = PAYMENT_METHODS.find((m) => m.key === method);

      const payment = await payWithFlutterwave({
        amount: parseFloat(ugxAmount),
        currency: 'UGX',
        customerEmail: userData?.user?.email,
        customerName: userData?.user?.user_metadata?.full_name,
        customerPhone: isMobileMoney ? phoneNumber : undefined,
        paymentOptions: selectedMethod.paymentOptions,
        title: 'Supermartkera — IcanEra Wallet',
        description: `Buy ${formatICAN(icanAmount)} ICAN`,
        txRef,
      });

      if (payment.status === 'cancelled') {
        toast.info('Payment cancelled');
        return;
      }
      if (payment.status !== 'successful' || !payment.transaction_id) {
        toast.error('Payment was not successful');
        return;
      }

      const { data, error } = await supabase.functions.invoke('verify-flutterwave-payment', {
        body: {
          transaction_id: payment.transaction_id,
          tx_ref: txRef,
          ican_amount: icanAmount,
          source_app: SOURCE_APP,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Payment verification failed');

      toast.success(`Successfully bought ${formatICAN(icanAmount)} ICAN!`);
      setUgxAmount('');
      setPhoneNumber('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      toast.error(e.message || 'Purchase failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg">Buy ICAN</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  disabled={processing}
                  className={`py-2 rounded-lg text-sm font-medium border ${
                    method === m.key ? 'bg-green-600 border-green-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {isMobileMoney && (
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Mobile Money Number</label>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 0770123456"
                disabled={processing}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-green-500"
              />
            </div>
          )}

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Amount (UGX)</label>
            <input
              type="number"
              min={ICAN_TO_UGX}
              step={ICAN_TO_UGX}
              value={ugxAmount}
              onChange={(e) => setUgxAmount(e.target.value)}
              placeholder={`Min: ${ICAN_TO_UGX.toLocaleString()}`}
              disabled={processing}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-green-500"
            />
            <p className="text-gray-500 text-xs mt-1">1 ICAN = UGX {ICAN_TO_UGX.toLocaleString()} (floor price)</p>
          </div>

          {icanAmount > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
              <div className="text-center flex-1">
                <div className="text-xs text-gray-400 mb-1">You Pay</div>
                <div className="text-white font-semibold">UGX {parseFloat(ugxAmount).toLocaleString()}</div>
              </div>
              <div className="text-green-400 mx-4">→</div>
              <div className="text-center flex-1">
                <div className="text-xs text-gray-400 mb-1">You Get</div>
                <div className="text-green-400 font-bold text-lg">{formatICAN(icanAmount)} ICAN</div>
              </div>
            </div>
          )}

          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-amber-300 text-xs">
            Payment is processed securely via Flutterwave. ICAN arrives in your wallet instantly once verified.
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium text-sm">Cancel</button>
          <button
            onClick={handleBuy}
            disabled={!canBuy || processing}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-60"
          >
            {processing ? 'Processing…' : 'Buy ICAN Now'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.open('https://icanera.space/', '_blank', 'noopener,noreferrer')}
          className="w-full mt-3 text-center text-xs text-gray-500 hover:text-gray-300 underline"
        >
          Prefer the web? Buy for free at icanera.space ↗
        </button>
      </div>
    </div>
  );
}
