/**
 * FAREDEAL Backend API Server
 * Main Express application for POS system backend
 * Version: 2.0.0
 * Last Updated: October 8, 2025
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// API Version
const API_VERSION = '2.0.0';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow for development
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware with color coding
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method.padEnd(7);
  const methodColor = {
    'GET': '\x1b[32m',    // Green
    'POST': '\x1b[33m',   // Yellow
    'PUT': '\x1b[34m',    // Blue
    'DELETE': '\x1b[31m', // Red
    'PATCH': '\x1b[35m'   // Magenta
  };
  const color = methodColor[req.method] || '\x1b[0m';
  console.log(`${color}${timestamp} - ${method}\x1b[0m ${req.path}`);
  next();
});

// Response time tracking
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.log(`⚠️  Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  next();
});

// =============================================================================
// AUTHENTICATION ROUTES
// =============================================================================

/**
 * User Login
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user in database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('status', 'active')
      .single();

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // In a real app, you'd verify the password hash here
    // For now, we'll accept the request if user exists
    
    const userResponse = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      permissions: user.permissions,
      profileComplete: true
    };

    res.json({
      success: true,
      user: userResponse,
      token: `mock_token_${user.id}` // In production, generate proper JWT
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * User Profile
 * GET /api/auth/profile
 */
