import React, { useEffect, useState } from 'react';
import { Globe2, PackageCheck, RefreshCw, ShoppingCart } from 'lucide-react';
import { supabase } from '../services/supabase';
import SupplierBidRequests from './SupplierBidRequests';

export default function SupplierNetwork({ supplierProfile }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessProfileId, setBusinessProfileId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let profileId = supplierProfile?.supplier_business_profile_id || supplierProfile?.business_profile_id;
      if (!profileId && supplierProfile?.id) {
        const { data: profile } = await supabase
          .from('business_profiles')
          .select('id')
          .eq('user_id', supplierProfile.id)
          .eq('status', 'active')
          .contains('metadata', { source: 'supermarketa_supplier' })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        profileId = profile?.id;
      }
      if (!profileId && supplierProfile?.id && supplierProfile?.name) {
        const { data: createdProfileId } = await supabase.rpc('supplier_create_business_account', {
          p_business_name: supplierProfile.name,
          p_business_type: 'Sole Proprietorship',
          p_registration_number: null
        });
        profileId = createdProfileId;
      }
      if (!profileId) {
        if (!cancelled) { setOrders([]); setBusinessProfileId(null); setLoading(false); }
        return;
      }
      if (!cancelled) setBusinessProfileId(profileId);
      const { data } = await supabase
        .from('supplier_marketplace_orders')
        .select('id, order_number, quantity, unit_price, currency, status, created_at, buyer_business_profile_id')
        .eq('supplier_business_profile_id', profileId)
        .order('created_at', { ascending: false });
      if (!cancelled) { setOrders(data || []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [supplierProfile]);

  return (
    <div className="mx-auto w-full min-w-0 space-y-4 sm:space-y-6">
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-fuchsia-700 p-4 text-white shadow-xl shadow-indigo-950/15 sm:rounded-[2rem] sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10 bg-white/5 blur-[1px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-20 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-inner shadow-white/10 sm:mb-5 sm:h-12 sm:w-12 sm:rounded-2xl">
            <Globe2 className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200 sm:mb-2 sm:text-[11px] sm:tracking-[0.2em]">One network · more opportunity</p>
          <h2 className="max-w-2xl text-[1.65rem] font-bold leading-tight tracking-tight sm:text-3xl">Global Supplier Network</h2>
          <p className="mt-2.5 max-w-3xl text-[13px] leading-5 text-indigo-100 sm:mt-3 sm:text-base sm:leading-7">Your business and catalog are discoverable by supermarkets, wholesalers, factories, schools, hospitals, and project organisations. No store-by-store application is required.</p>
          <div className="mt-4 grid gap-2 sm:mt-6 sm:grid-cols-3 sm:gap-3">
            <FeatureCard icon={PackageCheck} title="Publish once" description="Manage availability from My Catalog." />
            <FeatureCard icon={ShoppingCart} title="Receive orders" description="Accept, quote, reject, or fulfil buyer orders." />
            <FeatureCard icon={Globe2} title="Supply anywhere" description="Your supplier identity stays separate from buyers." />
          </div>
        </div>
      </section>

      <SupplierBidRequests supplierBusinessProfileId={businessProfileId} />

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Buyer activity</p><h3 className="mt-1 font-semibold text-gray-900 dark:text-white">Incoming marketplace orders</h3><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">Direct buyer relationships replace applications.</p></div><span className="rounded-xl bg-indigo-50 p-2 dark:bg-indigo-950/60"><RefreshCw aria-label={loading ? 'Loading orders' : 'Orders loaded'} className={`h-4 w-4 text-indigo-600 dark:text-indigo-300 ${loading ? 'animate-spin' : ''}`} /></span></div>
        {loading ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-slate-800 dark:text-slate-400">Loading orders…</p> : orders.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-800/60"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300"><ShoppingCart className="h-5 w-5" /></div><p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Your next buyer could be anywhere</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-gray-500 dark:text-slate-400">No marketplace orders yet. Keep your catalog available so buyers can discover your products.</p></div> : <div className="space-y-2">{orders.map(order => <div key={order.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-slate-800"><div className="min-w-0"><p className="break-words font-medium text-gray-800 dark:text-slate-100">{order.order_number}</p><p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">Qty {order.quantity} · {new Date(order.created_at).toLocaleDateString()}</p></div><span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">{order.status}</span></div>)}</div>}
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.09] p-3 backdrop-blur-sm transition-colors hover:bg-white/[0.14] sm:min-h-28 sm:items-start sm:rounded-2xl sm:p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/10 sm:h-10 sm:w-10 sm:rounded-xl">
        <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
      </span>
      <div className="min-w-0"><p className="text-sm font-semibold leading-5 sm:text-base">{title}</p><p className="mt-0.5 text-[11px] leading-4 text-indigo-100 sm:mt-1 sm:text-sm sm:leading-5">{description}</p></div>
    </div>
  );
}
