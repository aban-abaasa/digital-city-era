import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown } from 'react-icons/fi';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const DEFAULT_BADGE =
  'ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white';

/**
 * A row of tabs that never scrolls sideways or gets cut off: whatever fits is
 * shown, and the rest collapse into a "More" dropdown (badge counts of hidden
 * tabs are rolled up onto the More button, and More lights up when the active
 * tab is one of the hidden ones). Re-measures on resize, so it adapts from a
 * small laptop to an ultrawide monitor.
 *
 * items:   [{ id, label, icon?, badge?, title?, onClick, onHover? }]
 * activeId id of the active item (or null)
 * tabClassName(active, measuring)   classes for each tab button
 * moreClassName(active, open)       classes for the More button
 * iconClassName(active)             classes for a tab's icon (optional)
 */
const OverflowTabs = ({
  items,
  activeId,
  tabClassName,
  moreClassName,
  iconClassName,
  badgeClassName = DEFAULT_BADGE,
  className = '',
  gap = 2,
  moreLabel = 'More',
  navLabel = 'Tabs'
}) => {
  const wrapRef = useRef(null);
  const measureRef = useRef(null);
  const moreRef = useRef(null);
  const menuRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const itemsKey = items.map((i) => `${i.id}:${i.label}:${typeof i.prefix === 'string' ? i.prefix : ''}:${i.badge || 0}`).join('|');

  const recalc = useCallback(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure) return;
    const avail = wrap.clientWidth;
    const kids = Array.from(measure.children);
    if (!kids.length) return;
    // Hidden (display:none) ancestors report 0 — show everything until we can measure.
    if (avail === 0) { setVisibleCount(items.length); return; }
    const moreW = kids[kids.length - 1].getBoundingClientRect().width;
    const widths = kids.slice(0, -1).map((k) => k.getBoundingClientRect().width);
    const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, widths.length - 1);
    if (total <= avail + 0.5) { setVisibleCount(widths.length); return; }
    let used = moreW;
    let count = 0;
    for (let i = 0; i < widths.length; i += 1) {
      const next = used + gap + widths[i];
      if (next > avail) break;
      used = next;
      count += 1;
    }
    setVisibleCount(count);
  }, [gap, items.length]);

  useIsoLayoutEffect(() => { recalc(); }, [recalc, itemsKey]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => recalc());
      ro.observe(wrap);
    }
    window.addEventListener('resize', recalc);
    // Web fonts change text widths once they load.
    document.fonts?.ready?.then(recalc).catch(() => {});
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', recalc);
    };
  }, [recalc]);

  const toggleMenu = () => {
    if (!open && moreRef.current) {
      const r = moreRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || moreRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  // Menu closes itself if every tab fits again.
  useEffect(() => { if (visibleCount >= items.length) setOpen(false); }, [visibleCount, items.length]);

  const visible = items.slice(0, visibleCount);
  const hidden = items.slice(visibleCount);
  const hiddenActive = hidden.some((i) => i.id === activeId);
  const hiddenBadge = hidden.reduce((sum, i) => sum + (Number(i.badge) || 0), 0);

  const renderLabel = (item, active) => {
    const Icon = item.icon;
    return (
      <>
        {Icon && <Icon className={iconClassName ? iconClassName(active) : 'h-4 w-4'} />}
        {item.prefix != null && <span>{item.prefix}</span>}
        {item.label}
        {item.badge > 0 && <span className={badgeClassName}>{item.badge}</span>}
      </>
    );
  };

  const moreContent = (
    <>
      {moreLabel}
      <FiChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      {hiddenBadge > 0 && <span className={badgeClassName}>{hiddenBadge}</span>}
    </>
  );

  return (
    <div ref={wrapRef} className={`relative flex min-w-0 items-stretch ${className}`} style={{ gap }} role="tablist" aria-label={navLabel}>
      {/* Off-screen copy of every tab (+ More) used only to measure widths. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="flex"
        style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', height: 0, overflow: 'hidden', width: 'max-content', whiteSpace: 'nowrap', gap }}
      >
        {items.map((item) => (
          <span key={item.id} className={`${tabClassName(true, true, item)} flex-shrink-0`}>{renderLabel(item, true)}</span>
        ))}
        <span className={`${moreClassName(true, false)} flex-shrink-0`}>{moreContent}</span>
      </div>

      {visible.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            title={item.title}
            onClick={item.onClick}
            onMouseEnter={item.onHover}
            onFocus={item.onHover}
            onTouchStart={item.onHover}
            className={`${tabClassName(active, false, item)} flex-shrink-0`}
          >
            {renderLabel(item, active)}
          </button>
        );
      })}

      {hidden.length > 0 && (
        <button
          ref={moreRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-current={hiddenActive ? 'page' : undefined}
          onClick={toggleMenu}
          className={`${moreClassName(hiddenActive, open)} flex-shrink-0`}
        >
          {moreContent}
        </button>
      )}

      {open && hidden.length > 0 && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 1100 }}
          className="max-h-[70vh] min-w-[230px] max-w-[92vw] overflow-y-auto rounded-2xl border border-[#c4a052]/40 bg-white py-2 text-slate-800 shadow-2xl animate-fade-soft dark:border-[#c4a052]/30 dark:bg-slate-800 dark:text-slate-100"
        >
          {hidden.map((item) => {
            const active = item.id === activeId;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                aria-current={active ? 'page' : undefined}
                onClick={() => { setOpen(false); item.onClick?.(); }}
                onMouseEnter={item.onHover}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors ${
                  active
                    ? 'bg-indigo-50 font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-[#f5dfa0]'
                    : 'font-medium hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {Icon && <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-[#a17c28]' : 'text-indigo-600 dark:text-indigo-300'}`} />}
                {item.prefix != null && <span className="flex-shrink-0">{item.prefix}</span>}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge > 0 && <span className={badgeClassName}>{item.badge}</span>}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

export default OverflowTabs;
