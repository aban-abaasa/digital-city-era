import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { setInitialPin, validatePIN } from '@/services/pinService';

/**
 * Shown once per session when the signed-in user has no transaction PIN
 * yet. Setting a PIN is self-service from any app; if they ever forget it,
 * recovery is ICAN-app-only (dev panel), which this modal does not handle.
 */
export default function SetPinPrompt({ userId, onDone }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSetPin = async () => {
    setError('');
    if (!validatePIN(pin)) { setError('PIN must be 4-6 digits'); return; }
    if (pin !== confirmPin) { setError('PINs do not match'); return; }

    setProcessing(true);
    try {
      const result = await setInitialPin(userId, pin);
      if (!result.success) { setError(result.error); return; }
      toast.success('Transaction PIN set. Keep it safe — you\'ll use it to authorize transfers and payouts.');
      onDone();
    } catch (e) {
      setError(e.message || 'Could not set PIN');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">🔐</div>
          <h2 className="text-white font-bold text-lg">Set Your Transaction PIN</h2>
          <p className="text-gray-400 text-xs mt-1">
            Protects your IcanEra Wallet across all apps. If you ever forget it, you'll need to visit the ICAN app to recover it.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 4-6 digit PIN"
            disabled={processing}
            className="w-full bg-gray-800 text-white text-center tracking-widest rounded-lg px-4 py-3 text-lg outline-none border border-gray-700 focus:border-violet-500"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Confirm PIN"
            disabled={processing}
            className="w-full bg-gray-800 text-white text-center tracking-widest rounded-lg px-4 py-3 text-lg outline-none border border-gray-700 focus:border-violet-500"
          />
        </div>

        {error && <p className="text-rose-400 text-xs mt-3 text-center">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button onClick={onDone} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium text-sm">Later</button>
          <button
            onClick={handleSetPin}
            disabled={processing || !pin || !confirmPin}
            className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm disabled:opacity-60"
          >
            {processing ? 'Saving…' : 'Set PIN'}
          </button>
        </div>
      </div>
    </div>
  );
}
