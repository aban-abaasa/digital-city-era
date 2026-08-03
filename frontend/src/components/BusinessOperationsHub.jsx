import React, { useEffect, useState } from 'react';
import { FiArrowRight, FiBriefcase, FiExternalLink, FiTruck, FiUsers } from 'react-icons/fi';
import { supabase } from '../services/supabase';

const ICANERA_CMMS_URL = import.meta.env.VITE_ICANERA_CMMS_URL || 'https://icanera.com/#cmms';

/**
 * Supermarketa entry point for workforce operations.
 *
 * Payroll, fleet and transport remain owned by CMMS. This component is
 * intentionally a thin hand-off so the POS app does not create a second,
 * conflicting payroll or transport ledger.
 */
export default function BusinessOperationsHub({ supermarketId, businessProfileId, businessName }) {
  const [plan, setPlan] = useState('basic');
  const [loading, setLoading] = useState(true);

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

      if (active) {
        setPlan(data?.plan || 'basic');
        setLoading(false);
      }
    };
    loadPlan();
    return () => { active = false; };
  }, [supermarketId]);

  const openCmms = () => {
    window.open(ICANERA_CMMS_URL, '_blank', 'noopener,noreferrer');
  };

  const isEnterprise = plan === 'enterprise';

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

      {!businessProfileId && (
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
          onClick={openCmms}
          disabled={!businessProfileId}
        />
        <OperationCard
          icon={FiTruck}
          title="Transport & fleet"
          description="Assets, fleet maintenance and BodaGo transport requests."
          color="orange"
          onClick={openCmms}
          disabled={!businessProfileId}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">{isEnterprise ? 'Enterprise CMMS workspace' : 'Shared CMMS workspace'}</p>
            <p className="text-sm text-slate-500">
              {isEnterprise
                ? 'Enterprise stores should use the full ICANera CMMS workspace for payroll, assets and transport.'
                : 'Simple stores can use the same CMMS tools when they need them; your POS remains here.'}
            </p>
          </div>
          <button
            type="button"
            onClick={openCmms}
            disabled={!businessProfileId}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open ICANera CMMS <FiExternalLink size={15} />
          </button>
        </div>
      </div>
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
