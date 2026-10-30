import React from 'react';
import NavGlowDefs from './NavGlowDefs';
import '../styles/mobile-bottom-tabs.css';

/**
 * Phone-only bottom tab bar: the vital destinations of a portal, in reach
 * of the thumb. Capped at 5 on purpose — everything else stays in the section
 * bar's Menu sheet.
 *
 * Styled like the ICAN app's bottom bar: bare icons, like TikTok's, with nothing
 * painted behind or around them. The current one is drawn in colours that travel
 * along its own shape; the row is spaced apart and scrolls sideways (see
 * mobile-bottom-tabs.css). Hidden from `sm` up, where every portal already
 * shows its full top tab strip.
 *
 * tabs: [{ id, label, icon, badge? }]. Pages need ~5rem of bottom padding so
 * their last card isn't hidden under the bar.
 */
const MobileBottomTabs = ({ tabs, activeTab, onSelect, action }) => {
  // An action (a button that does something instead of opening a section) takes the middle slot
  const visible = (tabs || []).slice(0, action ? 4 : 5);
  if (visible.length === 0 && !action) return null;
  const ActionIcon = action?.icon;
  const actionButton = action && (
    <button
      key="bottom-action"
      type="button"
      onClick={action.onClick}
      aria-label={action.ariaLabel || action.label}
      className="sk-bottom-nav-tab sk-bottom-nav-action flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold whitespace-nowrap"
    >
      <span className="sk-bottom-nav-action-icon flex">
        {ActionIcon && <ActionIcon className="h-5 w-5 flex-shrink-0" />}
      </span>
      <span className="max-w-[68px] truncate">{action.label}</span>
    </button>
  );
  const actionAt = Math.ceil(visible.length / 2);

  return (
    <nav
      aria-label="Primary"
      className="sk-bottom-nav fixed inset-x-0 bottom-0 z-[60] flex sm:hidden"
    >
      <NavGlowDefs />
      {visible.map((tab, index) => {
        const active = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <React.Fragment key={tab.id}>
          {index === actionAt && actionButton}
          <button
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={active ? 'page' : undefined}
            className={`sk-bottom-nav-tab ${active ? 'sk-bottom-nav-tab-active' : ''} flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold whitespace-nowrap`}
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
          </React.Fragment>
        );
      })}
      {actionAt >= visible.length && actionButton}
    </nav>
  );
};

export default MobileBottomTabs;
