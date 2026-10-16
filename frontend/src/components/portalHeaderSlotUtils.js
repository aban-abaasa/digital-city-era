import { useSyncExternalStore } from 'react';

/*
 * Where the section tabs go: the slot element at the bottom of the shared
 * PortalHeader. The header REGISTERS its slot here when it mounts and clears
 * it when it unmounts, and the tabs subscribe.
 *
 * A DOM id lookup is not enough: portals are lazy-loaded behind
 * <PortalPageFallback />, which renders its own PortalHeader. The tabs would
 * find the placeholder's slot, and vanish when the placeholder unmounts. With
 * registration, the most recently mounted header wins, and a header that
 * unmounts only clears the slot if it still owns it.
 */
let currentSlot = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const registerHeaderTabsSlot = (el) => {
  if (currentSlot === el) return;
  currentSlot = el;
  emit();
};

export const unregisterHeaderTabsSlot = (el) => {
  if (currentSlot !== el) return; // a newer header already took over
  currentSlot = null;
  emit();
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => currentSlot;

export const useHeaderTabsSlot = () => useSyncExternalStore(subscribe, getSnapshot, () => null);

// Tab styling for the indigo header: white text, gold underline on the active tab.
export const headerTabClass = (isActive) =>
  `flex items-center gap-1.5 px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
    isActive
      ? 'font-semibold text-white border-[#f5dfa0]'
      : 'font-medium text-white/70 hover:text-white border-transparent hover:border-white/30'
  }`;

export const headerTabIconClass = (isActive) => `h-4 w-4 ${isActive ? 'text-[#f5dfa0]' : 'text-white/60'}`;
