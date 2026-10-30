import React, { useState } from 'react';
import { FiGrid } from 'react-icons/fi';
import MobileMenuSheet from './customerDashboard/MobileMenuSheet';
import MobileBottomTabs from './MobileBottomTabs';
import OverflowTabs from './OverflowTabs';
import { InHeaderTabs } from './PortalHeaderSlot';
import { headerTabClass, headerTabIconClass } from './portalHeaderSlotUtils';
import { PhoneBackArrow } from './PhonePortalNav';
import { usePhoneChrome, useFullPage } from '../utils/phoneChrome';
import { useBackLayer } from '../hooks/useBackLayer';

const tabClass = (isActive) => `classic-tab relative flex items-center gap-1.5 px-3.5 py-3 text-sm whitespace-nowrap ${
  isActive
    ? 'font-semibold text-indigo-800'
    : 'font-medium text-slate-600 hover:text-indigo-700'
}`;

/**
 * The customer dashboard's section navigator, shared by every portal so they
 * navigate the same way:
 *   - sm and up: a row of pill tabs on a white bar (active = blue→purple)
 *   - phones: a slim "section bar" showing where you are in serif type, plus a
 *     Menu button that opens a thumb-sized bottom sheet with every section
 *
 * tabs: [{ id, label, icon, badge? }]. Pass showWallet + onWallet only when the
 * wallet isn't already one of the tabs.
 *
 * bottomTabs: the 4 vital tabs for the phone's bottom bar, as
 * [{ id, label? }] — icon/badge come from the matching entry in `tabs`, and
 * `label` is an optional short name for the bar. Defaults to the first 4 tabs.
 *
 * bottomAction: { label, icon, onClick, ariaLabel? } — an extra phone-only button in the middle of
 * the bottom bar that does something (e.g. "Add") rather than opening a section. With one, the bar
 * shows 4 tabs + the action.
 */
const PortalTabNavigator = ({
  tabs,
  activeTab,
  onSelect,
  name,
  email,
  initial,
  showWallet = false,
  onWallet,
  bottomTabs,
  bottomAction,
  homeTab
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  // The section Back returns to (default: the first tab). Phone/browser Back
  // walks a sub-section back to it before leaving the page.
  const home = homeTab || tabs[0]?.id;
  useBackLayer(Boolean(home) && activeTab !== home, () => onSelect(home));
  // Phone, multi-portal account: the shared header is hidden, so this bar becomes the page's
  // only top bar — sticky, with Back, and it carries the header's right-hand extras.
  const fullPage = useFullPage();
  const headerExtras = usePhoneChrome()?.rightSlot;
  const humanize = (id) => String(id || '').replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  const active = tabs.find((t) => t.id === activeTab) || { label: humanize(activeTab), icon: FiGrid };
  const ActiveIcon = active?.icon;

  const pick = (id) => {
    onSelect(id);
    setMenuOpen(false);
  };

  const sectionItems = tabs.map((tab) => ({ ...tab, onClick: () => pick(tab.id) }));

  const barTabs = (bottomTabs || tabs.slice(0, 4).map((t) => ({ id: t.id })))
    .map(({ id, label }) => {
      const tab = tabs.find((t) => t.id === id);
      return tab ? { ...tab, label: label || tab.label } : null;
    })
    .filter(Boolean);

  return (
    <>
      {/* Section tabs (sm and up). They are portaled INTO the shared header so
          the portal has one sticky header; if no header slot exists they fall
          back to the classic white bar in place. Tabs that don't fit the screen
          fold into a "More" menu instead of scrolling off. */}
      <InHeaderTabs>
        {(inHeader) => (inHeader ? (
          <OverflowTabs
            gap={4}
            navLabel="Sections"
            items={sectionItems}
            activeId={activeTab}
            tabClassName={headerTabClass}
            moreClassName={headerTabClass}
            iconClassName={headerTabIconClass}
          />
        ) : (
          <div className="hidden sm:block bg-white border-b border-[#c4a052]/30">
            <div className="max-w-7xl mx-auto px-2">
              <OverflowTabs
                gap={2}
                navLabel="Sections"
                items={sectionItems}
                activeId={activeTab}
                tabClassName={tabClass}
                moreClassName={tabClass}
                iconClassName={(isActive) => `h-4 w-4 ${isActive ? 'text-[#a17c28]' : ''}`}
              />
            </div>
          </div>
        ))}
      </InHeaderTabs>

      {/* Phone section bar — current section in serif + the one Menu trigger */}
      <div className={`sm:hidden border-b border-[#c4a052]/25 bg-white dark:border-slate-700 dark:bg-slate-900 ${fullPage ? 'safe-top sticky top-0 z-40' : ''}`}>
        <div className="flex h-12 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <PhoneBackArrow atHome={activeTab === home} onHome={() => onSelect(home)} />
            {ActiveIcon && <ActiveIcon className="h-[17px] w-[17px] flex-shrink-0 text-indigo-600" />}
            <h2 className="truncate font-classic-display text-[18px] font-semibold leading-none text-slate-800">
              {active?.label}
            </h2>
          </div>
          {fullPage && headerExtras}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border border-[#c4a052]/40 bg-[#faf8f3] px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition-transform active:scale-95"
          >
            <FiGrid className="h-3.5 w-3.5 text-indigo-600" /> Menu
          </button>
        </div>
      </div>

      <MobileMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        tabs={tabs}
        activeTab={activeTab}
        onSelect={pick}
        onWallet={() => { setMenuOpen(false); onWallet?.(); }}
        showWallet={showWallet}
        name={name}
        email={email}
        initial={initial}
      />

      <MobileBottomTabs tabs={barTabs} activeTab={activeTab} onSelect={pick} action={bottomAction} />
    </>
  );
};

export default PortalTabNavigator;
