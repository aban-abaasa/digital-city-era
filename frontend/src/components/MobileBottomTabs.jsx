import React, { useEffect, useRef } from 'react';
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
 * With no bar behind the icons, cards scrolling underneath would show through
 * (labels sitting on top of card text), so the bar carries its own page-coloured
 * fade (.sk-bottom-nav-fade): every portal and dashboard that mounts it gets the
 * same soft fade-out at the bottom edge, hidden and themed together with the bar.
 *
 * tabs: [{ id, label, icon, badge? }]. Pages need ~5rem of bottom padding so
 * their last card isn't hidden under the bar.
 * Full-screen pages (order details, payment, ...) are `fixed inset-0` and would
 * sit under this bar, hiding their own action buttons. While the bar is shown it
 * publishes its height as --sk-bottom-nav-h on <html> and adds .sk-has-bottom-nav,
 * and those pages stop above it (see mobile-bottom-tabs.css). From `sm` up the bar
 * is display:none, so the measured height is 0 and nothing is reserved.
 * tone: the page colour the fade blends into — 'portal' (the ivory / deep-green
 * portals, default) or 'customer' (the customer dashboard's blue-grey page).
 */
const MobileBottomTabs = ({ tabs, activeTab, onSelect, action, tone = 'portal' }) => {
  const navRef = useRef(null);
  const hasBar = (tabs || []).length > 0 || !!action;
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const root = document.documentElement;
    const publish = () => {
      const height = Math.round(nav.getBoundingClientRect().height);
      root.style.setProperty('--sk-bottom-nav-h', `${height}px`);
      root.classList.toggle('sk-has-bottom-nav', height > 0);
    };
    publish();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(publish) : null;
    observer?.observe(nav);
    window.addEventListener('resize', publish);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', publish);
      root.style.removeProperty('--sk-bottom-nav-h');
      root.classList.remove('sk-has-bottom-nav');
    };
  }, [hasBar]);
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
      ref={navRef}
      aria-label="Primary"
      className={`sk-bottom-nav ${tone === 'customer' ? 'sk-bottom-nav-customer' : ''} fixed inset-x-0 bottom-0 z-[60] flex sm:hidden`}
    >
      <span aria-hidden="true" className="sk-bottom-nav-fade" />
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
