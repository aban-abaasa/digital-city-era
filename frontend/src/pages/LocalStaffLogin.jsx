import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiLock, FiServer, FiUser } from 'react-icons/fi';
import { supabaseConfig } from '../services/supabase';
import { bootstrapLocalOwner, getLocalStaffSession, signInLocalStaff } from '../services/localBusinessStaffService';

const LocalStaffLogin = () => {
  const location = useLocation();
  const [setupMode, setSetupMode] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  if (!supabaseConfig.localBusinessServer) return <Navigate to="/login" replace />;
  const activeSession = getLocalStaffSession();
  if (activeSession) {
    return <Navigate to={activeSession.user.localRole === 'owner' ? '/local-staff' : '/cashier-portal'} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setWorking(true);
    try {
      const session = setupMode
        ? await bootstrapLocalOwner({ setupToken, username, displayName, pin })
        : await signInLocalStaff({ username, pin });
      const requestedPath = location.state?.from?.pathname;
      const destination = setupMode
        ? '/local-staff'
        : requestedPath && requestedPath.startsWith('/') && !requestedPath.startsWith('//')
          ? requestedPath
          : session.user.localRole === 'owner' ? '/local-staff' : '/cashier-portal';
      window.location.assign(destination);
    } catch (requestError) {
      setError(requestError.message || 'Could not sign in to this local server.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <FiArrowLeft /> Local app
        </a>
        <div className="mt-7 flex items-center gap-3">
          <span className="rounded-xl bg-cyan-100 p-3 text-cyan-800"><FiServer className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800">Business LAN</p>
            <h1 className="text-2xl font-bold">{setupMode ? 'Create local owner' : 'Staff sign in'}</h1>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Local accounts are stored on this business server. Enter your username and PIN; cloud internet is not required.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {setupMode && (
            <label className="block text-sm font-medium">
              One-time owner setup code
              <input value={setupToken} onChange={(event) => setSetupToken(event.target.value.trim())} autoComplete="off" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono" />
              <span className="mt-1 block text-xs font-normal text-slate-500">The installer prints this code once after setup.</span>
            </label>
          )}
          {setupMode && (
            <label className="block text-sm font-medium">
              Owner display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={120} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            </label>
          )}
          <label className="block text-sm font-medium">
            <span className="inline-flex items-center gap-2"><FiUser /> Username</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={64} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
          <label className="block text-sm font-medium">
            <span className="inline-flex items-center gap-2"><FiLock /> {setupMode ? 'Create PIN' : 'PIN'}</span>
            <input type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))} autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 tracking-[0.3em]" />
            <span className="mt-1 block text-xs font-normal text-slate-500">Use 6 to 12 digits.</span>
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</p>}
          <button type="submit" disabled={working} className="w-full rounded-lg bg-cyan-700 px-4 py-3 font-semibold text-white hover:bg-cyan-800 disabled:opacity-60">
            {working ? 'Please wait…' : setupMode ? 'Create owner account' : 'Sign in'}
          </button>
        </form>

        <button type="button" onClick={() => { setSetupMode((value) => !value); setError(''); }} className="mt-5 text-sm font-medium text-cyan-800 underline underline-offset-2">
          {setupMode ? 'Return to staff sign in' : 'First time setting up this server? Create its owner account'}
        </button>
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          The local staff login is separate from your cloud account. Keep the one-time owner setup code private until the first owner account is created.
        </p>
      </div>
    </main>
  );
};

export default LocalStaffLogin;
