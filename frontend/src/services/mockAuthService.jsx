// Simplified mock authentication service for demo purposes
import { mockService } from './mockData';

const CURRENT_USER_KEY = 'supermarket_current_user';

export const mockAuthService = {
  // Simplified signup that always succeeds
  signUp: async ({ email, role = 'customer' }) => {
    const newUser = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      role,
      name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      avatar: `https://picsum.photos/200/200?random=${Math.floor(Math.random() * 100)}`,
      created_at: new Date().toISOString()
    };
    
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
    return { data: { user: newUser }, error: null };
  },

  // Simplified sign in - just use role names or simple words
  signIn: async ({ email }) => {
    const response = await mockService.login(email);
    if (response.success) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(response.user));
      return { data: { user: response.user }, error: null };
    }
    return { data: null, error: new Error('Invalid login') };
  },

  signOut: async () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    return { error: null };
  },

  getCurrentUser: () => {
    const user = localStorage.getItem(CURRENT_USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  updateUser: async (userId, updates) => {
    try {
      const users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        throw new Error('User not found');
      }

      users[userIndex] = { ...users[userIndex], ...updates };
      localStorage.setItem(USERS_KEY, JSON.stringify(users));

      // Update current user if it's the same user
      const currentUser = mockAuthService.getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(users[userIndex]));
      }

      return { data: users[userIndex], error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  deleteUser: async (userId) => {
    try {
      let users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
      users = users.filter(u => u.id !== userId);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));

      // Sign out if it's the current user
      const currentUser = mockAuthService.getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        localStorage.removeItem(CURRENT_USER_KEY);
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  }
};

export default mockAuthService;