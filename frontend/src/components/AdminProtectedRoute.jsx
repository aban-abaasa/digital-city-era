import React, { cloneElement, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { getCachedIdentity, isNetworkFailure } from '../services/posOfflineCache';

const AdminProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const cachedIdentity = getCachedIdentity();
    const hasCachedAdmin = cachedIdentity?.role === 'admin' && Boolean(cachedIdentity.userId);
    const allowCachedAdmin = (sessionUserId = null) => {
      if (!hasCachedAdmin || (sessionUserId && sessionUserId !== cachedIdentity.userId)) return false;
      setAuthenticatedUser({
        id: cachedIdentity.userId,
        email: cachedIdentity.email || '',
        user_metadata: { role: 'admin' },
        app_metadata: { role: 'admin' },
      });
      setIsAuthenticated(true);
      localStorage.setItem('adminKey', 'true');
      return true;
    };

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      const backendUnreachable = !navigator.onLine || isNetworkFailure(error);

      if (session?.user && !error) {
        // When offline, never let a saved admin role authorize a different
        // account whose session happens to remain on this shared device.
        if (!navigator.onLine && cachedIdentity?.userId !== session.user.id) {
          setIsAuthenticated(false);
          return;
        }
        setAuthenticatedUser(session.user);
        setIsAuthenticated(true);
        localStorage.setItem('adminKey', 'true');
      } else if (backendUnreachable && allowCachedAdmin(session?.user?.id)) {
        // AdminPortal will restore the profile and inventory snapshots after
        // this route guard accepts the last verified admin identity.
        return;
      } else {
        setAuthenticatedUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('adminKey');
      }
    } catch (error) {
      console.error('Auth error:', error);
      if ((!navigator.onLine || isNetworkFailure(error)) && allowCachedAdmin()) {
        return;
      }
      setAuthenticatedUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f3]">
        <p className="admin-take-control text-2xl font-black tracking-[0.18em] text-[#9a7622]">TAKE CONTROL</p>
        <style>{`@keyframes admin-take-control{0%,100%{opacity:.72;transform:translateY(2px) scale(.98);text-shadow:0 0 0 transparent}50%{opacity:1;transform:translateY(-2px) scale(1.03);text-shadow:0 0 18px rgba(196,160,82,.5)}}.admin-take-control{animation:admin-take-control 1.35s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.admin-take-control{animation:none}}`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin-login" state={{ from: location }} replace />;
  }

  return React.isValidElement(children) ? cloneElement(children, { authenticatedUser }) : children;
};

export default AdminProtectedRoute;
