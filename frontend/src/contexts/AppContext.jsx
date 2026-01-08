import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { toast } from 'react-toastify';

// Initial state for the entire application
const initialState = {
  // Products & Inventory
  products: [],
  categories: [],
  suppliers: [],
  inventory: {
    totalProducts: 0,
    lowStockItems: [],
    totalValue: 0,
    reorderSuggestions: []
  },
  
  // Sales & POS
  sales: [],
  currentCart: [],
  dailySales: 0,
  salesStats: {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    target: 500000
  },
  
  // Customers
  customers: [],
  currentCustomer: null,
  loyaltyProgram: {
    totalMembers: 0,
    activeMembers: 0,
    pointsIssued: 0
  },
  
  // Employees
  employees: [],
  currentUser: null,
  
  // Reports & Analytics
  reports: {
    salesTrends: [],
    topProducts: [],
    customerInsights: [],
    inventoryTurnover: []
  },
  
  // Real-time updates
  notifications: [],
  lastUpdated: new Date(),
  
  // UI State
  loading: {
    products: false,
    sales: false,
    customers: false,
    inventory: false
  },
  
  // Settings
  settings: {
    currency: 'UGX',
    taxRate: 0.18,
    receiptFooter: 'Thank you for shopping with FareDeal!',
    loyaltyPointRate: 0.01, // 1% of purchase amount
    lowStockThreshold: 10
  }
};

// Action types
const ActionTypes = {
  // Products
  SET_PRODUCTS: 'SET_PRODUCTS',
  ADD_PRODUCT: 'ADD_PRODUCT',
  UPDATE_PRODUCT: 'UPDATE_PRODUCT',
  DELETE_PRODUCT: 'DELETE_PRODUCT',
  
  // Inventory
  UPDATE_INVENTORY: 'UPDATE_INVENTORY',
  UPDATE_STOCK: 'UPDATE_STOCK',
  
  // Sales
  SET_SALES: 'SET_SALES',
  ADD_SALE: 'ADD_SALE',
  UPDATE_CART: 'UPDATE_CART',
  CLEAR_CART: 'CLEAR_CART',
  UPDATE_SALES_STATS: 'UPDATE_SALES_STATS',
  
  // Customers
  SET_CUSTOMERS: 'SET_CUSTOMERS',
  ADD_CUSTOMER: 'ADD_CUSTOMER',
  UPDATE_CUSTOMER: 'UPDATE_CUSTOMER',
  SET_CURRENT_CUSTOMER: 'SET_CURRENT_CUSTOMER',
  
  // Categories & Suppliers
  SET_CATEGORIES: 'SET_CATEGORIES',
  SET_SUPPLIERS: 'SET_SUPPLIERS',
  ADD_SUPPLIER: 'ADD_SUPPLIER',
  
  // Notifications
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  
  // Loading states
  SET_LOADING: 'SET_LOADING',
  
  // Real-time updates
  REAL_TIME_UPDATE: 'REAL_TIME_UPDATE'
};

