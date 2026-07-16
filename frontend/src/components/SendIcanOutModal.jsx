import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ICAN_TO_UGX, SOURCE_APP, formatICAN, requestIcanPayout } from '@/services/icanWalletService';
import { supabase } from '@/services/supabase';

export default function SendIcanOutModal({ userId, balance, onClose, onSuccess }) {
  const [icanAmount, setIcanAmount] = useState('');
  const [channel, setChannel] = useState('mobilemoneyuganda');
  const [network, setNetwork] = useState('MTN');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const amount = parseFloat(icanAmount) || 0;
  const ugxGross = amount * ICAN_TO_UGX;
  const feePercent = 3; // flat 3% cash-out fee, same as any ICAN sell — applied server-side in sell_ican_coins()
  const ugxNet = ugxGross - Math.round((ugxGross * feePercent) / 100);

  const canSubmit =
    amount > 0 &&
    amount <= (balance?.ican ?? 0) &&
    (channel === 'mobilemoneyuganda' ? !!phoneNumber : !!accountNumber && !!bankCode && !!beneficiaryName);

  const handleSendOut = async () => {
    if (!canSubmit) return;
    setProcessing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const data = await requestIcanPayout({
        icanAmount: amount,
        channel,
        phoneNumber: channel === 'mobilemoneyuganda' ? phoneNumber : undefined,
        network: channel === 'mobilemoneyuganda' ? network : undefined,
        accountNumber: channel === 'bank' ? accountNumber : undefined,
        bankCode: channel === 'bank' ? bankCode : undefined,
        beneficiaryName: channel === 'bank' ? beneficiaryName : (userData?.user?.user_metadata?.full_name || userData?.user?.email),
      });
      setResult(data);
      toast.success('Payout submitted — funds are on the way.');
      if (onSuccess) onSuccess();
    } catch (e) {
      toast.error(e.message || 'Payout failed');
    } finally {
      setProcessing(false);
    }
  };

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-white font-bold text-lg mb-2">Payout Submitted</h2>
          <p className="text-gray-400 text-sm mb-4">{result.message}</p>
          <div className="bg-gray-800 rounded-lg p-4 text-left text-sm space-y-1 mb-4">
            <div className="flex justify-between text-gray-300"><span>Gross</span><span>UGX {Number(result.ugx_gross).toLocaleString()}</span></div>
            <div className="flex justify-between text-gray-400"><span>Fee</span><span>-UGX {Number(result.fee_ugx).toLocaleString()}</span></div>
            <div className="flex justify-between text-white font-semibold"><span>You receive</span><span>UGX {Number(result.ugx_net).toLocaleString()}</span></div>
          </div>
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg">Send ICAN Out</h2>
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
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-rose-500"
            />
            <p className="text-gray-500 text-xs mt-1">Balance: {formatICAN(balance?.ican ?? 0)} ICAN</p>
          </div>

          <div className="flex gap-2">
            {[
              { key: 'mobilemoneyuganda', label: 'Mobile Money' },
              { key: 'bank', label: 'Bank Account' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setChannel(opt.key)}
                disabled={processing}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                  channel === opt.key ? 'bg-rose-600 border-rose-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {channel === 'mobilemoneyuganda' ? (
            <>
              <div className="flex gap-2">
                {['MTN', 'AIRTEL'].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNetwork(n)}
                    disabled={processing}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                      network === n ? 'bg-rose-600 border-rose-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Mobile Money Number</label>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 0770123456"
                  disabled={processing}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-rose-500"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Bank Code</label>
                <input
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  placeholder="Get this from your bank / Flutterwave bank list"
                  disabled={processing}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-rose-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Account Number</label>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  disabled={processing}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-rose-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Account Holder Name</label>
                <input
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  disabled={processing}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-rose-500"
                />
              </div>
            </>
          )}

          {amount > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 text-sm space-y-1">
              <div className="flex justify-between text-gray-300"><span>Gross</span><span>UGX {ugxGross.toLocaleString()}</span></div>
              <div className="flex justify-between text-gray-400"><span>Fee ({feePercent}%)</span><span>-UGX {(ugxGross - ugxNet).toLocaleString()}</span></div>
              <div className="flex justify-between text-white font-semibold"><span>You receive</span><span>UGX {ugxNet.toLocaleString()}</span></div>
            </div>
          )}

          {amount > (balance?.ican ?? 0) && (
            <p className="text-rose-400 text-xs">Amount exceeds your ICAN balance.</p>
          )}

          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-amber-300 text-xs">
            Sent via Flutterwave. A 3% cash-out fee applies. ICAN leaves your wallet immediately; if the transfer fails, it is refunded automatically.
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium text-sm">Cancel</button>
          <button
            onClick={handleSendOut}
            disabled={!canSubmit || processing}
            className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm disabled:opacity-60"
          >
            {processing ? 'Processing…' : 'Send Out'}
          </button>
        </div>
      </div>
    </div>
  );
}
