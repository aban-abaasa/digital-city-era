import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiShield, FiBriefcase, FiUsers, FiArrowRight, FiArrowLeft,
  FiLogIn, FiMapPin, FiPhone, FiMail, FiEye, FiEyeOff,
  FiCheck, FiCopy, FiPackage
} from 'react-icons/fi';
import { supabase } from '../services/supabase';

// ─── helpers ────────────────────────────────────────────────────────────────
const STEPS = ['Store details', 'Location', 'Review'];

function Field({ label, icon: Icon, error, ...props }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="relative">
        {Icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon size={15} />
          </span>
        )}
        <input
          className={`w-full ${Icon ? 'pl-9' : 'pl-4'} pr-4 py-3 rounded-xl border text-sm bg-white
            outline-none transition-all
            ${error
              ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
              : 'border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50'
            }`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-400 text-sm shrink-0">{label}</span>
      <span className="text-slate-800 text-sm font-medium text-right">{value || '—'}</span>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────
export default function AdminAuth() {
  const navigate = useNavigate();

  // view: 'loading' | 'create' | 'signin' | 'success'
  const [view, setView] = useState('loading');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState(null);
  const [session, setSession] = useState(null);

  const [form, setForm] = useState({
    storeName: '', description: '', storePhone: '', storeEmail: '',
    address: '', city: '', country: 'Uganda',
  });
  const [signin, setSignin] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  // ── on mount: check session ────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!alive) return;

      if (!s) {
        setView('signin');
        return;
      }

      setSession(s);
      setForm(f => ({ ...f, storeEmail: s.user.email || '' }));

      // If this session already belongs to a fully set-up admin, send them
      // straight to their own portal — never show "create a supermarket"
      // again, and never let a stray/shared session land someone in a
      // system that isn't a fresh one for them.
      const uid = s.user.id;
      const { data: userData } = await supabase
        .from('users').select('role, supermarket_id').eq('auth_id', uid).maybeSingle();
      const metaRole = s.user.user_metadata?.role || s.user.app_metadata?.role;
      const isAdmin = (userData?.role === 'admin' || metaRole === 'admin') && !!userData?.supermarket_id;

      if (!alive) return;
      if (isAdmin) {
        navigate('/admin-portal', { replace: true });
        return;
      }

      setView('create');
    })();
    return () => { alive = false; };
  }, [navigate]);

  // ── sign-in ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!signin.email || !signin.password) {
      toast.error('Enter your email and password');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signin.email,
        password: signin.password,
      });
      if (error) throw error;
      setSession(data.session);
      setForm(f => ({ ...f, storeEmail: data.user.email || '' }));

      const uid = data.user.id;

      // Check the users table (try auth_id first, fall back to id)
      let userData = null;
      const { data: ud1, error: udErr1 } = await supabase
        .from('users').select('role').eq('auth_id', uid).maybeSingle();
      if (!udErr1) { userData = ud1; }
      else {
        const { data: ud2 } = await supabase
          .from('users').select('role').eq('id', uid).maybeSingle();
        userData = ud2;
      }

      const metaRole = data.user.user_metadata?.role || data.user.app_metadata?.role;
      const isAdmin = userData?.role === 'admin' || metaRole === 'admin';

      // Repair: if they own a supermarket but role wasn't set, fix it now
      if (!isAdmin) {
        const { data: sm } = await supabase
          .from('supermarkets').select('id').eq('owner_user_id', uid).maybeSingle();
        if (sm) {
          const fix = { role: 'admin', updated_at: new Date().toISOString() };
          const { error: fe } = await supabase.from('users').update(fix).eq('auth_id', uid);
          if (fe) await supabase.from('users').update(fix).eq('id', uid);
          await supabase.auth.updateUser({ data: { role: 'admin' } });
          toast.success('Welcome back!');
          navigate('/admin-portal', { replace: true });
          return;
        }
      }

      if (isAdmin) {
        toast.success('Welcome back!');
        navigate('/admin-portal', { replace: true });
      } else {
        setView('create');
      }
    } catch (err) {
      toast.error(err.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  // ── validate per step ─────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (step === 0) {
      if (!form.storeName.trim()) e.storeName = 'Store name is required';
    }
    if (step === 1) {
      if (!form.address.trim()) e.address = 'Street address is required';
      if (!form.city.trim()) e.city = 'City is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  // ── submit / create supermarket ───────────────────────────────────────────
  const handleCreate = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (!session) {
        toast.error('Please sign in first');
        setView('signin');
        return;
      }

      // Call onboard_supermarket RPC (wired in MULTI_TENANT_PLATFORM.sql)
      const { data, error } = await supabase.rpc('onboard_supermarket', {
        p_name:        form.storeName.trim(),
        p_description: form.description.trim() || null,
        p_phone:       form.storePhone.trim() || null,
        p_email:       form.storeEmail.trim() || null,
        p_address:     form.address.trim(),
        p_city:        form.city.trim(),
        p_country:     form.country,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Registration failed');

      // Update auth metadata so session reflects admin role
      await supabase.auth.updateUser({ data: { role: 'admin' } });

      // Update users table row that AdminPortal checks (try auth_id first, then id)
      const uid = session.user.id;
      const userUpdate = {
        role: 'admin',
        supermarket_id: data.supermarket_id || null,
        updated_at: new Date().toISOString()
      };
      const { error: e1 } = await supabase.from('users').update(userUpdate).eq('auth_id', uid);
      if (e1) await supabase.from('users').update(userUpdate).eq('id', uid);

      setResult(data);
      setView('success');
      toast.success(`${form.storeName} is now live! 🎉`);
    } catch (err) {
      toast.error(err.message || 'Failed to register supermarket');
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = () => {
    const link = `${window.location.origin}/join/${result?.onboarding_token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Invite link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // ── shared left panel ─────────────────────────────────────────────────────
  const LeftPanel = () => (
    <div className="space-y-8 text-white">
      <button
        onClick={() => navigate('/customer-dashboard')}
        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
      >
        <FiArrowLeft size={14} /> Back to dashboard
      </button>

      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-emerald-300 mb-4">
          <FiShield size={12} /> Admin setup
        </div>
        <h1 className="text-4xl md:text-5xl font-black leading-[1.1] mb-4">
          Your store.<br />Your rules.
        </h1>
        <p className="text-slate-300 text-base leading-relaxed max-w-sm">
          Create your supermarket on the platform, invite your team, and earn ICAN coin on every sale — all from one portal.
        </p>
      </div>

      <div className="space-y-3">
        {[
          { icon: FiBriefcase, title: 'Launch your store', body: 'Go live in minutes. No technical setup needed.' },
          { icon: FiUsers, title: 'Invite managers & cashiers', body: 'Share an invite link — they join instantly.' },
          { icon: FiPackage, title: 'Earn ICAN on every sale', body: '10 ICAN for joining + rewards on every order.' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/4 p-4 backdrop-blur">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon size={16} className="text-emerald-300" />
            </div>
            <div>
              <p className="font-semibold text-sm mb-0.5">{title}</p>
              <p className="text-xs text-slate-400">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── loading ────────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── success screen ─────────────────────────────────────────────────────────
  if (view === 'success') {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#064e3b,#0f172a_60%,#020617)] flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-900/40">
            <span className="text-4xl">🏪</span>
          </div>

          <div className="text-white">
            <h1 className="text-3xl font-black mb-2">You're live!</h1>
            <p className="text-slate-300">
              <span className="text-white font-semibold">{form.storeName}</span> is now on the platform.{' '}
              You earned{' '}
              <span className="text-emerald-400 font-bold">10 ICAN coins</span> for joining.
            </p>
          </div>

          {result?.onboarding_token && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Staff invite link</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-emerald-300 bg-black/30 rounded-lg px-3 py-2 flex-1 truncate">
                  {window.location.origin}/join/{result.onboarding_token}
                </code>
                <button
                  onClick={copyInvite}
                  className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  {copied ? <FiCheck size={15} className="text-emerald-400" /> : <FiCopy size={15} />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">Share with managers and cashiers to let them join instantly.</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/admin-portal', { replace: true })}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-base shadow-lg shadow-emerald-900/30 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              Open Admin Portal <FiArrowRight />
            </button>
            <button
              onClick={() => navigate('/ican-wallet')}
              className="w-full py-3 rounded-2xl border border-white/10 text-white/70 text-sm font-semibold hover:bg-white/5 transition-colors"
            >
              View IcanEra Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── sign-in view ───────────────────────────────────────────────────────────
  if (view === 'signin') {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0f172a,#020617)] text-white flex items-center justify-center px-4 py-10">
        <div className="max-w-5xl w-full grid lg:grid-cols-2 gap-10 items-center">
          <LeftPanel />

          <div className="bg-white rounded-[2rem] shadow-2xl shadow-black/30 p-7 md:p-9 text-slate-900">
            <div className="mb-7">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center">
                  <FiLogIn size={18} className="text-white" />
                </div>
                <h2 className="text-2xl font-black">Sign in</h2>
              </div>
              <p className="text-sm text-slate-400 ml-[52px]">Access your existing business account.</p>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4">
              <Field label="Email" icon={FiMail} type="email" placeholder="you@business.com"
                value={signin.email} onChange={e => setSignin(s => ({ ...s, email: e.target.value }))} />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={signin.password}
                    onChange={e => setSignin(s => ({ ...s, password: e.target.value }))}
                    className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-700 text-white font-bold text-sm shadow-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {busy ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
                {busy ? 'Signing in…' : 'Sign in to portal'}
                {!busy && <FiArrowRight size={15} />}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                Don't have a business account yet?{' '}
                <button
                  onClick={() => setView('create')}
                  className="text-emerald-600 font-semibold hover:underline"
                >
                  Create one now
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── create view (multi-step) ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0f172a,#020617)] text-white flex items-center justify-center px-4 py-10">
      <div className="max-w-5xl w-full grid lg:grid-cols-2 gap-10 items-start">
        <LeftPanel />

        <div className="bg-white rounded-[2rem] shadow-2xl shadow-black/30 text-slate-900 overflow-hidden">
          {/* progress bar */}
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-7 md:p-9">
            {/* step indicator */}
            <div className="flex items-center gap-2 mb-6">
              {STEPS.map((label, i) => (
                <React.Fragment key={i}>
                  <div className={`flex items-center gap-1.5 text-xs font-semibold transition-colors
                    ${i === step ? 'text-emerald-600' : i < step ? 'text-slate-400' : 'text-slate-300'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                      ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {i < step ? <FiCheck size={10} /> : i + 1}
                    </div>
                    <span className="hidden sm:block">{label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px ${i < step ? 'bg-emerald-300' : 'bg-slate-100'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* ── step 0: store details ── */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="mb-2">
                  <h2 className="text-xl font-black text-slate-900">Create your supermarket</h2>
                  <p className="text-sm text-slate-400 mt-0.5">Tell us about your store.</p>
                </div>

                <Field label="Supermarket name *" icon={FiBriefcase}
                  placeholder="e.g. City Fresh Market"
                  value={form.storeName} onChange={e => set('storeName', e.target.value)}
                  error={errors.storeName} />

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</label>
                  <textarea
                    placeholder="What do you sell? Fresh produce, electronics, groceries…"
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Store phone" icon={FiPhone} type="tel"
                    placeholder="+256 700 000 000"
                    value={form.storePhone} onChange={e => set('storePhone', e.target.value)} />
                  <Field label="Store email" icon={FiMail} type="email"
                    placeholder="store@business.com"
                    value={form.storeEmail} onChange={e => set('storeEmail', e.target.value)} />
                </div>
              </div>
            )}

            {/* ── step 1: location ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="mb-2">
                  <h2 className="text-xl font-black text-slate-900">Where is your store?</h2>
                  <p className="text-sm text-slate-400 mt-0.5">Customers and riders use this for deliveries.</p>
                </div>

                <Field label="Street address *" icon={FiMapPin}
                  placeholder="Plot 14, Nakivubo Road"
                  value={form.address} onChange={e => set('address', e.target.value)}
                  error={errors.address} />

                <div className="grid grid-cols-2 gap-3">
                  <Field label="City *" placeholder="Kampala"
                    value={form.city} onChange={e => set('city', e.target.value)}
                    error={errors.city} />

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Country</label>
                    <select
                      value={form.country} onChange={e => set('country', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 bg-white"
                    >
                      {['Uganda','Kenya','Tanzania','Rwanda','Other'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── step 2: review ── */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="mb-2">
                  <h2 className="text-xl font-black text-slate-900">Review & launch</h2>
                  <p className="text-sm text-slate-400 mt-0.5">Confirm your details before going live.</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 divide-y divide-slate-100">
                  <Row label="Store name"   value={form.storeName} />
                  <Row label="Description"  value={form.description || '—'} />
                  <Row label="Phone"        value={form.storePhone || '—'} />
                  <Row label="Email"        value={form.storeEmail || '—'} />
                  <Row label="Address"      value={[form.address, form.city, form.country].filter(Boolean).join(', ')} />
                </div>

                <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-100 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-lg shrink-0">₡</div>
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Earn 10 ICAN coins on launch</p>
                    <p className="text-xs text-emerald-600">Plus ongoing rewards for every order processed through your store.</p>
                  </div>
                </div>
              </div>
            )}

            {/* navigation */}
            <div className="flex gap-3 mt-7">
              {step > 0 && (
                <button
                  onClick={back}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <FiArrowLeft size={14} /> Back
                </button>
              )}

              {step < STEPS.length - 1 ? (
                <button
                  onClick={next}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-bold shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                >
                  Continue <FiArrowRight size={14} />
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={busy}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-700 text-white text-sm font-bold shadow-md hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {busy
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Launching…</>
                    : <>Launch my store <FiArrowRight size={14} /></>
                  }
                </button>
              )}
            </div>

            {/* switch to sign-in */}
            <p className="text-center text-xs text-slate-400 mt-5">
              Already have a business account?{' '}
              <button onClick={() => setView('signin')} className="text-emerald-600 font-semibold hover:underline">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
