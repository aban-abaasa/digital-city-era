/**
 * Admin Authentication Utility
 * Handles automatic admin login for development/demo
 */

import { supabase } from '../services/supabase';

// Admin credentials
const ADMIN_CREDENTIALS = {
  email: 'heradmin@faredeal.ug',
  password: 'Administrator',
  userId: '399d9128-0b41-4a65-9124-24d8f0c7b4bb'
};

/**
 * Check if admin is authenticated
 * @returns {Promise<boolean>} True if authenticated
 */
export const isAdminAuthenticated = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Auth check error:', error);
      return false;
    }
    
    return !!user && user.email === ADMIN_CREDENTIALS.email;
  } catch (error) {
    console.error('Error checking admin auth:', error);
    return false;
  }
};

/**
 * Login admin user
 * @returns {Promise<{success: boolean, user: object|null, error: string|null}>}
 */
export const loginAdmin = async () => {
  try {
    // Check if already logged in
    const isAuthenticated = await isAdminAuthenticated();
    if (isAuthenticated) {
      const { data: { user } } = await supabase.auth.getUser();
      return { success: true, user, error: null };
    }

    // Attempt sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_CREDENTIALS.email,
      password: ADMIN_CREDENTIALS.password
    });

    if (error) {
      console.error('Admin login error:', error);
      return { success: false, user: null, error: error.message };
    }

    console.log('✅ Admin logged in successfully:', data.user.email);
    return { success: true, user: data.user, error: null };
  } catch (error) {
    console.error('Unexpected login error:', error);
    return { success: false, user: null, error: error.message };
  }
};

/**
 * Logout admin user
 * @returns {Promise<boolean>} True if successful
 */
export const logoutAdmin = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
      return false;
    }

    console.log('✅ Admin logged out successfully');
    return true;
  } catch (error) {
    console.error('Unexpected logout error:', error);
    return false;
  }
};

/**
 * Get current admin user
 * @returns {Promise<object|null>} User object or null
 */
export const getCurrentAdmin = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting current admin:', error);
    return null;
  }
};

/**
 * Ensure admin is logged in (auto-login if needed)
 * @returns {Promise<{success: boolean, user: object|null}>}
 */
export const ensureAdminAuth = async () => {
  try {
    // Check if already authenticated
    const isAuthenticated = await isAdminAuthenticated();
    
    if (isAuthenticated) {
      const user = await getCurrentAdmin();
      return { success: true, user };
    }

    // Not authenticated, attempt login
    console.log('🔐 Admin not authenticated, attempting auto-login...');
    const loginResult = await loginAdmin();
    
    return {
      success: loginResult.success,
      user: loginResult.user
    };
  } catch (error) {
    console.error('Error ensuring admin auth:', error);
    return { success: false, user: null };
  }
};

/**
 * Update admin user metadata
 * @param {object} metadata - Metadata to update
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const updateAdminMetadata = async (metadata) => {
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: metadata
    });

    if (error) {
      console.error('Metadata update error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Admin metadata updated');
    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected metadata update error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Change admin password
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const changeAdminPassword = async (newPassword) => {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('Password change error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Admin password changed');
    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected password change error:', error);
    return { success: false, error: error.message };
  }
};

export default {
  isAdminAuthenticated,
  loginAdmin,
  logoutAdmin,
  getCurrentAdmin,
  ensureAdminAuth,
  updateAdminMetadata,
  changeAdminPassword,
  ADMIN_CREDENTIALS
};
