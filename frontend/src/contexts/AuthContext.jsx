import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockService } from '../services/mockData';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const normalizeUser = (currentUser) => {
    if (!currentUser) return null;

    return {
      ...currentUser,
      name: currentUser.name || currentUser.full_name || 'Customer',
      full_name: currentUser.full_name || currentUser.name || 'Customer',
      phone: currentUser.phone || '',
      role: currentUser.role || 'customer'
    };
  };

  useEffect(() => {
    // Check for existing user session on mount
    const checkUser = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth check timeout')), 3000)
        );
        
        const currentUser = await Promise.race([
          mockService.getCurrentUser(),
          timeoutPromise
        ]);
        const normalizedUser = normalizeUser(currentUser);
        setUser(normalizedUser);
        setCustomer(normalizedUser);
      } catch (error) {
        console.log('No active session:', error?.message || error);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  // Simplified demo authentication functions
  const login = async (identifier) => {
    try {
      const result = await mockService.login(identifier);
      if (result.success) {
        const normalizedUser = normalizeUser(result.user);
        setUser(normalizedUser);
        setCustomer(normalizedUser);
        return normalizedUser;
      }
    } catch (error) {
      console.log('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await mockService.logout();
      setUser(null);
      setCustomer(null);
    } catch (error) {
      console.log('Logout error:', error);
    }
  };

  // Simple helper functions
  const isAuthenticated = () => !!user;
  const userType = user?.role || null;

  const value = {
    user,
    customer,
    login,
    logout,
    loading,
    isAuthenticated,
    userType
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
