import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { QRCodeCanvas } from 'qrcode.react';
import {
  ArrowDown, ArrowUp, Banknote, Check, ChevronDown, Copy, CreditCard, Eye, EyeOff, Leaf, QrCode, RefreshCw,
  ScanLine, Search, ShoppingBasket, Sparkles, X,
} from 'lucide-react';

/**
 * SupermartKera's IcanEra wallet, dressed as a shopping till: an emerald store
 * card with a tear-off wallet-ID strip (and barcode), aisle-style action tiles,
 * a "where your ICAN goes" mix, and a paper till-receipt for the history.
 *
 * Emerald + gold is SupermartKera's own palette (the store portals are emerald),
 * with the same gold hairlines the classic BodaGoEra wallet uses.
 */

const PAPER = '#fbf8f0';
const INK = '#052e22';

// ── helpers ─────────────────────────────────────────────────────────────────

export const fmtLocal = (amount, currency) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code', notation: amount >= 1e9 ? 'compact' : 'standard', maximumFractionDigits: amount < 100 ? 2 : amount >= 1e9 ? 2 : 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
};

// A 16-digit account number reads in fours, like a card: 1002 3456 7890 1234.
const compactFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 });

/** 5793.6514 → "5.79K", 3_400_000 → "3.4M", 5e12 → "5T"; small values keep their decimals. */
export const compactNumber = (n) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1000) return compactFmt.format(v);
  return v.toLocaleString('en', { maximumFractionDigits: abs < 1 ? 4 : 2 });
};

/** The exact 4-decimal amount, until it is too wide for a phone (a million or more), then compact. */
export const formatAmount = (n) => {
  const v = Number(n) || 0;
  return Math.abs(v) >= 1_000_000 ? compactFmt.format(v) : v.toFixed(4);
};

export const shortId = (a) => (/^\d{16}$/.test(a || '') ? a.replace(/(\d{4})(?=\d)/g, '$1 ') : a && a.length > 18 ? `${a.slice(0, 9)}…${a.slice(-6)}` : a || '');

/** A decorative barcode drawn from the text itself — same text, same bars. */
export function Barcode({ value, height = 34, color = '#f6e7bd', className = '' }) {
  const bars = useMemo(() => {
    const out = [];
    let x = 0;
    const text = `*${value || 'ICAN'}*`;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      for (let i = 0; i < 5; i++) {
        const w = 1 + ((code >> i) & 1) + (i === 2 ? 1 : 0);
        if (i % 2 === 0) out.push({ x, w });
        x += w;
      }
      x += 2;
    }
    return { rects: out, width: x };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${bars.width} ${height}`} preserveAspectRatio="none" className={className} style={{ width: '100%', height }} aria-hidden="true">
      {bars.rects.map((r, i) => <rect key={i} x={r.x} y="0" width={r.w} height={height} fill={color} />)}
    </svg>
  );
}

// ── sheet (every wallet dialog) ─────────────────────────────────────────────

export function Sheet({ title, onClose, children, z = 50 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 flex items-end justify-center bg-[#021a12]/70 backdrop-blur-[2px] sm:items-center sm:p-4" style={{ zIndex: z }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] border border-[#c4a052]/40 shadow-[0_-18px_50px_-20px_rgba(2,26,18,0.7)] sm:rounded-[28px]"
        style={{ background: `linear-gradient(180deg, ${PAPER}, #f3eddb)`, color: INK }}
      >
        <div className="sticky top-0 z-10 px-4 pb-3 pt-3 min-[380px]:px-5" style={{ background: `linear-gradient(180deg, ${PAPER} 80%, rgba(251,248,240,0.9))` }}>
          <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-emerald-700/30 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-classic-display text-[20px] font-bold leading-tight">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-800/25 text-emerald-800 hover:bg-emerald-800/10">
              <X size={16} />
            </button>
          </div>
          <div className="mt-3 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c4a052 20%, #c4a052 80%, transparent)' }} />
        </div>
        <div className="px-4 pb-6 pt-2 min-[380px]:px-5" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>{children}</div>
      </div>
    </div>
  );
}

// Field styles for the light sheet.
export const FIELD = 'w-full rounded-xl border border-emerald-800/25 bg-white px-4 py-3 text-[16px] text-stone-800 placeholder-stone-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/25';
export const LABEL = 'mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-emerald-800';
export const BTN_PRIMARY = 'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-bold text-[#f6e7bd] shadow-[0_10px_22px_-14px_rgba(0,0,0,0.7)] ring-1 ring-inset ring-[#c4a052]/55 transition active:scale-[0.985] disabled:opacity-50 bg-gradient-to-br from-[#053b2c] to-[#0a5a41]';
export const BTN_OUTLINE = 'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-emerald-800/35 px-4 text-[15px] font-bold text-emerald-900 transition hover:bg-emerald-800/10 active:scale-[0.985] disabled:opacity-50';

export function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={BTN_OUTLINE}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          toast.info('Copied');
          setTimeout(() => setDone(false), 1500);
        }).catch(() => toast.error('Could not copy'));
      }}
    >
      {done ? <Check size={15} /> : <Copy size={15} />} {done ? 'Copied' : label}
    </button>
  );
}

