import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiLogOut, FiShield, FiUsers, FiZap,
  FiRefreshCw, FiMoon, FiSun, FiStar,
  FiTrendingUp, FiDollarSign, FiCheckCircle,
  FiGift, FiToggleLeft, FiToggleRight,
  FiAlertTriangle, FiCopy, FiSearch,
  FiMapPin, FiCalendar, FiPackage, FiBarChart2,
  FiActivity, FiAward, FiMessageCircle, FiSend,
  FiGlobe, FiLock, FiTrash2, FiCheckSquare,
} from 'react-icons/fi';
import { supabase } from '../services/supabase';
import { useTheme } from '../contexts/ThemeContext';
import {
  listConversations,
  fetchMessages,
  sendMessage,
  markConversationRead,
  subscribeToAllConversations,
  subscribeToMessages,
} from '../services/chatService';
import {
  devListAllLandingMessages,
  devDeleteLandingMessage,
  devReplyToLandingMessage,
  devMarkCorrectAnswer,
  devGrantLandingBonus,
} from '../services/landingMessagesService';

const SESSION_KEY = 'dev_panel_auth';
const ICAN_TO_UGX = 5000;

// ─── Theme ───────────────────────────────────────────────────────────
const P = {
  dark: {
    shell:   'bg-[#060d17] text-white',
    header:  'bg-[#060d17]/90 border-white/10',
    card:    'bg-white/5 border-white/10',
    soft:    'bg-white/[0.04] border-white/8',
    input:   'bg-white/5 border-white/10 text-white placeholder:text-slate-600',
    muted:   'text-slate-400',
    label:   'text-slate-200',
    tab:     'text-slate-400 hover:text-white hover:bg-white/5',
    tabOn:   'border-violet-500 text-violet-400',
    tabOff:  'border-transparent',
    pill:    'bg-white/8 border-white/10 text-slate-300',
    divider: 'border-white/8',
    code:    'bg-slate-950 border-white/10 text-emerald-300',
    btn:     'bg-violet-600 hover:bg-violet-500 text-white',
    track:   'bg-white/10',
  },
  light: {
    shell:   'bg-slate-50 text-slate-900',
    header:  'bg-white/95 border-slate-200',
    card:    'bg-white border-slate-200 shadow-sm',
    soft:    'bg-slate-50 border-slate-200',
    input:   'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400',
    muted:   'text-slate-500',
    label:   'text-slate-800',
    tab:     'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
    tabOn:   'border-violet-600 text-violet-600',
    tabOff:  'border-transparent',
    pill:    'bg-slate-100 border-slate-200 text-slate-600',
    divider: 'border-slate-200',
    code:    'bg-slate-900 border-slate-700 text-emerald-400',
    btn:     'bg-violet-600 hover:bg-violet-700 text-white',
    track:   'bg-slate-200',
  },
};

const fmt     = (n) => Number(n || 0).toLocaleString();
const fmtI    = (n) => Number(n || 0).toFixed(2);
const fmtUGX  = (i) => 'UGX ' + (Number(i || 0) * ICAN_TO_UGX).toLocaleString();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

const activeBadge = (on) => on
  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
  : 'bg-slate-500/15 text-slate-400 border-slate-500/20';

const planColor = (pl) => ({
  basic:      'bg-slate-500/15 text-slate-400 border-slate-500/20',
  pro:        'bg-violet-500/15 text-violet-400 border-violet-500/20',
  enterprise: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
})[pl] || 'bg-slate-500/15 text-slate-400 border-slate-500/20';

const PLANS = ['basic', 'pro', 'enterprise'];

const TIER_THRESHOLDS = {
  enterprise: { members: 30, ican: 500 },
  pro:        { members: 8,  ican: 50  },
};

const suggestTier = (memberCount, totalIcan) => {
  if (memberCount >= TIER_THRESHOLDS.enterprise.members || totalIcan >= TIER_THRESHOLDS.enterprise.ican) return 'enterprise';
  if (memberCount >= TIER_THRESHOLDS.pro.members        || totalIcan >= TIER_THRESHOLDS.pro.ican)        return 'pro';
  return 'basic';
};

// ─── Tiny shared components ───────────────────────────────────────────
const Stat = ({ icon: Icon, label, value, sub, grad, p }) => (
  <div className={`rounded-2xl border p-5 ${p.card}`}>
    <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${grad}`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <p className="text-2xl font-black">{value}</p>
    <p className={`mt-0.5 text-xs uppercase tracking-wider ${p.muted}`}>{label}</p>
    {sub && <p className={`mt-1 text-[11px] ${p.muted}`}>{sub}</p>}
  </div>
);

const Badge = ({ label, cls }) => (
  <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>{label}</span>
);

const Empty = ({ msg, p }) => (
  <div className={`rounded-2xl border py-14 text-center ${p.card}`}>
    <p className={`text-sm ${p.muted}`}>{msg}</p>
  </div>
);

const Bar = ({ pct, col, p }) => (
  <div className={`h-2 rounded-full overflow-hidden ${p.track}`}>
    <div className={`h-full rounded-full transition-all duration-700 ${col}`} style={{ width: `${Math.min(pct, 100)}%` }} />
  </div>
);

// ─── SQL setup banner ─────────────────────────────────────────────────
const SUBSCRIPTION_SQL = `-- Run DEV_PANEL_ACCESS.sql in Supabase SQL Editor, then refresh.
-- Quick snippet:
CREATE TABLE IF NOT EXISTS public.supermart_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  plan VARCHAR(20) DEFAULT 'basic' CHECK (plan IN ('basic','pro','enterprise')),
  target_type VARCHAR(20) DEFAULT 'supermart'
    CHECK (target_type IN ('supermart','supplier','customer')),
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.supermart_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_manage_subscriptions"
  ON public.supermart_subscriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.supermart_subscriptions TO anon, authenticated;`;

const SqlSetupBanner = ({ p }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`rounded-2xl border p-5 ${p.card}`}>
      <div className="mb-3 flex items-start gap-3">
        <FiAlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
        <div>
          <p className="font-semibold">Subscriptions table not found</p>
          <p className={`mt-1 text-sm ${p.muted}`}>Run <strong>DEV_PANEL_ACCESS.sql</strong> once in Supabase → SQL Editor, then refresh.</p>
        </div>
      </div>
      <pre className={`mt-4 overflow-x-auto rounded-xl border p-4 text-xs leading-5 ${p.code}`}>{SUBSCRIPTION_SQL}</pre>
      <button onClick={() => { navigator.clipboard?.writeText(SUBSCRIPTION_SQL); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${p.btn}`}>
        <FiCopy className="h-4 w-4" />{copied ? 'Copied!' : 'Copy SQL'}
      </button>
    </div>
  );
};

// ─── Subscription management hub ─────────────────────────────────────
const SUB_FILTERS = [
  { id: 'supermarts', label: 'Supermarts', icon: FiShield  },
  { id: 'suppliers',  label: 'Suppliers',  icon: FiPackage },
  { id: 'customers',  label: 'Customers',  icon: FiUsers   },
  { id: 'all',        label: 'All',        icon: FiCheckCircle },
];

const TIER_INFO = [
  { plan: 'basic',      price: 'Free',             features: ['POS', 'Inventory', '1 cashier', 'Basic reports'] },
  { plan: 'pro',        price: '50,000 UGX / mo',  features: ['Everything in Basic', 'icaneracoin rewards', '5 cashiers', 'Supplier portal'] },
  { plan: 'enterprise', price: '150,000 UGX / mo', features: ['Everything in Pro', 'Unlimited staff', 'Priority support', 'API access'] },
];

const ROLE_LABELS = {
  admin:    { label: 'Admin',    col: 'bg-red-500'    },
  manager:  { label: 'Manager',  col: 'bg-blue-500'   },
  cashier:  { label: 'Cashier',  col: 'bg-teal-500'   },
  employee: { label: 'Employee', col: 'bg-indigo-500' },
  supplier: { label: 'Supplier', col: 'bg-purple-500' },
  customer: { label: 'Customer', col: 'bg-orange-400' },
};

