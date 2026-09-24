import React, { useState } from 'react';
import { FiGrid } from 'react-icons/fi';
import MobileMenuSheet from './customerDashboard/MobileMenuSheet';

/**
 * The customer dashboard's section navigator, shared by every portal so they
 * navigate the same way:
 *   - sm and up: a row of pill tabs on a white bar (active = blue→purple)
 *   - phones: a slim "section bar" showing where you are in serif type, plus a
 *     Menu button that opens a thumb-sized bottom sheet with every section
 *
 * tabs: [{ id, label, icon, badge? }]. Pass showWallet + onWallet only when the
 * wallet isn't already one of the tabs.
 */
const PortalTabNavigator = ({
  tabs,
  activeTab,
  onSelect,
  name,
  email,
  initial,
  showWallet = false,
  onWallet
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const humanize = (id) => String(id || '').replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  const active = tabs.find((t) => t.id === activeTab) || { label: humanize(activeTab), icon: FiGrid };
  const ActiveIcon = active?.icon;

  const pick = (id) => {
    onSelect(id);
    setMenuOpen(false);
  };

  return (
    <>
      {/* Row 2 — pill tabs (sm and up) */}
      <div className="hidden sm:block bg-white border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-2">
          <nav className="flex overflow-x-auto scrollbar-hide gap-0.5 py-1 items-center">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => pick(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {tab.label}
                  {tab.badge > 0 && (
                    <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Phone section bar — current section in serif + the one Menu trigger */}
      <div className="sm:hidden border-b border-[#c4a052]/25 bg-white">
        <div className="flex h-12 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            {ActiveIcon && <ActiveIcon className="h-[17px] w-[17px] flex-shrink-0 text-indigo-600" />}
            <h2 className="truncate font-classic-display text-[18px] font-semibold leading-none text-slate-800">
              {active?.label}
            </h2>
          </div>
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
    </>
  );
};

export default PortalTabNavigator;
