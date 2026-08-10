import React, { useEffect, useState } from 'react';
import { Globe2, PackageCheck, RefreshCw, ShoppingCart } from 'lucide-react';
import { supabase } from '../services/supabase';

export default function SupplierNetwork({ supplierProfile }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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
        if (!cancelled) { setOrders([]); setLoading(false); }
        return;
      }
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
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
        <div className="flex items-start gap-3">
          <Globe2 className="h-7 w-7 mt-1" />
          <div>
            <h2 className="text-xl font-bold">Global Supplier Network</h2>
            <p className="text-sm text-indigo-100 mt-1">Your business and catalog are discoverable by supermarkets, wholesalers, factories, schools, hospitals, and project organisations. No store-by-store application is required.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-5 text-sm">
          <div className="rounded-xl bg-white/10 p-3"><PackageCheck className="h-5 w-5 mb-1" /><p className="font-semibold">Publish once</p><p className="text-indigo-100 text-xs">Manage availability from My Catalog.</p></div>
          <div className="rounded-xl bg-white/10 p-3"><ShoppingCart className="h-5 w-5 mb-1" /><p className="font-semibold">Receive orders</p><p className="text-indigo-100 text-xs">Accept, quote, reject, or fulfil buyer orders.</p></div>
          <div className="rounded-xl bg-white/10 p-3"><Globe2 className="h-5 w-5 mb-1" /><p className="font-semibold">Supply anywhere</p><p className="text-indigo-100 text-xs">Your supplier identity stays separate from buyers.</p></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4"><div><h3 className="font-semibold text-gray-800">Incoming marketplace orders</h3><p className="text-xs text-gray-500 mt-1">Direct buyer relationships replace applications.</p></div><RefreshCw className={`h-4 w-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} /></div>
        {loading ? <p className="text-sm text-gray-400">Loading orders…</p> : orders.length === 0 ? <p className="text-sm text-gray-400">No direct marketplace orders yet. Keep your catalog available to be discovered.</p> : <div className="space-y-2">{orders.map(order => <div key={order.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><div><p className="font-medium text-gray-700">{order.order_number}</p><p className="text-xs text-gray-400">Qty {order.quantity} · {new Date(order.created_at).toLocaleDateString()}</p></div><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{order.status}</span></div>)}</div>}
      </div>
    </div>
  );
}
