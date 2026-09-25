import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { formatICAN, buyICANFromWallet, getMyTradingInfo } from '@/services/icanWalletService';

// Buying icaneracoin spends the money in the user's own IcanEra Wallet, in THEIR OWN currency, at
// the coin's LIVE value in that currency —
// an exchange between two balances they already hold, so there is no payment window. (Flutterwave
// is for money entering or leaving the platform.)
export default function BuyIcanModal({ userId, onClose, onSuccess }) {
  const [spendInput, setSpendInput] = useState('');
  const [processing, setProcessing] = useState(false);
  // The user's own currency, the live price of a coin in it, and the money they hold in it — one
  // figure set, so nothing is quoted until it is known.
  const [info, setInfo] = useState(null);
  const [priceFailed, setPriceFailed] = useState(false);

  const loadInfo = () => getMyTradingInfo().then((t) => {
    setInfo(t);
    setPriceFailed(t === null);
  });

  useEffect(() => {
    loadInfo();
    const timer = setInterval(loadInfo, 60000);
    return () => clearInterval(timer);
  }, []);

  const currency = info?.currency ?? '';
  const livePrice = info?.price ?? null;
  const walletBalance = info ? info.walletBalance : null;
  const money = (n) => `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const spend = parseFloat(spendInput) || 0;
  // The amount entered buys as many coins as it covers (8 dp, rounded down).
  const icanAmount = livePrice && spend > 0 ? Math.floor((spend / livePrice) * 1e8) / 1e8 : 0;
  const cost = livePrice ? Math.round(icanAmount * livePrice * 100) / 100 : 0;
  const enough = walletBalance !== null && cost <= walletBalance;
  const canBuy = icanAmount >= 0.0001 && !!livePrice && enough;

  const handleBuy = async () => {
    if (!canBuy) return;
    setProcessing(true);
    try {
      const result = await buyICANFromWallet({ userId, icanAmount, reference: `DCE-BUY-${Date.now()}` });
      toast.success(`Bought ${formatICAN(result.ican_bought)} IcanEra for ${result.currency} ${Number(result.paid).toLocaleString(undefined, { maximumFractionDigits: 2 })} from your IcanEra Wallet.`);
      setSpendInput('');
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
            <div className="text-green-400 text-xl font-bold">{walletBalance === null ? '…' : money(walletBalance)}</div>
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Amount to spend{currency ? ` (${currency})` : ''}</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="any"
                value={spendInput}
                onChange={(e) => setSpendInput(e.target.value)}
                placeholder="0"
                disabled={processing}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 pr-16 text-sm outline-none border border-gray-700 focus:border-green-500"
              />
              {walletBalance !== null && walletBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setSpendInput(String(Math.floor(walletBalance)))}
                  className="absolute right-3 top-3 text-xs text-green-400 hover:text-green-300 font-semibold"
                >
                  MAX
                </button>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-1">
              {livePrice
                ? `1 IcanEra = ${money(livePrice)} (live value)`
                : priceFailed ? "Couldn't load the live price — retrying…" : 'Loading the live price…'}
            </p>
          </div>

          {icanAmount > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
              <div className="text-center flex-1">
                <div className="text-xs text-gray-400 mb-1">You Pay</div>
                <div className="text-white font-semibold">{money(cost)}</div>
              </div>
              <div className="text-green-400 mx-4">→</div>
              <div className="text-center flex-1">
                <div className="text-xs text-gray-400 mb-1">You Get</div>
                <div className="text-green-400 font-bold text-lg">{formatICAN(icanAmount)} IcanEra</div>
              </div>
            </div>
          )}

          {icanAmount > 0 && walletBalance !== null && !enough && (
            <p className="text-rose-400 text-xs" role="alert">
              Your IcanEra Wallet has {money(walletBalance)}, and this costs {money(cost)}. Add money to your wallet first, or buy less.
            </p>
          )}

          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-amber-300 text-xs">
            Paid from your IcanEra Wallet balance at the live value of IcanEra, in your own currency. IcanEra arrives in your wallet instantly.
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
