import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { formatICAN, buyICANFromWallet, getLiveUgxPrice, getWalletUgxBalance } from '@/services/icanWalletService';

// Buying icaneracoin spends the money in the user's own IcanEra Wallet at the coin's LIVE value —
// an exchange between two balances they already hold, so there is no payment window. (Flutterwave
// is for money entering or leaving the platform.)
export default function BuyIcanModal({ userId, onClose, onSuccess }) {
  const [ugxAmount, setUgxAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [walletUgx, setWalletUgx] = useState(null);
  // Purchases are priced at the live value, so nothing is quoted until it is known.
  const [livePrice, setLivePrice] = useState(null);
  const [priceFailed, setPriceFailed] = useState(false);

  const loadWallet = () => getWalletUgxBalance().then(setWalletUgx).catch(() => setWalletUgx(null));

  useEffect(() => {
    loadWallet();
    let cancelled = false;
    const loadPrice = () => getLiveUgxPrice().then((p) => {
      if (cancelled) return;
      setLivePrice(p);
      setPriceFailed(p === null);
    });
    loadPrice();
    const timer = setInterval(loadPrice, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const spend = parseFloat(ugxAmount) || 0;
  // The UGX entered buys as many coins as it covers (8 dp, rounded down).
  const icanAmount = livePrice && spend > 0 ? Math.floor((spend / livePrice) * 1e8) / 1e8 : 0;
  const cost = livePrice ? Math.round(icanAmount * livePrice * 100) / 100 : 0;
  const enough = walletUgx !== null && cost <= walletUgx;
  const canBuy = icanAmount >= 0.0001 && !!livePrice && enough;

  const handleBuy = async () => {
    if (!canBuy) return;
    setProcessing(true);
    try {
      const result = await buyICANFromWallet({ userId, icanAmount, reference: `DCE-BUY-${Date.now()}` });
      toast.success(`Bought ${formatICAN(result.ican_bought)} IcanEra for UGX ${Number(result.ugx_paid).toLocaleString()} from your IcanEra Wallet.`);
      setUgxAmount('');
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
          <h2 className="text-white font-bold text-lg">Buy IcanEra</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">IcanEra Wallet (pays for this)</div>
            <div className="text-green-400 text-xl font-bold">{walletUgx === null ? '…' : `UGX ${walletUgx.toLocaleString()}`}</div>
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Amount to spend (UGX)</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="any"
                value={ugxAmount}
                onChange={(e) => setUgxAmount(e.target.value)}
                placeholder="0"
                disabled={processing}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 pr-16 text-sm outline-none border border-gray-700 focus:border-green-500"
              />
              {walletUgx !== null && walletUgx > 0 && (
                <button
                  type="button"
                  onClick={() => setUgxAmount(String(Math.floor(walletUgx)))}
                  className="absolute right-3 top-3 text-xs text-green-400 hover:text-green-300 font-semibold"
                >
                  MAX
                </button>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-1">
              {livePrice
                ? `1 IcanEra = UGX ${livePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} (live value)`
                : priceFailed ? "Couldn't load the live price — retrying…" : 'Loading the live price…'}
            </p>
          </div>

          {icanAmount > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
              <div className="text-center flex-1">
                <div className="text-xs text-gray-400 mb-1">You Pay</div>
                <div className="text-white font-semibold">UGX {cost.toLocaleString()}</div>
              </div>
              <div className="text-green-400 mx-4">→</div>
              <div className="text-center flex-1">
                <div className="text-xs text-gray-400 mb-1">You Get</div>
                <div className="text-green-400 font-bold text-lg">{formatICAN(icanAmount)} IcanEra</div>
              </div>
            </div>
          )}

          {icanAmount > 0 && walletUgx !== null && !enough && (
            <p className="text-rose-400 text-xs" role="alert">
              Your IcanEra Wallet has UGX {walletUgx.toLocaleString()}, and this costs UGX {cost.toLocaleString()}. Add money to your wallet first, or buy less.
            </p>
          )}

          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-amber-300 text-xs">
            Paid from your IcanEra Wallet balance at the live value of IcanEra (never below UGX 5,000). IcanEra arrives in your wallet instantly.
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium text-sm">Cancel</button>
          <button
            onClick={handleBuy}
            disabled={!canBuy || processing}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-60"
          >
            {processing ? 'Processing…' : 'Buy IcanEra Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
