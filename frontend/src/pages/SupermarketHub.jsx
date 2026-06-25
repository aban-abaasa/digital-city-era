import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';

// ─── tiny helpers ────────────────────────────────────────────────────────────
const fmtUGX = n => 'UGX ' + Number(n || 0).toLocaleString();
const fmtIcan = n => Number(n || 0).toFixed(4) + ' ₡';

const TABS = [
  { id: 'overview',   label: '📊 Overview' },
  { id: 'staff',      label: '👥 Staff' },
  { id: 'suppliers',  label: '🚚 Suppliers' },
  { id: 'deliveries', label: '🛵 Deliveries' },
  { id: 'wallet',     label: '₡ ICAN Wallet' },
];

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    invited: 'bg-blue-100 text-blue-700',
    inactive: 'bg-slate-100 text-slate-500',
    suspended: 'bg-red-100 text-red-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    in_transit: 'bg-blue-100 text-blue-700',
    assigned: 'bg-cyan-100 text-cyan-700',
    cancelled: 'bg-slate-100 text-slate-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] || 'bg-slate-100 text-slate-600'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function SupermarketHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const supermarketId = searchParams.get('id');

  const [tab, setTab]         = useState('overview');
  const [supermarket, setSM]  = useState(null);
  const [myMarkets, setMine]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  // data per tab
  const [staff, setStaff]           = useState([]);
  const [applications, setApps]     = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [wallet, setWallet]         = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  // ── load supermarket ──────────────────────────────────────────────────────
  const loadSupermarket = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      if (supermarketId) {
        const { data } = await supabase
          .from('supermarkets').select('*').eq('id', supermarketId).single();
        setSM(data);
      } else {
        // Load all supermarkets owned by or staffed by this user
        const { data: owned } = await supabase
          .from('supermarkets').select('*').eq('owner_user_id', session.user.id);
        const { data: staffed } = await supabase
          .from('supermarket_staff').select('supermarket_id, role, status')
          .eq('user_id', session.user.id).eq('status', 'active');
        const staffIds = (staffed || []).map(s => s.supermarket_id);
        let extra = [];
        if (staffIds.length) {
          const { data } = await supabase
            .from('supermarkets').select('*').in('id', staffIds);
          extra = data || [];
        }
        const all = [...(owned || []), ...extra.filter(e => !(owned || []).find(o => o.id === e.id))];
        setMine(all);
        if (all.length === 1) setSM(all[0]);
      }
    } catch (e) {
      toast.error('Failed to load supermarket data');
    } finally {
      setLoading(false);
    }
  }, [session, supermarketId]);

  useEffect(() => { loadSupermarket(); }, [loadSupermarket]);

  // ── load tab data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supermarket) return;
    const id = supermarket.id;

    if (tab === 'staff') {
      supabase.from('supermarket_staff').select('*')
        .eq('supermarket_id', id).order('created_at', { ascending: false })
        .then(({ data }) => setStaff(data || []));
    }
    if (tab === 'suppliers') {
      supabase.from('supplier_applications').select('*')
        .eq('supermarket_id', id).order('created_at', { ascending: false })
        .then(({ data }) => setApps(data || []));
    }
    if (tab === 'deliveries') {
      supabase.from('mybodaguy_delivery_requests').select('*')
        .eq('supermarket_id', id).order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => setDeliveries(data || []));
    }
    if (tab === 'wallet') {
      supabase.from('ican_user_wallets').select('*')
        .eq('user_id', session?.user?.id).single()
        .then(({ data }) => setWallet(data));
    }
  }, [tab, supermarket, session]);

  // ── not signed in ─────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Please sign in to access your supermarket dashboard.</p>
          <button onClick={() => navigate('/login')}
            className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold">Sign In</button>
        </div>
      </div>
    );
  }

  // ── no supermarket yet ────────────────────────────────────────────────────
  if (!loading && !supermarket && myMarkets.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🏪</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Supermarket Found</h2>
          <p className="text-slate-500 mb-6">Register your supermarket on the platform and start earning ICAN on every sale.</p>
          <button onClick={() => navigate('/onboard')}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl w-full">
            Register Your Supermarket
          </button>
        </div>
      </div>
    );
  }

  // ── multi-supermarket selector ────────────────────────────────────────────
  if (!supermarket && myMarkets.length > 1) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Select a Supermarket</h2>
          <div className="space-y-3">
            {myMarkets.map(m => (
              <button key={m.id} onClick={() => setSM(m)}
                className="w-full text-left p-4 border border-slate-200 rounded-xl hover:border-emerald-400 transition-colors">
                <p className="font-semibold text-slate-800">{m.name}</p>
                <p className="text-sm text-slate-500">{m.city}, {m.country} · <Badge status={m.status} /></p>
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/onboard')}
            className="mt-4 w-full py-3 border-2 border-dashed border-emerald-300 text-emerald-600 rounded-xl font-semibold hover:bg-emerald-50">
            + Add Another Supermarket
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏪</span>
            <div>
              <p className="font-bold text-slate-800 text-sm sm:text-base">{supermarket?.name}</p>
              <p className="text-xs text-slate-400">{supermarket?.city} · <Badge status={supermarket?.status} /></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {myMarkets.length > 1 && (
              <button onClick={() => setSM(null)}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                Switch
              </button>
            )}
            <button onClick={() => navigate('/onboard')}
              className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-200">
              + New Store
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tab nav */}
        <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                ${tab === t.id ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && <Overview supermarket={supermarket} navigate={navigate} />}

        {/* ── STAFF ── */}
        {tab === 'staff' && (
          <StaffTab
            supermarket={supermarket}
            staff={staff}
            session={session}
            onRefresh={() => setTab('staff')}
          />
        )}

        {/* ── SUPPLIERS ── */}
        {tab === 'suppliers' && (
          <SuppliersTab
            applications={applications}
            onRefresh={() => setTab('suppliers')}
          />
        )}

        {/* ── DELIVERIES ── */}
        {tab === 'deliveries' && (
          <DeliveriesTab
            supermarket={supermarket}
            deliveries={deliveries}
            onRefresh={() => setTab('deliveries')}
          />
        )}

        {/* ── ICAN WALLET ── */}
        {tab === 'wallet' && <WalletTab wallet={wallet} navigate={navigate} />}
      </div>
    </div>
  );
}