app.get('/api/auth/profile', async (req, res) => {
  try {
    // In a real app, you'd validate the JWT token here
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'No authorization token provided'
      });
    }

    // Mock user for development
    res.json({
      success: true,
      user: {
        id: 'mock-admin-id',
        email: 'admin@faredeal.co.ug',
        username: 'admin',
        firstName: 'System',
        lastName: 'Administrator',
        role: 'admin',
        permissions: {
          manage_all: true,
          view_analytics: true,
          manage_employees: true,
          manage_inventory: true
        },
        profileComplete: true
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// =============================================================================
// EMAIL ROUTES
// =============================================================================

/**
 * Send Admin Signup Email
 * POST /api/email/send-signup
 */
app.post('/api/email/send-signup', async (req, res) => {
  try {
    const { email, fullName } = req.body;

    if (!email || !fullName) {
      return res.status(400).json({
        error: 'Email and full name are required'
      });
    }

    // Import email service
    const { sendAdminSignupEmail } = await import('./services/emailNotifications.js');
    
    await sendAdminSignupEmail(email, fullName);
    
    res.json({
      success: true,
      message: 'Welcome email sent successfully'
    });

  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({
      error: 'Failed to send email',
      message: error.message
    });
  }
});

// =============================================================================
// INVENTORY MANAGEMENT ROUTES
// =============================================================================

/**
 * Get all products with inventory
 * GET /api/products
 */
app.get('/api/products', async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(name),
        supplier:suppliers(company_name),
        inventory(current_stock, minimum_stock, reorder_point)
      `);

    if (error) {
      throw error;
    }

    // Format products for frontend
    const formattedProducts = products.map(product => ({
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      description: product.description,
      category: product.category?.name || 'Uncategorized',
      supplier: product.supplier?.company_name || 'Unknown',
      brand: product.brand,
      costPrice: product.cost_price,
      sellingPrice: product.selling_price,
      stock: product.inventory?.[0]?.current_stock || 0,
      minimumStock: product.inventory?.[0]?.minimum_stock || 0,
      reorderPoint: product.inventory?.[0]?.reorder_point || 0,
      status: product.status,
      createdAt: product.created_at,
      updatedAt: product.updated_at
    }));

    res.json({
      success: true,
      products: formattedProducts,
      total: formattedProducts.length
    });

  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch products'
    });
  }
});

/**
 * Create new product
 * POST /api/products
 */
app.post('/api/products', async (req, res) => {
  try {
    const {
      sku, barcode, name, description, categoryId, supplierId,
      brand, costPrice, sellingPrice, initialStock, minimumStock
    } = req.body;

    // Validation
    if (!name || !costPrice || !sellingPrice) {
      return res.status(400).json({
        error: 'Name, cost price, and selling price are required'
      });
    }

    // Create product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        sku,
        barcode,
        name,
        description,
        category_id: categoryId,
        supplier_id: supplierId,
        brand,
        cost_price: costPrice,
        selling_price: sellingPrice,
        markup_percentage: ((sellingPrice - costPrice) / costPrice * 100).toFixed(2)
      })
      .select()
      .single();

    if (productError) {
      throw productError;
    }

    // Create inventory record
    const { error: inventoryError } = await supabase
      .from('inventory')
      .insert({
        product_id: product.id,
        current_stock: initialStock || 0,
        minimum_stock: minimumStock || 0,
        reorder_point: minimumStock || 0,
        location: 'Main Store'
      });

    if (inventoryError) {
      throw inventoryError;
    }

    res.status(201).json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        sellingPrice: product.selling_price,
        stock: initialStock || 0
      }
    });

  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({
      error: 'Failed to create product'
    });
  }
});

/**
 * Update product stock
 * PUT /api/products/:id/stock
 */
app.put('/api/products/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;

    if (typeof adjustment !== 'number') {
      return res.status(400).json({
        error: 'Stock adjustment must be a number'
      });
    }

    // Get current inventory
    const { data: inventory, error: fetchError } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', id)
      .single();

    if (fetchError || !inventory) {
      return res.status(404).json({
        error: 'Product inventory not found'
      });
    }

    const newStock = inventory.current_stock + adjustment;

    if (newStock < 0) {
      return res.status(400).json({
        error: 'Stock cannot be negative'
      });
    }

    // Update inventory
    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        current_stock: newStock,
        last_stock_update: new Date().toISOString()
      })
      .eq('product_id', id);

    if (updateError) {
      throw updateError;
    }

    // Log inventory movement
    const { error: logError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: id,
        movement_type: adjustment > 0 ? 'stock_in' : 'stock_out',
        quantity: Math.abs(adjustment),
        reason: reason || 'Manual adjustment',
        previous_stock: inventory.current_stock,
        new_stock: newStock,
        performed_by: 'admin' // In production, use actual user ID
      });

    if (logError) {
      console.warn('Failed to log inventory movement:', logError);
    }

    res.json({
      success: true,
      newStock,
      adjustment,
      previousStock: inventory.current_stock
    });

  } catch (error) {
    console.error('Stock update error:', error);
    res.status(500).json({
      error: 'Failed to update stock'
    });
  }
});

// =============================================================================
// EMPLOYEE MANAGEMENT ROUTES
// =============================================================================

/**
 * Get all employees
 * GET /api/employees
 */
app.get('/api/employees', async (req, res) => {
  try {
    const { data: employees, error } = await supabase
      .from('users')
      .select(`
        *,
        employee:employees(employee_number, department, position, hire_date, salary)
      `)
      .neq('role', 'customer')
      .eq('status', 'active');

    if (error) {
      throw error;
    }

    const formattedEmployees = employees.map(emp => ({
      id: emp.id,
      email: emp.email,
      name: `${emp.first_name} ${emp.last_name}`,
      role: emp.role,
      department: emp.employee?.[0]?.department || 'General',
      position: emp.employee?.[0]?.position || emp.role,
      phone: emp.phone,
      status: emp.status,
      hireDate: emp.employee?.[0]?.hire_date,
      lastLogin: emp.last_login_at
    }));

    res.json({
      success: true,
      employees: formattedEmployees
    });

  } catch (error) {
    console.error('Employees fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch employees'
    });
  }
});

// =============================================================================
// ANALYTICS & REPORTING ROUTES
// =============================================================================

/**
 * Get dashboard analytics
 * GET /api/analytics/dashboard
 */
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    // Get product count
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    // Get employee count
    const { count: employeeCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .neq('role', 'customer');

    // Get active user count
    const { count: activeUserCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get low stock products
    const { data: lowStockProducts } = await supabase
      .from('inventory')
      .select(`
        *,
        product:products(name)
      `)
      .lt('current_stock', 'reorder_point')
      .limit(10);

    // Calculate total inventory value
    const { data: inventoryValue } = await supabase
      .from('products')
      .select(`
        selling_price,
        inventory(current_stock)
      `);

    let totalValue = 0;
    if (inventoryValue) {
      totalValue = inventoryValue.reduce((sum, item) => {
        const stock = item.inventory?.[0]?.current_stock || 0;
        return sum + (item.selling_price * stock);
      }, 0);
    }

    res.json({
      success: true,
      analytics: {
        totalProducts: productCount || 0,
        totalEmployees: employeeCount || 0,
        activeUsers: activeUserCount || 0,
        totalInventoryValue: totalValue,
        lowStockCount: lowStockProducts?.length || 0,
        lowStockProducts: lowStockProducts?.map(item => ({
          name: item.product?.name || 'Unknown',
          currentStock: item.current_stock,
          reorderPoint: item.reorder_point
        })) || []
      }
    });

  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics'
    });
  }
});

// =============================================================================
// PORTAL CONFIGURATION ROUTES
// =============================================================================

/**
 * Get portal configuration
 * GET /api/portal/config
 */
app.get('/api/portal/config', async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('*');

    if (error) {
      throw error;
    }

    // Convert array of settings to object
    const config = {};
    settings?.forEach(setting => {
      config[setting.key] = setting.value;
    });

    // Provide defaults if no settings exist
    const defaultConfig = {
      companyName: process.env.BUSINESS_NAME || 'FAREDEAL',
      adminPortal: 'Admin Portal',
      managerPortal: 'Manager Portal',
      cashierPortal: 'Cashier Portal',
      currency: process.env.BUSINESS_CURRENCY || 'UGX',
      taxRate: process.env.BUSINESS_TAX_RATE || 18,
      ...config
    };

    res.json({
      success: true,
      config: defaultConfig
    });

  } catch (error) {
    console.error('Portal config fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch portal configuration'
    });
  }
});

/**
 * Update portal configuration
 * PUT /api/portal/config
 */
app.put('/api/portal/config', async (req, res) => {
  try {
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({
        error: 'Configuration object is required'
      });
    }

    // Update or insert each config setting
    for (const [key, value] of Object.entries(config)) {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key,
          value,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }
    }

    res.json({
      success: true,
      message: 'Portal configuration updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Portal config update error:', error);
    res.status(500).json({
      error: 'Failed to update portal configuration'
    });
  }
});

/**
 * Reset portal configuration to defaults
 * POST /api/portal/config/reset
 */
app.post('/api/portal/config/reset', async (req, res) => {
  try {
    const defaultConfig = {
      companyName: process.env.BUSINESS_NAME || 'FAREDEAL',
      adminPortal: 'Admin Portal',
      managerPortal: 'Manager Portal',
      cashierPortal: 'Cashier Portal',
      employeePortal: 'Employee Portal',
      customerPortal: 'Customer Portal',
      supplierPortal: 'Supplier Portal',
      deliveryPortal: 'Delivery Portal',
      systemName: 'FAREDEAL',
      tagline: 'Your Trusted Marketplace',
      currency: process.env.BUSINESS_CURRENCY || 'UGX',
      taxRate: process.env.BUSINESS_TAX_RATE || 18
    };

    // Update all settings to defaults
    for (const [key, value] of Object.entries(defaultConfig)) {
      await supabase
        .from('system_settings')
        .upsert({
          key,
          value,
          updated_at: new Date().toISOString()
        });
    }

    res.json({
      success: true,
      message: 'Configuration reset to defaults',
      config: defaultConfig,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Portal config reset error:', error);
    res.status(500).json({
      error: 'Failed to reset portal configuration'
    });
  }
});

/**
 * Get portal configuration history
 * GET /api/portal/config/history
 */
app.get('/api/portal/config/history', async (req, res) => {
  try {
    const { data: history, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'PORTAL_CONFIG_UPDATE')
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      history: history || []
    });

  } catch (error) {
    console.error('Portal config history error:', error);
    res.status(500).json({
      error: 'Failed to fetch configuration history'
    });
  }
});

// =============================================================================
// EMPLOYEE ACCESS CONTROL ROUTES
// =============================================================================

/**
 * Get employee access control status
 * GET /api/employees/access
 */
app.get('/api/employees/access', async (req, res) => {
  try {
    const { data: employees, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, status, last_login_at')
      .neq('role', 'customer')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      employees: employees || [],
      totalCount: employees?.length || 0
    });

  } catch (error) {
    console.error('Employee access fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch employee access status'
    });
  }
});

/**
 * Update employee access status
 * PUT /api/employees/:id/access
 */
app.put('/api/employees/:id/access', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'disabled', 'suspended'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: active, disabled, or suspended'
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the access change
    await supabase
      .from('audit_logs')
      .insert({
        action: 'EMPLOYEE_ACCESS_CHANGE',
        user_id: id,
        details: {
          newStatus: status,
          timestamp: new Date().toISOString()
        }
      });

    res.json({
      success: true,
      message: `Employee access ${status}`,
      employee: data
    });

  } catch (error) {
    console.error('Employee access update error:', error);
    res.status(500).json({
      error: 'Failed to update employee access'
    });
  }
});

/**
 * Bulk update employee access
 * POST /api/employees/access/bulk
 */
app.post('/api/employees/access/bulk', async (req, res) => {
  try {
    const { employeeIds, status } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({
        error: 'Employee IDs array is required'
      });
    }

    if (!['active', 'disabled', 'suspended'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status'
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .in('id', employeeIds)
      .select();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: `Updated ${data.length} employees`,
      affectedCount: data.length
    });

  } catch (error) {
    console.error('Bulk access update error:', error);
    res.status(500).json({
      error: 'Failed to update employee access'
    });
  }
});

// =============================================================================
// PAYMENT PROCESSING ROUTES
// =============================================================================

/**
 * Get payment history
 * GET /api/payments
 */
app.get('/api/payments', async (req, res) => {
  try {
    const { status, supplierId } = req.query;

    let query = supabase
      .from('payments')
      .select(`
        *,
        orders (
          id,
          order_number,
          total_amount,
          suppliers (name)
        )
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (supplierId) {
      query = query.eq('orders.supplier_id', supplierId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      payments: data || [],
      totalCount: data?.length || 0
    });

  } catch (error) {
    console.error('Payments fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch payments'
    });
  }
});

