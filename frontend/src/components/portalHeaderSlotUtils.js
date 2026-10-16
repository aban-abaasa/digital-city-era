import { useEffect, useLayoutEffect, useState } from 'react';

export const HEADER_TABS_SLOT_ID = 'portal-header-tabs';

const findSlot = () => (typeof document === 'undefined' ? null : document.getElementById(HEADER_TABS_SLOT_ID));

export const useHeaderTabsSlot = () => {
  const [slot, setSlot] = useState(findSlot);
  useLayoutEffect(() => { if (!slot) setSlot(findSlot()); }, [slot]);
  useEffect(() => {
    if (slot) return undefined;
    // The header can mount a frame after its tabs (lazy routes) — look again briefly.
    let frames = 0;
    let raf;
    const look = () => {
      const el = findSlot();
      if (el) setSlot(el);
      else if (frames < 30) { frames += 1; raf = requestAnimationFrame(look); }
    };
    raf = requestAnimationFrame(look);
    return () => cancelAnimationFrame(raf);
  }, [slot]);
  return slot;
};

// Tab styling for the indigo header: white text, gold underline on the active tab.
export const headerTabClass = (isActive) =>
  `flex items-center gap-1.5 px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
    isActive
      ? 'font-semibold text-white border-[#f5dfa0]'
      : 'font-medium text-white/70 hover:text-white border-transparent hover:border-white/30'
  }`;

export const headerTabIconClass = (isActive) => `h-4 w-4 ${isActive ? 'text-[#f5dfa0]' : 'text-white/60'}`;
