// Mock Supabase client for frontend-only operation
const createMockQuery = (kind, payload = null) => {
  const buildResult = () => {
    switch (kind) {
      case 'select':
        return { data: [], error: null, count: 0 };
      case 'insert':
        return {
          data: Array.isArray(payload) ? payload : payload ? [payload] : [],
          error: null
        };
      case 'update':
        return {
          data: Array.isArray(payload) ? payload : payload ? [payload] : [],
          error: null
        };
      case 'delete':
        return { data: [], error: null };
      default:
        return { data: null, error: null };
    }
  };

  const builder = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    lt: () => builder,
    gte: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    single: async () => {
      const result = buildResult();
      const singleData = Array.isArray(result.data) ? result.data[0] || null : result.data;
      return { data: singleData, error: null };
    },
    maybeSingle: async () => {
      const result = buildResult();
      const singleData = Array.isArray(result.data) ? result.data[0] || null : result.data;
      return { data: singleData, error: null };
    },
    then: (resolve, reject) => Promise.resolve(buildResult()).then(resolve, reject)
  };

  return builder;
};

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
    select: () => createMockQuery('select'),
    insert: (data) => createMockQuery('insert', data),
    update: (data) => createMockQuery('update', data),
    delete: () => createMockQuery('delete')
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
