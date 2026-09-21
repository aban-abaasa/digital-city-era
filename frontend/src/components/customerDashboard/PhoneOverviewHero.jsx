import React from 'react';
import {
  FiPackage, FiGift, FiBriefcase, FiUserPlus, FiShoppingBag, FiArrowRight, FiChevronRight,
  FiNavigation, FiSend, FiCalendar, FiCreditCard, FiSearch, FiShare2,
} from 'react-icons/fi';
import AnimatedCounter from '../AnimatedCounter';

// Card face per tier — a deep, slightly metallic gradient (the black wash in
// the card itself keeps white text legible even on the lighter tiers).
const TIER_FACE = {
  bronze:   'from-[#8a4b1f] via-[#b4652a] to-[#5e3113]',
  silver:   'from-slate-500 via-slate-400 to-slate-700',
  gold:     'from-[#b8860b] via-[#d4a017] to-[#7a5a08]',
  platinum: 'from-indigo-700 via-violet-600 to-slate-800',
};

// Points cycle: a reward every 1,000 points (same rule the old "Next Reward"
// stat used), shown as a progress bar toward the next one.
const POINTS_PER_REWARD = 1000;

function SectionHeading({ children }) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="font-classic-display text-lg font-semibold text-slate-800">{children}</h3>
      <div className="gold-rule flex-1" />
    </div>
  );
}

