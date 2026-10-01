import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { FiArrowLeft, FiRefreshCw, FiUserPlus, FiUserX } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabaseConfig } from '../services/supabase';
import { createLocalStaff, listLocalStaff, setLocalStaffActive } from '../services/localBusinessStaffService';

const LocalBusinessStaffPage = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ username: '', displayName: '', role: 'cashier', pin: '' });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStaff(await listLocalStaff());
    } catch (requestError) {
      setError(requestError.message || 'Could not load local staff.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (!supabaseConfig.localBusinessServer) return <Navigate to="/" replace />;
  if (user?.localRole !== 'owner') return <Navigate to="/cashier-portal" replace />;

  const addStaff = async (event) => {
    event.preventDefault();
    setWorking(true);
    setError('');
    setNotice('');
    try {
      await createLocalStaff(form);
      setForm({ username: '', displayName: '', role: 'cashier', pin: '' });
      setNotice('Local staff account created. Give the username and PIN to that staff member securely.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not create the staff account.');
    } finally {
      setWorking(false);
    }
  };

  const toggleStaff = async (member) => {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      await setLocalStaffActive(member.id, !member.isActive);
      setNotice(member.isActive ? 'Staff account disabled on this server.' : 'Staff account enabled on this server.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not update this account.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/business-local-server" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"><FiArrowLeft /> Local server</Link>
        <header className="mt-5 rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-200">Local server settings</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Manage local staff</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">Add or disable accounts that can sign in to this business server without internet. PINs are stored as password hashes on this server; these local accounts do not create or change cloud accounts.</p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.25fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold"><FiUserPlus className="text-cyan-700" /> Add staff account</h2>
            <form onSubmit={addStaff} className="mt-4 space-y-3">
              <label className="block text-sm font-medium">Username<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} autoComplete="off" minLength={3} maxLength={64} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <label className="block text-sm font-medium">Display name<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} maxLength={120} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <label className="block text-sm font-medium">Local role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="cashier">Cashier</option><option value="manager">Manager</option></select></label>
              <label className="block text-sm font-medium">PIN<input type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/\D/g, '').slice(0, 12) })} autoComplete="new-password" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 tracking-[0.3em]" /><span className="mt-1 block text-xs font-normal text-slate-500">Use a unique 6 to 12 digit PIN.</span></label>
              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</p>}
              {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{notice}</p>}
              <button type="submit" disabled={working} className="w-full rounded-lg bg-cyan-700 px-4 py-3 font-semibold text-white hover:bg-cyan-800 disabled:opacity-60">{working ? 'Saving…' : 'Create local account'}</button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Staff on this server</h2>
              <button type="button" onClick={refresh} disabled={loading || working} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"><FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh</button>
            </div>
            {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading staff…</p> : staff.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No local staff accounts found.</p> : (
              <div className="mt-4 divide-y divide-slate-100">
                {staff.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{member.displayName}{member.isOwner ? ' · Owner' : ''}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{member.username} · {member.role} · {member.isActive ? 'Active' : 'Disabled'}</p>
                    </div>
                    {!member.isOwner && <button type="button" onClick={() => toggleStaff(member)} disabled={working} className={`shrink-0 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60 ${member.isActive ? 'bg-rose-50 text-rose-800 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}><FiUserX /> {member.isActive ? 'Disable' : 'Enable'}</button>}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Staff access is local to this server. A disabled account cannot sign in here. Protect the server computer and business Wi-Fi.</p>
          </section>
        </div>
      </div>
    </main>
  );
};

export default LocalBusinessStaffPage;
