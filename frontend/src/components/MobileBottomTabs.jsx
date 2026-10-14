import React from 'react';
import '../styles/mobile-bottom-tabs.css';

/**
 * Phone-only bottom tab bar: the four vital destinations of a portal, in reach
 * of the thumb. Capped at 4 on purpose — everything else stays in the section
 * bar's Menu sheet.
 *
 * Styled like the ICAN app's bottom bar: no bar chrome, just independent
 * transparent glass tiles (icon over a small label), each with its own colour
 * line along its edge -- orbiting on the active one (see
 * mobile-bottom-tabs.css). Hidden from `sm` up, where every portal already
 * shows its full top tab strip.
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
      className="sk-bottom-nav fixed inset-x-0 bottom-0 z-[60] flex items-stretch gap-1.5 px-2 pt-1.5 sm:hidden"
    >
      {visible.map((tab) => {
        const active = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={active ? 'page' : undefined}
            className={`sk-bottom-nav-tab ${active ? 'sk-bottom-nav-tab-active' : ''} flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold whitespace-nowrap`}
          >
            <span className="relative flex">
              {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
              {tab.badge > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </span>
            <span className="max-w-[68px] truncate">{tab.shortLabel || tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomTabs;
