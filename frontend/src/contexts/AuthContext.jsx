import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockService } from '../services/mockData';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
        setUser(currentUser);
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
        setUser(result.user);
        return result.user;
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
    } catch (error) {
      console.log('Logout error:', error);
    }
  };

  // Simple helper functions
  const isAuthenticated = () => !!user;
  const userType = user?.role || null;

  const value = {
    user,
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