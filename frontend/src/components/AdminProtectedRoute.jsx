import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

const AdminProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        setIsAuthenticated(false);
      } else if (session && session.user) {
        setIsAuthenticated(true);
        localStorage.setItem('adminKey', 'true');
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem('adminKey');
      }
    } catch (error) {
      console.error('Auth error:', error);
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
