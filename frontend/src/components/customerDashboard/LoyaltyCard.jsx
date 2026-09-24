import React from 'react';
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
export const POINTS_PER_REWARD = 1000;

// The membership card, shared by the phone and web Overview. One compact
// face: tier + holder on top, points and "next reward" side by side, a
// progress rule, then visits / spent. `wide` scales the type up for desktop.
export default function LoyaltyCard({
  membershipLevel, badge, points, visits, totalSpent, formatCurrency, memberSinceYear, firstName, wide = false,
}) {
  const cycle = points % POINTS_PER_REWARD;
  const toNext = POINTS_PER_REWARD - cycle;
  const pct = Math.round((cycle / POINTS_PER_REWARD) * 100);
  const face = TIER_FACE[membershipLevel] || TIER_FACE.bronze;
  const spentText = formatCurrency(totalSpent);
  const spentSize = wide
    ? (spentText.length > 12 ? 'text-lg' : 'text-2xl')
    : (spentText.length > 11 ? 'text-sm' : spentText.length > 8 ? 'text-base' : 'text-xl');

  return (
    <section
      className={`classic-rise relative overflow-hidden bg-gradient-to-br text-white shadow-[0_18px_34px_-16px_rgba(30,27,75,0.6)] ${face} ${
        wide ? 'rounded-[26px] p-7' : 'rounded-[20px] p-4 min-[360px]:p-5'
      }`}
      aria-label="Membership"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-white/10" />
      <span aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full border border-white/15" />
      <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full border border-white/10" />
      <span aria-hidden className="pointer-events-none absolute inset-[5px] rounded-[15px] border border-[#e6c980]/35" style={wide ? { borderRadius: 21 } : undefined} />
      <span aria-hidden className="classic-glint" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-[#e6c980]/60">
            {badge.icon} {badge.label}
          </span>
          <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f3dc9b]">
            {firstName ? `${firstName} · ` : ''}Since {memberSinceYear}
          </p>
        </div>

        <div className={`flex items-end justify-between gap-4 ${wide ? 'mt-8' : 'mt-4'}`}>
          <div>
            <p className={`font-classic-display font-bold leading-none tabular-nums ${wide ? 'text-[72px]' : 'text-[44px]'}`}>
              <AnimatedCounter value={points} duration={1600} />
            </p>
            <p className={`text-white/75 ${wide ? 'mt-2 text-sm' : 'mt-1 text-xs'}`}>Loyalty points</p>
          </div>
          <div className="pb-0.5 text-right">
            <p className={`font-classic-display font-bold leading-none text-[#f3dc9b] tabular-nums ${wide ? 'text-2xl' : 'text-lg'}`}>
              {toNext.toLocaleString()} pts
            </p>
            <p className={`text-white/75 ${wide ? 'mt-1.5 text-xs' : 'mt-1 text-[11px]'}`}>to next reward</p>
          </div>
        </div>

        <div
          className={`overflow-hidden rounded-full bg-black/25 ${wide ? 'mt-5 h-2' : 'mt-3 h-1.5'}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Progress to next reward"
        >
          <div className="h-full rounded-full bg-gradient-to-r from-[#f3dc9b] to-[#e6c980] transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>

        <div className={`h-px bg-gradient-to-r from-transparent via-white/30 to-transparent ${wide ? 'mt-6' : 'mt-3.5'}`} />

        <div className={`grid grid-cols-2 gap-3 ${wide ? 'mt-4' : 'mt-3'}`}>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">Total visits</p>
            <p className={`mt-0.5 font-classic-display font-bold leading-tight tabular-nums ${wide ? 'text-2xl' : 'text-xl'}`}>
              <AnimatedCounter value={visits} duration={1200} />
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">Total spent</p>
            <p className={`mt-0.5 truncate font-classic-display font-bold leading-tight ${spentSize}`}>{spentText}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
