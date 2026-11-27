import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { getCachedIdentity, isNetworkFailure } from '../services/posOfflineCache';

const AdminProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const cachedIdentity = getCachedIdentity();
    const hasCachedAdmin = cachedIdentity?.role === 'admin' && Boolean(cachedIdentity.userId);
    const allowCachedAdmin = (sessionUserId = null) => {
      if (!hasCachedAdmin || (sessionUserId && sessionUserId !== cachedIdentity.userId)) return false;
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
        setIsAuthenticated(true);
        localStorage.setItem('adminKey', 'true');
      } else if (backendUnreachable && allowCachedAdmin(session?.user?.id)) {
        // AdminPortal will restore the profile and inventory snapshots after
        // this route guard accepts the last verified admin identity.
        return;
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem('adminKey');
      }
    } catch (error) {
      console.error('Auth error:', error);
      if ((!navigator.onLine || isNetworkFailure(error)) && allowCachedAdmin()) {
        return;
      }
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin-login" state={{ from: location }} replace />;
  }

  return children;
};

export default AdminProtectedRoute;
