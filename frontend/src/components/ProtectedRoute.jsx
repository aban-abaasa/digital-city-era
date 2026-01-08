import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ 
  children, 
  allowedUserTypes = ['customer', 'manager', 'employee', 'supplier']
}) => {
  const { userType, loading } = useAuth();
  const location = useLocation();

  // Simple loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Loading...</h2>
        </div>
      </div>
    );
  }

  // Simplified auth check - just redirect to login if no user type
  if (!userType) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Basic role check
  if (!allowedUserTypes.includes(userType)) {
    console.info(`Demo: Redirecting ${userType} to authorized route`);
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;