/**
 * Create payment
 * POST /api/payments
 */
app.post('/api/payments', async (req, res) => {
  try {
    const {
      orderId, amount, currency, paymentMethod,
      mobileNumber, network, reference, notes
    } = req.body;

    if (!orderId || !amount || !paymentMethod) {
      return res.status(400).json({
        error: 'Order ID, amount, and payment method are required'
      });
    }

    const { data, error } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        amount,
        currency: currency || 'UGX',
        payment_method: paymentMethod,
        mobile_number: mobileNumber,
        network,
        reference_number: reference,
        status: 'pending',
        notes
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      payment: data
    });

  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      error: 'Failed to create payment'
    });
  }
});

/**
 * Update payment status
 * PUT /api/payments/:id/status
 */
app.put('/api/payments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionId } = req.body;

    if (!['pending', 'completed', 'failed', 'partial'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid payment status'
      });
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed') {
      updateData.processed_at = new Date().toISOString();
    }

    if (transactionId) {
      updateData.transaction_id = transactionId;
    }

    const { data, error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Payment status updated',
      payment: data
    });

  } catch (error) {
    console.error('Payment status update error:', error);
    res.status(500).json({
      error: 'Failed to update payment status'
    });
  }
});

// =============================================================================
// MANAGER-SPECIFIC ROUTES
// =============================================================================

/**
 * Get manager dashboard overview
 * GET /api/manager/dashboard
 */
app.get('/api/manager/dashboard', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id']; // Get from auth or header

    // Get dashboard overview from view
    const { data: overview, error: viewError } = await supabase
      .from('manager_dashboard_overview')
      .select('*')
      .eq('manager_id', managerId)
      .single();

    // Get recent alerts
    const { data: alerts } = await supabase
      .from('manager_alerts')
      .select('*')
      .eq('manager_id', managerId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get pending tasks count
    const { count: pendingRequests } = await supabase
      .from('manager_stock_requests')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', managerId)
      .eq('status', 'pending');

    const { count: openComplaints } = await supabase
      .from('manager_customer_complaints')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', managerId)
      .in('status', ['open', 'investigating']);

    res.json({
      success: true,
      data: {
        overview: overview || {},
        alerts: alerts || [],
        pendingTasks: {
          stockRequests: pendingRequests || 0,
          complaints: openComplaints || 0
        }
      }
    });

  } catch (error) {
    console.error('Manager dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch manager dashboard'
    });
  }
});

/**
 * Get manager performance metrics
 * GET /api/manager/performance
 */
app.get('/api/manager/performance', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const { period = 'monthly' } = req.query;

    // Calculate date range based on period
    const periodMap = {
      'daily': 1,
      'weekly': 7,
      'monthly': 30,
      'quarterly': 90,
      'yearly': 365
    };
    const days = periodMap[period] || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('manager_performance_metrics')
      .select('*')
      .eq('manager_id', managerId)
      .gte('period_start', startDate)
      .order('period_end', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Manager performance error:', error);
    res.status(500).json({
      error: 'Failed to fetch performance metrics'
    });
  }
});

/**
 * Submit daily report
 * POST /api/manager/daily-report
 */
app.post('/api/manager/daily-report', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const reportData = req.body;

    const { data, error } = await supabase
      .from('manager_daily_reports')
      .insert({
        manager_id: managerId,
        ...reportData,
        report_submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Daily report submitted successfully'
    });

  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({
      error: 'Failed to submit daily report'
    });
  }
});

/**
 * Get manager's team
 * GET /api/manager/team
 */
app.get('/api/manager/team', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];

    const { data: teams, error } = await supabase
      .from('manager_teams')
      .select(`
        *,
        members:manager_team_members(
          *,
          employee:users(id, first_name, last_name, email, phone)
        )
      `)
      .eq('manager_id', managerId)
      .eq('is_active', true);

    if (error) throw error;

    res.json({
      success: true,
      data: teams || []
    });

  } catch (error) {
    console.error('Team fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch team'
    });
  }
});

/**
 * Get team performance
 * GET /api/manager/team/performance
 */
app.get('/api/manager/team/performance', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];

    const { data, error } = await supabase
      .from('manager_team_performance')
      .select('*')
      .eq('manager_id', managerId);

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Team performance error:', error);
    res.status(500).json({
      error: 'Failed to fetch team performance'
    });
  }
});

/**
 * Get employee schedules
 * GET /api/manager/schedules
 */
