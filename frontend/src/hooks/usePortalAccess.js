import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiShield, FiBriefcase, FiCreditCard, FiShoppingBag, FiTruck } from 'react-icons/fi';
import { ROLE_LEVEL } from '../components/RoleProtectedRoute';
import { getSupplierAccess } from '../utils/supplierAccess';

// Same ladder as RoleProtectedRoute/role_level() in the database:
// customer < cashier < manager < admin. Each entry's `level` decides who
// can switch into it — admin sees all four, manager sees manager+cashier+
// customer, cashier sees cashier+customer, customer sees only itself (so
// the portal tabs/switcher hide entirely for a plain customer, nothing to
// switch to). Supplier sits outside the ladder (`standalone`): like a
// BodaGoEra role tab it shows up only for accounts that can really act as
// one — a supplier, an admin who wants to supply too, or a manager of a
// supply-enabled store — and never for a plain cashier/customer.
export const PORTALS = [
  { id: 'admin', name: 'Admin Portal', label: 'Admin', icon: FiShield, route: '/admin-portal', level: 3, color: 'from-red-600 to-pink-600' },
  { id: 'manager', name: 'Manager Portal', label: 'Manager', icon: FiBriefcase, route: '/manager-portal', level: 2, color: 'from-blue-600 to-purple-600' },
  { id: 'cashier', name: 'Cashier Portal', label: 'Cashier', icon: FiCreditCard, route: '/employee-portal', level: 1, color: 'from-green-600 to-emerald-600' },
  { id: 'supplier', name: 'Supplier Portal', label: 'Supplier', icon: FiTruck, route: '/supplier-portal', standalone: true, color: 'from-purple-600 to-indigo-600' },
  { id: 'customer', name: 'Customer Portal', label: 'Customer', icon: FiShoppingBag, route: '/customer-dashboard', level: 0, color: 'from-orange-600 to-amber-600' }
];

export const PORTAL_ROUTES = {
  admin: ['/admin-portal', '/system-admin', '/admin-dashboard'],
  manager: ['/manager-portal', '/manager'],
  cashier: ['/cashier-portal', '/cashier', '/employee-portal', '/employee'],
  supplier: ['/supplier-portal', '/supplier'],
  customer: ['/customer-dashboard', '/customer', '/customer-portal']
};

/**
 * Which portals the signed-in user can walk into, and which one they're
 * standing in right now. `currentPortal` is null (never guessed) when the
 * path isn't a known portal route — showing the wrong "current" portal
 * previously made clicks on it silently no-op.
 */
export const usePortalAccess = () => {
  const location = useLocation();
  const [role, setRole] = useState(null);
  const [supplierAccess, setSupplierAccess] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const access = await getSupplierAccess();
        if (active && access) {
          setRole(access.role);
          setSupplierAccess(access);
        }
      } catch (err) {
        console.warn('[usePortalAccess] Could not resolve portal access:', err);
      }
    })();
    return () => { active = false; };
  }, []);

  const myLevel = role === 'admin' ? Infinity : (ROLE_LEVEL[role] ?? -1);
  const accessiblePortals = role
    ? PORTALS
      .filter((p) => (p.standalone ? Boolean(supplierAccess?.canSupply) : p.level <= myLevel))
      .map((p) => (p.id === 'supplier'
        // An admin/manager who hasn't set up a supplier business yet sees an
        // invitation instead of a plain link, so the entry explains itself.
        ? { ...p, subtitle: supplierAccess?.isSetUp ? 'Your supply business' : 'Start supplying' }
        : p))
    : [];

  const currentId = Object.entries(PORTAL_ROUTES).find(([, routes]) => routes.includes(location.pathname))?.[0];
  const currentPortal = accessiblePortals.find((p) => p.id === currentId) || null;
  // The portal the page itself belongs to, even when the user has no access
  // to switch (e.g. a plain supplier) — used for header colour/labels.
  const pageMeta = PORTALS.find((p) => p.id === currentId) || null;

  return { role, accessiblePortals, currentPortal, pageMeta };
};
