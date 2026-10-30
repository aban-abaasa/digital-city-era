import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiHome, FiLogOut, FiMoon, FiSun, FiUser } from 'react-icons/fi';
import { useTheme } from '../contexts/ThemeContext';
import { usePhoneChrome, HUB_ROUTE } from '../utils/phoneChrome';

/**
 * Back arrow for a portal's phone section bar. Inside a sub-section it returns
 * to the portal's home section; from home it goes back to wherever the user
 * came from (the hub, or the portal they switched from), falling back to the hub.
 * Renders nothing for single-portal accounts, which keep the normal header.
 */
export const PhoneBackArrow = ({ atHome, onHome }) => {
  const navigate = useNavigate();
  const chrome = usePhoneChrome();
  if (!chrome?.multi) return null;
  const goBack = () => {
    if (!atHome) { onHome(); return; }
    // history.state.idx > 0 means there is an earlier in-app page to return to.
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(HUB_ROUTE, { replace: true });
  };
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={atHome ? 'Back' : 'Back to home section'}
      className="-ml-1.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-slate-700 transition-transform active:scale-90 dark:text-slate-200"
    >
      <FiArrowLeft className="h-5 w-5" />
    </button>
  );
};

/**
 * Extras shown at the foot of the phone Menu sheet in place of the hidden
 * header: switch portal, profile and the portal's own menu items, theme, sign out.
 */
export const PhonePortalSection = ({ onDone }) => {
  const navigate = useNavigate();
  const chrome = usePhoneChrome();
  const { theme, toggleTheme } = useTheme();
  if (!chrome?.multi) return null;

  const others = chrome.portals.filter((p) => p.id !== chrome.currentId);
  const rowClass = 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800';

  return (
    <div className="px-4 pb-2 pt-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Switch portal</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { onDone(); navigate(HUB_ROUTE); }}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#c4a052]/40 bg-[#faf8f3] px-4 py-2 text-xs font-semibold text-slate-700 transition-transform active:scale-95 dark:bg-slate-800 dark:text-slate-100"
        >
          <FiHome className="h-3.5 w-3.5" /> All portals
        </button>
        {others.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { onDone(); navigate(p.route); }}
            className="rounded-full border border-[#c4a052]/40 bg-[#faf8f3] px-4 py-2 text-xs font-semibold text-slate-700 transition-transform active:scale-95 dark:bg-slate-800 dark:text-slate-100"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
        {chrome.items.map((item) => (
          <button key={item.label} type="button" className={rowClass} onClick={() => { onDone(); item.onClick?.(); }}>
            {item.icon ? <item.icon size={16} /> : <FiUser size={16} />}
            {item.label}
          </button>
        ))}
        <button type="button" className={rowClass} onClick={toggleTheme}>
          {theme === 'dark' ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => { onDone(); chrome.onSignOut?.(); }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3 text-sm font-semibold text-red-600 ring-1 ring-inset ring-red-100 transition-transform active:scale-[0.99] dark:bg-red-950/40 dark:ring-red-900"
      >
        <FiLogOut className="h-4 w-4" /> Sign Out
      </button>
    </div>
  );
};