app.get('/api/manager/schedules', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const { dateFrom, dateTo } = req.query;

    let query = supabase
      .from('manager_employee_schedules')
      .select(`
        *,
        employee:users(id, first_name, last_name, email)
      `)
      .eq('manager_id', managerId)
      .order('schedule_date', { ascending: true });

    if (dateFrom) query = query.gte('schedule_date', dateFrom);
    if (dateTo) query = query.lte('schedule_date', dateTo);

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Schedules fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch schedules'
    });
  }
});

/**
 * Create employee schedule
 * POST /api/manager/schedules
 */
app.post('/api/manager/schedules', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const scheduleData = req.body;

    const { data, error } = await supabase
      .from('manager_employee_schedules')
      .insert({
        manager_id: managerId,
        ...scheduleData
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Schedule created successfully'
    });

  } catch (error) {
    console.error('Schedule creation error:', error);
    res.status(500).json({
      error: 'Failed to create schedule'
    });
  }
});

/**
 * Get employee attendance
 * GET /api/manager/attendance
 */
app.get('/api/manager/attendance', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const { date } = req.query;

    const { data, error } = await supabase
      .from('manager_employee_attendance')
      .select(`
        *,
        employee:users(id, first_name, last_name, email)
      `)
      .eq('manager_id', managerId)
      .eq('attendance_date', date || new Date().toISOString().split('T')[0])
      .order('clock_in_time', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Attendance fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch attendance'
    });
  }
});

/**
 * Mark attendance
 * POST /api/manager/attendance
 */
app.post('/api/manager/attendance', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const attendanceData = req.body;

    const { data, error } = await supabase
      .from('manager_employee_attendance')
      .insert({
        manager_id: managerId,
        ...attendanceData
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Attendance marked successfully'
    });

  } catch (error) {
    console.error('Attendance marking error:', error);
    res.status(500).json({
      error: 'Failed to mark attendance'
    });
  }
});

/**
 * Get inventory status
 * GET /api/manager/inventory/status
 */
app.get('/api/manager/inventory/status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('manager_inventory_status')
      .select('*')
      .order('stock_status', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Inventory status error:', error);
    res.status(500).json({
      error: 'Failed to fetch inventory status'
    });
  }
});

/**
 * Create stock request
 * POST /api/manager/stock-requests
 */
app.post('/api/manager/stock-requests', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const requestData = req.body;

    // Generate request number
    const requestNumber = `SR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const { data, error } = await supabase
      .from('manager_stock_requests')
      .insert({
        manager_id: managerId,
        request_number: requestNumber,
        ...requestData
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Stock request created successfully'
    });

  } catch (error) {
    console.error('Stock request error:', error);
    res.status(500).json({
      error: 'Failed to create stock request'
    });
  }
});

/**
 * Get stock requests
 * GET /api/manager/stock-requests
 */
app.get('/api/manager/stock-requests', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const { status } = req.query;

    let query = supabase
      .from('manager_stock_requests')
      .select('*')
      .eq('manager_id', managerId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Stock requests fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch stock requests'
    });
  }
});

/**
 * Get sales analysis
 * GET /api/manager/sales/analysis
 */
app.get('/api/manager/sales/analysis', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const { period = 'today' } = req.query;

    const { data, error } = await supabase
      .from('manager_sales_analysis')
      .select('*')
      .eq('manager_id', managerId)
      .order('analysis_date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({
      success: true,
      data: data || {}
    });

  } catch (error) {
    console.error('Sales analysis error:', error);
    res.status(500).json({
      error: 'Failed to fetch sales analysis'
    });
  }
});

/**
 * Get customer complaints
 * GET /api/manager/complaints
 */
app.get('/api/manager/complaints', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const { status } = req.query;

    let query = supabase
      .from('manager_customer_complaints')
      .select('*')
      .eq('manager_id', managerId)
      .order('complaint_date', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Complaints fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch complaints'
    });
  }
});

/**
 * Create customer complaint
 * POST /api/manager/complaints
 */
app.post('/api/manager/complaints', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const complaintData = req.body;

    const complaintNumber = `CMP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const { data, error } = await supabase
      .from('manager_customer_complaints')
      .insert({
        manager_id: managerId,
        complaint_number: complaintNumber,
        ...complaintData
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Complaint logged successfully'
    });

  } catch (error) {
    console.error('Complaint creation error:', error);
    res.status(500).json({
      error: 'Failed to log complaint'
    });
  }
});

/**
 * Update complaint status
 * PUT /api/manager/complaints/:id/status
 */
app.put('/api/manager/complaints/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const statusData = req.body;

    const { data, error } = await supabase
      .from('manager_customer_complaints')
      .update({
        ...statusData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Complaint updated successfully'
    });

  } catch (error) {
    console.error('Complaint update error:', error);
    res.status(500).json({
      error: 'Failed to update complaint'
    });
  }
});

/**
 * Get manager alerts
 * GET /api/manager/alerts
 */
app.get('/api/manager/alerts', async (req, res) => {
  try {
    const managerId = req.user?.id || req.headers['x-manager-id'];
    const { filter = 'unread' } = req.query;

    let query = supabase
      .from('manager_alerts')
      .select('*')
      .eq('manager_id', managerId)
      .order('created_at', { ascending: false });

    if (filter === 'unread') {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Alerts fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch alerts'
    });
  }
});

/**
 * Mark alert as read
 * PUT /api/manager/alerts/:id/read
 */
app.put('/api/manager/alerts/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('manager_alerts')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Alert marked as read'
    });

  } catch (error) {
    console.error('Alert update error:', error);
    res.status(500).json({
      error: 'Failed to mark alert as read'
    });
  }
});

/**
 * Log manager activity
 * POST /api/manager/activity/log
 */
app.post('/api/manager/activity/log', async (req, res) => {
  try {
    const activityData = req.body;

    const { error} = await supabase
      .from('manager_activity_log')
      .insert(activityData);

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Activity logged'
    });

  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({
      error: 'Failed to log activity'
    });
  }
});

// =============================================================================
// CASHIER-SPECIFIC ROUTES
// =============================================================================

/**
 * Get cashier dashboard
 * GET /api/cashier/:cashierId/dashboard
 */
app.get('/api/cashier/:cashierId/dashboard', async (req, res) => {
  try {
    const { cashierId } = req.params;

    const { data, error } = await supabase
      .from('cashier_dashboard_overview')
      .select('*')
      .eq('cashier_id', cashierId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({
      success: true,
      data: data || {}
    });

  } catch (error) {
    console.error('Cashier dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch cashier dashboard'
    });
  }
});

