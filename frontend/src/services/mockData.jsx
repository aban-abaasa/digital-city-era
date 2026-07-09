// Mock data service for frontend-only operation
const mockData = {
  products: [
    {
      id: 1,
      name: "Rice",
      price: 25000,
      stock: 100,
      image: "https://picsum.photos/200/200?random=1",
      category: "Groceries"
    },
    {
      id: 2,
      name: "Cooking Oil",
      price: 15000,
      stock: 50,
      image: "https://picsum.photos/200/200?random=2",
      category: "Groceries"
    },
    {
      id: 3,
      name: "Sugar",
      price: 8000,
      stock: 75,
      image: "https://picsum.photos/200/200?random=3",
      category: "Groceries"
    },
    {
      id: 4,
      name: "Milk",
      price: 5000,
      stock: 30,
      image: "https://picsum.photos/200/200?random=4",
      category: "Dairy"
    }
  ],

  categories: [
    { id: 1, name: "Groceries" },
    { id: 2, name: "Dairy" },
    { id: 3, name: "Beverages" },
    { id: 4, name: "Snacks" }
  ],

  users: [
    {
      id: 1,
      name: "System Admin",
      role: "admin",
      email: "admin", // Just type 'admin' to login
      avatar: "https://picsum.photos/200/200?random=1"
    },
    {
      id: 2,
      name: "Demo Employee",
      role: "employee",
      email: "staff", // Simplified for easy demo access
      avatar: "https://picsum.photos/200/200?random=11"
    },
    {
      id: 3,
      name: "Demo Customer",
      role: "customer",
      email: "customer", // Simplified for easy demo access
      avatar: "https://picsum.photos/200/200?random=12"
    },
    {
      id: 4,
      name: "Demo Supplier",
      role: "supplier",
      email: "supplier", // Simplified for easy demo access
      avatar: "https://picsum.photos/200/200?random=13"
    }
  ],

  orders: [
    {
      id: 1,
      date: "2025-09-19",
      total: 45000,
      items: [
        { productId: 1, quantity: 1, price: 25000 },
        { productId: 2, quantity: 1, price: 15000 },
        { productId: 4, quantity: 1, price: 5000 }
      ],
      status: "completed"
    }
  ]
};

// Local Storage Keys
const STORAGE_KEYS = {
  CART: 'supermarket_cart',
  USER: 'supermarket_user',
  ORDERS: 'supermarket_orders'
};

// Helper function to initialize local storage with mock data
export const initializeMockData = () => {
  // Only initialize if not already done
  if (!localStorage.getItem(STORAGE_KEYS.USER)) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(null));
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(mockData.orders));
  }
};

// Mock service functions
export const mockService = {
  // Products
  getProducts: () => {
    return Promise.resolve(mockData.products);
  },

  getProductById: (id) => {
    const product = mockData.products.find(p => p.id === id);
    return Promise.resolve(product);
  },

  // Categories
  getCategories: () => {
    return Promise.resolve(mockData.categories);
  },

  // Cart
  getCart: () => {
    const cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '[]');
    return Promise.resolve(cart);
  },

  addToCart: (product) => {
    const cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '[]');
    const existingItem = cart.find(item => item.productId === product.id);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image
      });
    }

    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    return Promise.resolve(cart);
  },

  updateCartItem: (productId, quantity) => {
    let cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '[]');
    
    if (quantity === 0) {
      cart = cart.filter(item => item.productId !== productId);
    } else {
      const item = cart.find(item => item.productId === productId);
      if (item) {
        item.quantity = quantity;
      }
    }

    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    return Promise.resolve(cart);
  },

  clearCart: () => {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
    return Promise.resolve([]);
  },

  // Auth
  login: async (email) => {
    // Import supabase dynamically to avoid circular dependencies
    const { supabase } = await import('./supabase');
    
    try {
      // First check if there's a valid Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // User is authenticated with Supabase, fetch their profile from users
        // table. role/full_name/supermarket_id live directly on users — no
        // join needed. Rows created by different signup paths over time link
        // to auth either via auth_id (older trigger) or by using
        // auth.users.id as users.id directly (newer trigger), so match
        // either rather than assuming one convention.
        let { data: userRow, error: userError } = await supabase
          .from('users')
          .select('*')
          .or(`auth_id.eq.${session.user.id},id.eq.${session.user.id}`)
          .maybeSingle();

        // If user doesn't exist in users table, create them
        if (!userRow && !userError) {
          console.log('[MOCK-SERVICE] Creating user record for authenticated user...');

          const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';

          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
              id: session.user.id,
              auth_id: session.user.id,
              email: session.user.email,
              full_name: fullName,
              role: 'customer',
              is_active: true
            })
            .select('*')
            .single();

          if (insertError) {
            console.error('[MOCK-SERVICE] Failed to create user:', insertError);
          } else {
            userRow = newUser;
          }
        }

        if (userRow) {
          const primaryRole = userRow.role?.toLowerCase() || 'customer';

          // Convert Supabase user to mock format
          const user = {
            id: userRow.id,
            name: userRow.full_name || userRow.email?.split('@')[0] || 'User',
            full_name: userRow.full_name || userRow.email?.split('@')[0] || 'User',
            role: primaryRole,
            email: userRow.email,
            avatar: userRow.avatar_url || `https://picsum.photos/200/200?random=${userRow.id}`,
            phone: userRow.phone || '',
            created_at: userRow.created_at || null
          };

          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
          return Promise.resolve({ success: true, user });
        }
      }
    } catch (error) {
      console.error('[MOCK-SERVICE] Supabase auth check failed:', error);
    }
    
    // Fallback to mock user system for demo/testing
    const fallbackUser = mockData.users.find(u => u.role === 'customer') || mockData.users[0];
    const user = mockData.users.find(u => 
      u.email.toLowerCase() === email.toLowerCase() || 
      u.role.toLowerCase() === email.toLowerCase()
    ) || fallbackUser;

    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return Promise.resolve({ success: true, user });
  },

  logout: () => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(null));
    return Promise.resolve({ success: true });
  },

  getCurrentUser: () => {
    return Promise.resolve(JSON.parse(localStorage.getItem(STORAGE_KEYS.USER)));
  },

  // Orders
  createOrder: (cart) => {
    const orders = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
    const newOrder = {
      id: orders.length + 1,
      date: new Date().toISOString(),
      items: cart,
      total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      status: 'completed'
    };
    
    orders.push(newOrder);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    return Promise.resolve(newOrder);
  },

  getOrders: () => {
    return Promise.resolve(JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]'));
  }
};

// Initialize mock data
initializeMockData();

export default mockService;