// Reducer function
const appReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_PRODUCTS:
      return {
        ...state,
        products: action.payload,
        inventory: {
          ...state.inventory,
          totalProducts: action.payload.length,
          lowStockItems: action.payload.filter(p => p.stock <= state.settings.lowStockThreshold),
          totalValue: action.payload.reduce((sum, p) => sum + (p.price * p.stock), 0)
        }
      };

    case ActionTypes.ADD_PRODUCT:
      const newProducts = [...state.products, action.payload];
      return {
        ...state,
        products: newProducts,
        inventory: {
          ...state.inventory,
          totalProducts: newProducts.length,
          totalValue: state.inventory.totalValue + (action.payload.price * action.payload.stock)
        }
      };

    case ActionTypes.UPDATE_PRODUCT:
      const updatedProducts = state.products.map(p => 
        p._id === action.payload._id ? action.payload : p
      );
      return {
        ...state,
        products: updatedProducts,
        inventory: {
          ...state.inventory,
          totalValue: updatedProducts.reduce((sum, p) => sum + (p.price * p.stock), 0)
        }
      };

    case ActionTypes.UPDATE_STOCK:
      const stockUpdatedProducts = state.products.map(p => 
        p._id === action.payload.productId 
          ? { ...p, stock: p.stock - action.payload.quantity }
          : p
      );
      return {
        ...state,
        products: stockUpdatedProducts,
        inventory: {
          ...state.inventory,
          lowStockItems: stockUpdatedProducts.filter(p => p.stock <= state.settings.lowStockThreshold)
        }
      };

    case ActionTypes.ADD_SALE:
      const newSale = action.payload;
      const updatedSalesStats = {
        ...state.salesStats,
        today: state.salesStats.today + newSale.total
      };
      
      // Update product stock for each item in the sale
      const stockReducedProducts = state.products.map(product => {
        const saleItem = newSale.items.find(item => item.productId === product._id);
        if (saleItem) {
          return { ...product, stock: product.stock - saleItem.quantity };
        }
        return product;
      });

      return {
        ...state,
        sales: [newSale, ...state.sales],
        products: stockReducedProducts,
        salesStats: updatedSalesStats,
        dailySales: state.dailySales + newSale.total,
        currentCart: [] // Clear cart after sale
      };

    case ActionTypes.UPDATE_CART:
      return {
        ...state,
        currentCart: action.payload
      };

    case ActionTypes.SET_CUSTOMERS:
      return {
        ...state,
        customers: action.payload,
        loyaltyProgram: {
          ...state.loyaltyProgram,
          totalMembers: action.payload.length,
          activeMembers: action.payload.filter(c => c.lastVisit && 
            new Date(c.lastVisit) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ).length
        }
      };

    case ActionTypes.ADD_CUSTOMER:
      return {
        ...state,
        customers: [action.payload, ...state.customers],
        loyaltyProgram: {
          ...state.loyaltyProgram,
          totalMembers: state.loyaltyProgram.totalMembers + 1
        }
      };

    case ActionTypes.SET_CURRENT_CUSTOMER:
      return {
        ...state,
        currentCustomer: action.payload
      };

    case ActionTypes.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [
          {
            id: Date.now(),
            ...action.payload,
            timestamp: new Date()
          },
          ...state.notifications.slice(0, 9) // Keep only 10 notifications
        ]
      };

    case ActionTypes.SET_LOADING:
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value
        }
      };

    case ActionTypes.REAL_TIME_UPDATE:
      return {
        ...state,
        lastUpdated: new Date(),
        ...action.payload
      };

    default:
      return state;
  }
};

// Context
const AppContext = createContext();