/**
 * Get cashier profile
 * GET /api/cashier/:cashierId/profile
 */
app.get('/api/cashier/:cashierId/profile', async (req, res) => {
  try {
    const { cashierId } = req.params;

    const { data, error } = await supabase
      .from('cashier_profiles')
      .select('*, user:users(*)')
      .eq('id', cashierId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Cashier profile error:', error);
    res.status(500).json({
      error: 'Failed to fetch cashier profile'
    });
  }
});

/**
 * Get current shift
 * GET /api/cashier/:cashierId/shift/current
 */
app.get('/api/cashier/:cashierId/shift/current', async (req, res) => {
  try {
    const { cashierId } = req.params;

    const { data, error } = await supabase
      .from('cashier_shifts')
      .select('*')
      .eq('cashier_id', cashierId)
      .eq('status', 'open')
      .eq('shift_date', new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({
      success: true,
      data: data || null
    });

  } catch (error) {
    console.error('Current shift error:', error);
    res.status(500).json({
      error: 'Failed to fetch current shift'
    });
  }
});

/**
 * Open shift
 * POST /api/cashier/:cashierId/shift/open
 */
app.post('/api/cashier/:cashierId/shift/open', async (req, res) => {
  try {
    const { cashierId } = req.params;
    const shiftData = req.body;

    const shiftNumber = `SH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const { data, error } = await supabase
      .from('cashier_shifts')
      .insert({
        cashier_id: cashierId,
        shift_number: shiftNumber,
        shift_date: new Date().toISOString().split('T')[0],
        start_time: new Date().toISOString(),
        ...shiftData
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Shift opened successfully'
    });

  } catch (error) {
    console.error('Open shift error:', error);
    res.status(500).json({
      error: 'Failed to open shift'
    });
  }
});

/**
 * Close shift
 * PUT /api/cashier/:cashierId/shift/:shiftId/close
 */
app.put('/api/cashier/:cashierId/shift/:shiftId/close', async (req, res) => {
  try {
    const { shiftId } = req.params;
    const closingData = req.body;

    const { data, error } = await supabase
      .from('cashier_shifts')
      .update({
        end_time: new Date().toISOString(),
        status: 'closed',
        ...closingData
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Shift closed successfully'
    });

  } catch (error) {
    console.error('Close shift error:', error);
    res.status(500).json({
      error: 'Failed to close shift'
    });
  }
});

/**
 * Process transaction
 * POST /api/cashier/:cashierId/transaction
 */
app.post('/api/cashier/:cashierId/transaction', async (req, res) => {
  try {
    const { cashierId } = req.params;
    const transactionData = req.body;

    const transactionNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        cashier_id: cashierId,
        transaction_id: transactionNumber,
        receipt_number: receiptNumber,
        ...transactionData
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Transaction processed successfully'
    });

  } catch (error) {
    console.error('Transaction processing error:', error);
    res.status(500).json({
      error: 'Failed to process transaction'
    });
  }
});

/**
 * Get cashier transactions
 * GET /api/cashier/:cashierId/transactions
 */
app.get('/api/cashier/:cashierId/transactions', async (req, res) => {
  try {
    const { cashierId } = req.params;
    const { date, status } = req.query;

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('cashier_id', cashierId)
      .order('created_at', { ascending: false });

    if (date) query = query.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions'
    });
  }
});

/**
 * Cash drawer operations
 * POST /api/cashier/:cashierId/drawer/:operation
 */
app.post('/api/cashier/:cashierId/drawer/:operation', async (req, res) => {
  try {
    const { cashierId, operation } = req.params;
    const operationData = req.body;

    const { data, error } = await supabase
      .from('cashier_drawer_operations')
      .insert({
        cashier_id: cashierId,
        operation_type: operation,
        ...operationData
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: `${operation} operation completed successfully`
    });

  } catch (error) {
    console.error('Drawer operation error:', error);
    res.status(500).json({
      error: `Failed to complete ${req.params.operation} operation`
    });
  }
});

/**
 * Process return
 * POST /api/cashier/:cashierId/return
 */
app.post('/api/cashier/:cashierId/return', async (req, res) => {
  try {
    const { cashierId } = req.params;
    const returnData = req.body;

    const returnNumber = `RET-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const { data, error } = await supabase
      .from('cashier_returns')
      .insert({
        cashier_id: cashierId,
        return_number: returnNumber,
        ...returnData
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Return processed successfully'
    });

  } catch (error) {
    console.error('Return processing error:', error);
    res.status(500).json({
      error: 'Failed to process return'
    });
  }
});

/**
 * Get cashier alerts
 * GET /api/cashier/:cashierId/alerts
 */
app.get('/api/cashier/:cashierId/alerts', async (req, res) => {
  try {
    const { cashierId } = req.params;
    const { filter = 'unread' } = req.query;

    let query = supabase
      .from('cashier_alerts')
      .select('*')
      .eq('cashier_id', cashierId)
      .order('created_at', { ascending: false });

    if (filter === 'unread') {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Alerts fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch alerts'
    });
  }
});

/**
 * Log cashier activity
 * POST /api/cashier/activity/log
 */
app.post('/api/cashier/activity/log', async (req, res) => {
  try {
    const activityData = req.body;

    const { error } = await supabase
      .from('cashier_activity_log')
      .insert(activityData);

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Activity logged'
    });

  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({
      error: 'Failed to log activity'
    });
  }
});

// =============================================================================
// SUPPLIER-SPECIFIC ROUTES
// =============================================================================

/**
 * Get suppliers dashboard
 * GET /api/suppliers/dashboard
 */
app.get('/api/suppliers/dashboard', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('supplier_dashboard_overview')
      .select('*')
      .order('total_purchase_value_ugx', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Suppliers dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch suppliers dashboard'
    });
  }
});

/**
 * Get all suppliers
 * GET /api/suppliers
 */
app.get('/api/suppliers', async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('users')
      .select('*')
      .eq('role', 'supplier')
      .order('company_name', { ascending: true });

    if (status === 'active') query = query.eq('is_active', true);
    if (status === 'pending_approval') query = query.eq('is_active', false);

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Suppliers fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch suppliers'
    });
  }
});

/**
 * Get supplier by ID
 * GET /api/suppliers/:supplierId
 */
