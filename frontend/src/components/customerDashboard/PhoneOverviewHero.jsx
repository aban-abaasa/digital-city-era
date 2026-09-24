import React from 'react';
import {
  FiPackage, FiGift, FiBriefcase, FiUserPlus, FiShoppingBag, FiChevronRight,
  FiNavigation, FiSend, FiCalendar, FiCreditCard, FiSearch, FiShare2,
} from 'react-icons/fi';
import AnimatedCounter from '../AnimatedCounter';
import LoyaltyCard from './LoyaltyCard';

// The phone Overview as one short scroll with as few boxes as possible:
//   1. the membership card
//   2. ONE card holding the live counts and the service shortcuts
//   3. ONE list card for "get started" (shop / create business / supplier)
// Phone only (the caller renders it inside an `sm:hidden` wrapper).
export default function PhoneOverviewHero({
  firstName, membershipLevel, badge, points, visits, totalSpent, formatCurrency, memberSinceYear,
  activeOrders, availableRewards,
  onNavigate, onTrackOrders, onRedeemRewards, onRefer, onWallet, onCreateBusiness, onBecomeSupplier,
}) {
  const services = [
    { label: 'Book Ride', icon: FiNavigation, tone: 'bg-indigo-50 text-indigo-600', onClick: () => onNavigate('book-ride') },
    { label: 'Delivery',  icon: FiPackage,    tone: 'bg-sky-50 text-sky-600',       onClick: () => onNavigate('delivery') },
    { label: 'Journey',   icon: FiSend,       tone: 'bg-violet-50 text-violet-600', onClick: () => onNavigate('journey') },
    { label: 'Book',      icon: FiCalendar,   tone: 'bg-teal-50 text-teal-600',     onClick: () => onNavigate('book-service') },
    { label: 'Rewards',   icon: FiGift,       tone: 'bg-amber-50 text-amber-600',   onClick: () => onNavigate('rewards') },
    { label: 'Wallet',    icon: FiCreditCard, tone: 'bg-emerald-50 text-emerald-600', onClick: onWallet },
    { label: 'Track',     icon: FiSearch,     tone: 'bg-rose-50 text-rose-600',     onClick: onTrackOrders },
    { label: 'Refer',     icon: FiShare2,     tone: 'bg-fuchsia-50 text-fuchsia-600', onClick: onRefer },
  ];

  const start = [
    { title: 'Shop the Store', desc: 'Browse products and start shopping', icon: FiShoppingBag, tone: 'bg-[#1e1b4b] text-[#e6c980]', onClick: () => onNavigate('shop') },
    { title: 'Create Your Business', desc: 'Set up your store, managers and cashiers', icon: FiBriefcase, tone: 'bg-emerald-50 text-emerald-600', onClick: onCreateBusiness },
    { title: 'Become a Supplier', desc: 'Join the live supplier network', icon: FiUserPlus, tone: 'bg-violet-50 text-violet-600', onClick: onBecomeSupplier },
  ];

  return (
    <div className="space-y-4 text-slate-800">
      <LoyaltyCard
        membershipLevel={membershipLevel}
        badge={badge}
        points={points}
        visits={visits}
        totalSpent={totalSpent}
        formatCurrency={formatCurrency}
        memberSinceYear={memberSinceYear}
        firstName={firstName}
      />

      {/* Live counts + services in a single card */}
      <section className="classic-card classic-rise overflow-hidden" style={{ '--d': '90ms' }} aria-label="At a glance and services">
        <div className="grid grid-cols-2 divide-x divide-[#c4a052]/25 border-b border-[#c4a052]/25 bg-[#fdfaf2]">
          <button type="button" onClick={onTrackOrders} className="flex items-center gap-2.5 px-4 py-3 text-left transition-colors active:bg-[#f6efdc]">
            <FiPackage className="h-[18px] w-[18px] flex-shrink-0 text-blue-600" />
            <span className="min-w-0">
              <span className="block font-classic-display text-xl font-bold leading-none tabular-nums text-slate-900">
                <AnimatedCounter value={activeOrders} duration={900} />
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-slate-500">Active orders</span>
            </span>
          </button>
          <button type="button" onClick={onRedeemRewards} className="flex items-center gap-2.5 px-4 py-3 text-left transition-colors active:bg-[#f6efdc]">
            <FiGift className="h-[18px] w-[18px] flex-shrink-0 text-emerald-600" />
            <span className="min-w-0">
              <span className="block font-classic-display text-xl font-bold leading-none tabular-nums text-slate-900">
                <AnimatedCounter value={availableRewards} duration={900} />
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-slate-500">Rewards ready</span>
            </span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-x-0.5 gap-y-0.5 p-2 min-[360px]:p-2.5">
          {services.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.onClick}
              className="flex flex-col items-center gap-1 rounded-2xl px-1 py-2 transition-transform active:scale-95"
            >
              <span className={`grid h-10 w-10 place-items-center rounded-full ring-1 ring-inset ring-black/5 ${s.tone}`}>
                <s.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[11px] font-medium leading-tight text-slate-700">{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Get started — one list card instead of a hero plus two more cards */}
      <section className="classic-card classic-rise overflow-hidden" style={{ '--d': '170ms' }} aria-label="Get started">
        <p className="classic-eyebrow px-4 pt-3.5">Get started</p>
        <div className="mt-1 divide-y divide-[#c4a052]/20">
          {start.map((a) => (
            <button
              key={a.title}
              type="button"
              onClick={a.onClick}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[#f6efdc]"
            >
              <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ring-1 ring-inset ring-black/5 ${a.tone}`}>
                <a.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-tight text-slate-800">{a.title}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{a.desc}</span>
              </span>
              <FiChevronRight className="h-5 w-5 flex-shrink-0 text-[#c4a052]" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