// Everything the old Membership / Stats / Actions tab switcher hid behind
// three taps, laid out as one scroll: loyalty card → live counts → service
// shortcuts → things to do next. Phone only (the caller renders it inside an
// `sm:hidden` wrapper).
export default function PhoneOverviewHero({
  firstName, membershipLevel, badge, points, visits, totalSpent, formatCurrency, memberSinceYear,
  activeOrders, availableRewards,
  onNavigate, onTrackOrders, onRedeemRewards, onRefer, onWallet, onCreateBusiness, onBecomeSupplier,
}) {
  const cycle = points % POINTS_PER_REWARD;
  const toNext = POINTS_PER_REWARD - cycle;
  const pct = Math.round((cycle / POINTS_PER_REWARD) * 100);
  const face = TIER_FACE[membershipLevel] || TIER_FACE.bronze;
  const spentText = formatCurrency(totalSpent);
  const spentSize = spentText.length > 11 ? 'text-sm' : spentText.length > 8 ? 'text-base' : 'text-xl';

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

  return (
    <div className="space-y-6 text-slate-800">
      {/* Loyalty card */}
      <section
        className={`relative overflow-hidden rounded-[22px] bg-gradient-to-br p-4 text-white shadow-[0_18px_34px_-16px_rgba(30,27,75,0.6)] min-[360px]:p-5 ${face}`}
        aria-label="Membership"
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-white/10" />
        <span aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full border border-white/15" />
        <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full border border-white/10" />
        <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[17px] border border-[#e6c980]/35" />

        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">Membership</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-[#e6c980]/60">
              {badge.icon} {badge.label}
            </span>
          </div>

          <p className="mt-5 font-classic-display text-[46px] font-bold leading-none tabular-nums">
            <AnimatedCounter value={points} duration={1600} />
          </p>
          <p className="mt-1.5 text-xs text-white/75">Loyalty points</p>

          <div className="mt-4">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-black/25"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label="Progress to next reward"
            >
              <div className="h-full rounded-full bg-gradient-to-r from-[#f3dc9b] to-[#e6c980] transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-white/80">
              <span className="font-semibold text-[#f3dc9b]">{toNext.toLocaleString()} pts</span> to your next reward
            </p>
          </div>

          <div className="mt-4 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">Total visits</p>
              <p className="mt-0.5 font-classic-display text-xl font-bold leading-tight tabular-nums">
                <AnimatedCounter value={visits} duration={1200} />
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">Total spent</p>
              <p className={`mt-0.5 truncate font-classic-display font-bold leading-tight ${spentSize}`}>{spentText}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f3dc9b]">
            <span className="truncate">{firstName}</span>
            <span className="flex-shrink-0">Member since {memberSinceYear}</span>
          </div>
        </div>
      </section>

      {/* Live counts — both are tappable shortcuts to where you'd act on them */}
      <section className="grid grid-cols-2 gap-3" aria-label="At a glance">
        <button
          type="button"
          onClick={onTrackOrders}
          className="classic-card flex flex-col items-start gap-2.5 p-3.5 text-left transition-transform active:scale-[0.98] min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3 min-[380px]:p-4"
        >
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-black/5">
            <FiPackage className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-classic-display text-2xl font-bold leading-none tabular-nums text-slate-900">
              <AnimatedCounter value={activeOrders} duration={900} />
            </span>
            <span className="mt-1 block text-[11px] leading-tight text-slate-500">Active orders</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onRedeemRewards}
          className="classic-card flex flex-col items-start gap-2.5 p-3.5 text-left transition-transform active:scale-[0.98] min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3 min-[380px]:p-4"
        >
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-black/5">
            <FiGift className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-classic-display text-2xl font-bold leading-none tabular-nums text-slate-900">
              <AnimatedCounter value={availableRewards} duration={900} />
            </span>
            <span className="mt-1 block text-[11px] leading-tight text-slate-500">Rewards ready</span>
          </span>
        </button>
      </section>

      {/* Service shortcuts */}
      <section className="space-y-3">
        <SectionHeading>Services</SectionHeading>
        <div className="classic-card grid grid-cols-4 gap-x-0.5 gap-y-1 p-2 min-[360px]:gap-x-1 min-[360px]:p-2.5">
          {services.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.onClick}
              className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-transform active:scale-95"
            >
              <span className={`grid h-11 w-11 place-items-center rounded-full ring-1 ring-inset ring-black/5 min-[360px]:h-12 min-[360px]:w-12 ${s.tone}`}>
                <s.icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-medium leading-tight text-slate-700">{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Do next */}
      <section className="space-y-3">
        <SectionHeading>Get started</SectionHeading>

        <button
          type="button"
          onClick={() => onNavigate('shop')}
          className="group relative w-full overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] p-5 text-left text-white shadow-[0_18px_34px_-16px_rgba(30,27,75,0.7)] ring-1 ring-inset ring-[#c4a052]/40 transition-transform active:scale-[0.99]"
        >
          <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full border border-[#c4a052]/25" />
          <span aria-hidden className="pointer-events-none absolute -right-5 -top-5 h-28 w-28 rounded-full border border-[#c4a052]/20" />
          <span aria-hidden className="pointer-events-none absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-violet-500/25 blur-2xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#e6c980]">Store</p>
              <p className="mt-1 font-classic-display text-[22px] font-bold leading-tight min-[360px]:text-[26px]">Shop the Store</p>
              <p className="mt-1 text-[13px] leading-snug text-indigo-100/80">Browse products, track orders, and start shopping right away.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#f3dc9b] to-[#e6c980] px-4 py-2 text-xs font-bold text-[#3b2a06] shadow-lg shadow-black/20">
                Start shopping <FiArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
            <span className="hidden h-16 w-16 flex-shrink-0 place-items-center rounded-full bg-white/5 ring-1 ring-[#c4a052]/50 min-[360px]:grid">
              <FiShoppingBag className="h-7 w-7 text-[#e6c980]" />
            </span>
          </div>
        </button>

        {[
          {
            title: 'Create Your Business',
            desc: 'Supermarket, hotel, boutique, or restaurant/café — set up your store and assign managers or cashiers.',
            icon: FiBriefcase,
            tone: 'bg-emerald-50 text-emerald-600',
            onClick: onCreateBusiness,
          },
          {
            title: 'Become a Supplier',
            desc: 'Create a supplier account, or let your store supply other businesses through the live supplier network.',
            icon: FiUserPlus,
            tone: 'bg-violet-50 text-violet-600',
            onClick: onBecomeSupplier,
          },
        ].map((a) => (
          <button
            key={a.title}
            type="button"
            onClick={a.onClick}
            className="classic-card flex w-full items-center gap-3 p-4 text-left transition-transform active:scale-[0.98]"
          >
            <span className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl ring-1 ring-inset ring-black/5 ${a.tone}`}>
              <a.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-tight text-slate-800">{a.title}</span>
              <span className="mt-1 block text-xs leading-snug text-slate-500">{a.desc}</span>
            </span>
            <FiChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
          </button>
        ))}
      </section>
    </div>
  );
}