app.get('/api/suppliers/:supplierId', async (req, res) => {
  try {
    const { supplierId } = req.params;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', supplierId)
      .eq('role', 'supplier')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Supplier fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch supplier'
    });
  }
});

/**
 * Create supplier
 * POST /api/suppliers
 */
app.post('/api/suppliers', async (req, res) => {
  try {
    const supplierData = req.body;

    const supplierCode = `SUP-${Date.now().toString().substr(-6)}`;

    const { data, error } = await supabase
      .from('users')
      .insert({
        role: 'supplier',
        is_active: false,
        profile_completed: true,
        ...supplierData
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Supplier created successfully'
    });

  } catch (error) {
    console.error('Supplier creation error:', error);
    res.status(500).json({
      error: 'Failed to create supplier'
    });
  }
});

/**
 * Update supplier
 * PUT /api/suppliers/:supplierId
 */
app.put('/api/suppliers/:supplierId', async (req, res) => {
  try {
    const { supplierId } = req.params;
    const supplierData = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({
        ...supplierData,
        updated_at: new Date().toISOString()
      })
      .eq('id', supplierId)
      .eq('role', 'supplier')
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Supplier updated successfully'
    });

  } catch (error) {
    console.error('Supplier update error:', error);
    res.status(500).json({
      error: 'Failed to update supplier'
    });
  }
});

/**
 * Get purchase orders
 * GET /api/purchase-orders
 */
app.get('/api/purchase-orders', async (req, res) => {
  try {
    const { status, supplierId } = req.query;

    let query = supabase
      .from('purchase_orders')
      .select('*, supplier:users!supplier_id(company_name, full_name, username)')
      .order('order_date', { ascending: false });

    if (status) query = query.eq('status', status);
    if (supplierId) query = query.eq('supplier_id', supplierId);

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Purchase orders fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch purchase orders'
    });
  }
});

/**
 * Create purchase order
 * POST /api/purchase-orders
 */
app.post('/api/purchase-orders', async (req, res) => {
  try {
    const poData = req.body;

    const { data, error } = await supabase
      .from('purchase_orders')
      .insert(poData)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Purchase order created successfully'
    });

  } catch (error) {
    console.error('PO creation error:', error);
    res.status(500).json({
      error: 'Failed to create purchase order'
    });
  }
});

/**
 * Update purchase order
 * PUT /api/purchase-orders/:poId
 */
app.put('/api/purchase-orders/:poId', async (req, res) => {
  try {
    const { poId } = req.params;
    const poData = req.body;

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        ...poData,
        updated_at: new Date().toISOString()
      })
      .eq('id', poId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Purchase order updated successfully'
    });

  } catch (error) {
    console.error('PO update error:', error);
    res.status(500).json({
      error: 'Failed to update purchase order'
    });
  }
});

/**
 * Get supplier invoices
 * GET /api/supplier-invoices
 */
app.get('/api/supplier-invoices', async (req, res) => {
  try {
    const { status, supplierId } = req.query;

    let query = supabase
      .from('supplier_invoices')
      .select('*, supplier:users!supplier_id(company_name, full_name, username)')
      .order('invoice_date', { ascending: false });

    if (status) query = query.eq('payment_status', status);
    if (supplierId) query = query.eq('supplier_id', supplierId);

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Invoices fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch invoices'
    });
  }
});

/**
 * Create supplier invoice
 * POST /api/supplier-invoices
 */
app.post('/api/supplier-invoices', async (req, res) => {
  try {
    const invoiceData = req.body;

    const invoiceNumber = `INV-${Date.now().toString().substr(-8)}`;

    const { data, error } = await supabase
      .from('supplier_invoices')
      .insert({
        invoice_number: invoiceNumber,
        ...invoiceData
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Invoice created successfully'
    });

  } catch (error) {
    console.error('Invoice creation error:', error);
    res.status(500).json({
      error: 'Failed to create invoice'
    });
  }
});

/**
 * Get supplier payments
 * GET /api/supplier-payments
 */
app.get('/api/supplier-payments', async (req, res) => {
  try {
    const { supplierId } = req.query;

    let query = supabase
      .from('supplier_payments')
      .select('*, supplier:users!supplier_id(company_name, full_name, username)')
      .order('payment_date', { ascending: false });

    if (supplierId) query = query.eq('supplier_id', supplierId);

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Payments fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch payments'
    });
  }
});

/**
 * Create supplier payment
 * POST /api/supplier-payments
 */
app.post('/api/supplier-payments', async (req, res) => {
  try {
    const paymentData = req.body;

    const paymentNumber = `PAY-${Date.now().toString().substr(-8)}`;

    const { data, error } = await supabase
      .from('supplier_payments')
      .insert({
        payment_number: paymentNumber,
        ...paymentData
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Payment recorded successfully'
    });

  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      error: 'Failed to record payment'
    });
  }
});

/**
 * Log supplier activity
 * POST /api/supplier/activity/log
 */
app.post('/api/supplier/activity/log', async (req, res) => {
  try {
    const activityData = req.body;

    const { error } = await supabase
      .from('supplier_activity_log')
      .insert(activityData);

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Activity logged'
    });

  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({
      error: 'Failed to log activity'
    });
  }
});

// =============================================================================
// ADMIN-SPECIFIC ROUTES
// =============================================================================

/**
 * Get admin dashboard metrics
 * GET /api/admin/dashboard
 */
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    // Get real-time metrics from database view
    const { data: metrics, error } = await supabase
      .from('admin_dashboard_overview')
      .select('*')
      .single();

    if (error) {
      console.warn('Dashboard view error:', error);
      // Return calculated metrics if view fails
      return res.json({
        success: true,
        metrics: await calculateDashboardMetrics()
      });
    }

    res.json({
      success: true,
      metrics: metrics || {}
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard metrics'
    });
  }
});

/**
 * Get admin activity log
 * GET /api/admin/activity
 */
app.get('/api/admin/activity', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const { data, error, count } = await supabase
      .from('admin_activity_log')
      .select(`
        *,
        admin:users!admin_activity_log_admin_id_fkey(email, first_name, last_name)
      `, { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      activities: data || [],
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Activity log fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch activity log'
    });
  }
});

/**
 * Get admin notifications
 * GET /api/admin/notifications
 */
