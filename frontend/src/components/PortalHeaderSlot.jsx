import React from 'react';
import { createPortal } from 'react-dom';
import { HEADER_TABS_SLOT_ID, useHeaderTabsSlot } from './portalHeaderSlotUtils';

/**
 * Lets a portal's section tabs (Dashboard, Orders, Wallet…) live INSIDE the
 * shared PortalHeader, so every portal has a single sticky header instead of a
 * header plus a separate tab bar.
 *
 *  - PortalHeader renders <HeaderTabsSlot /> at the bottom of its bar.
 *  - Whoever owns the section tabs wraps them in <InHeaderTabs>{(inHeader) => …}</InHeaderTabs>.
 *    When the slot exists the tabs are portaled into it (inHeader = true, so
 *    use headerTabClass from portalHeaderSlotUtils); otherwise they render in
 *    place as before (inHeader = false).
 */

// Hidden on phones (they keep the section bar + bottom sheet) and while empty.
export const HeaderTabsSlot = () => (
  <div id={HEADER_TABS_SLOT_ID} className="hidden sm:block border-t border-white/10" />
);

export const InHeaderTabs = ({ children }) => {
  const slot = useHeaderTabsSlot();
  return slot ? createPortal(children(true), slot) : children(false);
};
