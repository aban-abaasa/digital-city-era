import React, { useCallback, useEffect, useState } from 'react';
import { FiBriefcase, FiCheckCircle, FiLink, FiLoader, FiRefreshCw } from 'react-icons/fi';
import { supabase } from '../services/supabase';

// The business profile is shared with Pichin and CMMS.  This panel is kept in
// Supermarketa so an owner can deliberately choose the same business instead
// of silently receiving a duplicate profile.
export default function UseBusinessProfileTab({ mode, supermarketId, supplierUserId, currentProfileId, onLinked }) {
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState(currentProfileId || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in again to select a business profile.');

      const { data: publicUser } = await supabase
        .from('users')
        .select('id')
        .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
        .limit(1)
        .maybeSingle();
      const identities = [...new Set([user.id, publicUser?.id].filter(Boolean))];
      const ownerFilters = [...identities.map(id => `user_id.eq.${id}`), ...(user.email ? [`owner_email.ilike.${user.email}`] : [])];
      const [owned, shared] = await Promise.all([
        supabase.from('business_profiles').select('id, business_name, business_type, status, created_at').in('user_id', identities).eq('status', 'active'),
        ownerFilters.length
          ? supabase.from('business_co_owners').select('business_profile_id, business_profiles(id, business_name, business_type, status, created_at)').or(ownerFilters.join(',')).in('status', ['active', 'approved', 'verified'])
          : Promise.resolve({ data: [] })
      ]);
      if (owned.error) throw owned.error;
      if (shared.error) throw shared.error;

      const unique = new Map();
      (owned.data || []).forEach(profile => unique.set(profile.id, profile));
      (shared.data || []).forEach(member => {
        if (member.business_profiles?.id && member.business_profiles.status === 'active') unique.set(member.business_profiles.id, member.business_profiles);
      });
      const available = [...unique.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setProfiles(available);
      setSelectedId(previous => previous || currentProfileId || available[0]?.id || '');
    } catch (loadError) {
      setError(loadError.message || 'Could not load business profiles.');
    } finally {
      setLoading(false);
    }
  }, [currentProfileId]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const linkSelectedProfile = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      let result;
      if (mode === 'admin') {
        if (!supermarketId) throw new Error('Your supermarket account is still loading. Please refresh and try again.');
        result = await supabase.rpc('merge_supermarketa_pichin_business', {
          p_supermarket_id: supermarketId,
          p_business_profile_id: selectedId
        });
        if (result.error) throw result.error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const ids = [...new Set([user?.id, supplierUserId].filter(Boolean))];
        const { data: applications, error: applicationsError } = await supabase
          .from('supplier_applications')
          .select('id')
          .in('supplier_user_id', ids);
        if (applicationsError) throw applicationsError;
        const linkResults = await Promise.all((applications || []).map(application => supabase.rpc('supplier_link_application_business', {
          p_application_id: application.id,
          p_business_profile_id: selectedId
        })));
        const linkError = linkResults.find(item => item.error)?.error;
        if (linkError) throw linkError;

        // A supplier can use the selected profile immediately, including when
        // they have not made a legacy store application yet.
        const { error: directoryError } = await supabase.rpc('publish_business_as_supplier', {
          p_business_profile_id: selectedId,
          p_supplier_type: 'supplier'
        });
        if (directoryError) console.warn('Supplier directory publishing is unavailable:', directoryError.message);
      }
      const profile = profiles.find(item => item.id === selectedId);
      onLinked?.(selectedId, profile);
      setMessage(`${profile?.business_name || 'Business profile'} is now the business identity used in Supermarketa, Supplier and CMMS.`);
    } catch (linkError) {
      setError(linkError.message || 'Could not link this business profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 to-violet-700 p-6 text-white shadow-sm">
        <div className="flex items-start gap-3"><FiBriefcase className="mt-1 shrink-0" size={24} /><div><h1 className="text-xl font-bold">Use your business profile</h1><p className="mt-1 text-sm text-indigo-100">Choose the Pichin business profile that should power this {mode === 'admin' ? 'Supermarketa store' : 'supplier account'}. It keeps your administrator authority, wallet, catalog and CMMS records together.</p></div></div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Available business profiles</h2><p className="text-sm text-slate-500">Only profiles you own or are an approved member of appear here.</p></div><button type="button" onClick={loadProfiles} disabled={loading} className="rounded-lg p-2 text-indigo-700 hover:bg-indigo-50" aria-label="Refresh business profiles"><FiRefreshCw className={loading ? 'animate-spin' : ''} /></button></div>
        {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><FiLoader className="animate-spin" /> Loading profiles…</div> : profiles.length === 0 ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No active Pichin business profile is available yet. Create one in Pichin first, then refresh this tab.</p> : <div className="space-y-2">{profiles.map(profile => <label key={profile.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${selectedId === profile.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}><input type="radio" name="business-profile" value={profile.id} checked={selectedId === profile.id} onChange={() => setSelectedId(profile.id)} /><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{profile.business_name}</span><span className="block text-sm text-slate-500">{profile.business_type || 'Business'}{profile.id === currentProfileId ? ' · Currently linked' : ''}</span></span>{profile.id === currentProfileId && <FiCheckCircle className="text-emerald-600" />}</label>)}</div>}
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        <button type="button" onClick={linkSelectedProfile} disabled={!selectedId || saving} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <FiLoader className="animate-spin" /> : <FiLink />} {saving ? 'Linking…' : 'Use selected business profile'}</button>
      </div>
    </div>
  );
}