// ─── OVERVIEW ────────────────────────────────────────────────────────────────
function Overview({ supermarket, navigate }) {
  const [stats, setStats] = useState({ staff: 0, suppliers: 0, deliveries: 0, sales: 0 });

  useEffect(() => {
    if (!supermarket) return;
    Promise.all([
      supabase.from('supermarket_staff').select('id', { count: 'exact', head: true }).eq('supermarket_id', supermarket.id).eq('status', 'active'),
      supabase.from('supplier_applications').select('id', { count: 'exact', head: true }).eq('supermarket_id', supermarket.id).eq('status', 'pending'),
      supabase.from('mybodaguy_delivery_requests').select('id', { count: 'exact', head: true }).eq('supermarket_id', supermarket.id).eq('status', 'pending'),
    ]).then(([s, sup, del]) => {
      setStats({ staff: s.count || 0, suppliers: sup.count || 0, deliveries: del.count || 0 });
    });
  }, [supermarket]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="👥" label="Active Staff"       value={stats.staff}      color="blue" />
        <StatCard icon="🚚" label="Pending Suppliers"  value={stats.suppliers}  color="yellow" />
        <StatCard icon="🛵" label="Pending Deliveries" value={stats.deliveries} color="orange" />
        <StatCard icon="₡"  label="ICAN Wallet"        value="Active"           color="emerald" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <InfoCard
          title="Staff invite link"
          desc="Share this with your managers and cashiers"
          action="Copy Link"
          onAction={() => {
            navigator.clipboard.writeText(`${window.location.origin}/join/${supermarket?.onboarding_token}`);
            toast.success('Invite link copied!');
          }}
          icon="🔗"
        />
        <InfoCard
          title="Supplier applications"
          desc="Suppliers from across the platform can apply to supply your store"
          action="View Applications"
          onAction={() => {}}
          icon="📋"
        />
      </div>

      <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="text-4xl">₡</div>
          <div>
            <p className="font-bold text-lg">ICAN Blockchain Rewards</p>
            <p className="text-emerald-100 text-sm">
              1% cashback on every customer purchase • Riders earn ICAN per delivery •
              Suppliers earn ICAN on approval • 10 ICAN joining bonus
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/ican-wallet')}
          className="mt-4 px-5 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold"
        >
          View My ICAN Wallet →
        </button>
      </div>
    </div>
  );
}

