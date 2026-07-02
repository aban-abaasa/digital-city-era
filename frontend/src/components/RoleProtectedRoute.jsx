import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

// Where each role lands automatically when it hits a page it doesn't own.
export const ROLE_HOME = {
  admin: '/admin-portal',
  manager: '/manager-portal',
  cashier: '/employee-portal',
  employee: '/employee-portal',
  supplier: '/supplier-portal',
  customer: '/customer-dashboard'
};

// customer < cashier < manager < admin — matches public.role_level() in
// the database. A role automatically gets into its own portal and every
// portal at or below its level (manager can walk into the cashier and
// customer portals; cashier can walk into the customer portal; admin gets
// everywhere). Supplier sits outside this ladder as its own silo.
export const ROLE_LEVEL = { customer: 0, cashier: 1, employee: 1, manager: 2, admin: 3 };

// Circuit breaker: AuthContext (mock, localStorage-based) and the real
// Supabase session this component checks are two separate, uncoordinated
// systems — if they ever disagree about who's logged in, each one bounces
// the browser toward what it thinks is correct, forever ("Throttling
// navigation to prevent the browser from hanging"). This guarantees we
// never redirect more than a few times in a row no matter which side is
// wrong, instead of hanging the tab.
const REDIRECT_LOOP_KEY = 'role_protected_redirect_guard';
const REDIRECT_LOOP_WINDOW_MS = 8000;
const REDIRECT_LOOP_MAX = 4;

const tooManyRecentRedirects = () => {
  try {
    const raw = sessionStorage.getItem(REDIRECT_LOOP_KEY);
    const entry = raw ? JSON.parse(raw) : null;
    const now = Date.now();

    if (!entry || now - entry.first > REDIRECT_LOOP_WINDOW_MS) {
      sessionStorage.setItem(REDIRECT_LOOP_KEY, JSON.stringify({ first: now, count: 1 }));
      return false;
    }

    const count = entry.count + 1;
    sessionStorage.setItem(REDIRECT_LOOP_KEY, JSON.stringify({ first: entry.first, count }));
    return count > REDIRECT_LOOP_MAX;
  } catch {
    return false;
  }
};

/**
 * Grants access if the signed-in user's role level is >= minLevel (so
 * manager automatically gets into the cashier and customer portals, cashier
 * automatically gets into the customer portal, admin gets everywhere), or if
 * their exact role is listed in exactRoles (for silos outside the ladder,
 * like supplier). Admin always gets in regardless. Anyone else gets bounced
 * to the home page for their own role instead of a dead end.
 */
const RoleProtectedRoute = ({ children, minLevel, exactRoles }) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [redirectTarget, setRedirectTarget] = useState(null);
  const [loopBroken, setLoopBroken] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          if (!active) return;
          finishWithDecision(false, null);
          return;
        }

        const { data: userRow } = await supabase
          .from('users')
          .select('role')
          .eq('auth_id', session.user.id)
          .maybeSingle();

        if (!active) return;
        finishWithDecision(true, userRow?.role?.toLowerCase() || null);
      } catch (error) {
        console.error('Role access check failed:', error);
        if (active) finishWithDecision(false, null);
      }
    };

    // Resolve whether this render needs to redirect, and if so, whether
    // that redirect is safe or part of a loop — decided once, here, instead
    // of recomputed (and re-triggering sessionStorage writes) on every render.
    const finishWithDecision = (isAuthenticated, resolvedRole) => {
      setAuthenticated(isAuthenticated);
      setRole(resolvedRole);
      setLoading(false);

      const isAllowed = isAuthenticated && (
        resolvedRole === 'admin' ||
        (typeof minLevel === 'number' && (ROLE_LEVEL[resolvedRole] ?? -1) >= minLevel) ||
        (exactRoles && exactRoles.includes(resolvedRole))
      );
      if (isAllowed) {
        setRedirectTarget(null);
        return;
      }

      const target = isAuthenticated ? (ROLE_HOME[resolvedRole] || '/') : '/login';
      if (target === location.pathname || tooManyRecentRedirects()) {
        setLoopBroken(true);
        setRedirectTarget(null);
        return;
      }

      setRedirectTarget(target);
    };

    checkAccess();
    return () => {
      active = false;
    };
  }, [location.pathname, minLevel, exactRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600" />
      </div>
    );
  }

  if (loopBroken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-gray-700 font-medium mb-3">Couldn't confirm your sign-in.</p>
          <p className="text-sm text-gray-500 mb-4">This can happen if two tabs or sessions disagree about who's logged in.</p>
          <a href="/login" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  if (redirectTarget) {
    return authenticated
      ? <Navigate to={redirectTarget} replace />
      : <Navigate to={redirectTarget} state={{ from: location }} replace />;
  }

  return children;
};

export default RoleProtectedRoute;
