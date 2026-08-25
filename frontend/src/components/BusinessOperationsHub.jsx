import React, { useEffect, useState } from 'react';
import { FiArrowRight, FiBriefcase, FiCheck, FiDollarSign, FiExternalLink, FiLoader, FiTruck, FiUsers } from 'react-icons/fi';
import { supabase } from '../services/supabase';

const ICANERA_CMMS_URL = import.meta.env.VITE_ICANERA_CMMS_URL || 'https://icanera.space/#cmms';

/**
 * Supermarketa entry point for workforce operations.
 *
 * Small stores get a focused in-app operations view. Larger stores are handed
 * off to the full CMMS workspace so the POS does not create a second ledger.
 */
export default function BusinessOperationsHub({ supermarketId, businessProfileId, businessName }) {
  const [plan, setPlan] = useState('basic');
  const [loading, setLoading] = useState(true);
  const [resolvedBusinessProfileId, setResolvedBusinessProfileId] = useState(businessProfileId || null);
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [salary, setSalary] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeOperation, setActiveOperation] = useState('payroll');
  const [transportContracts, setTransportContracts] = useState([]);
  const [transportRequests, setTransportRequests] = useState([]);
  const [transportUsage, setTransportUsage] = useState([]);
  const [transportForm, setTransportForm] = useState({ contract_id: '', vehicle_type: 'car', ride_count: 1, pickup: '', dropoff: '', scheduled_at: '', recurrence: 'once' });
  const [transportWorkerEmail, setTransportWorkerEmail] = useState('');
  const [transportStartsAt, setTransportStartsAt] = useState(new Date().toISOString().slice(0, 16));
  const [transportEndsAt, setTransportEndsAt] = useState('');
  const [transportDailyStart, setTransportDailyStart] = useState('06:00');
  const [transportDailyEnd, setTransportDailyEnd] = useState('18:00');
  const [transportBillingMode, setTransportBillingMode] = useState('monthly');

  useEffect(() => {
    let active = true;
    const loadPlan = async () => {
      if (!supermarketId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('supermart_subscriptions')
        .select('plan')
        .eq('supermarket_id', supermarketId)
        .eq('target_type', 'supermart')
        .eq('active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      let linkedBusinessId = businessProfileId || null;

      const { data: allStaff, error: staffError } = await supabase
        .from('users')
        .select('id, full_name, email, role, supermarket_id')
        .eq('supermarket_id', supermarketId)
        .neq('role', 'admin')
        .order('full_name', { ascending: true });
      if (staffError) setError(staffError.message);
      const staff = (allStaff || []).filter((employee) => (
        ['cashier', 'manager'].includes(String(employee.role || '').trim().toLowerCase())
      ));

      // A profile made in Pichin's "Manage your business" is already the
      // owner's CMMS identity. Link that existing profile before considering
      // creation of a Supermarketa-specific profile; otherwise opening CMMS
      // appears to ask the owner to create the same business again.
      if (!linkedBusinessId && authUser) {
        // Pitchin's older profiles can use public.users.id for user_id while
        // current sessions use auth.users.id. Resolve both identities and all
        // shared access records, then let the same authority RPC used by CMMS
        // decide which profiles this user may administer.
        const { data: publicUser } = await supabase
          .from('users')
          .select('id')
          .or(`auth_id.eq.${authUser.id},id.eq.${authUser.id}`)
          .limit(1)
          .maybeSingle();
        const identityIds = [...new Set([authUser.id, publicUser?.id].filter(Boolean))];
        const identityFilter = identityIds.map((id) => `user_id.eq.${id}`);
        if (authUser.email) identityFilter.push(`owner_email.ilike.${authUser.email}`);

        const [ownedResult, coOwnerResult, accountMemberResult, teamMemberResult] = await Promise.all([
          supabase.from('business_profiles').select('id').in('user_id', identityIds).or('status.eq.active,status.is.null'),
          supabase.from('business_co_owners').select('business_profile_id').or(identityFilter.join(',')).in('status', ['active', 'approved', 'verified']),
          supabase.from('business_account_members').select('business_profile_id').in('auth_user_id', identityIds).eq('employment_status', 'active'),
          supabase.from('business_team_members').select('business_profile_id').in('user_id', identityIds).eq('status', 'active')
        ]);

        if (ownedResult.error) {
          setError(ownedResult.error.message);
        } else {
          const candidateIds = [...new Set([
            ...(ownedResult.data || []).map((profile) => profile.id),
            ...(coOwnerResult.data || []).map((member) => member.business_profile_id),
            ...(accountMemberResult.data || []).map((member) => member.business_profile_id),
            ...(teamMemberResult.data || []).map((member) => member.business_profile_id)
          ].filter(Boolean))];

          const authorityChecks = await Promise.all(candidateIds.map(async (profileId) => {
            const { data: isAdministrator, error: authorityError } = await supabase.rpc('ican_business_admin', {
              p_business_profile_id: profileId
            });
            return !authorityError && isAdministrator ? profileId : null;
          }));
          const manageableProfileIds = authorityChecks.filter(Boolean);

          if (manageableProfileIds.length === 1) {
            linkedBusinessId = manageableProfileIds[0];

            const [{ error: storeLinkError }, { error: appLinkError }] = await Promise.all([
              supabase.from('supermarkets')
                .update({ pichin_business_profile_id: linkedBusinessId })
                .eq('id', supermarketId),
              supabase.from('business_app_links').upsert({
                business_profile_id: linkedBusinessId,
                app_key: 'supermarketa',
                source_entity_id: supermarketId,
                status: 'active',
                linked_by: authUser.id,
                metadata: { mode: 'existing_pichin_profile' }
              }, { onConflict: 'app_key,source_entity_id' })
            ]);

            if (storeLinkError) setError(storeLinkError.message);
            if (appLinkError && appLinkError.code !== '42P01') setError(appLinkError.message);
          } else if (manageableProfileIds.length > 1) {
            setError('More than one Pichin business profile is available. Choose the business profile to link in Supermarketa onboarding before opening CMMS.');
          }
        }
      }

      // Small Supermarketa stores do not need to leave POS to bootstrap the
      // shared authority profile. This runs only when the owner has no Pichin
      // business profile at all, never as a replacement for an existing one.
      if (!linkedBusinessId && authUser && (staff || []).length < 3) {
        const { data: createdProfile, error: profileError } = await supabase
          .from('business_profiles')
          .insert({
            user_id: authUser.id,
            business_name: businessName || 'Supermarketa store',
            business_type: 'Sole Proprietorship',
            description: 'Small Supermarketa business operations profile',
            status: 'active',
            metadata: { source: 'supermarketa_small_team', supermarket_id: supermarketId }
          })
          .select('id')
          .single();

        linkedBusinessId = createdProfile?.id || null;
        if (profileError) setError(profileError.message);
        if (linkedBusinessId) {
          await supabase.from('business_co_owners').insert({
            business_profile_id: linkedBusinessId,
            owner_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Store administrator',
            owner_email: authUser.email,
            user_id: authUser.id,
            ownership_share: 100,
            role: 'owner',
            status: 'active',
            verification_status: 'verified'
          });
          await supabase.from('business_app_links').upsert({
            business_profile_id: linkedBusinessId,
            app_key: 'supermarketa',
            source_entity_id: supermarketId,
            status: 'active',
            linked_by: authUser.id,
            metadata: { mode: 'small_team_auto_link' }
          }, { onConflict: 'app_key,source_entity_id' });
          await supabase.from('business_account_members').upsert({
            business_profile_id: linkedBusinessId,
            auth_user_id: authUser.id,
            employment_status: 'active',
            job_title: 'Administrator',
            permissions: { manage_business: true, manage_payroll: true, manage_transport: true },
            invited_by: authUser.id,
            joined_at: new Date().toISOString()
          }, { onConflict: 'business_profile_id,auth_user_id' });
          await supabase.from('supermarkets').update({ pichin_business_profile_id: linkedBusinessId }).eq('id', supermarketId);
        }
      }

      if (active && linkedBusinessId) {
        const { data: compensation } = await supabase
          .from('business_compensation_profiles')
          .select('id, employee_user_id, base_salary, currency, pay_type, payroll_status')
          .eq('business_profile_id', linkedBusinessId)
          .order('effective_from', { ascending: false });
        if (compensation === null) setError('Payroll is temporarily unavailable. Please refresh this operations page.');
        setResolvedBusinessProfileId(linkedBusinessId);
        setEmployees(staff || []);
        setPayroll(compensation || []);

        const [{ data: contracts, error: contractsError }, { data: requests, error: requestsError }, { data: usage, error: usageError }] = await Promise.all([
          supabase.from('mbg_corporate_transport_contracts')
            .select('id, contract_name, billing_cycle, currency, status')
            .eq('business_profile_id', linkedBusinessId)
            .eq('status', 'active')
            .order('created_at', { ascending: false }),
          supabase.from('mbg_corporate_ride_requests')
            .select('id, contract_id, ride_count, requested_vehicle_type, pickup_location, dropoff_location, scheduled_for, status, created_at')
            .eq('business_profile_id', linkedBusinessId)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase.rpc('mbg_company_transport_usage', {
            p_business_profile_id: linkedBusinessId,
            p_period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            p_period_end: new Date().toISOString()
          })
        ]);
        if (contractsError && contractsError.code !== '42P01') setError(contractsError.message);
        if (requestsError && requestsError.code !== '42P01') setError(requestsError.message);
        if (usageError && usageError.code !== '42P01') setError(usageError.message);
        setTransportContracts(contracts || []);
        setTransportRequests(requests || []);
        setTransportUsage(usage || []);
        setTransportForm((previous) => ({
          ...previous,
          contract_id: previous.contract_id || contracts?.[0]?.id || ''
        }));
      }

      if (active) {
        setPlan(data?.plan || 'basic');
        setLoading(false);
      }
    };
    loadPlan();
    return () => { active = false; };
  }, [supermarketId, businessProfileId, businessName]);

  const savePayroll = async (event) => {
    event.preventDefault();
    if (!resolvedBusinessProfileId || !selectedEmployee || Number(salary) <= 0) return;
    setSaving(true); setError(''); setMessage('');
    const { data: authData } = await supabase.auth.getUser();
    const { error: saveError } = await supabase.from('business_compensation_profiles').upsert({
      business_profile_id: resolvedBusinessProfileId,
      employee_user_id: selectedEmployee,
      base_salary: Number(salary),
      currency: 'UGX',
      pay_type: 'monthly',
      payroll_status: 'on_pay',
      created_by: authData?.user?.id || null
    }, { onConflict: 'business_profile_id,employee_user_id,effective_from' });
    if (saveError) setError(saveError.message);
    else {
      setMessage('Payroll saved in the shared business account.');
      setSalary('');
      const { data } = await supabase.from('business_compensation_profiles').select('id, employee_user_id, base_salary, currency, pay_type, payroll_status').eq('business_profile_id', resolvedBusinessProfileId);
      setPayroll(data || []);
    }
    setSaving(false);
  };

  const submitTransportRequest = async (event) => {
    event.preventDefault();
    const contract = transportContracts.find((item) => item.id === transportForm.contract_id);
    if (!resolvedBusinessProfileId || !contract || !transportForm.pickup.trim() || !transportForm.dropoff.trim()) {
      setError('Select an active transport contract and enter pickup and drop-off locations.');
      return;
    }
    setSaving(true); setError(''); setMessage('');
    const { data: authData } = await supabase.auth.getUser();
    const { data, error: requestError } = await supabase.from('mbg_corporate_ride_requests').insert({
      contract_id: contract.id,
      business_profile_id: resolvedBusinessProfileId,
      requested_by: authData?.user?.id || null,
      ride_count: Math.max(1, Number(transportForm.ride_count) || 1),
      requested_vehicle_type: transportForm.vehicle_type,
      recurrence: transportForm.recurrence,
      pickup_location: transportForm.pickup.trim(),
      dropoff_location: transportForm.dropoff.trim(),
      scheduled_for: transportForm.scheduled_at || null,
      status: 'pending'
    }).select('id, contract_id, ride_count, requested_vehicle_type, pickup_location, dropoff_location, scheduled_for, status, created_at').single();
    if (requestError) setError(requestError.message);
    else {
      setTransportRequests((previous) => [data, ...previous]);
      setTransportForm((previous) => ({ ...previous, ride_count: 1, pickup: '', dropoff: '', scheduled_at: '' }));
      setMessage('Transport request submitted for dispatch.');
    }
    setSaving(false);
  };

  const assignTransportWorker = async (event) => {
    event.preventDefault();
    if (!resolvedBusinessProfileId || !transportWorkerEmail.trim()) {
      setError('Enter the worker Gmail used to sign in to BodaGo or Supermarkera.');
      return;
    }
    setSaving(true); setError(''); setMessage('');
    const { error: allocationError } = await supabase.rpc('mbg_allocate_company_transport_worker', {
      p_business_profile_id: resolvedBusinessProfileId,
      p_employee_email: transportWorkerEmail.trim(),
      p_starts_at: new Date(transportStartsAt).toISOString(),
      p_ends_at: transportEndsAt ? new Date(transportEndsAt).toISOString() : null,
      p_billing_mode: transportBillingMode,
      p_daily_start_time: transportDailyStart,
      p_daily_end_time: transportDailyEnd
    });
    if (allocationError) setError(allocationError.message);
    else {
      setTransportWorkerEmail('');
      setTransportEndsAt('');
      setMessage('Worker assigned. They can book from BodaGo or Supermarkera during the approved hours; the company wallet will pay.');
    }
    setSaving(false);
  };

  const isEnterprise = plan === 'enterprise';
  // Keep the small-team operations view available, but do not use team size as
  // an authorization rule. A newly provisioned business administrator must be
  // able to open the shared CMMS workspace immediately.
  const requiresFullCmms = employees.length >= 3;

  const openCmms = () => {
    if (!resolvedBusinessProfileId) {
      setError('Your business profile is still being prepared. Refresh this page and try again.');
      return;
    }

    // CMMS runs on a different web origin, so it cannot read Supermarketa's
    // local session storage. Preserve the shared business identity in the URL
    // and let CMMS authenticate the same user against the shared database.
    const cmmsUrl = new URL(ICANERA_CMMS_URL, window.location.origin);
    cmmsUrl.searchParams.set('business_profile_id', resolvedBusinessProfileId);
    cmmsUrl.searchParams.set('source_app', 'supermarketa');
    window.open(cmmsUrl.toString(), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 p-5 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-indigo-200">
              <FiBriefcase />
              <span className="text-xs font-semibold uppercase tracking-wider">Business operations</span>
            </div>
            <h2 className="text-2xl font-bold">{businessName || 'Store'} workforce tools</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Manage employees, payroll, assets, fleet and transport in the shared CMMS workspace.
            </p>
          </div>
          <span className="rounded-full border border-indigo-300/30 bg-indigo-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-100">
            {loading ? 'Checking plan…' : `${plan} plan`}
          </span>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!resolvedBusinessProfileId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Complete the business profile to activate payroll and transport.</p>
          <p className="mt-1">The Pichin business profile is the administrator authority shared with CMMS. POS access is unchanged.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <OperationCard
          icon={FiUsers}
          title="Payroll"
          description="Employees, compensation, payroll periods and approvals."
          color="emerald"
           onClick={() => {
             if (!resolvedBusinessProfileId) {
               setError('The small-team business profile is still being prepared. Refresh this page and try again.');
               return;
             }
             setActiveOperation('payroll');
             document.getElementById('simple-payroll-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
           }}
           disabled={loading || requiresFullCmms}
        />
        <OperationCard
          icon={FiTruck}
          title="Transport & fleet"
          description="Assets, fleet maintenance and BodaGo transport requests."
          color="orange"
           onClick={() => {
             if (!resolvedBusinessProfileId) {
               setError('The small-team business profile is still being prepared. Refresh this page and try again.');
               return;
             }
             setActiveOperation('transport');
             setMessage('Transport is available from this Supermarketa operations screen. Use the full CMMS workspace only when your team reaches three workers.');
           }}
           disabled={loading || requiresFullCmms}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">{isEnterprise ? 'Enterprise CMMS workspace' : 'Shared CMMS workspace'}</p>
            <p className="text-sm text-slate-500">
               {requiresFullCmms
                ? 'Use the full ICANera CMMS workspace for payroll, assets and transport.'
                : 'Simple stores can work here or open the full CMMS workspace at any time.'}
            </p>
          </div>
          <button
            type="button"
             onClick={openCmms}
             disabled={loading || !resolvedBusinessProfileId}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open ICANera CMMS <FiExternalLink size={15} />
          </button>
        </div>
      </div>

      {!requiresFullCmms && resolvedBusinessProfileId && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section id="simple-payroll-form" className={`rounded-2xl border bg-white p-5 shadow-sm ${activeOperation === 'payroll' ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-emerald-200'}`}>
            <div className="mb-4 flex items-center gap-2 text-emerald-700"><FiDollarSign /><h3 className="text-lg font-bold text-slate-900">Simple payroll</h3></div>
            {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            {message && <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
            <form onSubmit={savePayroll} className="space-y-3">
              <select required value={selectedEmployee} onChange={(event) => setSelectedEmployee(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" style={{ colorScheme: 'light' }}><option value="" className="bg-white text-slate-900">Select worker</option>{employees.map(employee => <option key={employee.id} value={employee.id} className="bg-white text-slate-900">{employee.full_name || employee.email}</option>)}</select>
              <input required min="1" type="number" value={salary} onChange={(event) => setSalary(event.target.value)} placeholder="Monthly salary (UGX)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
              <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? <FiLoader className="animate-spin" /> : <FiCheck />} Save payroll</button>
            </form>
            <div className="mt-5 space-y-2">{payroll.map(record => <div key={record.id} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm text-slate-900"><span className="font-medium text-slate-900">{employees.find(employee => employee.id === record.employee_user_id)?.full_name || employees.find(employee => employee.id === record.employee_user_id)?.email || 'Worker'}</span><strong className="text-slate-900">UGX {Number(record.base_salary || 0).toLocaleString()}</strong></div>)}</div>
          </section>
          <section className={`rounded-2xl border bg-white p-5 shadow-sm ${activeOperation === 'transport' ? 'border-orange-400 ring-2 ring-orange-100' : 'border-orange-200'}`}>
            <div className="mb-4 flex items-center gap-2 text-orange-700"><FiTruck /><h3 className="text-lg font-bold text-slate-900">Simple transport</h3></div>
            <form onSubmit={assignTransportWorker} className="mb-5 space-y-3 rounded-lg border border-orange-200 bg-orange-50/50 p-3">
              <p className="text-sm text-orange-800">Assign the worker here. The worker places each ride order from their own BodaGo/Supermarkera customer page.</p>
              <select required value={transportWorkerEmail} onChange={(event) => setTransportWorkerEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="">Select existing employee</option>{employees.filter(employee => employee.email).map(employee => <option key={employee.id} value={employee.email}>{employee.full_name || employee.email} — {employee.email}</option>)}</select>
              <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-600">Assignment starts<input required type="datetime-local" value={transportStartsAt} onChange={(event) => setTransportStartsAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label><label className="text-sm text-slate-600">Assignment ends<input type="datetime-local" value={transportEndsAt} onChange={(event) => setTransportEndsAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label></div>
              <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm text-slate-600">Daily from<input required type="time" value={transportDailyStart} onChange={(event) => setTransportDailyStart(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label><label className="text-sm text-slate-600">Daily until<input required type="time" value={transportDailyEnd} onChange={(event) => setTransportDailyEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label><label className="text-sm text-slate-600">Billing<select value={transportBillingMode} onChange={(event) => setTransportBillingMode(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="monthly">Monthly</option><option value="per_ride">Per ride</option></select></label></div>
              <button disabled={saving} className="rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Assigning...' : 'Assign worker transport'}</button>
            </form>
            <div className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"><div><h4 className="font-semibold text-slate-900">Employee transport usage</h4><p className="text-xs text-slate-500">Last 30 days: orders, completed rides, total fare, and order times.</p></div>{transportUsage.length === 0 ? <p className="text-sm text-slate-500">No assigned employees or rides recorded yet.</p> : transportUsage.map(row => <div key={row.allocation_id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong className="text-slate-900">{row.employee_email}</strong><span className="text-orange-700">{row.ride_count} orders</span></div><p className="text-xs text-slate-600">{row.completed_ride_count} completed · UGX {Number(row.total_fare || 0).toLocaleString()} · {row.last_order_at ? 'Last order ' + new Date(row.last_order_at).toLocaleString() : 'No orders yet'}</p>{row.order_times?.length > 0 && <details className="mt-1"><summary className="cursor-pointer text-xs text-orange-700">View order times</summary>{row.order_times.map(order => <p key={order.ride_id} className="mt-1 text-xs text-slate-500">{new Date(order.ordered_at).toLocaleString()} · {order.pickup} → {order.dropoff}</p>)}</details>}</div>)}</div>
            {transportContracts.length === 0 ? <p className="hidden rounded-lg bg-orange-50 p-3 text-sm text-orange-800">No active transport contract is configured yet.</p> : <form onSubmit={submitTransportRequest} className="hidden space-y-3">
              <select required value={transportForm.contract_id} onChange={(event) => setTransportForm({ ...transportForm, contract_id: event.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" style={{ colorScheme: 'light' }}><option value="">Select contract</option>{transportContracts.map(contract => <option key={contract.id} value={contract.id}>{contract.contract_name} — {contract.billing_cycle}</option>)}</select>
              <div className="grid gap-3 sm:grid-cols-2"><input required value={transportForm.pickup} onChange={(event) => setTransportForm({ ...transportForm, pickup: event.target.value })} placeholder="Pickup location" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /><input required value={transportForm.dropoff} onChange={(event) => setTransportForm({ ...transportForm, dropoff: event.target.value })} placeholder="Drop-off location" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></div>
              <div className="grid gap-3 sm:grid-cols-3"><select value={transportForm.vehicle_type} onChange={(event) => setTransportForm({ ...transportForm, vehicle_type: event.target.value })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="car">Car</option><option value="motorcycle">Motorcycle</option><option value="van">Van</option><option value="truck">Truck</option></select><input min="1" type="number" value={transportForm.ride_count} onChange={(event) => setTransportForm({ ...transportForm, ride_count: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900" placeholder="Rides" /><input type="datetime-local" value={transportForm.scheduled_at} onChange={(event) => setTransportForm({ ...transportForm, scheduled_at: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></div>
              <button disabled={saving} className="rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Request transport'}</button>
            </form>}
            <div className="mt-5 space-y-2">{transportRequests.map(request => <div key={request.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-900"><div className="flex justify-between gap-2"><strong>{request.pickup_location} → {request.dropoff_location}</strong><span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs capitalize text-orange-800">{request.status}</span></div><p className="mt-1 text-slate-600">{request.ride_count} ride{request.ride_count === 1 ? '' : 's'} · {request.requested_vehicle_type || 'Any'}{request.scheduled_for ? ` · ${new Date(request.scheduled_for).toLocaleString()}` : ''}</p></div>)}</div>
          </section>
        </div>
      )}
    </div>
  );
}

function OperationCard({ icon: Icon, title, description, color, onClick, disabled }) {
  const colors = color === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400'
    : 'border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-400';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group rounded-2xl border-2 p-5 text-left transition ${colors} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-xl bg-white p-3 shadow-sm">{React.createElement(Icon, { size: 24 })}</span>
        <FiArrowRight className="transition-transform group-hover:translate-x-1" />
      </div>
      <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide">Open in CMMS</p>
    </button>
  );
}
