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

/** True while a multi-portal account is on a phone, i.e. the shared header is hidden and the page owns the whole screen. */
export const useFullPage = () => Boolean(usePhoneChrome()?.multi);

/*
 * Phones, multi-portal accounts: is the current portal showing full-screen?
 * false (the default): the shared header with every portal tab sits above the
 * page, as it always has. true: the header is hidden and the page owns the
 * screen. Tapping a portal in the header sets it; Back (the section bar's arrow
 * or the phone's Back button) clears it, bringing the header back over the same page.
 * Lives here, not in a component, because it has to survive the route change
 * between one portal and the next.
 */
let fullPage = false;

export const setPhoneFullPage = (value) => {
  if (fullPage === value) return;
  fullPage = value;
  emit();
};

export const usePhoneFullPage = () => useSyncExternalStore(subscribe, () => fullPage, () => false);
