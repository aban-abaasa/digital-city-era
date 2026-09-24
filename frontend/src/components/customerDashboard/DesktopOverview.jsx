import React from 'react';
import { FiPackage, FiGift, FiStar, FiTrendingUp, FiBriefcase, FiUserPlus, FiShoppingBag, FiArrowRight } from 'react-icons/fi';
import AnimatedCounter from '../AnimatedCounter';
import LoyaltyCard, { POINTS_PER_REWARD } from './LoyaltyCard';

// Web (sm and up) Overview: the membership card beside a ledger of the
// customer's figures, then three engraved "next step" cards. Ivory, ink and
// gold — no rainbow gradients — with quiet one-shot entrances and hover lifts.
export default function DesktopOverview({
  firstName, membershipLevel, badge, points, visits, totalSpent, formatCurrency, memberSinceYear,
  activeOrders, availableRewards,
  onNavigate, onTrackOrders, onRedeemRewards, onCreateBusiness, onBecomeSupplier,
}) {
  const toNext = POINTS_PER_REWARD - (points % POINTS_PER_REWARD);

  const ledger = [
    { label: 'Active orders', icon: FiPackage, tone: 'text-blue-600 bg-blue-50', value: <AnimatedCounter value={activeOrders} duration={1000} />, onClick: onTrackOrders, hint: 'Track' },
    { label: 'Rewards ready', icon: FiGift, tone: 'text-emerald-600 bg-emerald-50', value: <AnimatedCounter value={availableRewards} duration={1200} />, onClick: onRedeemRewards, hint: 'Redeem' },
    { label: 'Member since', icon: FiStar, tone: 'text-amber-600 bg-amber-50', value: memberSinceYear },
    { label: 'Next reward in', icon: FiTrendingUp, tone: 'text-violet-600 bg-violet-50', value: <>{toNext.toLocaleString()}<span className="ml-1 text-base font-semibold text-slate-500">pts</span></> },
  ];

  const steps = [
    {
      eyebrow: 'Store', title: 'Shop the Store', icon: FiShoppingBag, cta: 'Start shopping',
      desc: 'Browse products, track orders, and start shopping right away.',
      onClick: () => onNavigate('shop'), dark: true,
    },
    {
      eyebrow: 'Admin setup', title: 'Create Your Business', icon: FiBriefcase, cta: 'Set up your store',
      desc: 'Supermarket, hotel, boutique, or restaurant/café — set up your store and assign managers or cashiers.',
      onClick: onCreateBusiness,
    },
    {
      eyebrow: 'Supplier network', title: 'Become a Supplier', icon: FiUserPlus, cta: 'Open supplier flow',
      desc: 'Create a supplier account, or let your store supply other businesses through the live supplier network.',
      onClick: onBecomeSupplier,
    },
  ];

  return (
    <div className="mb-8 space-y-6">
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <LoyaltyCard
          wide
          membershipLevel={membershipLevel}
          badge={badge}
          points={points}
          visits={visits}
          totalSpent={totalSpent}
          formatCurrency={formatCurrency}
          memberSinceYear={memberSinceYear}
          firstName={firstName}
        />

        <section className="classic-card classic-rise flex flex-col p-7" style={{ '--d': '100ms' }} aria-label="Your figures">
          <p className="classic-eyebrow">At a glance</p>
          <h2 className="font-classic-display mt-1 text-[28px] font-semibold leading-tight text-[#1e1b4b]">
            Welcome back, {firstName}
          </h2>
          <div className="gold-rule mt-4" />

          <div className="mt-2 grid flex-1 grid-cols-2 divide-x divide-[#c4a052]/25">
            {ledger.map((item, i) => {
              const Tag = item.onClick ? 'button' : 'div';
              return (
                <Tag
                  key={item.label}
                  type={item.onClick ? 'button' : undefined}
                  onClick={item.onClick}
                  className={`group flex items-center gap-4 py-5 text-left ${i % 2 === 0 ? 'pr-5' : 'pl-6'} ${i > 1 ? 'border-t border-[#c4a052]/25' : ''} ${item.onClick ? 'cursor-pointer' : ''}`}
                >
                  <span className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-full ring-1 ring-inset ring-black/5 transition-transform group-hover:scale-105 ${item.tone}`}>
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-classic-display text-3xl font-bold leading-none tabular-nums text-slate-900">{item.value}</span>
                    <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      {item.label}
                      {item.hint && <span className="text-[#a17c28] normal-case tracking-normal">· {item.hint} <FiArrowRight className="classic-arrow inline h-3 w-3" /></span>}
                    </span>
                  </span>
                </Tag>
              );
            })}
          </div>
        </section>
      </div>

      <div className="flex items-center gap-4">
        <h3 className="font-classic-display text-xl font-semibold text-[#1e1b4b]">Where to next</h3>
        <div className="gold-rule flex-1" />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={s.onClick}
            style={{ '--d': `${160 + i * 90}ms` }}
            className={`group classic-rise classic-lift relative overflow-hidden rounded-[22px] border p-6 text-left ${
              s.dark
                ? 'border-[#c4a052]/50 bg-gradient-to-br from-[#1e1b4b] via-[#28246b] to-[#3b2a6e] text-white shadow-[0_18px_34px_-18px_rgba(30,27,75,0.75)]'
                : 'border-[#c4a052]/30 bg-gradient-to-b from-white to-[#fbf8f0] text-slate-800 shadow-[0_12px_26px_-20px_rgba(30,27,75,0.4)]'
            }`}
          >
            <span aria-hidden className={`pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border ${s.dark ? 'border-[#c4a052]/30' : 'border-[#c4a052]/25'}`} />
            <span aria-hidden className={`pointer-events-none absolute -right-3 -top-3 h-20 w-20 rounded-full border ${s.dark ? 'border-[#c4a052]/20' : 'border-[#c4a052]/15'}`} />
            <span className={`relative grid h-12 w-12 place-items-center rounded-full ring-1 ${s.dark ? 'bg-white/10 text-[#e6c980] ring-[#c4a052]/60' : 'bg-[#1e1b4b] text-[#e6c980] ring-[#c4a052]/50'}`}>
              <s.icon className="h-5 w-5" />
            </span>
            <p className={`relative mt-5 text-[10px] font-semibold uppercase tracking-[0.24em] ${s.dark ? 'text-[#e6c980]' : 'text-[#a17c28]'}`}>{s.eyebrow}</p>
            <h4 className="font-classic-display relative mt-1 text-2xl font-bold leading-tight">{s.title}</h4>
            <p className={`relative mt-2 text-sm leading-relaxed ${s.dark ? 'text-indigo-100/80' : 'text-slate-500'}`}>{s.desc}</p>
            <span className={`relative mt-5 inline-flex items-center gap-2 text-sm font-semibold ${s.dark ? 'text-[#f3dc9b]' : 'text-[#1e1b4b]'}`}>
              {s.cta} <FiArrowRight className="classic-arrow h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