app.get('/api/admin/notifications', async (req, res) => {
  try {
    const { unreadOnly = 'false', limit = 50 } = req.query;

    let query = supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (unreadOnly === 'true') {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const unreadCount = data?.filter(n => !n.is_read).length || 0;

    res.json({
      success: true,
      notifications: data || [],
      unreadCount
    });

  } catch (error) {
    console.error('Notifications fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch notifications'
    });
  }
});

/**
 * Mark notification as read
 * PUT /api/admin/notifications/:id/read
 */
app.put('/api/admin/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('admin_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Notification update error:', error);
    res.status(500).json({
      error: 'Failed to update notification'
    });
  }
});

/**
 * Get system configuration
 * GET /api/admin/config
 */
app.get('/api/admin/config', async (req, res) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from('admin_system_config')
      .select('*')
      .order('category', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Convert to key-value object
    const config = {};
    data?.forEach(item => {
      config[item.config_key] = {
        value: item.config_value,
        type: item.value_type,
        category: item.category,
        description: item.description
      };
    });

    res.json({
      success: true,
      config
    });

  } catch (error) {
    console.error('Config fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch configuration'
    });
  }
});

/**
 * Update system configuration
 * PUT /api/admin/config/:key
 */
app.put('/api/admin/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const { error } = await supabase
      .from('admin_system_config')
      .update({
        config_value: String(value),
        updated_at: new Date().toISOString()
      })
      .eq('config_key', key);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Configuration updated successfully'
    });

  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({
      error: 'Failed to update configuration'
    });
  }
});

/**
 * Get system health status
 * GET /api/admin/health/system
 */
app.get('/api/admin/health/system', async (req, res) => {
  try {
    const { limit = 24 } = req.query;

    const { data, error } = await supabase
      .from('admin_system_health')
      .select('*')
      .order('check_timestamp', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      throw error;
    }

    const latest = data?.[0];
    const isHealthy = latest?.database_status === 'healthy' && 
                     latest?.api_status === 'healthy';

    res.json({
      success: true,
      currentHealth: latest || {},
      history: data || [],
      isHealthy
    });

  } catch (error) {
    console.error('System health fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch system health'
    });
  }
});

/**
 * Get error logs
 * GET /api/admin/errors
 */
app.get('/api/admin/errors', async (req, res) => {
  try {
    const { level, resolved = 'false', limit = 100 } = req.query;

    let query = supabase
      .from('admin_error_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(parseInt(limit));

    if (level) {
      query = query.eq('error_level', level);
    }

    if (resolved !== 'all') {
      query = query.eq('resolved', resolved === 'true');
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const unresolvedCount = data?.filter(e => !e.resolved).length || 0;

    res.json({
      success: true,
      errors: data || [],
      unresolvedCount
    });

  } catch (error) {
    console.error('Error logs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch error logs'
    });
  }
});

/**
 * Resolve error
 * PUT /api/admin/errors/:id/resolve
 */
app.put('/api/admin/errors/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;

    const { error } = await supabase
      .from('admin_error_logs')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Error resolved successfully'
    });

  } catch (error) {
    console.error('Error resolution failed:', error);
    res.status(500).json({
      error: 'Failed to resolve error'
    });
  }
});

/**
 * Get admin reports
 * GET /api/admin/reports
 */
app.get('/api/admin/reports', async (req, res) => {
  try {
    const { reportType, limit = 50 } = req.query;

    let query = supabase
      .from('admin_reports')
      .select(`
        *,
        generated_by_user:users!admin_reports_generated_by_fkey(email, first_name, last_name)
      `)
      .order('generated_at', { ascending: false })
      .limit(parseInt(limit));

    if (reportType) {
      query = query.eq('report_type', reportType);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      reports: data || []
    });

  } catch (error) {
    console.error('Reports fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch reports'
    });
  }
});

/**
 * Generate admin report
 * POST /api/admin/reports
 */
app.post('/api/admin/reports', async (req, res) => {
  try {
    const { reportType, reportFormat, parameters, dateFrom, dateTo } = req.body;

    if (!reportType) {
      return res.status(400).json({
        error: 'Report type is required'
      });
    }

    const { data, error } = await supabase
      .from('admin_reports')
      .insert({
        report_name: `${reportType}_${Date.now()}`,
        report_type: reportType,
        report_format: reportFormat || 'pdf',
        parameters: parameters || {},
        date_from: dateFrom,
        date_to: dateTo,
        status: 'processing',
        generated_by: 'admin' // In production, use actual user ID
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      reportId: data.id,
      message: 'Report generation started'
    });

  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({
      error: 'Failed to generate report'
    });
  }
});

// Helper function to calculate dashboard metrics
async function calculateDashboardMetrics() {
  try {
    const [salesData, usersData, productsData, inventoryData] = await Promise.all([
      supabase.from('sales').select('total_amount').gte('created_at', new Date().toISOString().split('T')[0]),
      supabase.from('users').select('role, status'),
      supabase.from('products').select('status'),
      supabase.from('inventory').select('current_stock, minimum_stock')
    ]);

    return {
      today_sales: salesData.data?.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0) || 0,
      today_orders: salesData.data?.length || 0,
      total_employees: usersData.data?.filter(u => u.role !== 'customer').length || 0,
      active_employees: usersData.data?.filter(u => u.role !== 'customer' && u.status === 'active').length || 0,
      total_products: productsData.data?.length || 0,
      low_stock_products: inventoryData.data?.filter(i => i.current_stock < i.minimum_stock).length || 0,
      total_customers: usersData.data?.filter(u => u.role === 'customer').length || 0
    };
  } catch (error) {
    console.error('Metrics calculation error:', error);
    return {
      today_sales: 0,
      today_orders: 0,
      total_employees: 0,
      active_employees: 0,
      total_products: 0,
      low_stock_products: 0,
      total_customers: 0
    };
  }
}

// =============================================================================
// HEALTH CHECK & STATUS ROUTES
// =============================================================================

/**
 * Health check endpoint
 * GET /api/health
 */
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1);

    const dbStatus = error ? 'error' : 'connected';

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });

  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * API information endpoint
 * GET /api/info
 */
