// Mock API service to simulate backend functionality
import axios from 'axios';

// Mock data
const mockData = {
  users: [
    {
      _id: '1',
      username: 'admin',
      email: 'admin@faredeal.com',
      name: 'Admin User',
      role: 'admin'
    }
  ],
  products: [
    {
      _id: '1',
      name: 'Blue Band Margarine',
      description: 'Premium margarine for cooking and baking',
      category: 'Dairy & Spreads',
      brand: 'Blue Band',
      sku: 'BB-MARG-500G',
      barcode: '6001087357012',
      price: 8500, // UGX
      cost: 6800,
      stock: 150,
      minStock: 20,
      maxStock: 500,
      unit: 'piece',
      weight: '500g',
      supplier: { _id: '1', name: 'Unilever Uganda' },
      tags: ['dairy', 'cooking', 'local-favorite'],
      isActive: true,
      countryOfOrigin: 'Uganda',
      expiryDate: '2024-12-31',
      createdAt: new Date().toISOString()
    },
    {
      _id: '2',
      name: 'Mukwano Cooking Oil',
      description: 'Pure sunflower cooking oil - locally produced',
      category: 'Cooking Oils',
      brand: 'Mukwano',
      sku: 'MK-OIL-2L',
      barcode: '6005089023456',
      price: 15000, // UGX
      cost: 12000,
      stock: 80,
      minStock: 15,
      maxStock: 200,
      unit: 'piece',
      weight: '2L',
      supplier: { _id: '2', name: 'Mukwano Industries' },
      tags: ['cooking', 'oil', 'local-brand'],
      isActive: true,
      countryOfOrigin: 'Uganda',
      expiryDate: '2025-06-30',
      createdAt: new Date().toISOString()
    },
    {
      _id: '3',
      name: "Mama's Pride Posho",
      description: 'Fine quality maize flour - locally milled',
      category: 'Grains & Cereals',
      brand: 'Mama\'s Pride',
      sku: 'MP-POSHO-5KG',
      barcode: '6009012345678',
      price: 12000, // UGX
      cost: 9500,
      stock: 200,
      minStock: 50,
      maxStock: 1000,
      unit: 'bag',
      weight: '5kg',
      supplier: { _id: '3', name: 'Ugandan Millers Ltd' },
      tags: ['staple-food', 'maize', 'local'],
      isActive: true,
      countryOfOrigin: 'Uganda',
      expiryDate: '2024-09-30',
      createdAt: new Date().toISOString()
    },
    {
      _id: '4',
      name: 'Coca-Cola 500ml',
      description: 'Refreshing soft drink - glass bottle',
      category: 'Beverages',
      brand: 'Coca-Cola',
      sku: 'CC-500ML-GB',
      barcode: '5449000000996',
      price: 2500, // UGX
      cost: 1800,
      stock: 5, // Low stock for alert
      minStock: 20,
      maxStock: 500,
      unit: 'bottle',
      weight: '500ml',
      supplier: { _id: '4', name: 'Century Bottling Co.' },
      tags: ['soft-drink', 'popular', 'cold-drink'],
      isActive: true,
      countryOfOrigin: 'Uganda',
      expiryDate: '2024-08-15',
      createdAt: new Date().toISOString()
    },
    {
      _id: '5',
      name: 'Rwenzori Mineral Water',
      description: 'Pure natural mineral water from the Rwenzori Mountains',
      category: 'Beverages',
      brand: 'Rwenzori',
      sku: 'RW-WATER-1.5L',
      barcode: '6008901234567',
      price: 3000, // UGX
      cost: 2200,
      stock: 120,
      minStock: 30,
      maxStock: 300,
      unit: 'bottle',
      weight: '1.5L',
      supplier: { _id: '5', name: 'Rwenzori Bottling Co.' },
      tags: ['water', 'mineral', 'local-brand'],
      isActive: true,
      countryOfOrigin: 'Uganda',
      expiryDate: '2025-12-31',
      createdAt: new Date().toISOString()
    },
    {
      _id: '6',
      name: 'Super FM Radio Rice',
      description: 'Premium quality parboiled rice - 25kg bag',
      category: 'Grains & Cereals',
      brand: 'Super FM',
      sku: 'SFM-RICE-25KG',
      barcode: '6007890123456',
      price: 95000, // UGX
      cost: 75000,
      stock: 8, // Low stock for alert
      minStock: 10,
      maxStock: 100,
      unit: 'bag',
      weight: '25kg',
      supplier: { _id: '6', name: 'Tilda Uganda Ltd' },
      tags: ['rice', 'staple-food', 'wholesale'],
      isActive: true,
      countryOfOrigin: 'Uganda',
      expiryDate: '2025-03-31',
      createdAt: new Date().toISOString()
    },
    {
      _id: '7',
      name: 'Fresh Dairy Milk',
      description: 'Fresh pasteurized milk - 1 liter packet',
      category: 'Dairy & Spreads',
      brand: 'Fresh Dairy',
      sku: 'FD-MILK-1L',
      barcode: '6001234567890',
      price: 4500, // UGX
      cost: 3200,
      stock: 3, // Low stock - expires soon
      minStock: 15,
      maxStock: 200,
      unit: 'packet',
      weight: '1L',
      supplier: { _id: '7', name: 'Fresh Dairy Uganda' },
      tags: ['dairy', 'fresh', 'perishable'],
      isActive: true,
      countryOfOrigin: 'Uganda',
      expiryDate: '2024-03-25', // Short expiry for alert
      createdAt: new Date().toISOString()
    },
    {
      _id: '8',
      name: 'Capital FM Sugar',
      description: 'White crystal sugar - 2kg pack',
      category: 'Condiments & Spices',
      brand: 'Capital FM',
      sku: 'CFM-SUGAR-2KG',
      barcode: '6002345678901',
      price: 8000, // UGX
      cost: 6500,
      stock: 180,
      minStock: 40,
      maxStock: 400,
      unit: 'pack',
      weight: '2kg',
      supplier: { _id: '8', name: 'Sugar Corporation of Uganda' },
      tags: ['sugar', 'sweetener', 'baking'],
      isActive: true,
      countryOfOrigin: 'Uganda',
      expiryDate: '2026-12-31',
      createdAt: new Date().toISOString()
    }
  ],
  categories: ['Dairy & Spreads', 'Cooking Oils', 'Grains & Cereals', 'Beverages', 'Condiments & Spices', 'Fresh Produce', 'Meat & Poultry', 'Personal Care', 'Household Items', 'Snacks & Confectionery'],
  suppliers: [
    {
      _id: '1',
      name: 'Unilever Uganda',
      contact: 'Moses Kiggundu',
      email: 'contact@unilever.co.ug',
      phone: '+256-414-200-300',
      address: 'Industrial Area, Kampala, Uganda',
      district: 'Kampala',
      paymentTerms: '30 days',
      isLocal: true
    },
    {
      _id: '2',
      name: 'Mukwano Industries',
      contact: 'Sarah Nakasozi',
      email: 'info@mukwano.co.ug',
      phone: '+256-414-200-400',
      address: 'Mukwano Road, Kampala, Uganda',
      district: 'Kampala',
      paymentTerms: '21 days',
      isLocal: true
    },
    {
      _id: '3',
      name: 'Ugandan Millers Ltd',
      contact: 'Peter Ssemakula',
      email: 'sales@uganmillers.co.ug',
      phone: '+256-414-200-500',
      address: 'Jinja Road, Kampala, Uganda',
      district: 'Kampala',
      paymentTerms: '14 days',
      isLocal: true
    },
    {
      _id: '4',
      name: 'Century Bottling Co.',
      contact: 'Grace Namatovu',
      email: 'orders@century.co.ug',
      phone: '+256-414-200-600',
      address: 'Namanve Industrial Park, Uganda',
      district: 'Mukono',
      paymentTerms: '7 days',
      isLocal: true
    },
    {
      _id: '5',
      name: 'Rwenzori Bottling Co.',
      contact: 'James Mubiru',
      email: 'info@rwenzori.co.ug',
      phone: '+256-414-200-700',
      address: 'Fort Portal, Kabarole District, Uganda',
      district: 'Kabarole',
      paymentTerms: '30 days',
      isLocal: true
    },
    {
      _id: '6',
      name: 'Tilda Uganda Ltd',
      contact: 'Mary Nakimuli',
      email: 'sales@tilda.co.ug',
      phone: '+256-414-200-800',
      address: 'Bugiri District, Eastern Uganda',
      district: 'Bugiri',
      paymentTerms: '45 days',
      isLocal: true
    },
    {
      _id: '7',
      name: 'Fresh Dairy Uganda',
      contact: 'Robert Kiprotich',
      email: 'orders@freshdairy.co.ug',
      phone: '+256-414-200-900',
      address: 'Mbarara Town, Uganda',
      district: 'Mbarara',
      paymentTerms: '3 days',
      isLocal: true
    },
    {
      _id: '8',
      name: 'Sugar Corporation of Uganda',
      contact: 'Agnes Byarugaba',
      email: 'sales@scoul.co.ug',
      phone: '+256-414-201-000',
      address: 'Lugazi, Mukono District, Uganda',
      district: 'Mukono',
      paymentTerms: '30 days',
      isLocal: true
    }
  ],
  customers: [
    {
      _id: '1',
      name: 'John Customer',
      email: 'john@example.com',
      phone: '+1-555-0100',
      address: '123 Main St, Anytown, USA',
      totalPurchases: 2500.00,
      lastPurchase: new Date().toISOString()
    }
  ],
  sales: [
    {
      _id: '1',
      saleNumber: 'SALE-001',
      customer: { _id: '1', name: 'John Customer', phone: '+1-555-0100' },
      items: [
        {
          product: { _id: '1', name: 'iPhone 15 Pro', sku: 'IP15P-128' },
          quantity: 1,
          price: 999.99,
          total: 999.99
        }
      ],
      subtotal: 999.99,
      tax: 99.99,
      total: 1099.98,
      paymentMethod: 'card',
      status: 'completed',
      createdAt: new Date().toISOString()
    }
  ],
  employees: [
    {
      _id: '1',
      name: 'Admin User',
      email: 'admin@faredeal.com',
      phone: '+1-555-0001',
      role: 'admin',
      department: 'Management',
      salary: 75000,
      hireDate: '2023-01-01',
      isActive: true
    }
  ]
};

