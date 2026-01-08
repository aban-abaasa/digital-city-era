import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

/**
 * Admin Entry Point
 * Checks if user is authenticated and routes accordingly
 */
const AdminEntry = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    try {
      // Check if user has valid session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        navigate('/admin-login', { replace: true });
        return;
      }

      if (session && session.user) {
        // User is authenticated, go to portal
        localStorage.setItem('adminKey', 'true');
        navigate('/admin-portal', { replace: true });
      } else {
        // Not authenticated, go to login
        localStorage.removeItem('adminKey');
        navigate('/admin-login', { replace: true });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      navigate('/admin-login', { replace: true });
    }
  };

  // Show loading while checking
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
        <p className="text-white text-xl font-semibold">Loading Admin Portal...</p>
      </div>
    </div>
  );
};

export default AdminEntry;
