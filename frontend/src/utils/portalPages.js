// Each portal is its own page, loaded only when someone enters it — the way
// BodaGoEra's role dashboards are separate pages behind one header — instead
// of shipping all six multi-thousand-line portals in the first download.
// App.jsx lazy()-wraps these same loader functions, and PortalHeader calls
// prefetchPortal() as soon as a tab is hovered/focused/touched, so by the
// time the tap lands the page is usually already in cache. import() dedupes,
// so prefetching never downloads a portal twice.
export const PORTAL_LOADERS = {
  admin: () => import('@/pages/AdminPortal'),
  manager: () => import('@/pages/ManagerPortal'),
  cashier: () => import('@/pages/cashier portal'),
  supplier: () => import('@/pages/SupplierPortal'),
  customer: () => import('@/pages/CustomerDashboard')
};

// The standalone /cashier-portal page (CushierPortal) is not one of the
// switcher's targets, but is still split out the same way.
export const loadCashierStation = () => import('@/pages/CushierPortal');

export const prefetchPortal = (portalId) => {
  const load = PORTAL_LOADERS[portalId];
  if (load) load().catch(() => { /* a failed prefetch is retried on the real navigation */ });
};
