import React, { useEffect, useRef } from 'react';
import { FiX, FiCreditCard } from 'react-icons/fi';

// Phone navigation as a bottom sheet: profile header, then every section as a
// big, thumb-sized tile. Replaces the small 3-dot dropdown, which was easy to
// miss and had tiny tap targets. Rendered outside the sticky header by the
// caller so its fixed positioning isn't affected by that stacking context.
export default function MobileMenuSheet({ open, onClose, tabs, activeTab, onSelect, onWallet, name, email, initial }) {
  // Kept in a ref so callers can pass an inline handler without re-running
  // the effect (and re-toggling body scroll lock) on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="sm:hidden fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50 animate-fade-soft"
      />
      <div className="animate-sheet-up safe-bottom absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[28px] bg-white text-slate-800 shadow-2xl">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-300" />

        <div className="flex items-center gap-3 px-5 pb-4 pt-4">
          <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 font-classic-display text-xl font-bold text-white ring-2 ring-[#e6c980] ring-offset-2 ring-offset-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-classic-display text-lg font-semibold leading-tight text-slate-800">{name}</p>
            {email && <p className="truncate text-xs text-slate-500">{email}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition-transform active:scale-95"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="gold-rule mx-5" />

        <div className="grid grid-cols-3 gap-2.5 px-4 pb-1 pt-4">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelect(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-2 rounded-2xl px-2 py-3.5 text-center transition-all active:scale-95 ${
                  active ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300' : 'bg-slate-50 ring-1 ring-inset ring-slate-100'
                }`}
              >
                <span
                  className={`grid h-11 w-11 place-items-center rounded-full ${
                    active
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/30'
                      : 'bg-white text-indigo-600 shadow-sm ring-1 ring-inset ring-slate-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className={`text-[11px] leading-tight ${active ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onWallet}
            className="flex flex-col items-center gap-2 rounded-2xl bg-violet-50 px-2 py-3.5 text-center ring-1 ring-inset ring-violet-100 transition-all active:scale-95"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-800 text-white shadow-md shadow-violet-500/30">
              <FiCreditCard className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-violet-700">IcanEra Wallet</span>
          </button>
        </div>
      </div>
    </div>
  );
}
