import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';

const steps = ['Your Info', 'Store Details', 'Location', 'Review'];

export default function SupermarketOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    ownerName: '', ownerEmail: '', ownerPhone: '',
    storeName: '', description: '',
    storePhone: '', storeEmail: '',
    address: '', city: '', country: 'Uganda',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const next = () => setStep(s => Math.min(s + 1, steps.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Ensure user is signed in
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in first to register your supermarket.');
        navigate('/login');
        return;
      }

      const { data, error } = await supabase.rpc('onboard_supermarket', {
        p_name:        form.storeName,
        p_description: form.description,
        p_phone:       form.storePhone || form.ownerPhone,
        p_email:       form.storeEmail || form.ownerEmail,
        p_address:     form.address,
        p_city:        form.city,
        p_country:     form.country,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Onboarding failed');

      setResult(data);
      toast.success('Your supermarket is live! 🎉');
    } catch (err) {
      toast.error(err.message || 'Failed to register supermarket');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🏪</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">You're live!</h1>
          <p className="text-slate-600 mb-6">
            <strong>{form.storeName}</strong> is now on the platform.
            You earned <span className="text-emerald-600 font-bold">10 ICAN coins</span> for joining!
          </p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Staff invite link</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-white border rounded px-2 py-1 flex-1 overflow-hidden text-ellipsis">
                {window.location.origin}/join/{result.onboarding_token}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/join/${result.onboarding_token}`);
                  toast.success('Copied!');
                }}
                className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-slate-400">Share this with your managers and cashiers to let them join.</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/supermarket-hub?id=' + result.supermarket_id)}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate('/ican-wallet')}
              className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200"
            >
              View IcanEra Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🏪</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">List Your Supermarket</h1>
          <p className="text-sm text-slate-500 mt-1">Join thousands of stores on the platform. Earn ICAN on every sale.</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((label, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? 'text-cyan-600 font-medium' : 'text-slate-400'}`}>{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-emerald-300' : 'bg-slate-100'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0 — Your Info */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-700">About you</h2>
            <input className="input-field" placeholder="Your full name *" value={form.ownerName}
              onChange={e => set('ownerName', e.target.value)} />
            <input className="input-field" type="email" placeholder="Your email *" value={form.ownerEmail}
              onChange={e => set('ownerEmail', e.target.value)} />
            <input className="input-field" placeholder="Your phone number" value={form.ownerPhone}
              onChange={e => set('ownerPhone', e.target.value)} />
          </div>
        )}

        {/* Step 1 — Store Details */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-700">Store details</h2>
            <input className="input-field" placeholder="Supermarket name *" value={form.storeName}
              onChange={e => set('storeName', e.target.value)} />
            <textarea className="input-field resize-none h-24" placeholder="Brief description (what do you sell?)"
              value={form.description} onChange={e => set('description', e.target.value)} />
            <input className="input-field" placeholder="Store phone number" value={form.storePhone}
              onChange={e => set('storePhone', e.target.value)} />
            <input className="input-field" type="email" placeholder="Store email" value={form.storeEmail}
              onChange={e => set('storeEmail', e.target.value)} />
          </div>
        )}

        {/* Step 2 — Location */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-700">Location</h2>
            <input className="input-field" placeholder="Street address *" value={form.address}
              onChange={e => set('address', e.target.value)} />
            <input className="input-field" placeholder="City *" value={form.city}
              onChange={e => set('city', e.target.value)} />
            <select className="input-field" value={form.country} onChange={e => set('country', e.target.value)}>
              <option value="Uganda">Uganda</option>
              <option value="Kenya">Kenya</option>
              <option value="Tanzania">Tanzania</option>
              <option value="Rwanda">Rwanda</option>
              <option value="Other">Other</option>
            </select>
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-700">Confirm & submit</h2>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <Row label="Store name"   value={form.storeName} />
              <Row label="Owner"        value={form.ownerName} />
              <Row label="Email"        value={form.storeEmail || form.ownerEmail} />
              <Row label="Phone"        value={form.storePhone || form.ownerPhone} />
              <Row label="Address"      value={[form.address, form.city, form.country].filter(Boolean).join(', ')} />
              {form.description && <Row label="Description" value={form.description} />}
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-sm text-emerald-800 flex items-center gap-3">
              <span className="text-2xl">₡</span>
              <div>
                <p className="font-semibold">Earn 10 ICAN coins on registration</p>
                <p className="text-xs text-emerald-600">Plus 1% cashback for every customer purchase — paid in ICAN</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button onClick={back}
              className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50">
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              onClick={next}
              disabled={step === 0 ? !form.ownerName || !form.ownerEmail : step === 1 ? !form.storeName : !form.address || !form.city}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-40"
            >
              {loading ? 'Registering…' : 'Register Supermarket'}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Already have an account?{' '}
          <button onClick={() => navigate('/manager-login')} className="text-cyan-600 hover:underline">Sign in</button>
        </p>
      </div>

      <style>{`
        .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1.5px solid #e2e8f0;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus { border-color: #06b6d4; }
      `}</style>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-800 font-medium text-right">{value || '—'}</span>
    </div>
  );
}
