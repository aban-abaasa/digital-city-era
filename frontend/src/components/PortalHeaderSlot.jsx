import React, { useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  registerHeaderTabsSlot,
  unregisterHeaderTabsSlot,
  useHeaderTabsSlot
} from './portalHeaderSlotUtils';

/**
 * Lets a portal's section tabs (Dashboard, Orders, Wallet…) live INSIDE the
 * shared PortalHeader, so every portal has a single sticky header instead of a
 * header plus a separate tab bar.
 *
 *  - PortalHeader renders <HeaderTabsSlot /> at the bottom of its bar.
 *  - Whoever owns the section tabs wraps them in <InHeaderTabs>{(inHeader) => …}</InHeaderTabs>.
 *    When a header is mounted the tabs are portaled into its slot (inHeader =
 *    true, so use headerTabClass from portalHeaderSlotUtils); otherwise they
 *    render in place as before (inHeader = false).
 */

// Hidden on phones (they keep the section bar + bottom sheet) and while empty.
export const HeaderTabsSlot = () => {
  const owned = useRef(null);
  const setRef = useCallback((el) => {
    if (el) {
      owned.current = el;
      registerHeaderTabsSlot(el);
    } else {
      unregisterHeaderTabsSlot(owned.current);
      owned.current = null;
    }
  }, []);
  return <div ref={setRef} className="portal-header-tabs hidden sm:block border-t border-white/10" />;
};

export const InHeaderTabs = ({ children }) => {
  const slot = useHeaderTabsSlot();
  return slot ? createPortal(children(true), slot) : children(false);
};