// Custom hook to use the app context
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Provider component
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Action creators
  const actions = {
    // Products
    setProducts: (products) => dispatch({ type: ActionTypes.SET_PRODUCTS, payload: products }),
    addProduct: (product) => {
      dispatch({ type: ActionTypes.ADD_PRODUCT, payload: product });
      dispatch({ 
        type: ActionTypes.ADD_NOTIFICATION, 
        payload: { 
          type: 'success', 
          message: `New product "${product.name}" added to inventory`,
          category: 'inventory'
        }
      });
    },
    updateProduct: (product) => {
      dispatch({ type: ActionTypes.UPDATE_PRODUCT, payload: product });
      dispatch({ 
        type: ActionTypes.ADD_NOTIFICATION, 
        payload: { 
          type: 'info', 
          message: `Product "${product.name}" updated`,
          category: 'inventory'
        }
      });
    },
    
    // Sales
    addSale: (sale) => {
      dispatch({ type: ActionTypes.ADD_SALE, payload: sale });
      
      // Check for low stock after sale
      const lowStockItems = state.products
        .map(p => {
          const saleItem = sale.items.find(item => item.productId === p._id);
          return saleItem ? { ...p, stock: p.stock - saleItem.quantity } : p;
        })
        .filter(p => p.stock <= state.settings.lowStockThreshold);
      
      if (lowStockItems.length > 0) {
        dispatch({ 
          type: ActionTypes.ADD_NOTIFICATION, 
          payload: { 
            type: 'warning', 
            message: `${lowStockItems.length} items are running low on stock`,
            category: 'inventory'
          }
        });
      }
      
      // Customer loyalty points
      if (sale.customerId) {
        const points = Math.floor(sale.total * state.settings.loyaltyPointRate);
        dispatch({ 
          type: ActionTypes.ADD_NOTIFICATION, 
          payload: { 
            type: 'success', 
            message: `Customer earned ${points} loyalty points`,
            category: 'customer'
          }
        });
      }
    },
    
    updateCart: (cart) => dispatch({ type: ActionTypes.UPDATE_CART, payload: cart }),
    clearCart: () => dispatch({ type: ActionTypes.CLEAR_CART }),
    
    // Customers
    setCustomers: (customers) => dispatch({ type: ActionTypes.SET_CUSTOMERS, payload: customers }),
    addCustomer: (customer) => {
      dispatch({ type: ActionTypes.ADD_CUSTOMER, payload: customer });
      dispatch({ 
        type: ActionTypes.ADD_NOTIFICATION, 
        payload: { 
          type: 'success', 
          message: `New customer "${customer.firstName} ${customer.lastName}" added`,
          category: 'customer'
        }
      });
    },
    setCurrentCustomer: (customer) => dispatch({ type: ActionTypes.SET_CURRENT_CUSTOMER, payload: customer }),
    
    // Categories & Suppliers
    setCategories: (categories) => dispatch({ type: ActionTypes.SET_CATEGORIES, payload: categories }),
    setSuppliers: (suppliers) => dispatch({ type: ActionTypes.SET_SUPPLIERS, payload: suppliers }),
    
    // Notifications
    addNotification: (notification) => dispatch({ type: ActionTypes.ADD_NOTIFICATION, payload: notification }),
    removeNotification: (id) => dispatch({ type: ActionTypes.REMOVE_NOTIFICATION, payload: id }),
    
    // Loading
    setLoading: (key, value) => dispatch({ type: ActionTypes.SET_LOADING, payload: { key, value } }),
    
    // Real-time updates
    realtimeUpdate: (data) => dispatch({ type: ActionTypes.REAL_TIME_UPDATE, payload: data })
  };

  // Real-time data simulation
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time sales updates
      if (state.sales.length > 0) {
        const randomIncrease = Math.random() * 50000; // Random sales increase
        actions.realtimeUpdate({
          salesStats: {
            ...state.salesStats,
            today: state.salesStats.today + randomIncrease
          }
        });
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [state.sales.length]);

  // Auto-notification for low stock
  useEffect(() => {
    const lowStockItems = state.products.filter(p => p.stock <= state.settings.lowStockThreshold);
    if (lowStockItems.length > 0 && state.products.length > 0) {
      const existingLowStockNotification = state.notifications.find(n => 
        n.category === 'inventory' && n.message.includes('low on stock')
      );
      
      if (!existingLowStockNotification) {
        actions.addNotification({
          type: 'warning',
          message: `${lowStockItems.length} products are running low on stock`,
          category: 'inventory'
        });
      }
    }
  }, [state.products]);

  const value = {
    state,
    actions,
    // Computed values
    computed: {
      totalRevenue: state.sales.reduce((sum, sale) => sum + sale.total, 0),
      averageOrderValue: state.sales.length > 0 
        ? state.sales.reduce((sum, sale) => sum + sale.total, 0) / state.sales.length 
        : 0,
      topSellingProducts: state.products
        .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
        .slice(0, 5),
      recentCustomers: state.customers
        .sort((a, b) => new Date(b.lastVisit || 0) - new Date(a.lastVisit || 0))
        .slice(0, 5),
      salesGrowth: state.salesStats.today > 0 
        ? ((state.salesStats.today - state.salesStats.target * 0.1) / (state.salesStats.target * 0.1)) * 100 
        : 0
    }
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export { ActionTypes };



