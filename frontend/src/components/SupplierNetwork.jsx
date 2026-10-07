import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';
import SupplierBidRequests from './SupplierBidRequests';
import '../styles/supplier-classic.css';

const formatUgx = (value) => `UGX ${Number(value || 0).toLocaleString()}`;
const ORDER_PAYMENT = {
  paid: { label: 'Paid', tone: 'ok' },
  pending_approval: { label: 'Awaiting buyer approval', tone: 'warn' },
  not_requested: { label: 'Payment not requested', tone: '' },
  rejected: { label: 'Payment rejected', tone: 'bad' },
  cancelled: { label: 'Payment cancelled', tone: 'bad' },
};

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
        .select('id, order_number, quantity, unit_price, currency, status, payment_status, created_at, buyer_business_profile_id')
        .eq('supplier_business_profile_id', profileId)
        .order('created_at', { ascending: false });
      if (!cancelled) { setOrders(data || []); setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierProfile?.id, supplierProfile?.supplier_business_profile_id, supplierProfile?.business_profile_id, supplierProfile?.name]);

  return (
    <div className="spc">
      <section className="spc-hero">
        <p className="spc-eyebrow">One network · more opportunity</p>
        <h2>Global Supplier Network</h2>
        <p>Your business and catalog are discoverable by supermarkets, wholesalers, factories, schools, hospitals and project organisations. Publish once from My Catalog, bid on what buyers need, and receive orders here.</p>
      </section>

      <SupplierBidRequests supplierBusinessProfileId={businessProfileId} profileLoading={loading && !businessProfileId} supplierProfile={supplierProfile} />

      <section className="spc-card" aria-label="Incoming marketplace orders">
        <div className="spc-card-head">
          <div>
            <p className="spc-eyebrow">Buyer activity</p>
            <h3 className="spc-title">Incoming marketplace orders</h3>
            <p className="spc-sub" style={{ marginTop: 4 }}>Orders buyers placed with you directly or by awarding your bid.</p>
          </div>
          <span className="spc-icon-btn" aria-hidden="true"><RefreshCw size={18} className={loading ? 'spc-spin' : ''} /></span>
        </div>
        {loading ? (
          <p className="spc-sub">Loading orders…</p>
        ) : orders.length === 0 ? (
          <div className="spc-empty"><b>No marketplace orders yet</b><span>Keep your catalog available so buyers can discover your products, and bid on open requests above.</span></div>
        ) : (
          <div className="spc-list">
            {orders.map((order) => {
              const pay = ORDER_PAYMENT[order.payment_status];
              const total = (Number(order.quantity) || 0) * (Number(order.unit_price) || 0);
              return (
                <div key={order.id} className="spc-item">
                  <div className="spc-item-head" style={{ cursor: 'default' }}>
                    <div className="spc-item-main">
                      <p className="spc-item-title">{order.order_number}</p>
                      <p className="spc-item-meta">Qty {Number(order.quantity)} · {new Date(order.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="spc-item-side">
                      {total > 0 && <span className="spc-amount">{formatUgx(total)}</span>}
                      <span className="spc-badge info" style={{ textTransform: 'capitalize' }}>{String(order.status || '').replace(/_/g, ' ')}</span>
                      {pay && <span className={`spc-badge ${pay.tone}`}>{pay.label}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