app.get('/api/info', (req, res) => {
  res.json({
    name: 'FAREDEAL Backend API',
    version: API_VERSION,
    description: 'Backend API for FAREDEAL POS System',
    environment: process.env.NODE_ENV || 'development',
    businessName: process.env.BUSINESS_NAME || 'FAREDEAL',
    country: process.env.BUSINESS_COUNTRY || 'Uganda',
    currency: process.env.BUSINESS_CURRENCY || 'UGX',
    features: [
      'Authentication & Authorization',
      'Product & Inventory Management',
      'Employee Management',
      'Sales & POS Operations',
      'Analytics & Reporting',
      'Portal Configuration',
      'Payment Processing',
      'Real-time Updates'
    ],
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile',
        logout: 'POST /api/auth/logout'
      },
      admin: {
        dashboard: 'GET /api/admin/dashboard',
        activity: 'GET /api/admin/activity',
        notifications: 'GET /api/admin/notifications',
        markNotificationRead: 'PUT /api/admin/notifications/:id/read',
        getConfig: 'GET /api/admin/config',
        updateConfig: 'PUT /api/admin/config/:key',
        systemHealth: 'GET /api/admin/health/system',
        errorLogs: 'GET /api/admin/errors',
        resolveError: 'PUT /api/admin/errors/:id/resolve',
        reports: 'GET /api/admin/reports',
        generateReport: 'POST /api/admin/reports'
      },
      products: {
        list: 'GET /api/products',
        create: 'POST /api/products',
        update: 'PUT /api/products/:id',
        updateStock: 'PUT /api/products/:id/stock',
        delete: 'DELETE /api/products/:id'
      },
      employees: {
        list: 'GET /api/employees',
        create: 'POST /api/employees',
        update: 'PUT /api/employees/:id',
        accessStatus: 'GET /api/employees/access',
        updateAccess: 'PUT /api/employees/:id/access',
        bulkUpdateAccess: 'POST /api/employees/access/bulk'
      },
      analytics: {
        dashboard: 'GET /api/analytics/dashboard',
        sales: 'GET /api/analytics/sales',
        inventory: 'GET /api/analytics/inventory'
      },
      portal: {
        getConfig: 'GET /api/portal/config',
        updateConfig: 'PUT /api/portal/config',
        resetConfig: 'POST /api/portal/config/reset',
        configHistory: 'GET /api/portal/config/history'
      },
      payments: {
        list: 'GET /api/payments',
        create: 'POST /api/payments',
        updateStatus: 'PUT /api/payments/:id/status'
      },
      system: {
        health: 'GET /api/health',
        info: 'GET /api/info'
      }
    },
    documentation: 'https://github.com/aronnykevin-hub/Faredeal',
    support: 'support@faredeal.co.ug'
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

app.listen(PORT, () => {
  console.log('\x1b[36m%s\x1b[0m', '🚀 FAREDEAL Backend API Server Started');
  console.log('=' .repeat(70));
  console.log(`\x1b[32m📡 Server:\x1b[0m         http://localhost:${PORT}`);
  console.log(`\x1b[32m🌍 Environment:\x1b[0m    ${process.env.NODE_ENV || 'development'}`);
  console.log(`\x1b[32m� Version:\x1b[0m        ${API_VERSION}`);
  console.log(`\x1b[32m�🗄️  Database:\x1b[0m       ${process.env.SUPABASE_URL ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`\x1b[32m🏢 Business:\x1b[0m       ${process.env.BUSINESS_NAME || 'FAREDEAL'}`);
  console.log(`\x1b[32m� Currency:\x1b[0m       ${process.env.BUSINESS_CURRENCY || 'UGX'}`);
  console.log(`\x1b[32m�📋 API Base:\x1b[0m       http://localhost:${PORT}/api`);
  console.log('=' .repeat(70));
  console.log('\x1b[33m%s\x1b[0m', '📚 Available API Endpoints:');
  console.log('');
  console.log('  \x1b[36m🔐 Authentication\x1b[0m');
  console.log('    POST   /api/auth/login           - User login');
  console.log('    GET    /api/auth/profile         - User profile');
  console.log('');
  console.log('  \x1b[36m� Admin Management\x1b[0m');
  console.log('    GET    /api/admin/dashboard      - Admin dashboard metrics');
  console.log('    GET    /api/admin/activity       - Activity log');
  console.log('    GET    /api/admin/notifications  - Admin notifications');
  console.log('    GET    /api/admin/config         - System configuration');
  console.log('    GET    /api/admin/health/system  - System health status');
  console.log('    GET    /api/admin/errors         - Error logs');
  console.log('    GET    /api/admin/reports        - Admin reports');
  console.log('');
  console.log('  \x1b[36m�📦 Products & Inventory\x1b[0m');
  console.log('    GET    /api/products             - List all products');
  console.log('    POST   /api/products             - Create product');
  console.log('    PUT    /api/products/:id/stock   - Update stock');
  console.log('');
  console.log('  \x1b[36m👥 Employee Management\x1b[0m');
  console.log('    GET    /api/employees            - List employees');
  console.log('    GET    /api/employees/access     - Access control status');
  console.log('    PUT    /api/employees/:id/access - Update access');
  console.log('    POST   /api/employees/access/bulk - Bulk access update');
  console.log('');
  console.log('  \x1b[36m💳 Payment Processing\x1b[0m');
  console.log('    GET    /api/payments             - Payment history');
  console.log('    POST   /api/payments             - Create payment');
  console.log('    PUT    /api/payments/:id/status  - Update payment status');
  console.log('');
  console.log('  \x1b[36m📊 Analytics & Reporting\x1b[0m');
  console.log('    GET    /api/analytics/dashboard  - Dashboard metrics');
  console.log('');
  console.log('  \x1b[36m⚙️  Portal Configuration\x1b[0m');
  console.log('    GET    /api/portal/config        - Get configuration');
  console.log('    PUT    /api/portal/config        - Update configuration');
  console.log('    POST   /api/portal/config/reset  - Reset to defaults');
  console.log('    GET    /api/portal/config/history - Configuration history');
  console.log('');
  console.log('  \x1b[36m🏥 System Health\x1b[0m');
  console.log('    GET    /api/health               - Health check');
  console.log('    GET    /api/info                 - API information');
  console.log('');
  console.log('=' .repeat(70));
  console.log('\x1b[32m%s\x1b[0m', '✨ Server is ready to accept requests!');
  console.log('=' .repeat(70));
  console.log('');
});

export default app;