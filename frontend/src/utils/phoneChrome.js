import { useSyncExternalStore } from 'react';

/*
 * On phones, a multi-portal account's shared PortalHeader (brand row + portal
 * tabs) is hidden so each portal gets the whole page. What the header used to
 * offer — switching portal, My Profile, Notifications, Sign out — moves into
 * each portal's section Menu sheet instead.
 *
 * The header and the section navigator are siblings, so the header publishes
 * what it knows here and the navigator/sheet reads it. The most recently
 * mounted header wins (portals are lazy-loaded behind a placeholder header),
 * and a header that unmounts only clears what it still owns.
 */
let current = null;
let owner = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const publishPhoneChrome = (ownerKey, value) => {
  owner = ownerKey;
  current = value;
  emit();
};

export const clearPhoneChrome = (ownerKey) => {
  if (owner !== ownerKey) return; // a newer header already took over
  owner = null;
  current = null;
  emit();
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const usePhoneChrome = () => useSyncExternalStore(subscribe, () => current, () => null);

// Where the phone "hub" lives: the shared header with every portal you can
// enter, plus a card for each. See pages/PortalHub.jsx.
export const HUB_ROUTE = '/portals';

/** True while a multi-portal account is on a phone, i.e. the shared header is hidden and the page owns the whole screen. */
export const useFullPage = () => Boolean(usePhoneChrome()?.multi);