export function AddressQr({ address }) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto w-fit rounded-2xl border border-[#c4a052]/50 bg-white p-4 shadow-[0_14px_28px_-18px_rgba(5,46,34,0.5)]">
        <QRCodeCanvas value={address} size={196} level="M" fgColor={INK} bgColor="#ffffff" />
      </div>
      <p className="font-mono text-[14px] tabular-nums tracking-wider text-stone-700">{shortId(address)}</p>
      <p className="text-[12px] leading-relaxed text-stone-500">Show this at any till, or share this account number to receive IcanEra from any IcanEra app.</p>
      <CopyButton text={address} label="Copy address" />
    </div>
  );
}

// ── the store card ──────────────────────────────────────────────────────────

const notch = (pos) => {
  const at = pos === 'bottom' ? '100%' : '0';
  const mask = `radial-gradient(circle 11px at 0 ${at}, transparent 96%, #000) left / 51% 100% no-repeat, radial-gradient(circle 11px at 100% ${at}, transparent 96%, #000) right / 51% 100% no-repeat`;
  return { mask, WebkitMask: mask };
};

const CARD_BG = 'linear-gradient(135deg, #04281e 0%, #075440 52%, #0b6b4f 100%)';

export function StoreCard({ balanceText, exactText, hidden, onToggleHidden, onRefresh, refreshing, display, fallbackPrice, localBalance, currency, address, onShowQr }) {
  const size = balanceText.length > 11
    ? 'text-[26px] min-[380px]:text-[30px]'
    : balanceText.length > 8 ? 'text-[30px] min-[380px]:text-[36px]' : 'text-[36px] min-[380px]:text-[44px]';
  const price = Number(display?.price_local ?? fallbackPrice);

  return (
    <section aria-label="IcanEra wallet balance" style={{ filter: 'drop-shadow(0 22px 22px rgba(3, 40, 29, 0.38))' }}>
      {/* top half */}
      <div className="relative overflow-hidden rounded-t-[26px] px-4 pb-6 pt-5 text-white min-[380px]:px-5" style={{ background: CARD_BG, ...notch('bottom') }}>
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border border-[#e6c980]/25" />
        <span aria-hidden className="pointer-events-none absolute -right-5 -top-5 h-28 w-28 rounded-full border border-[#e6c980]/20" />
        <span aria-hidden className="pointer-events-none absolute -bottom-14 -left-8 h-40 w-40 rounded-full border border-[#e6c980]/15" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/5" />
        <Leaf aria-hidden size={92} strokeWidth={1} className="pointer-events-none absolute -bottom-3 right-3 rotate-[-18deg] text-[#e6c980]/[0.08]" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5 text-[#e6c980] ring-1 ring-[#c4a052]/60"><ShoppingBasket size={19} /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.24em] text-[#e6c980]">IcanEra Wallet</p>
              <p className="mt-1 truncate font-classic-display text-[15px] font-semibold leading-tight text-white/90">Supermarket</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onToggleHidden} aria-label={hidden ? 'Show balance' : 'Hide balance'} aria-pressed={hidden} className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-[#e6c980] ring-1 ring-[#c4a052]/40 hover:bg-white/10">
              {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh balance" className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-[#e6c980] ring-1 ring-[#c4a052]/40 hover:bg-white/10 disabled:opacity-60">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="relative mt-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#e6c980]/80">Balance</p>
            {display?.country_name && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">{display.country_name} · {currency}</span>
            )}
          </div>
          <p className="mt-1.5 flex items-baseline gap-2 font-classic-display font-bold leading-none tabular-nums lining-nums" aria-live="polite">
            <span className={size} title={hidden ? undefined : exactText}>{hidden ? '••••••' : balanceText}</span>
          </p>
          <p className="mt-2.5 text-[13px] text-white/75">{hidden ? '••••' : `≈ ${fmtLocal(localBalance, currency)}`}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-white/50">
            <span>1 IcanEra = {fmtLocal(price, currency)} · live rate</span>
            {display?.is_protected && <span className="font-semibold text-emerald-300">✓ beating local inflation</span>}
          </p>
        </div>
      </div>

      {/* tear-off strip */}
      <div className="relative overflow-hidden rounded-b-[26px] px-5 pb-4 pt-5 text-white" style={{ background: 'linear-gradient(135deg, #062f23 0%, #0a5a41 100%)', ...notch('top') }}>
        <span aria-hidden className="pointer-events-none absolute left-6 right-6 top-0 border-t-2 border-dashed border-[#e6c980]/45" />
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e6c980]/75">Account number</p>
            <p className="mt-0.5 truncate font-mono text-[12px] tabular-nums tracking-tight text-white/85">{address ? shortId(address) : 'Generating…'}</p>
          </div>
          {address && (
            <>
              <button type="button" onClick={() => navigator.clipboard.writeText(address).then(() => toast.info('Address copied'))} aria-label="Copy wallet address" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#e6c980] hover:bg-white/10"><Copy size={15} /></button>
              <button type="button" onClick={onShowQr} aria-label="Show wallet QR code" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#e6c980] hover:bg-white/10"><QrCode size={16} /></button>
            </>
          )}
        </div>
        {address && <Barcode value={address} className="mt-3 opacity-80" />}
      </div>
    </section>
  );
}

// ── action tiles ────────────────────────────────────────────────────────────

const PRIMARY = [
  { key: 'pay', label: 'Pay', Icon: ScanLine },
  { key: 'send', label: 'Send', Icon: ArrowUp },
  { key: 'receive', label: 'Receive', Icon: ArrowDown },
  { key: 'buy', label: 'Buy', Icon: CreditCard },
];

export function ActionTiles({ onAction, embedded }) {
  const shell = embedded ? 'border-emerald-800/15 bg-white' : 'border-emerald-400/15 bg-white/[0.04]';
  const text = embedded ? 'text-stone-700' : 'text-emerald-50';
  const pill = embedded ? 'border-emerald-800/25 bg-white text-emerald-900 hover:bg-emerald-50' : 'border-emerald-300/25 bg-white/[0.04] text-emerald-100 hover:bg-white/10';
  return (
    <section aria-label="Wallet actions" className={`rounded-[22px] border p-4 ${shell}`}>
      <div className="grid grid-cols-4 gap-2">
        {PRIMARY.map(({ key, label, Icon }) => (
          <button key={key} type="button" onClick={() => onAction(key)} className="group flex flex-col items-center gap-1.5 rounded-2xl py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4a052]">
            <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-gradient-to-br from-[#053b2c] to-[#0a5a41] text-[#f6e7bd] shadow-[0_10px_20px_-12px_rgba(0,0,0,0.7)] ring-1 ring-inset ring-[#c4a052]/60 transition-transform group-active:scale-95">
              <Icon size={20} />
            </span>
            <span className={`text-[12px] font-semibold ${text}`}>{label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => onAction('sell')} className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border text-[13px] font-bold transition ${pill}`}><Banknote size={16} /> Sell IcanEra</button>
        <button type="button" onClick={() => onAction('sendout')} className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border text-[13px] font-bold transition ${pill}`}><ArrowUp size={16} /> Cash out</button>
      </div>
    </section>
  );
}

// ── where your ICAN goes ────────────────────────────────────────────────────

const APP_META = {
  'digital-city-era': { label: 'Supermarket', color: '#059669' },
  mybodaguy: { label: 'BodaGoEra', color: '#a17c28' },
  'farm-agent': { label: 'AgriBone', color: '#65a30d' },
  ican: { label: 'ICAN', color: '#0d9488' },
};

export function SpendMix({ transactions, earned, spent, tithe, cashback, hidden, embedded, fmt }) {
  const mix = useMemo(() => {
    const totals = new Map();
    for (const tx of transactions) {
      if (tx.direction !== 'out') continue;
      const key = tx.transaction_type === 'tithe' ? 'tithe' : tx.source_app;
      totals.set(key, (totals.get(key) || 0) + Number(tx.ican_amount));
    }
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    return {
      sum,
      parts: [...totals.entries()]
        .map(([key, value]) => ({ key, value, pct: sum ? (value / sum) * 100 : 0, label: key === 'tithe' ? 'Tithe' : APP_META[key]?.label || key, color: key === 'tithe' ? '#a8a29e' : APP_META[key]?.color || '#0d9488' }))
        .sort((a, b) => b.value - a.value),
    };
  }, [transactions]);

  const shell = embedded ? 'border-emerald-800/15 bg-white' : 'border-emerald-400/15 bg-white/[0.04]';
  const head = embedded ? 'text-stone-800' : 'text-white';
  const sub = embedded ? 'text-stone-500' : 'text-emerald-100/60';
  const line = embedded ? 'divide-emerald-800/15' : 'divide-emerald-300/15';

  return (
    <section aria-label="Wallet activity" className={`rounded-[22px] border p-4 ${shell}`}>
      <div className={`grid grid-cols-3 divide-x text-center ${line}`}>
        {[['Earned', earned], ['Spent', spent], ['Tithe', tithe]].map(([k, v]) => (
          <div key={k} className="px-2">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[#a17c28]">{k}</p>
            <p className={`mt-1 truncate font-classic-display text-[13px] font-bold tabular-nums lining-nums min-[380px]:text-[15px] ${head}`}>{hidden ? '••••' : v}</p>
          </div>
        ))}
      </div>

      <div className="my-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c4a052 25%, #c4a052 75%, transparent)' }} />

      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a17c28]">Where your IcanEra goes</p>
        {cashback > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600">
            <Sparkles size={11} /> {hidden ? '••••' : fmt(cashback)} cashback
          </span>
        )}
      </div>

      {mix.sum === 0 ? (
        <p className={`mt-3 text-[12.5px] ${sub}`}>Pay with IcanEra at the till to see how your spending splits across the IcanEra apps.</p>
      ) : (
        <>
          <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-black/10" role="img" aria-label="Spending split by app">
            {mix.parts.map((p) => <span key={p.key} style={{ width: `${p.pct}%`, background: p.color }} title={`${p.label} ${p.pct.toFixed(0)}%`} />)}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {mix.parts.map((p) => (
              <li key={p.key} className="flex items-center gap-2 text-[12px]">
                <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className={`min-w-0 flex-1 truncate ${embedded ? 'text-stone-700' : 'text-emerald-50'}`}>{p.label}</span>
                <span className={`tabular-nums ${sub}`}>{hidden ? '••' : `${p.pct.toFixed(0)}%`}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ── the till receipt ────────────────────────────────────────────────────────

const ZIGZAG = {
  height: 12,
  background: `linear-gradient(-45deg, transparent 8px, ${PAPER} 0), linear-gradient(45deg, transparent 8px, ${PAPER} 0)`,
  backgroundSize: '16px 100%',
  backgroundPosition: 'left bottom',
};

export function Receipt({ groups, renderRow, empty, footerId }) {
  return (
    <div style={{ filter: 'drop-shadow(0 14px 16px rgba(3, 40, 29, 0.25))' }}>
      <div className="px-4 pb-3 pt-5" style={{ background: PAPER, color: INK }}>
        <p className="text-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.28em] text-emerald-900/70">IcanEra · Supermarket</p>
        <p className="mt-0.5 text-center font-classic-display text-[17px] font-bold">Till receipt</p>
        <div className="mt-3 border-t-2 border-dotted border-emerald-900/25" />

        {groups.length === 0 ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700"><ShoppingBasket size={20} /></span>
            <p className="mt-3 font-classic-display text-[16px] font-semibold">{empty.title}</p>
            <p className="mt-1 text-[12.5px] text-stone-500">{empty.body}</p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mt-3">
              <p className="text-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.3em] text-emerald-900/55">· · {g.label} · ·</p>
              <ul className="mt-1 divide-y divide-dotted divide-emerald-900/15">{g.items.map(renderRow)}</ul>
            </div>
          ))
        )}

        <div className="mt-4 border-t-2 border-dotted border-emerald-900/25 pt-3 text-center">
          <Barcode value={footerId || 'ICANERA'} color={INK} height={30} className="opacity-70" />
          <p className="mt-1.5 font-mono text-[10px] tracking-[0.2em] text-emerald-900/55">THANK YOU · PAID WITH ICANERA</p>
        </div>
      </div>
      <div aria-hidden style={ZIGZAG} />
    </div>
  );
}

export function ReceiptRow({ label, sub, amount, local, tone, icon, onClick }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-emerald-900/[0.04] focus-visible:bg-emerald-900/[0.06] focus-visible:outline-none">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone.bg} ${tone.text}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">{label}</span>
          <span className="mt-0.5 block truncate font-mono text-[10.5px] text-stone-500">{sub}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block font-mono text-[14px] font-bold tabular-nums ${tone.text}`}>{amount}</span>
          <span className="block font-mono text-[10px] text-stone-400">{local}</span>
        </span>
      </button>
    </li>
  );
}

export function FilterTabs({ value, onChange, embedded }) {
  return (
    <div className={`flex gap-1 rounded-full border p-1 ${embedded ? 'border-emerald-800/20 bg-white' : 'border-emerald-300/20 bg-white/[0.04]'}`} role="tablist" aria-label="Filter transactions">
      {['all', 'in', 'out', 'tithe'].map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold capitalize transition-colors ${
            value === tab ? 'bg-gradient-to-br from-[#053b2c] to-[#0a5a41] text-[#f6e7bd] shadow-sm' : embedded ? 'text-stone-500 hover:text-emerald-800' : 'text-emerald-100/60 hover:text-white'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function Collapsible({ icon, title, subtitle, children, embedded }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-[22px] border p-4 ${embedded ? 'border-emerald-800/15 bg-white' : 'border-emerald-400/15 bg-white/[0.04]'}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-700/20">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className={`block font-classic-display text-[15px] font-semibold leading-tight ${embedded ? 'text-stone-800' : 'text-white'}`}>{title}</span>
          <span className={`block text-[11.5px] ${embedded ? 'text-stone-500' : 'text-emerald-100/60'}`}>{subtitle}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-[#a17c28] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className={`mt-3 border-t pt-3 ${embedded ? 'border-emerald-800/15' : 'border-emerald-300/15'}`}>{children}</div>}
    </div>
  );
}

export { RotateCcw, ShoppingBasket as BasketIcon } from 'lucide-react';

// ── collapsible history header + search ─────────────────────────────────────

export function HistoryHeader({ open, onToggle, count, preview, embedded }) {
  return (
    <h2 className="m-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="tx-panel"
        className={`flex w-full items-center gap-3 rounded-[22px] border px-4 py-3.5 text-left transition ${
          embedded ? 'border-emerald-800/15 bg-white hover:border-emerald-700/40' : 'border-emerald-400/15 bg-white/[0.04] hover:bg-white/[0.07]'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`font-classic-display text-[20px] font-bold leading-none ${embedded ? 'text-stone-800' : 'text-white'}`}>Receipts</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">{count}</span>
          </span>
          {!open && <span className={`mt-1 block truncate text-[12px] font-normal ${embedded ? 'text-stone-500' : 'text-emerald-100/60'}`}>{preview}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-[#a17c28]">
          {open ? 'Hide' : 'Show'}
          <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
    </h2>
  );
}

export function SearchBox({ value, onChange, embedded }) {
  return (
    <div className="relative">
      <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a17c28]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name, app, note, amount, date…"
        aria-label="Search receipts"
        className={`w-full rounded-2xl border py-3 pl-10 pr-10 text-[15px] outline-none transition focus:ring-2 focus:ring-emerald-500/30 ${
          embedded
            ? 'border-emerald-800/25 bg-white text-stone-800 placeholder-stone-400 focus:border-emerald-600'
            : 'border-emerald-300/25 bg-white/[0.06] text-white placeholder-emerald-100/40 focus:border-emerald-400'
        }`}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#a17c28] hover:bg-emerald-500/10">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
