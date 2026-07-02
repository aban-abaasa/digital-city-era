import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiShield, FiBriefcase, FiCreditCard, FiShoppingBag, FiChevronDown } from 'react-icons/fi';
import { supabase } from '../services/supabase';
import { ROLE_LEVEL } from './RoleProtectedRoute';

// Same ladder as RoleProtectedRoute/role_level() in the database:
// customer < cashier < manager < admin. Each entry's `level` decides who
// can switch into it — admin sees all four, manager sees manager+cashier+
// customer, cashier sees cashier+customer, customer sees only itself (so
// the switcher hides entirely for a plain customer, nothing to switch to).
const PORTALS = [
  { id: 'admin', name: 'Admin Portal', icon: FiShield, route: '/admin-portal', level: 3, color: 'from-red-600 to-pink-600' },
  { id: 'manager', name: 'Manager Portal', icon: FiBriefcase, route: '/manager-portal', level: 2, color: 'from-blue-600 to-purple-600' },
  { id: 'cashier', name: 'Cashier Portal', icon: FiCreditCard, route: '/employee-portal', level: 1, color: 'from-green-600 to-emerald-600' },
  { id: 'customer', name: 'Customer Portal', icon: FiShoppingBag, route: '/customer-dashboard', level: 0, color: 'from-orange-600 to-amber-600' }
];

const PORTAL_ROUTES = {
  admin: ['/admin-portal', '/system-admin', '/admin-dashboard'],
  manager: ['/manager-portal', '/manager'],
  cashier: ['/cashier-portal', '/cashier', '/employee-portal', '/employee'],
  customer: ['/customer-dashboard', '/customer', '/customer-portal']
};

const PortalSwitcher = ({ variant = 'light', fullWidth = false, onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', session.user.id)
        .maybeSingle();
      if (active) setRole(data?.role?.toLowerCase() || null);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const insideButton = buttonRef.current && buttonRef.current.contains(event.target);
      const insideMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!insideButton && !insideMenu) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The dropdown is portaled to <body> so no ancestor header's overflow can
  // clip it (ManagerPortal's header has overflow-hidden for its decorative
  // background) — position it by the button's real screen coordinates.
  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setIsOpen((prev) => !prev);
  };

  if (!role) return null;

  const myLevel = role === 'admin' ? Infinity : (ROLE_LEVEL[role] ?? -1);
  const accessiblePortals = PORTALS.filter((p) => p.level <= myLevel);

  // Nothing lower to switch to (e.g. a plain customer) — hide entirely.
  if (accessiblePortals.length <= 1) return null;

  // If the current path doesn't match any known portal route, don't guess —
  // showing the wrong "current" portal previously caused clicks on that
  // portal to silently no-op (see handleSwitch), which looked like the
  // switcher did nothing at all.
  const currentId = Object.entries(PORTAL_ROUTES).find(([, routes]) => routes.includes(location.pathname))?.[0];
  const currentPortal = accessiblePortals.find((p) => p.id === currentId) || null;
  const CurrentIcon = (currentPortal || accessiblePortals[0]).icon;

  const handleSwitch = (portal) => {
    setIsOpen(false);
    onNavigate?.(); // close any parent mobile drawer — otherwise it stays
    // open on top of the page that just navigated underneath it, and the
    // switch looks like it did nothing.
    toast.info(`Switching to ${portal.name}...`, { position: 'top-right', autoClose: 1200 });
    navigate(portal.route);
  };

  const isDark = variant === 'dark';
  const displayPortal = currentPortal || accessiblePortals[0];

  return (
    <div className={fullWidth ? 'relative w-full' : 'relative'}>
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className={`flex items-center space-x-2 rounded-xl border transition-all ${fullWidth ? 'w-full justify-between px-4 py-3' : 'px-3 py-2'} ${
          isDark
            ? 'bg-white/10 hover:bg-white/20 border-white/20'
            : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
        }`}
        title="Switch portal"
      >
        <span className="flex items-center space-x-2 min-w-0">
          <div className={`p-1.5 rounded-lg bg-gradient-to-r ${displayPortal.color} flex-shrink-0`}>
            <CurrentIcon className="h-4 w-4 text-white" />
          </div>
          <span className={`text-sm font-medium truncate ${fullWidth ? '' : 'hidden md:inline'} ${isDark ? 'text-white' : 'text-gray-700'}`}>{displayPortal.name}</span>
        </span>
        <FiChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isDark ? 'text-white/80' : 'text-gray-400'} ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className="w-72 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-[9999]"
        >
          <div className="p-2 max-h-96 overflow-y-auto">
            {accessiblePortals.map((portal) => {
              const PortalIcon = portal.icon;
              const isActive = currentPortal?.id === portal.id;
              return (
                <button
                  key={portal.id}
                  onClick={() => handleSwitch(portal)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all mb-1 ${
                    isActive ? 'bg-blue-50 border-2 border-blue-400' : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${portal.color} flex-shrink-0`}>
                    <PortalIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-900 text-sm">{portal.name}</p>
                  </div>
                  {isActive && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">Active</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PortalSwitcher;