// Mock API responses
const mockResponses = {
  '/api/auth/login': (data) => {
    const { username, password } = data;
    if (username === 'admin' && password === 'admin') {
      return {
        success: true,
        user: mockData.users[0],
        token: 'mock-jwt-token-12345'
      };
    }
    throw new Error('Invalid credentials');
  },
  '/api/auth/me': () => ({
    user: mockData.users[0]
  }),
  '/api/products': () => ({
    products: mockData.products,
    total: mockData.products.length
  }),
  '/api/products/categories/list': () => ({
    categories: mockData.categories
  }),
  '/api/suppliers': () => ({
    suppliers: mockData.suppliers,
    total: mockData.suppliers.length
  }),
  '/api/customers': () => ({
    customers: mockData.customers,
    total: mockData.customers.length
  }),
  '/api/sales': () => ({
    sales: mockData.sales,
    total: mockData.sales.length
  }),
  '/api/employees': () => ({
    employees: mockData.employees,
    total: mockData.employees.length
  }),
  '/api/reports/dashboard': () => {
    const today = new Date();
    const randomVariation = () => 0.9 + Math.random() * 0.2; // ±10% variation
    
    return {
      dashboard: {
        totalSales: Math.floor(15420.50 * randomVariation()),
        totalOrders: Math.floor(156 * randomVariation()),
        totalCustomers: Math.floor(89 * randomVariation()),
        totalProducts: mockData.products.length,
        recentSales: mockData.sales.slice(0, 5),
        lowStockProducts: mockData.products.filter(p => p.stock <= p.minStock),
        // Additional metrics for enhanced dashboard
        dailyGrowth: Math.floor(Math.random() * 25) + 5, // 5-30%
        monthlyTarget: 50000,
        currentMonthSales: Math.floor(35000 * randomVariation()),
        topCustomer: mockData.customers[0],
        averageOrderValue: Math.floor(120 * randomVariation()),
        conversionRate: Math.floor(3.5 * randomVariation() * 10) / 10, // 3.1-3.9%
      }
    };
  },
  '/api/reports/sales': () => ({
    report: Array.from({ length: 7 }, (_, i) => {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const baseValue = 2000 + Math.sin(i * 0.5) * 1000; // Create some pattern
      return {
        date: date.toISOString().split('T')[0],
        sales: Math.floor(baseValue + Math.random() * 1500),
        orders: Math.floor(Math.random() * 50) + 10,
        profit: Math.floor((baseValue + Math.random() * 1500) * 0.3), // 30% profit
        target: Math.floor((baseValue + Math.random() * 1500) * 1.2), // 20% above sales
        customers: Math.floor(Math.random() * 30) + 8,
        averageOrderValue: Math.floor(100 + Math.random() * 100),
      };
    }).reverse()
  }),
  '/api/reports/products': () => ({
    report: mockData.products.slice(0, 5)
  })
};

