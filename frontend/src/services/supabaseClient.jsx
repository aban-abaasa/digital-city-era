// Mock Supabase client for frontend-only operation
export const supabase = {
  auth: {
    getUser: () => Promise.resolve({ data: { user: { id: 1, email: 'demo@example.com' } } }),
    signOut: () => Promise.resolve({ error: null }),
    onAuthStateChange: (callback) => {
      return { unsubscribe: () => {} };
    },
    // Add other auth methods that might be needed
    signInWithPassword: () => Promise.resolve({ 
      data: { user: { id: 1, email: 'demo@example.com' } }, 
      error: null 
    }),
    signUp: () => Promise.resolve({ 
      data: { user: { id: 1, email: 'demo@example.com' } }, 
      error: null 
    })
  },
  from: (table) => ({
    select: (columns = '*') => ({
      eq: () => Promise.resolve({ data: [], error: null }),
      neq: () => Promise.resolve({ data: [], error: null }),
      gt: () => Promise.resolve({ data: [], error: null }),
      lt: () => Promise.resolve({ data: [], error: null }),
      gte: () => Promise.resolve({ data: [], error: null }),
      lte: () => Promise.resolve({ data: [], error: null }),
      like: () => Promise.resolve({ data: [], error: null }),
      ilike: () => Promise.resolve({ data: [], error: null }),
      in: () => Promise.resolve({ data: [], error: null }),
      order: () => Promise.resolve({ data: [], error: null }),
      limit: () => Promise.resolve({ data: [], error: null }),
      range: () => Promise.resolve({ data: [], error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      then: () => Promise.resolve({ data: [], error: null })
    }),
    insert: (data) => ({
      select: () => Promise.resolve({ data: [data], error: null }),
      single: () => Promise.resolve({ data, error: null })
    }),
    update: (data) => ({
      eq: () => ({
        select: () => Promise.resolve({ data: [data], error: null }),
        single: () => Promise.resolve({ data, error: null })
      })
    }),
    delete: () => ({
      eq: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        single: () => Promise.resolve({ data: null, error: null })
      })
    })
  }),
  removeChannel: () => {},
  channel: () => ({
    on: () => ({
      subscribe: () => {}
    })
  }),
  rpc: () => Promise.resolve({ data: null, error: null })
};

// Mock function to simulate authenticated state
export const isAuthenticated = () => Promise.resolve(true);

// Mock function to get current user
export const getCurrentUser = async () => {
  return { id: 1, email: 'demo@example.com' };
};

// Mock auth state change listener
export const onAuthStateChange = (callback) => {
  return { unsubscribe: () => {} };
};

// Mock sign out function
export const signOut = async () => {
  return Promise.resolve();
};

// Mock error handler (always returns success)
export const handleSupabaseError = (error) => {
  return { message: 'Operation completed successfully', code: 200 };
};

// Mock retry wrapper (immediately returns)
export const retryAuthOperation = async (operation) => {
  return operation();
};