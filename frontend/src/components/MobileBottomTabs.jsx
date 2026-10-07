import React from 'react';

/**
 * Phone-only bottom tab bar: the four vital destinations of a portal, in reach
 * of the thumb. Capped at 4 on purpose — everything else stays in the section
 * bar's Menu sheet. The bar is see-through (a faint frosted blur, no solid
 * fill) so page content shows beneath it; the active tab gets a solid pill so
 * it still reads over any content. Hidden from `sm` up, where every portal
 * already shows its full top tab strip.
 *
 * tabs: [{ id, label, icon, badge? }]. Pages need ~5rem of bottom padding so
 * their last card isn't hidden under the bar.
 */
const MobileBottomTabs = ({ tabs, activeTab, onSelect }) => {
  const visible = (tabs || []).slice(0, 4);
  if (visible.length === 0) return null;

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] px-3 sm:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-around gap-1 rounded-[26px] border border-white/40 bg-white/10 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md backdrop-saturate-150 dark:border-white/15 dark:bg-slate-900/10">
        {visible.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[20px] px-1 py-2 transition-all active:scale-95 ${
                active
                  ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/30'
                  : 'text-slate-800 [text-shadow:0_1px_2px_rgba(255,255,255,0.7)] dark:text-white dark:[text-shadow:0_1px_2px_rgba(0,0,0,0.6)]'
              }`}
            >
              {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
              <span className="max-w-full truncate text-[10.5px] font-semibold leading-none">{tab.shortLabel || tab.label}</span>
              {tab.badge > 0 && (
                <span className="absolute right-3 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomTabs;
