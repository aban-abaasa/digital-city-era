import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

/**
 * Protected Route Component for Admin Pages
 * Checks if user is authenticated before allowing access
 */
const AdminProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isURLAllowed, setIsURLAllowed] = useState(false);

  useEffect(() => {
    checkURLAccess();
    checkAuth();
  }, []);

  const checkURLAccess = () => {
    const currentURL = window.location.href.toLowerCase();
    const allowedURLs = [
      'http://localhost:7779',
      'http://localhost:3000',
      'http://127.0.0.1:7779',
      'http://127.0.0.1:3000',
      'http://10.70.0.31:7779',
      'http://10.70.0.31:3000',
      'https://faredeal-main.vercel.app',
      'http://10.0.2.139'  // Android emulator
    ];
    
    // Check if current URL is from allowed domains (more flexible)
    const isAllowed = allowedURLs.some(url => 
      currentURL.toLowerCase().includes(url.toLowerCase().replace('http://', '').replace('https://', ''))
    );
    
    setIsURLAllowed(isAllowed);
    
    if (!isAllowed) {
      console.warn('Admin access blocked - Unauthorized URL:', window.location.href);
    }
  };

  const checkAuth = async () => {
    try {
      // Check Supabase session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
      } else if (session && session.user) {
        // User is authenticated
        setIsAuthenticated(true);
        // Set admin key
        localStorage.setItem('adminKey', 'true');
      } else {
        // No valid session
        setIsAuthenticated(false);
        localStorage.removeItem('adminKey');
      }
    } catch (error) {
      console.error('Unexpected auth error:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Block access if URL is not allowed
  if (!isURLAllowed && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-xl">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-red-600 mb-4">Unauthorized Access</h1>
          <p className="text-gray-700 mb-6">Admin access is only allowed from:</p>
          <div className="bg-gray-100 p-4 rounded-lg text-left mb-6">
            <p className="font-mono text-sm mb-2">• http://localhost:7779/#admin</p>
            <p className="font-mono text-sm">• https://faredeal-main.vercel.app/#admin</p>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Show loading spinner while checking authentication
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

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/admin-login" state={{ from: location }} replace />;
  }

  // User is authenticated, render the protected content
  return children;
};

export default AdminProtectedRoute;