// Setup axios interceptor to handle mock responses
const originalAxios = axios.create();

// Override axios methods
const setupMockAxios = () => {
  // Mock GET requests
  axios.get = async (url, config = {}) => {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    
    const baseUrl = url.split('?')[0]; // Remove query parameters
    
    if (mockResponses[baseUrl]) {
      return { data: mockResponses[baseUrl]() };
    }
    
    console.warn(`Mock API: No response defined for GET ${url}`);
    return { data: {} };
  };

  // Mock POST requests
  axios.post = async (url, data, config = {}) => {
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
    
    if (mockResponses[url]) {
      return { data: mockResponses[url](data) };
    }
    
    // Handle generic POST requests (like creating products, sales, etc.)
    if (url.includes('/api/products') && !url.includes('categories')) {
      const newProduct = { ...data, _id: String(Date.now()), createdAt: new Date().toISOString() };
      mockData.products.push(newProduct);
      return { data: { success: true, product: newProduct } };
    }
    
    if (url.includes('/api/sales')) {
      const newSale = {
        ...data,
        _id: String(Date.now()),
        saleNumber: `SALE-${String(mockData.sales.length + 1).padStart(3, '0')}`,
        createdAt: new Date().toISOString(),
        status: 'completed'
      };
      mockData.sales.push(newSale);
      return { data: { success: true, sale: newSale } };
    }
    
    console.warn(`Mock API: No response defined for POST ${url}`);
    return { data: { success: true } };
  };

  // Mock PUT requests
  axios.put = async (url, data, config = {}) => {
    await new Promise(resolve => setTimeout(resolve, 150)); // Simulate network delay
    
    console.log(`Mock API: PUT ${url}`, data);
    return { data: { success: true } };
  };

  // Mock DELETE requests
  axios.delete = async (url, config = {}) => {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    
    console.log(`Mock API: DELETE ${url}`);
    return { data: { success: true } };
  };
};

export default setupMockAxios;