const SubsManager = ({
  subsReady, subs,
  supermarts, suppliers, customers,
  smMembersMap, wallets,
  upsertSub, toggleSub,
  p,
}) => {
  const [subFilter, setSubFilter] = useState('supermarts');
  const [bulkPlan,  setBulkPlan]  = useState(null);
  const [bulkBusy,  setBulkBusy]  = useState(false);
  const [subSearch, setSubSearch] = useState('');

  if (!subsReady) return <SqlSetupBanner p={p} />;

  const subFor = (id, type) =>
    subs.find(s => s.target_type === type && (type === 'supermart' ? s.supermarket_id === id : s.user_id === id));

  // Load stats for a supermarket — uses the pre-joined server data
  const smLoad = (sm) => {
    const members = smMembersMap[sm.id] || [];
    const staff   = members.filter(m => ['manager','cashier','employee'].includes(m.role));
    const custs   = members.filter(m => m.role === 'customer');
    const supps   = members.filter(m => m.role === 'supplier');
    const admins  = members.filter(m => m.role === 'admin');
    const totalIcan = members.reduce((s, m) => s + Number(m.ican_balance || 0), 0);
    const suggested = suggestTier(members.length, totalIcan);
    return { admins, staff, custs, supps, members, totalIcan, suggested };
  };

  const applyBulk = async (targetType, plan) => {
    setBulkBusy(true);
    const targets =
      targetType === 'supermarts' ? supermarts.map(sm => ({ id: sm.id, type: 'supermart' }))
      : targetType === 'suppliers' ? suppliers.map(sp => ({ id: sp.user_id, type: 'supplier' }))
      : customers.map(c => ({ id: c.id, type: 'customer' }));
    for (const t of targets) await upsertSub(t.id, t.type, plan);
    setBulkPlan(null);
    setBulkBusy(false);
  };

  const q = subSearch.toLowerCase();
  const filteredSm = supermarts.filter(s => !q || (s.name || '').toLowerCase().includes(q));
  const filteredSp = suppliers.filter(s => !q || ((s.company_name || '') + (s.contact_person || '')).toLowerCase().includes(q));
  const filteredCu = customers.filter(u => !q || ((u.full_name || '') + (u.email || '')).toLowerCase().includes(q));
  const activeCount = (type) => subs.filter(s => s.target_type === type && s.active).length;

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {[
          { type: 'supermart', icon: FiShield,  grad: 'from-red-500 to-pink-600',      total: supermarts.length },
          { type: 'supplier',  icon: FiPackage, grad: 'from-purple-500 to-indigo-600', total: suppliers.length  },
          { type: 'customer',  icon: FiUsers,   grad: 'from-orange-500 to-amber-500',  total: customers.length  },
        ].map(({ type, icon, grad, total }) => (
          <Stat key={type} icon={icon} label={`${type}s subscribed`}
            value={`${activeCount(type)} / ${total}`} grad={grad} p={p} />
        ))}
      </div>

      {/* Filter + search */}
      <div className={`rounded-2xl border p-1 flex gap-1 ${p.card}`}>
        {SUB_FILTERS.map(f => (
          <button key={f.id} onClick={() => { setSubFilter(f.id); setSubSearch(''); }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
              subFilter === f.id ? 'bg-violet-600 text-white' : p.tab
            }`}>
            <f.icon className="h-3.5 w-3.5" />{f.label}
          </button>
        ))}
      </div>

      {subFilter !== 'all' && (
        <div className="relative">
          <FiSearch className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${p.muted}`} />
          <input type="text" value={subSearch} onChange={e => setSubSearch(e.target.value)}
            placeholder={`Search ${subFilter}…`}
            className={`w-full rounded-xl border py-2.5 pl-9 pr-4 text-sm outline-none focus:border-violet-400/60 transition ${p.input}`} />
        </div>
      )}

      {/* Bulk apply */}
      {subFilter !== 'all' && (
        <div className={`rounded-2xl border p-4 ${p.soft}`}>
          <p className={`mb-3 text-xs font-semibold uppercase tracking-wider ${p.muted}`}>Bulk Apply — {subFilter}</p>
          <div className="flex flex-wrap items-center gap-2">
            {PLANS.map(plan => (
              <button key={plan} onClick={() => setBulkPlan(bulkPlan === plan ? null : plan)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  bulkPlan === plan ? planColor(plan) + ' ring-1 ring-current' : p.pill
                }`}>{plan}</button>
            ))}
            {bulkPlan && (
              <button onClick={() => applyBulk(subFilter, bulkPlan)} disabled={bulkBusy}
                className="ml-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-1.5 text-xs font-bold text-white transition">
                {bulkBusy ? 'Applying…' : `Apply "${bulkPlan}" to ALL ${subFilter}`}
              </button>
            )}
            {!bulkPlan && <span className={`text-xs ${p.muted}`}>Select a plan then click Apply</span>}
          </div>
        </div>
      )}

      {/* ── SUPERMARTS ── */}
      {subFilter === 'supermarts' && (
        <>
          <p className={`text-xs font-semibold uppercase tracking-wider ${p.muted}`}>
            {filteredSm.length} supermart{filteredSm.length !== 1 ? 's' : ''}
          </p>
          {filteredSm.length === 0 ? <Empty msg="No supermarts found." p={p} /> :
            filteredSm.map(sm => {
              const sub  = subFor(sm.id, 'supermart');
              const load = smLoad(sm);
              const needsUpgrade = sub && PLANS.indexOf(load.suggested) > PLANS.indexOf(sub.plan);
              return (
                <div key={sm.id} className={`rounded-2xl border p-4 ${p.card}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{sm.name}</p>
                        <Badge label={sm.is_active ? 'Active' : 'Inactive'} cls={activeBadge(sm.is_active)} />
                        {sub
                          ? <><Badge label={sub.plan} cls={planColor(sub.plan)} /><Badge label={sub.active ? 'On' : 'Paused'} cls={activeBadge(sub.active)} /></>
                          : <Badge label="Unassigned" cls={p.pill} />
                        }
                        {needsUpgrade && (
                          <span className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                            ↑ {load.suggested}
                          </span>
                        )}
                      </div>
                      {sm.location && <p className={`text-xs mt-0.5 ${p.muted}`}><FiMapPin className="inline h-3 w-3 mr-0.5" />{sm.location}</p>}
                    </div>
                    {sub && (
                      <button onClick={() => toggleSub(sub.id, sub.active)}
                        className={`flex-shrink-0 flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                          sub.active ? 'border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400/20'
                                     : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20'
                        }`}>
                        {sub.active ? <><FiToggleRight className="h-3.5 w-3.5" />Pause</> : <><FiToggleLeft className="h-3.5 w-3.5" />Resume</>}
                      </button>
                    )}
                  </div>

                  {/* Member breakdown */}
                  <div className={`mt-3 rounded-xl border p-3 ${p.soft}`}>
                    <div className="grid grid-cols-5 gap-1 text-center mb-3">
                      {[
                        { label: 'Admins',    val: load.admins.length, col: 'text-red-400'    },
                        { label: 'Managers',  val: load.staff.filter(m => m.role==='manager').length, col: 'text-blue-400' },
                        { label: 'Cashiers',  val: load.staff.filter(m => m.role==='cashier').length, col: 'text-teal-400' },
                        { label: 'Suppliers', val: load.supps.length, col: 'text-purple-400' },
                        { label: 'Customers', val: load.custs.length, col: 'text-orange-400' },
                      ].map(m => (
                        <div key={m.label}>
                          <p className={`text-base font-black ${m.col}`}>{m.val}</p>
                          <p className={`text-[9px] leading-tight ${p.muted}`}>{m.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${p.muted}`}>Active icaneracoin</span>
                      <span className="text-sm font-black text-cyan-400">{fmtI(load.totalIcan)} ICAN</span>
                    </div>
                    <div className={`mt-1 text-[11px] text-right ${p.muted}`}>{fmtUGX(load.totalIcan)}</div>
                  </div>

                  {/* Plan picker + smart auto */}
                  <div className={`mt-3 pt-3 border-t flex flex-wrap items-center gap-2 ${p.divider}`}>
                    {PLANS.map(plan => (
                      <button key={plan} onClick={() => upsertSub(sm.id, 'supermart', plan)}
                        className={`rounded-lg border px-3 py-1 text-xs font-semibold capitalize transition ${
                          sub?.plan === plan ? planColor(plan) + ' ring-1 ring-current' : p.pill
                        }`}>{plan}</button>
                    ))}
                    {(!sub || sub.plan !== load.suggested) && (
                      <button onClick={() => upsertSub(sm.id, 'supermart', load.suggested)}
                        className="ml-auto rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400 hover:bg-violet-500/20 transition">
                        ⚡ Auto: {load.suggested}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          }
        </>
      )}

      {/* ── SUPPLIERS ── */}
      {subFilter === 'suppliers' && (
        <>
          <p className={`text-xs font-semibold uppercase tracking-wider ${p.muted}`}>{filteredSp.length} supplier{filteredSp.length !== 1 ? 's' : ''}</p>
          {filteredSp.length === 0 ? <Empty msg="No suppliers found." p={p} /> :
            filteredSp.map(sp => {
              const sub = subFor(sp.user_id, 'supplier');
              const bal = wallets[sp.user_id] || 0;
              return (
                <div key={sp.id} className={`rounded-2xl border p-4 ${p.card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold truncate">{sp.company_name || sp.contact_person || '—'}</p>
                        <Badge label={sp.is_approved ? 'Approved' : 'Pending'} cls={activeBadge(sp.is_approved)} />
                        {sub ? <Badge label={sub.plan} cls={planColor(sub.plan)} /> : <Badge label="Unassigned" cls={p.pill} />}
                      </div>
                      {sp.email && <p className={`text-xs truncate ${p.muted}`}>{sp.email}</p>}
                      <p className={`text-xs font-semibold text-purple-400 mt-0.5`}>{fmtI(bal)} ICAN · {fmtUGX(bal)}</p>
                    </div>
                    {sub && (
                      <button onClick={() => toggleSub(sub.id, sub.active)}
                        className={`flex-shrink-0 flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                          sub.active ? 'border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400/20'
                                     : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20'
                        }`}>
                        {sub.active ? <><FiToggleRight className="h-3.5 w-3.5" />Suspend</> : <><FiToggleLeft className="h-3.5 w-3.5" />Reinstate</>}
                      </button>
                    )}
                  </div>
                  <div className={`mt-3 pt-3 border-t flex flex-wrap gap-2 ${p.divider}`}>
                    {PLANS.map(plan => (
                      <button key={plan} onClick={() => upsertSub(sp.user_id, 'supplier', plan)}
                        className={`rounded-lg border px-3 py-1 text-xs font-semibold capitalize transition ${
                          sub?.plan === plan ? planColor(plan) + ' ring-1 ring-current' : p.pill
                        }`}>{plan}</button>
                    ))}
                  </div>
                </div>
              );
            })
          }
        </>
      )}

      {/* ── CUSTOMERS ── */}
      {subFilter === 'customers' && (
        <>
          <p className={`text-xs font-semibold uppercase tracking-wider ${p.muted}`}>{filteredCu.length} customer{filteredCu.length !== 1 ? 's' : ''}</p>
          {filteredCu.length === 0 ? <Empty msg="No customers found." p={p} /> :
            filteredCu.map(u => {
              const sub = subFor(u.id, 'customer');
              const bal = wallets[u.id] || 0;
              const tl  = (pl) => pl === 'basic' ? 'Bronze' : pl === 'pro' ? 'Silver' : 'Gold';
              return (
                <div key={u.id} className={`rounded-2xl border p-4 ${p.card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold truncate">{u.full_name || '—'}</p>
                        {sub ? <Badge label={tl(sub.plan)} cls={planColor(sub.plan)} /> : <Badge label="Unassigned" cls={p.pill} />}
                      </div>
                      {u.email && <p className={`text-xs truncate ${p.muted}`}>{u.email}</p>}
                      <p className={`text-xs font-semibold text-amber-400 mt-0.5`}>{fmtI(bal)} ICAN · {fmtUGX(bal)}</p>
                    </div>
                    <button onClick={() => {}} className="hidden" />
                  </div>
                  <div className={`mt-3 pt-3 border-t flex flex-wrap gap-2 ${p.divider}`}>
                    {PLANS.map(plan => (
                      <button key={plan} onClick={() => upsertSub(u.id, 'customer', plan)}
                        className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                          sub?.plan === plan ? planColor(plan) + ' ring-1 ring-current' : p.pill
                        }`}>{tl(plan)}</button>
                    ))}
                  </div>
                </div>
              );
            })
          }
        </>
      )}

      {/* ── ALL ── */}
      {subFilter === 'all' && (
        <>
          <div className={`rounded-2xl border p-5 ${p.card}`}>
            <p className={`mb-4 text-xs font-semibold uppercase tracking-wider ${p.muted}`}>Plan Tiers</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {TIER_INFO.map(tier => (
                <div key={tier.plan} className={`rounded-xl border p-4 ${p.soft}`}>
                  <Badge label={tier.plan} cls={planColor(tier.plan)} />
                  <p className="mt-2 font-bold text-violet-400 text-sm">{tier.price}</p>
                  <ul className={`mt-3 space-y-1 text-xs ${p.muted}`}>
                    {tier.features.map(f => (
                      <li key={f} className="flex items-center gap-1.5">
                        <FiCheckCircle className="h-3 w-3 text-emerald-400 flex-shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <p className="font-bold">All Subscriptions ({subs.length})</p>
          {subs.length === 0
            ? <Empty msg="No subscriptions yet. Use the Supermarts, Suppliers, or Customers tabs to assign plans." p={p} />
            : subs.map(s => {
                const name = s.target_type === 'supermart'
                  ? supermarts.find(sm => sm.id === s.supermarket_id)?.name
                  : s.target_type === 'supplier'
                    ? suppliers.find(sp => sp.user_id === s.user_id)?.company_name
                    : customers.find(c => c.id === s.user_id)?.full_name;
                return (
                  <div key={s.id} className={`mb-2 rounded-2xl border p-4 ${p.card}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium truncate">{name || '—'}</p>
                          <Badge label={s.target_type}                   cls={p.pill} />
                          <Badge label={s.plan}                          cls={planColor(s.plan)} />
                          <Badge label={s.active ? 'Active' : 'Paused'} cls={activeBadge(s.active)} />
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <div className="flex gap-1">
                          {PLANS.map(plan => (
                            <button key={plan}
                              onClick={() => upsertSub(s.target_type === 'supermart' ? s.supermarket_id : s.user_id, s.target_type, plan)}
                              className={`rounded-lg border px-2 py-1 text-[10px] font-semibold capitalize transition ${
                                s.plan === plan ? planColor(plan) + ' ring-1 ring-current' : p.pill
                              }`}>{plan}</button>
                          ))}
                        </div>
                        <button onClick={() => toggleSub(s.id, s.active)}
                          className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                            s.active ? 'border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400/20'
                                     : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20'
                          }`}>
                          {s.active ? <><FiToggleRight className="h-3.5 w-3.5" />Pause</> : <><FiToggleLeft className="h-3.5 w-3.5" />Resume</>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </>
      )}
    </>
  );
};

// ─── System tracking tab ──────────────────────────────────────────────
const SystemTab = ({ systemTotals, supermarts, smMembersMap, wallets, subs, p }) => {
  const grand = systemTotals.reduce((acc, r) => ({
    balance: acc.balance + Number(r.total_balance || 0),
    earned:  acc.earned  + Number(r.total_earned  || 0),
    spent:   acc.spent   + Number(r.total_spent   || 0),
    tithe:   acc.tithe   + Number(r.total_tithe   || 0),
    users:   acc.users   + Number(r.user_count    || 0),
  }), { balance: 0, earned: 0, spent: 0, tithe: 0, users: 0 });

  const subsCoverage = (type) => {
    const total  = type === 'supermart' ? supermarts.length
                 : systemTotals.find(r => r.role === (type === 'supplier' ? 'supplier' : 'customer'))?.user_count || 0;
    const active = subs.filter(s => s.target_type === type && s.active).length;
    return total > 0 ? Math.round((active / total) * 100) : 0;
  };

  return (
    <>
      {/* Grand totals */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={FiZap}        label="Total icaneracoin"  value={fmtI(grand.balance)}             sub={fmtUGX(grand.balance)} grad="from-cyan-500 to-sky-600"      p={p} />
        <Stat icon={FiTrendingUp} label="Total ever earned"  value={fmtI(grand.earned)}              sub={fmtUGX(grand.earned)}  grad="from-emerald-500 to-teal-600"  p={p} />
        <Stat icon={FiDollarSign} label="Total tithe paid"   value={fmtI(grand.tithe)}               sub={fmtUGX(grand.tithe)}   grad="from-violet-500 to-fuchsia-600" p={p} />
        <Stat icon={FiUsers}      label="Total users"        value={fmt(grand.users)}                sub="across all roles"      grad="from-orange-500 to-amber-500"  p={p} />
      </div>

      {/* Per-role breakdown */}
      <div className={`rounded-2xl border p-5 ${p.card}`}>
        <p className={`mb-4 text-xs font-semibold uppercase tracking-wider ${p.muted}`}>icaneracoin by Role</p>
        {systemTotals.map(r => {
          const pct = grand.balance > 0 ? (Number(r.total_balance) / grand.balance) * 100 : 0;
          const info = ROLE_LABELS[r.role] || { label: r.role, col: 'bg-slate-500' };
          return (
            <div key={r.role} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${info.col}`} />
                  <span className="text-sm font-medium capitalize">{info.label}s</span>
                  <span className={`text-xs ${p.muted}`}>({fmt(r.user_count)})</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold">{fmtI(r.total_balance)} ICAN</span>
                  <span className={`ml-2 text-xs ${p.muted}`}>{pct.toFixed(1)}%</span>
                </div>
              </div>
              <Bar pct={pct} col={info.col} p={p} />
              <div className={`mt-1 flex gap-4 text-[10px] ${p.muted}`}>
                <span>Earned: {fmtI(r.total_earned)}</span>
                <span>Spent: {fmtI(r.total_spent)}</span>
                <span>Tithe: {fmtI(r.total_tithe)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscription coverage */}
      <div className={`rounded-2xl border p-5 ${p.card}`}>
        <p className={`mb-4 text-xs font-semibold uppercase tracking-wider ${p.muted}`}>Subscription Coverage</p>
        {[
          { label: 'Supermarts',   type: 'supermart', col: 'bg-red-500'    },
          { label: 'Suppliers',    type: 'supplier',  col: 'bg-purple-500' },
          { label: 'Customers',    type: 'customer',  col: 'bg-orange-400' },
        ].map(row => {
          const pct = subsCoverage(row.type);
          return (
            <div key={row.type} className="mb-3 last:mb-0">
              <div className="flex justify-between text-sm mb-1">
                <span>{row.label}</span>
                <span className="font-semibold">{pct}% subscribed</span>
              </div>
              <Bar pct={pct} col={row.col} p={p} />
            </div>
          );
        })}
      </div>

      {/* Top supermarts by ecosystem ICAN */}
      <div className={`rounded-2xl border overflow-hidden ${p.card}`}>
        <div className={`px-5 py-3 border-b text-xs font-semibold uppercase tracking-wider ${p.muted} ${p.divider}`}>
          Top Supermarts by icaneracoin Ecosystem
        </div>
        {supermarts
          .map(sm => {
            const members   = smMembersMap[sm.id] || [];
            const totalIcan = members.reduce((s, m) => s + Number(m.ican_balance || 0), 0);
            return { ...sm, totalIcan, memberCount: members.length };
          })
          .sort((a, b) => b.totalIcan - a.totalIcan)
          .slice(0, 15)
          .map((sm, i) => (
            <div key={sm.id} className={`flex items-center gap-3 px-5 py-3.5 border-b last:border-0 ${p.divider}`}>
              <span className={`w-5 text-center text-xs font-black flex-shrink-0 ${
                i===0 ? 'text-amber-400' : i===1 ? 'text-slate-300' : i===2 ? 'text-orange-500' : p.muted
              }`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{sm.name}</p>
                <p className={`text-xs ${p.muted}`}>{sm.memberCount} members · {sm.location || '—'}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-cyan-400">{fmtI(sm.totalIcan)} ICAN</p>
                <p className={`text-[11px] ${p.muted}`}>{fmtUGX(sm.totalIcan)}</p>
              </div>
            </div>
          ))
        }
        {supermarts.length === 0 && <p className={`px-5 py-10 text-center text-sm ${p.muted}`}>No supermarts yet.</p>}
      </div>

      {/* Rate reference */}
      <div className={`rounded-2xl border p-5 ${p.card}`}>
        <p className={`mb-3 text-xs font-semibold uppercase tracking-wider ${p.muted}`}>icaneracoin Reference</p>
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          {[
            { icon: FiZap,     label: 'Floor price', val: '1 ICAN = 5,000 UGX' },
            { icon: FiAward,   label: 'Tithe rate',  val: '10% auto-deducted on every earning' },
            { icon: FiActivity,label: 'Circulation', val: fmtI(grand.balance) + ' ICAN active' },
          ].map(r => (
            <div key={r.label} className={`rounded-xl border p-4 ${p.soft}`}>
              <r.icon className="mb-2 h-5 w-5 text-violet-400" />
              <p className="font-semibold">{r.label}</p>
              <p className={`mt-1 text-xs ${p.muted}`}>{r.val}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ─── Live support chat inbox ────────────────────────────────────────
const PORTAL_BADGE = {
  landing:  'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  customer: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  cashier:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  manager:  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  supplier: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  admin:    'bg-red-500/15 text-red-400 border-red-500/20',
};

const fmtChatTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString();
};

const MessagesTab = ({ p }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedId,    setSelectedId]    = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [reply,         setReply]         = useState('');
  const [sending,       setSending]       = useState(false);
  const scrollRef = useRef(null);

  const refresh = useCallback(async () => {
    setConversations(await listConversations());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    return subscribeToAllConversations((payload) => {
      const row = payload.new;
      if (!row || row.kind === 'team') return;
      setConversations(prev =>
        [row, ...prev.filter(c => c.id !== row.id)]
          .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
      );
    });
  }, []);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      const msgs = await fetchMessages(selectedId);
      if (cancelled) return;
      setMessages(msgs);
      await markConversationRead(selectedId, 'dev');
      setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, unread_by_dev: false } : c));
    })();
    const unsub = subscribeToMessages(selectedId, (msg) => {
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
    });
    return () => { cancelled = true; unsub(); };
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const selected = conversations.find(c => c.id === selectedId);

  const handleReply = async () => {
    const body = reply.trim();
    if (!body || !selectedId || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(selectedId, { senderRole: 'dev', senderName: 'Supermartkera Team', body });
      setMessages(prev => [...prev, msg]);
      setReply('');
    } catch (e) {
      console.error('[MessagesTab] reply failed:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className={`rounded-2xl border overflow-hidden ${p.card}`}>
        <div className={`px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider ${p.muted} ${p.divider}`}>
          Conversations ({conversations.length})
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          {conversations.map(c => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={`w-full border-b last:border-0 px-4 py-3 text-left transition ${p.divider} ${
                selectedId === c.id ? 'bg-violet-500/10' : 'hover:bg-white/5'
              }`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{c.guest_name || c.role || 'Guest'}</p>
                {c.unread_by_dev && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />}
              </div>
              <p className={`text-xs truncate ${p.muted}`}>{c.guest_email}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${PORTAL_BADGE[c.portal] || PORTAL_BADGE.landing}`}>
                  {c.portal}
                </span>
                {c.origin_app && c.origin_app !== 'digital-city-era' && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${p.pill}`}>
                    {c.origin_app}
                  </span>
                )}
                <span className={`text-[10px] ${p.muted}`}>{fmtChatTime(c.last_message_at)}</span>
              </div>
              {c.last_message_preview && <p className={`mt-1 truncate text-xs ${p.muted}`}>{c.last_message_preview}</p>}
            </button>
          ))}
          {conversations.length === 0 && (
            <p className={`px-4 py-10 text-center text-sm ${p.muted}`}>No conversations yet.</p>
          )}
        </div>
      </div>

      <div className={`flex flex-col overflow-hidden rounded-2xl border ${p.card}`}>
        {!selected ? (
          <div className={`flex flex-1 items-center justify-center text-sm ${p.muted}`}>
            <div className="text-center">
              <FiMessageCircle className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Select a conversation to reply
            </div>
          </div>
        ) : (
          <>
            <div className={`border-b px-4 py-3 ${p.divider}`}>
              <p className="text-sm font-semibold">{selected.guest_name || 'Guest'}</p>
              <p className={`text-xs ${p.muted}`}>{selected.guest_email} · {selected.portal}</p>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3" style={{ maxHeight: '48vh' }}>
              {messages.map(m => {
                const fromDev = m.sender_role === 'dev';
                return (
                  <div key={m.id} className={`flex ${fromDev ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      fromDev ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white' : p.soft
                    }`}>
                      {!fromDev && (
                        <p className={`mb-0.5 text-[10px] font-semibold uppercase tracking-wide ${p.muted}`}>
                          {m.sender_name || selected.role}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={`flex items-center gap-2 border-t px-3 py-3 ${p.divider}`}>
              <input value={reply} onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleReply(); }}
                placeholder="Reply as Supermartkera Team…"
                className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-violet-400/60 ${p.input}`} />
              <button onClick={handleReply} disabled={sending || !reply.trim()}
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition disabled:opacity-40 ${p.btn}`}>
                <FiSend className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Public landing-page message board (moderation) ────────────────────
const PublicBoardTab = ({ p }) => {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replying,   setReplying]   = useState(false);
  const [markingId,  setMarkingId]  = useState(null);
  const [markError,  setMarkError]  = useState('');
  const [grantTargetId, setGrantTargetId] = useState(null);
  const [grantAmount,   setGrantAmount]   = useState('');
  const [grantingId,    setGrantingId]    = useState(null);
  const [grantError,    setGrantError]    = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await devListAllLandingMessages(null));
    } catch (e) {
      console.error('[PublicBoardTab] failed to load messages:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (id) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await devDeleteLandingMessage(null, id);
      if (expandedId === id) setExpandedId(null);
      await refresh();
    } catch (e) {
      console.error('[PublicBoardTab] failed to delete message:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleReply = async (id) => {
    const body = replyDraft.trim();
    if (!body || replying) return;
    setReplying(true);
    try {
      await devReplyToLandingMessage(null, id, body);
      setReplyDraft('');
      await refresh();
    } catch (e) {
      console.error('[PublicBoardTab] failed to reply:', e);
    } finally {
      setReplying(false);
    }
  };

  const handleMarkCorrect = async (id) => {
    if (markingId) return;
    setMarkingId(id);
    setMarkError('');
    try {
      await devMarkCorrectAnswer(null, id);
      await refresh();
    } catch (e) {
      console.error('[PublicBoardTab] failed to mark correct answer:', e);
      setMarkError(e?.message || 'Failed to mark as correct answer.');
    } finally {
      setMarkingId(null);
    }
  };

  const handleOpenGrant = (id) => {
    setGrantTargetId((prev) => (prev === id ? null : id));
    setGrantAmount('');
    setGrantError('');
  };

  const handleGrant = async (item) => {
    const amt = parseFloat(grantAmount);
    if (!amt || amt <= 0 || grantingId) return;
    setGrantingId(item.id);
    setGrantError('');
    try {
      await devGrantLandingBonus(null, item.user_id, amt, 'Manual grant from Public Board');
      setGrantTargetId(null);
      setGrantAmount('');
      await refresh();
    } catch (e) {
      console.error('[PublicBoardTab] failed to grant bonus:', e);
      setGrantError(e?.message || 'Failed to grant ICAN.');
    } finally {
      setGrantingId(null);
    }
  };

  const topLevel = items.filter(m => !m.parent_id);

  return (
    <div className={`rounded-2xl border overflow-hidden ${p.card}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider ${p.muted} ${p.divider}`}>
        <span>Landing page messages ({topLevel.length})</span>
        <button onClick={refresh} className={`rounded-lg p-1.5 transition ${p.tab}`}>
          <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="max-h-[65vh] divide-y overflow-y-auto">
        {topLevel.map(m => {
          const replies = items.filter(i => i.parent_id === m.id);
          const isExpanded = expandedId === m.id;
          return (
            <div key={m.id} className={`px-4 py-3 ${p.divider}`}>
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => { setExpandedId(isExpanded ? null : m.id); setReplyDraft(''); }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{m.name || 'Website visitor'}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      m.is_public
                        ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    }`}>
                      {m.is_public ? <FiGlobe className="h-3 w-3" /> : <FiLock className="h-3 w-3" />}
                      {m.is_public ? 'Public' : 'Private'}
                    </span>
                    {m.origin_app && (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${p.pill}`}>
                        {m.origin_app}
                      </span>
                    )}
                    {m.reward_reason === 'popular' && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                        🪙 Popular
                      </span>
                    )}
                    <span className={`text-[10px] ${p.muted}`}>{fmtChatTime(m.created_at)}</span>
                    {replies.length > 0 && (
                      <span className={`text-[10px] ${p.muted}`}>· {replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
                    )}
                  </div>
                  {m.email && <p className={`text-xs ${p.muted}`}>{m.email}</p>}
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.message}</p>
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
                  title="Delete message"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>

              {isExpanded && (
                <div className={`mt-3 space-y-2 border-l-2 pl-3 ${p.divider}`}>
                  {m.user_id && (
                    <div>
                      <button
                        onClick={() => handleOpenGrant(m.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 transition hover:bg-amber-500/20"
                      >
                        <FiGift className="h-3 w-3" /> Grant ICAN to {m.name || 'this poster'}
                      </button>
                      {grantTargetId === m.id && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={grantAmount}
                            onChange={e => setGrantAmount(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleGrant(m); }}
                            placeholder="Amount"
                            className={`w-24 rounded-lg border px-2 py-1 text-xs outline-none focus:border-amber-400/60 ${p.input}`}
                          />
                          <button
                            onClick={() => handleGrant(m)}
                            disabled={grantingId === m.id || !grantAmount}
                            className="rounded-lg bg-amber-500 px-2.5 py-1 text-[10px] font-semibold text-slate-950 transition disabled:opacity-40"
                          >
                            {grantingId === m.id ? 'Granting…' : 'Confirm'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {replies.map(r => (
                    <div key={r.id} className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 ${r.sender_role === 'dev' ? 'bg-violet-500/10' : p.soft}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold">{r.sender_role === 'dev' ? 'Supermartkera Team' : (r.name || 'Website visitor')}</p>
                          {r.reward_reason && (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                              🪙 {r.reward_reason === 'correct_answer' ? 'Correct answer' : 'Popular'}
                            </span>
                          )}
                          <span className={`text-[10px] ${p.muted}`}>{fmtChatTime(r.created_at)}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{r.message}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {r.sender_role !== 'dev' && r.user_id && !r.rewarded_at && (
                            <button
                              onClick={() => handleMarkCorrect(r.id)}
                              disabled={markingId === r.id}
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40"
                            >
                              <FiCheckSquare className="h-3 w-3" /> {markingId === r.id ? 'Marking…' : 'Mark correct answer (+1 ICAN)'}
                            </button>
                          )}
                          {r.sender_role !== 'dev' && r.user_id && (
                            <button
                              onClick={() => handleOpenGrant(r.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 transition hover:bg-amber-500/20"
                            >
                              <FiGift className="h-3 w-3" /> Grant ICAN
                            </button>
                          )}
                        </div>
                        {grantTargetId === r.id && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={grantAmount}
                              onChange={e => setGrantAmount(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleGrant(r); }}
                              placeholder="Amount"
                              className={`w-24 rounded-lg border px-2 py-1 text-xs outline-none focus:border-amber-400/60 ${p.input}`}
                            />
                            <button
                              onClick={() => handleGrant(r)}
                              disabled={grantingId === r.id || !grantAmount}
                              className="rounded-lg bg-amber-500 px-2.5 py-1 text-[10px] font-semibold text-slate-950 transition disabled:opacity-40"
                            >
                              {grantingId === r.id ? 'Granting…' : 'Confirm'}
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
                        title="Delete reply"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {replies.length === 0 && <p className={`text-xs ${p.muted}`}>No replies yet.</p>}
                  {markError && <p className="text-xs text-rose-400">{markError}</p>}
                  {grantError && <p className="text-xs text-rose-400">{grantError}</p>}

                  {m.is_public && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        value={replyDraft}
                        onChange={e => setReplyDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleReply(m.id); }}
                        placeholder="Reply as Supermartkera Team…"
                        className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-violet-400/60 ${p.input}`}
                      />
                      <button
                        onClick={() => handleReply(m.id)}
                        disabled={replying || !replyDraft.trim()}
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition disabled:opacity-40 ${p.btn}`}
                      >
                        <FiSend className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && topLevel.length === 0 && (
          <p className={`px-4 py-10 text-center text-sm ${p.muted}`}>No landing page messages yet.</p>
        )}
      </div>
    </div>
  );
};

// ─── Main dashboard ───────────────────────────────────────────────────
const DevDashboard = ({ onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const p = P[theme] || P.dark;

  const [tab,        setTab]        = useState('overview');
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [lastRefresh,setLastRefresh]= useState(null);

  // Core data
  const [supermarts,     setSupermarts]     = useState([]);
  const [allUsers,       setAllUsers]       = useState([]);
  const [admins,         setAdmins]         = useState([]);
  const [suppliers,      setSuppliers]      = useState([]);
  const [customers,      setCustomers]      = useState([]);
  const [wallets,        setWallets]        = useState({});
  const [lifetimeEarned, setLifetimeEarned] = useState({});
  // smMembersMap: supermarketId → [{ user_id, full_name, role, ican_balance, ... }]
  const [smMembersMap,   setSmMembersMap]   = useState({});
  // systemTotals: [{ role, user_count, total_balance, total_earned, total_spent, total_tithe }]
  const [systemTotals,   setSystemTotals]   = useState([]);
  const [subs,           setSubs]           = useState([]);
  const [subsReady,      setSubsReady]      = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);

    // 1. Supermarkets
    try {
      const { data } = await supabase.rpc('dev_get_supermarkets');
      setSupermarts(data || []);
    } catch { setSupermarts([]); }

    // 2. All users
    let allFetched = [];
    try {
      const { data: users } = await supabase.rpc('dev_get_users');
      allFetched = users || [];
      setAllUsers(allFetched);
      setAdmins(allFetched.filter(u => u.role === 'admin'));
      setCustomers(allFetched.filter(u => u.role === 'customer'));
    } catch { setAllUsers([]); setAdmins([]); setCustomers([]); }

    // 3. Suppliers — try RPC, fall back to users with role='supplier'
    try {
      const { data: spRows, error: spErr } = await supabase.rpc('dev_get_suppliers');
      if (!spErr && spRows && spRows.length > 0) {
        setSuppliers(spRows);
      } else {
        setSuppliers(allFetched.filter(u => u.role === 'supplier').map(u => ({
          id: u.id, user_id: u.id, company_name: u.full_name || u.email,
          contact_person: u.full_name, email: u.email, phone: u.phone,
          address: null, supermarket_id: u.supermarket_id,
          is_approved: u.is_active, created_at: u.created_at,
        })));
      }
    } catch {
      setSuppliers(allFetched.filter(u => u.role === 'supplier').map(u => ({
        id: u.id, user_id: u.id, company_name: u.full_name || u.email,
        contact_person: u.full_name, email: u.email, phone: u.phone,
        address: null, supermarket_id: u.supermarket_id,
        is_approved: u.is_active, created_at: u.created_at,
      })));
    }

    // 4. ICAN wallets
    try {
      const { data: wRows } = await supabase.rpc('dev_get_wallets');
      const map = {};
      (wRows || []).forEach(w => { map[w.user_id] = Number(w.ican_balance || 0); });
      setWallets(map);
    } catch { setWallets({}); }

    // 5. Lifetime earned
    try {
      const { data: txRows } = await supabase.rpc('dev_get_tx_totals');
      const map = {};
      (txRows || []).forEach(r => { map[r.recipient_user_id] = Number(r.total_received || 0); });
      setLifetimeEarned(map);
    } catch { setLifetimeEarned({}); }

    // 6. Supermarket members — server-side join (admins + managers + cashiers + all staff)
    try {
      const { data: mRows } = await supabase.rpc('dev_get_supermarket_members');
      const map = {};
      (mRows || []).forEach(m => {
        if (!map[m.supermarket_id]) map[m.supermarket_id] = [];
        // Deduplicate by user_id
        if (!map[m.supermarket_id].find(x => x.user_id === m.user_id)) {
          map[m.supermarket_id].push(m);
        }
      });
      setSmMembersMap(map);
    } catch { setSmMembersMap({}); }

    // 7. System totals (per-role aggregates)
    try {
      const { data: totRows } = await supabase.rpc('dev_get_system_totals');
      setSystemTotals(totRows || []);
    } catch { setSystemTotals([]); }

    // 8. Subscriptions
    try {
      const { data: subRows, error: subErr } = await supabase
        .from('supermart_subscriptions').select('*').order('created_at', { ascending: false });
      if (subErr) { setSubsReady(false); setSubs([]); }
      else         { setSubsReady(true);  setSubs(subRows || []); }
    } catch { setSubsReady(false); setSubs([]); }

    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Subscription helpers ──────────────────────────────────────────
  const subFor = (id, type) =>
    subs.find(s => s.target_type === type && (type === 'supermart' ? s.supermarket_id === id : s.user_id === id));

  const upsertSub = async (targetId, targetType, plan) => {
    if (!subsReady) return;
    const existing = subFor(targetId, targetType);
    const base = { target_type: targetType, plan, active: true, updated_at: new Date().toISOString() };
    const payload = targetType === 'supermart'
      ? { ...base, supermarket_id: targetId, user_id: null }
      : { ...base, user_id: targetId, supermarket_id: null };
    if (existing) {
      const { data } = await supabase.from('supermart_subscriptions')
        .update({ plan, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single();
      if (data) setSubs(prev => prev.map(s => s.id === existing.id ? data : s));
    } else {
      const { data } = await supabase.from('supermart_subscriptions').insert(payload).select().single();
      if (data) setSubs(prev => [data, ...prev]);
    }
  };

  const toggleSub = async (id, current) => {
    await supabase.from('supermart_subscriptions')
      .update({ active: !current, updated_at: new Date().toISOString() }).eq('id', id);
    setSubs(prev => prev.map(s => s.id === id ? { ...s, active: !current } : s));
  };

  // ── Grant bonus ───────────────────────────────────────────────────
  const grantBonus = async (userId, amount) => {
    try {
      await supabase.rpc('dev_grant_ican_bonus', { target_user_id: userId, bonus_amount: amount });
      await fetchAll();
    } catch (e) { console.error('Grant bonus error:', e); }
  };

  // ── Computed ──────────────────────────────────────────────────────
  // Ecosystem ICAN for a supermarket = sum of all members' balances from the server join
  const smIcan = (sm) =>
    (smMembersMap[sm.id] || []).reduce((s, m) => s + Number(m.ican_balance || 0), 0);

  const totalAdminIcan    = admins.reduce((s, a) => s + (wallets[a.id] || 0), 0);
  const totalSupplierIcan = suppliers.reduce((s, sp) => s + (wallets[sp.user_id] || 0), 0);
  const totalCustomerIcan = customers.reduce((s, c) => s + (wallets[c.id] || 0), 0);
  const totalIcan         = totalAdminIcan + totalSupplierIcan + totalCustomerIcan;

  const q        = search.toLowerCase();
  const filterSm = l => q ? l.filter(s => (s.name || '').toLowerCase().includes(q)) : l;
  const filterSp = l => q ? l.filter(s => ((s.company_name || '') + (s.contact_person || '')).toLowerCase().includes(q)) : l;
  const filterU  = l => q ? l.filter(u => ((u.full_name || '') + (u.email || '')).toLowerCase().includes(q)) : l;

  const TABS = [
    { id: 'overview',      label: 'Overview'      },
    { id: 'messages',      label: 'Messages'      },
    { id: 'public-board',  label: 'Public Board'  },
    { id: 'supermarts',    label: 'Supermarts'    },
    { id: 'suppliers',     label: 'Suppliers'     },
    { id: 'customers',     label: 'Customers'     },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'rewards',       label: 'Rewards'       },
    { id: 'system',        label: 'System'        },
  ];

  return (
    <div className={`min-h-screen ${p.shell}`}>

      {/* Header */}
      <header className={`sticky top-0 z-20 border-b backdrop-blur-xl ${p.header}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
              <FiShield className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className={`text-[10px] uppercase tracking-widest ${p.muted}`}>Control Centre</p>
              <h1 className="text-sm font-bold leading-none">Supermartkera</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastRefresh && <span className={`hidden text-[11px] sm:block ${p.muted}`}>{lastRefresh.toLocaleTimeString()}</span>}
            <button onClick={fetchAll} disabled={loading} className={`rounded-xl border p-2 transition disabled:opacity-40 ${p.pill}`}>
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={toggleTheme} className={`rounded-xl border p-2 transition ${p.pill}`}>
              {theme === 'dark' ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
            </button>
            <button onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-400/20 transition">
              <FiLogOut className="h-3.5 w-3.5" /> Exit
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl overflow-x-auto px-5 pb-px scrollbar-none">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); }}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
                tab === t.id ? p.tabOn : p.tabOff + ' ' + p.tab
              }`}>{t.label}</button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 space-y-5">

        {/* Search */}
        {['supermarts','suppliers','customers'].includes(tab) && (
          <div className="relative">
            <FiSearch className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${p.muted}`} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className={`w-full rounded-xl border py-2.5 pl-9 pr-4 text-sm outline-none focus:border-violet-400/60 transition ${p.input}`} />
          </div>
        )}

        {/* ── MESSAGES ── */}
        {tab === 'messages' && <MessagesTab p={p} />}
        {tab === 'public-board' && <PublicBoardTab p={p} />}

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat icon={FiShield}   label="Supermarts"     grad="from-red-500 to-pink-600"
                value={supermarts.length}  sub={fmtUGX(totalAdminIcan)}    p={p} />
              <Stat icon={FiPackage}  label="Suppliers"      grad="from-purple-500 to-indigo-600"
                value={suppliers.length}   sub={fmtUGX(totalSupplierIcan)} p={p} />
              <Stat icon={FiUsers}    label="Customers"      grad="from-orange-500 to-amber-500"
                value={customers.length}   sub={fmtUGX(totalCustomerIcan)} p={p} />
              <Stat icon={FiZap}      label="ICAN ecosystem" grad="from-cyan-500 to-sky-600"
                value={fmtI(totalIcan)}    sub={fmtUGX(totalIcan)}         p={p} />
            </div>
            <div className={`rounded-2xl border p-5 ${p.card}`}>
              <p className={`mb-4 text-xs font-semibold uppercase tracking-wider ${p.muted}`}>icaneracoin Distribution</p>
              {[
                { label: 'Supermarts', val: totalAdminIcan,    col: 'bg-red-500'    },
                { label: 'Suppliers',  val: totalSupplierIcan, col: 'bg-purple-500' },
                { label: 'Customers',  val: totalCustomerIcan, col: 'bg-orange-400' },
              ].map(row => {
                const pct = totalIcan > 0 ? (row.val / totalIcan) * 100 : 0;
                return (
                  <div key={row.label} className="mb-3 last:mb-0">
                    <div className={`mb-1 flex justify-between text-sm ${p.label}`}>
                      <span>{row.label}</span>
                      <span className="font-semibold">{fmtI(row.val)} ICAN <span className={`text-xs ${p.muted}`}>({pct.toFixed(1)}%)</span></span>
                    </div>
                    <Bar pct={pct} col={row.col} p={p} />
                  </div>
                );
              })}
            </div>
            <div className={`rounded-2xl border p-5 ${p.card}`}>
              <p className={`mb-4 text-xs font-semibold uppercase tracking-wider ${p.muted}`}>Latest Supermarts</p>
              {supermarts.slice(0, 8).map(sm => {
                const members = smMembersMap[sm.id] || [];
                const admin   = members.find(m => m.role === 'admin');
                return (
                  <div key={sm.id} className={`mb-2 last:mb-0 flex items-center justify-between rounded-xl border p-3 ${p.soft}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{sm.name}</p>
                      <p className={`text-xs truncate ${p.muted}`}>{admin?.email || sm.location || '—'} · {members.length} members</p>
                    </div>
                    <div className="ml-3 flex-shrink-0 text-right">
                      <p className="text-xs font-semibold text-cyan-400">{fmtI(smIcan(sm))} ICAN</p>
                      <p className={`text-[10px] ${p.muted}`}>{fmtDate(sm.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              {supermarts.length === 0 && <p className={`text-sm ${p.muted}`}>No supermarts yet.</p>}
            </div>
          </>
        )}

        {/* ── SUPERMARTS ── */}
        {tab === 'supermarts' && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-bold">Registered Supermarts</p>
              <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${p.pill}`}>{supermarts.length} total</span>
            </div>
            {filterSm(supermarts).length === 0 ? <Empty msg="No supermarts found." p={p} /> :
              filterSm(supermarts).map(sm => {
                const members = smMembersMap[sm.id] || [];
                const admin   = members.find(m => m.role === 'admin');
                const sub     = subsReady ? subFor(sm.id, 'supermart') : null;
                const ican    = smIcan(sm);
                const roles   = ['admin','manager','cashier','employee','supplier','customer'];
                return (
                  <div key={sm.id} className={`rounded-2xl border p-4 ${p.card}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{sm.name}</p>
                          <Badge label={sm.is_active ? 'Active' : 'Inactive'} cls={activeBadge(sm.is_active)} />
                          {sub && <Badge label={sub.plan} cls={planColor(sub.plan)} />}
                        </div>
                        {admin && <p className={`text-xs mt-0.5 ${p.muted}`}>Admin: <span className="text-violet-400">{admin.full_name || admin.email}</span></p>}
                        {sm.location && <p className={`text-xs ${p.muted}`}><FiMapPin className="inline h-3 w-3 mr-0.5" />{sm.location}</p>}
                        <p className={`text-xs ${p.muted} mt-0.5`}><FiCalendar className="inline h-3 w-3 mr-0.5" />{fmtDate(sm.created_at)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-cyan-400 font-bold text-sm">
                          <FiZap className="h-3.5 w-3.5" />{fmtI(ican)} ICAN
                        </div>
                        <p className={`text-[11px] ${p.muted}`}>{fmtUGX(ican)}</p>
                      </div>
                    </div>
                    {/* Member role breakdown */}
                    {members.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {roles.map(role => {
                          const cnt = members.filter(m => m.role === role).length;
                          if (!cnt) return null;
                          const info = ROLE_LABELS[role] || { label: role, col: 'bg-slate-500' };
                          return (
                            <span key={role} className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${p.pill}`}>
                              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${info.col}`} />
                              {cnt} {info.label}{cnt !== 1 ? 's' : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            }
          </>
        )}

        {/* ── SUPPLIERS ── */}
        {tab === 'suppliers' && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-bold">Onboarded Suppliers</p>
              <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${p.pill}`}>{suppliers.length} total</span>
            </div>
            {filterSp(suppliers).length === 0 ? <Empty msg="No suppliers found." p={p} /> :
              filterSp(suppliers).map(sp => {
                const bal = wallets[sp.user_id] || 0;
                const sub = subsReady ? subFor(sp.user_id, 'supplier') : null;
                return (
                  <div key={sp.id} className={`rounded-2xl border p-4 ${p.card}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold truncate">{sp.company_name || sp.contact_person || '—'}</p>
                          <Badge label={sp.is_approved ? 'Approved' : 'Pending'} cls={activeBadge(sp.is_approved)} />
                          {sub && <Badge label={sub.plan} cls={planColor(sub.plan)} />}
                        </div>
                        {sp.contact_person && <p className={`text-xs ${p.muted}`}>{sp.contact_person}</p>}
                        {sp.email && <p className={`text-xs truncate ${p.muted}`}>{sp.email}</p>}
                        {sp.phone && <p className={`text-xs ${p.muted}`}>{sp.phone}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-purple-400 font-bold text-sm">
                          <FiZap className="h-3.5 w-3.5" />{fmtI(bal)} ICAN
                        </div>
                        <p className={`text-[11px] ${p.muted}`}>{fmtUGX(bal)}</p>
                        <p className={`text-[11px] ${p.muted}`}>Earned: {fmtI(lifetimeEarned[sp.user_id] || 0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </>
        )}

        {/* ── CUSTOMERS ── */}
        {tab === 'customers' && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-bold">Customers</p>
              <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${p.pill}`}>{customers.length} total</span>
            </div>
            {filterU(customers).length === 0 ? <Empty msg="No customers found." p={p} /> :
              filterU(customers).map(u => {
                const bal = wallets[u.id] || 0;
                const sub = subsReady ? subFor(u.id, 'customer') : null;
                return (
                  <div key={u.id} className={`rounded-2xl border p-4 ${p.card}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold truncate">{u.full_name || '—'}</p>
                          {sub && <Badge label={sub.plan==='basic'?'Bronze':sub.plan==='pro'?'Silver':'Gold'} cls={planColor(sub.plan)} />}
                        </div>
                        {u.email && <p className={`text-xs truncate ${p.muted}`}>{u.email}</p>}
                        {u.phone && <p className={`text-xs ${p.muted}`}>{u.phone}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                          <FiStar className="h-3.5 w-3.5" />{fmtI(bal)} ICAN
                        </div>
                        <p className={`text-[11px] ${p.muted}`}>{fmtUGX(bal)}</p>
                        <button onClick={() => grantBonus(u.id, 1)}
                          className="mt-1.5 flex items-center gap-1 ml-auto rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-400/20 transition">
                          <FiGift className="h-3 w-3" /> +1 ICAN
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </>
        )}

        {/* ── SUBSCRIPTIONS ── */}
        {tab === 'subscriptions' && (
          <SubsManager
            subsReady={subsReady} subs={subs}
            supermarts={supermarts} suppliers={suppliers} customers={customers}
            smMembersMap={smMembersMap} wallets={wallets}
            upsertSub={upsertSub} toggleSub={toggleSub}
            p={p}
          />
        )}

        {/* ── REWARDS ── */}
        {tab === 'rewards' && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat icon={FiZap}        label="Total icaneracoin" value={fmtI(totalIcan)}              grad="from-cyan-500 to-sky-600"      p={p} />
              <Stat icon={FiDollarSign} label="UGX equivalent"   value={'UGX '+fmt(totalIcan*ICAN_TO_UGX)} grad="from-violet-500 to-fuchsia-600" p={p} />
              <Stat icon={FiTrendingUp} label="Rate"             value="1 ICAN = 5k UGX"              grad="from-amber-500 to-orange-600"  p={p} />
            </div>
            <div className={`rounded-2xl border overflow-hidden ${p.card}`}>
              <div className={`px-5 py-3 border-b text-xs font-semibold uppercase tracking-wider ${p.muted} ${p.divider}`}>
                Customer icaneracoin Leaderboard
              </div>
              {customers
                .map(u => ({ ...u, bal: wallets[u.id] || 0 }))
                .sort((a, b) => b.bal - a.bal).slice(0, 25)
                .map((u, i) => (
                  <div key={u.id} className={`flex items-center gap-3 px-5 py-3.5 border-b last:border-0 ${p.divider}`}>
                    <span className={`w-5 text-center text-xs font-black flex-shrink-0 ${
                      i===0?'text-amber-400':i===1?'text-slate-300':i===2?'text-orange-500':p.muted}`}>{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.full_name || '—'}</p>
                      <p className={`text-xs truncate ${p.muted}`}>{u.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className="text-sm font-bold text-amber-400">{fmtI(u.bal)} ICAN</p>
                      <p className={`text-[11px] ${p.muted}`}>{fmtUGX(u.bal)}</p>
                    </div>
                    <button onClick={() => grantBonus(u.id, 5)}
                      className="flex-shrink-0 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-400 hover:bg-amber-400/20 transition">
                      +5
                    </button>
                  </div>
                ))
              }
              {customers.length === 0 && <p className={`px-5 py-10 text-center text-sm ${p.muted}`}>No customers yet.</p>}
            </div>
          </>
        )}

        {/* ── SYSTEM ── */}
        {tab === 'system' && (
          <SystemTab
            systemTotals={systemTotals}
            supermarts={supermarts}
            smMembersMap={smMembersMap}
            wallets={wallets}
            subs={subs}
            p={p}
          />
        )}

      </main>
    </div>
  );
};

// ─── Root — requires a real Supabase session on the dev_operators
// allowlist (checked server-side by is_dev_operator(), never a shared
// secret shipped to the client). sessionStorage is now only a cosmetic
// flag ChatWidget reads to hide itself for a confirmed developer — every
// dev_* RPC call still independently re-verifies authorization itself. ──
const DevPanel = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // checking | authorized | denied

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setStatus('denied');
        return;
      }
      const { data, error } = await supabase.rpc('is_dev_operator');
      if (cancelled) return;
      if (error || !data) {
        setStatus('denied');
        return;
      }
      sessionStorage.setItem(SESSION_KEY, 'true');
      setStatus('authorized');
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (status === 'denied') navigate('/login', { replace: true });
  }, [status, navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    navigate('/', { replace: true });
  };

  if (status !== 'authorized') return null;
  return <DevDashboard onLogout={handleLogout} />;
};

export default DevPanel;