// ─── STAFF TAB ────────────────────────────────────────────────────────────────
function StaffTab({ supermarket, staff, session, onRefresh }) {
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState('cashier');
  const [loading, setLoading] = useState(false);

  const invite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('invite_supermarket_staff', {
        p_supermarket_id: supermarket.id,
        p_email:          email.trim().toLowerCase(),
        p_role:           role,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      toast.success(`${email} invited as ${role}`);
      setEmail('');
      onRefresh();
    } catch (e) {
      toast.error(e.message || 'Invite failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="font-semibold text-slate-700 mb-4">Invite Staff Member</h3>
        <p className="text-sm text-slate-400 mb-4">Only managers and cashiers can be invited. The owner controls the account.</p>
        <div className="flex gap-3 flex-wrap">
          <input
            type="email"
            placeholder="staff@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1 min-w-48 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-400"
          />
          <select value={role} onChange={e => setRole(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none">
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
          </select>
          <button onClick={invite} disabled={loading || !email}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40">
            {loading ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Or share the invite link:
          <button className="ml-1 text-cyan-600 hover:underline"
            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join/${supermarket?.onboarding_token}`); toast.success('Copied!'); }}>
            Copy link
          </button>
        </p>
      </div>

      {/* Staff list */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">Staff ({staff.length})</h3>
        </div>
        {staff.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No staff invited yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {staff.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.invited_email}</p>
                  <p className="text-xs text-slate-400">
                    Invited {new Date(s.created_at).toLocaleDateString()}
                    {s.joined_at && ` · Joined ${new Date(s.joined_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 capitalize">{s.role}</span>
                  <Badge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SUPPLIERS TAB ────────────────────────────────────────────────────────────
function SuppliersTab({ applications, onRefresh }) {
  const [reviewing, setReviewing] = useState(null);
  const [reason, setReason]       = useState('');

  const review = async (id, approve) => {
    setReviewing(id);
    try {
      const { data, error } = await supabase.rpc('approve_supplier_application', {
        p_application_id: id,
        p_approve:        approve,
        p_reason:         reason || null,
      });
      if (error) throw error;
      toast.success(approve ? 'Supplier approved — they earned 5 ICAN!' : 'Application rejected');
      setReason('');
      onRefresh();
    } catch (e) {
      toast.error(e.message || 'Review failed');
    } finally {
      setReviewing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">Supplier Applications ({applications.length})</h3>
        <p className="text-xs text-slate-400">Approved suppliers earn 5 ICAN coins automatically</p>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-slate-400">
          <p className="text-4xl mb-3">📋</p>
          <p>No supplier applications yet.</p>
          <p className="text-sm mt-1">Suppliers from mybodaguy and across the platform can apply here.</p>
        </div>
      ) : (
        applications.map(app => (
          <div key={app.id} className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="font-semibold text-slate-800">{app.business_name}</p>
                <p className="text-sm text-slate-500">{app.contact_name} · {app.contact_email} · {app.contact_phone}</p>
              </div>
              <Badge status={app.status} />
            </div>
            {app.product_categories?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {app.product_categories.map(c => (
                  <span key={c} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
            )}
            {app.message && <p className="text-sm text-slate-600 mb-3 italic">"{app.message}"</p>}
            {app.status === 'pending' && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => review(app.id, true)}
                  disabled={reviewing === app.id}
                  className="px-4 py-1.5 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-40">
                  Approve + 5 ICAN
                </button>
                <button
                  onClick={() => review(app.id, false)}
                  disabled={reviewing === app.id}
                  className="px-4 py-1.5 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 disabled:opacity-40">
                  Reject
                </button>
              </div>
            )}
            {app.status !== 'pending' && app.reviewed_at && (
              <p className="text-xs text-slate-400">Reviewed {new Date(app.reviewed_at).toLocaleDateString()}</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─── DELIVERIES TAB ───────────────────────────────────────────────────────────
function DeliveriesTab({ supermarket, deliveries, onRefresh }) {
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', deliveryAddress: '',
    deliveryNotes: '', itemsSummary: '', totalUgx: '',
  });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const request = async () => {
    if (!form.customerName || !form.customerPhone || !form.deliveryAddress) {
      toast.error('Customer name, phone, and delivery address are required');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('request_mbg_delivery', {
        p_supermarket_id:   supermarket.id,
        p_transaction_id:   null,
        p_customer_name:    form.customerName,
        p_customer_phone:   form.customerPhone,
        p_delivery_address: form.deliveryAddress,
        p_delivery_notes:   form.deliveryNotes,
        p_items_summary:    form.itemsSummary,
        p_total_ugx:        parseFloat(form.totalUgx) || 0,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      toast.success('Delivery request sent to mybodaguy riders!');
      setShowForm(false);
      setForm({ customerName: '', customerPhone: '', deliveryAddress: '', deliveryNotes: '', itemsSummary: '', totalUgx: '' });
      onRefresh();
    } catch (e) {
      toast.error(e.message || 'Failed to create delivery request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">mybodaguy Deliveries</h3>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-gradient-to-r from-orange-400 to-yellow-400 text-white text-sm font-semibold rounded-xl hover:opacity-90">
          + Request Delivery
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
          <h4 className="font-semibold text-slate-700 mb-2">New Delivery Request</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder="Customer name *" value={form.customerName} onChange={e => set('customerName', e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
            <input placeholder="Customer phone *" value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <input placeholder="Delivery address *" value={form.deliveryAddress} onChange={e => set('deliveryAddress', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
          <input placeholder="Items summary (e.g. Milk x2, Bread x1)" value={form.itemsSummary} onChange={e => set('itemsSummary', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder="Order total (UGX)" type="number" value={form.totalUgx} onChange={e => set('totalUgx', e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
            <input placeholder="Delivery notes (optional)" value={form.deliveryNotes} onChange={e => set('deliveryNotes', e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-sm text-orange-700">
            🛵 Rider earns <strong>1 ICAN</strong> (= UGX 5,000 delivery fee) on completion
          </div>
          <div className="flex gap-3">
            <button onClick={request} disabled={loading}
              className="flex-1 py-2.5 bg-gradient-to-r from-orange-400 to-yellow-400 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-40">
              {loading ? 'Sending…' : 'Send to mybodaguy'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {deliveries.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-slate-400">
          <p className="text-4xl mb-3">🛵</p>
          <p>No deliveries yet.</p>
          <p className="text-sm mt-1">Riders from mybodaguy pick up pending deliveries from here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.map(d => (
            <div key={d.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{d.customer_name}</p>
                  <p className="text-sm text-slate-500">{d.customer_phone} · {d.delivery_address}</p>
                  {d.items_summary && <p className="text-xs text-slate-400 mt-1">{d.items_summary}</p>}
                </div>
                <div className="text-right">
                  <Badge status={d.status} />
                  <p className="text-xs text-slate-400 mt-1">{fmtUGX(d.total_ugx)}</p>
                </div>
              </div>
              {d.rider_name && (
                <p className="text-xs text-blue-600 mt-2">🛵 {d.rider_name}</p>
              )}
              <p className="text-xs text-slate-300 mt-2">{new Date(d.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── WALLET TAB ───────────────────────────────────────────────────────────────
function WalletTab({ wallet, navigate }) {
  if (!wallet) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
        <p className="text-4xl mb-3">₡</p>
        <p className="text-slate-600 mb-4">No ICAN wallet found. Register a supermarket to get one.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl p-6 text-white">
        <p className="text-sm text-emerald-100 mb-1">ICAN Balance</p>
        <p className="text-4xl font-bold">{fmtIcan(wallet.ican_balance)}</p>
        <p className="text-emerald-200 text-sm mt-1">≈ {fmtUGX(wallet.ican_balance * 5000)}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{fmtIcan(wallet.total_earned)}</p>
          <p className="text-xs text-slate-500 mt-1">Total Earned</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{fmtIcan(wallet.total_tithe_paid)}</p>
          <p className="text-xs text-slate-500 mt-1">Tithe Paid (10%)</p>
        </div>
      </div>
      <button onClick={() => navigate('/ican-wallet')}
        className="w-full py-3 bg-white border border-emerald-200 text-emerald-600 font-semibold rounded-xl hover:bg-emerald-50">
        Full ICAN Wallet →
      </button>
    </div>
  );
}

// ─── SMALL UI BITS ────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    orange: 'bg-orange-50 text-orange-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 text-xl ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function InfoCard({ title, desc, action, onAction, icon }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
      <div className="text-3xl">{icon}</div>
      <div className="flex-1">
        <p className="font-semibold text-slate-800 text-sm">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      <button onClick={onAction}
        className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-semibold shrink-0">
        {action}
      </button>
    </div>
  );
}
