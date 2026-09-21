import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ICAN_TO_UGX, formatICAN, sellICAN } from '@/services/icanWalletService';

export default function SellIcanModal({ userId, balance, onClose, onSuccess }) {
  const [icanAmount, setIcanAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const amount = parseFloat(icanAmount) || 0;
  const ugxGross = amount * ICAN_TO_UGX;
  const feePercent = 3; // flat 3% fee, applied server-side in sell_ican_coins()
  const ugxNet = ugxGross - Math.round((ugxGross * feePercent) / 100);

  const canSubmit = amount > 0 && amount <= (balance?.ican ?? 0);

  const handleSell = async () => {
    if (!canSubmit) return;
    setProcessing(true);
    try {
      const data = await sellICAN({
        userId,
        icanAmount: amount,
        reference: `DCE-SELL-${Date.now()}`,
      });
      setResult(data);
      toast.success('Sold — credited to your ICANera Wallet balance.');
      if (onSuccess) onSuccess();
    } catch (e) {
      toast.error(e.message || 'Sell failed');
    } finally {
      setProcessing(false);
    }
  };

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-white font-bold text-lg mb-2">Sold</h2>
          <div className="bg-gray-800 rounded-lg p-4 text-left text-sm space-y-1 mb-4">
            <div className="flex justify-between text-gray-300"><span>ICAN sold</span><span>{formatICAN(result.ican_sold)}</span></div>
            <div className="flex justify-between text-white font-semibold"><span>Credited to Wallet</span><span>UGX {Number(result.ugx_payout).toLocaleString()}</span></div>
            <div className="flex justify-between text-gray-400"><span>New Wallet balance</span><span>UGX {Number(result.wallet_balance).toLocaleString()}</span></div>
          </div>
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg">Sell ICAN</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Amount (ICAN)</label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              max={balance?.ican ?? undefined}
              value={icanAmount}
              onChange={(e) => setIcanAmount(e.target.value)}
              placeholder="0.0000"
              disabled={processing}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-orange-500"
            />
            <p className="text-gray-500 text-xs mt-1">Balance: {formatICAN(balance?.ican ?? 0)} ICAN · 1 ICAN = UGX {ICAN_TO_UGX.toLocaleString()} (floor price)</p>
          </div>

          {amount > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 text-sm space-y-1">
              <div className="flex justify-between text-gray-300"><span>Gross</span><span>UGX {ugxGross.toLocaleString()}</span></div>
              <div className="flex justify-between text-gray-400"><span>Fee ({feePercent}%)</span><span>-UGX {(ugxGross - ugxNet).toLocaleString()}</span></div>
              <div className="flex justify-between text-white font-semibold"><span>Credited to Wallet</span><span>UGX {ugxNet.toLocaleString()}</span></div>
            </div>
          )}

          {amount > (balance?.ican ?? 0) && (
            <p className="text-rose-400 text-xs">Amount exceeds your ICAN balance.</p>
          )}

          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-amber-300 text-xs">
            Credited instantly to your in-app ICANera Wallet balance — a 3% fee applies. To cash out to mobile money/bank instead, use "Send Out".
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium text-sm">Cancel</button>
          <button
            onClick={handleSell}
            disabled={!canSubmit || processing}
            className="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm disabled:opacity-60"
          >
            {processing ? 'Processing…' : 'Sell ICAN'}
          </button>
        </div>
      </div>
    </div>
  );
}
