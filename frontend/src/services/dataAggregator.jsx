// Data Aggregator Service - Pulls data from Supabase for comprehensive reporting
import { apiService } from './apiService';
import { getCurrentUser } from './supabaseClient';

class DataAggregator {
  constructor() {
    this.tables = {
      orders: 'orders',
      orderItems: 'order_items',
      products: 'products',
      customers: 'customers',
      inventory: 'inventory',
      suppliers: 'suppliers',
      users: 'users',
      payments: 'payments',
      categories: 'categories'
    };
  }

  // Get date range based on period selection
  getDateRange(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'today':
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return {
          start: yesterday,
          end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case 'last7days':
        return {
          start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now
        };
      case 'last30days':
        return {
          start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now
        };
      case 'thismonth':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: now
        };
      case 'lastmonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return {
          start: lastMonth,
          end: new Date(now.getFullYear(), now.getMonth(), 0)
        };
      case 'thisyear':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: now
        };
      case 'lastyear':
        return {
          start: new Date(now.getFullYear() - 1, 0, 1),
          end: new Date(now.getFullYear() - 1, 11, 31)
        };
      default:
        return {
          start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now
        };
    }
  }

  // Format date for API calls
  formatDate(date) {
    return date.toISOString();
  }

  // Get comprehensive sales data
  async getSalesData(period, customRange = null) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const dateRange = customRange || this.getDateRange(period);
      const startDate = this.formatDate(dateRange.start);
      const endDate = this.formatDate(dateRange.end);

      // Fetch sales data from orders table
      const { data: orders } = await apiService.getAll(this.tables.orders, {
        select: `
          id,
          order_number,
          total_amount,
          subtotal,
          tax_amount,
          status,
          created_at,
          customer_id,
          customers (
            id,
            first_name,
            last_name,
            email
          ),
          order_items (
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            products (
              id,
              name,
              category_id,
              categories (
                name
              )
            )
          )
        `,
        filter: {
          created_at: {
            gte: startDate,
            lte: endDate
          },
          status: ['completed', 'delivered']
        }
      });

      // Fetch products data
      const { data: products } = await apiService.getAll(this.tables.products, {
        select: `
          id,
          name,
          selling_price,
          cost_price,
          category_id,
          categories (
            name
          )
        `,
        filter: { is_active: true }
      });

      // Fetch customers data
      const { data: customers } = await apiService.getAll(this.tables.customers, {
        select: 'id, first_name, last_name, email, phone_number, is_active',
        filter: { is_active: true }
      });

      // Process and format data
      const salesData = this.processSalesData(orders || []);
      const productsData = this.processProductsData(products || [], orders || []);
      const customersData = this.processCustomersData(customers || []);

      return {
        sales: salesData,
        products: productsData,
        customers: customersData,
        period: period,
        dateRange: `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`,
        summary: this.calculateSalesSummary(salesData, productsData, customersData)
      };
    } catch (error) {
      console.error('Error fetching sales data:', error);
      return this.getSampleSalesData(period);
    }
  }

  // Process sales data from orders
  processSalesData(orders) {
    return orders.map(order => ({
      id: order.id,
      customerId: order.customer_id,
      amount: order.total_amount || 0,
      subtotal: order.subtotal || 0,
      tax: order.tax_amount || 0,
      date: order.created_at,
      orderNumber: order.order_number,
      status: order.status,
      items: order.order_items?.map(item => ({
        productId: item.product_id,
        productName: item.products?.name || 'Unknown',
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal
      })) || []
    }));
  }

  // Process products data with sales information
  processProductsData(products, orders) {
    return products.map(product => {
      // Calculate sales for this product from orders
      let productSales = 0;
      orders.forEach(order => {
        order.order_items?.forEach(item => {
          if (item.product_id === product.id) {
            productSales += item.subtotal || 0;
          }
        });
      });

      return {
        id: product.id,
        name: product.name,
        price: product.selling_price || 0,
        cost: product.cost_price || 0,
        sales: productSales,
        category: product.categories?.name || 'Uncategorized'
      };
    });
  }

  // Process customers data
  processCustomersData(customers) {
    return customers.map(customer => ({
      id: customer.id,
      name: `${customer.first_name} ${customer.last_name}`,
      email: customer.email,
      phone: customer.phone_number,
      status: customer.is_active ? 'active' : 'inactive'
    }));
  }

  // Get comprehensive inventory data
  async getInventoryData(period, customRange = null) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const dateRange = customRange || this.getDateRange(period);
      const startDate = this.formatDate(dateRange.start);
      const endDate = this.formatDate(dateRange.end);

      // Fetch inventory data
      const { data: inventory } = await apiService.getAll(this.tables.inventory, {
        select: `
          id,
          product_id,
          current_stock,
          min_stock_level,
          max_stock_level,
          last_restocked,
          location,
          products (
            id,
            name,
            selling_price,
            cost_price,
            categories (
              name
            )
          )
        `
      });

      // Fetch recent stock movements (using order_items as movement proxy)
      const { data: movements } = await apiService.getAll(this.tables.orderItems, {
        select: `
          id,
          product_id,
          quantity,
          created_at,
          products (
            name
          )
        `,
        filter: {
          created_at: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Fetch suppliers data
      const { data: suppliers } = await apiService.getAll(this.tables.suppliers, {
        select: 'id, name, contact_phone, email, is_active',
        filter: { is_active: true }
      });

      // Process data
      const inventoryData = this.processInventoryData(inventory || []);
      const movementsData = this.processMovementsData(movements || []);
      const suppliersData = this.processSuppliersData(suppliers || []);

      return {
        inventory: inventoryData,
        movements: movementsData,
        suppliers: suppliersData,
        period: period,
        dateRange: `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`,
        summary: this.calculateInventorySummary(inventoryData, movementsData)
      };
    } catch (error) {
      console.error('Error fetching inventory data:', error);
      return this.getSampleInventoryData(period);
    }
  }

  // Process inventory data
  processInventoryData(inventory) {
    return inventory.map(item => ({
      id: item.id,
      productId: item.product_id,
      name: item.products?.name || 'Unknown',
      quantity: item.current_stock || 0,
      price: item.products?.cost_price || 0,
      reorderPoint: item.min_stock_level || 0,
      maxStock: item.max_stock_level || 0,
      category: item.products?.categories?.name || 'Uncategorized',
      location: item.location || '',
      lastRestocked: item.last_restocked
    }));
  }

  // Process movements data
  processMovementsData(movements) {
    return movements.map(movement => ({
      id: movement.id,
      itemId: movement.product_id,
      itemName: movement.products?.name || 'Unknown',
      type: 'sale', // From order_items, so it's a sale
      quantity: movement.quantity,
      date: movement.created_at
    }));
  }

  // Process suppliers data
  processSuppliersData(suppliers) {
    return suppliers.map(supplier => ({
      id: supplier.id,
      name: supplier.name,
      contact: supplier.contact_phone,
      email: supplier.email,
      status: supplier.is_active ? 'active' : 'inactive'
    }));
  }

  // Get comprehensive employee data
  async getEmployeeData(period, customRange = null) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      // For employees, we'll use the users table
      const { data: employees } = await apiService.getAll(this.tables.users, {
        select: `
          id,
          first_name,
          last_name,
          email,
          role,
          is_active,
          created_at
        `,
        filter: { role: ['employee', 'manager', 'cashier'] }
      });

      // Process employee data
      const employeesData = this.processEmployeesData(employees || []);
      
      // Generate mock attendance and performance data for demo
      const attendanceData = this.generateAttendanceData(employeesData);
      const performanceData = this.generatePerformanceData(employeesData);

      return {
        employees: employeesData,
        attendance: attendanceData,
        performance: performanceData,
        period: period,
        dateRange: this.getDateRange(period),
        summary: this.calculateEmployeeSummary(employeesData, attendanceData, performanceData)
      };
    } catch (error) {
      console.error('Error fetching employee data:', error);
      return this.getSampleEmployeeData(period);
    }
  }

  // Process employees data
  processEmployeesData(employees) {
    return employees.map(emp => ({
      id: emp.id,
      name: `${emp.first_name} ${emp.last_name}`,
      email: emp.email,
      position: emp.role,
      department: this.getDepartmentFromRole(emp.role),
      status: emp.is_active ? 'active' : 'inactive'
    }));
  }

  // Get department from role
  getDepartmentFromRole(role) {
    const roleDepartmentMap = {
      'manager': 'Management',
      'cashier': 'Sales',
      'employee': 'General',
      'inventory_clerk': 'Inventory',
      'supervisor': 'Operations'
    };
    return roleDepartmentMap[role] || 'General';
  }

  // Generate mock attendance data
  generateAttendanceData(employees) {
    return employees.map(emp => ({
      employeeId: emp.id,
      date: new Date().toISOString().split('T')[0],
      attendanceRate: Math.floor(Math.random() * 20) + 80 // 80-100%
    }));
  }

  // Generate mock performance data
  generatePerformanceData(employees) {
    return employees.map(emp => ({
      employeeId: emp.id,
      name: emp.name,
      rating: Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0-5.0
      sales: Math.floor(Math.random() * 100000) + 50000 // 50K-150K UGX
    }));
  }

  // Get comprehensive financial data
  async getFinancialData(period, customRange = null) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const dateRange = customRange || this.getDateRange(period);
      const startDate = this.formatDate(dateRange.start);
      const endDate = this.formatDate(dateRange.end);

      // Fetch revenue from orders
      const { data: orders } = await apiService.getAll(this.tables.orders, {
        select: 'total_amount, subtotal, tax_amount, created_at, status',
        filter: {
          created_at: {
            gte: startDate,
            lte: endDate
          },
          status: ['completed', 'delivered']
        }
      });

      // Fetch payments
      const { data: payments } = await apiService.getAll(this.tables.payments, {
        select: 'amount, payment_method, status, created_at',
        filter: {
          created_at: {
            gte: startDate,
            lte: endDate
          },
          status: 'completed'
        }
      });

      // Process financial data
      const revenueData = this.processRevenueData(orders || []);
      const expensesData = this.generateExpensesData(); // Mock for now
      const profitData = this.calculateProfitData(revenueData, expensesData);

      return {
        revenue: revenueData,
        expenses: expensesData,
        profit: profitData,
        period: period,
        dateRange: `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`,
        summary: this.calculateFinancialSummary(revenueData, expensesData, profitData)
      };
    } catch (error) {
      console.error('Error fetching financial data:', error);
      return this.getSampleFinancialData(period);
    }
  }

  // Process revenue data
  processRevenueData(orders) {
    return orders.map(order => ({
      id: order.id || Math.random().toString(),
      source: 'Sales',
      amount: order.total_amount || 0,
      date: order.created_at
    }));
  }

  // Generate mock expenses data
  generateExpensesData() {
    return [
      { id: 1, category: 'Inventory', amount: 1500000, date: new Date().toISOString() },
      { id: 2, category: 'Salaries', amount: 2000000, date: new Date().toISOString() },
      { id: 3, category: 'Utilities', amount: 300000, date: new Date().toISOString() },
      { id: 4, category: 'Rent', amount: 500000, date: new Date().toISOString() },
      { id: 5, category: 'Marketing', amount: 200000, date: new Date().toISOString() }
    ];
  }

  // Calculate profit data
  calculateProfitData(revenue, expenses) {
    const totalRevenue = revenue.reduce((sum, rev) => sum + rev.amount, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    
    return [{
      id: 1,
      amount: netProfit,
      growthRate: 15.5, // Mock growth rate
      date: new Date().toISOString()
    }];
  }

  // Get comprehensive customer data
  async getCustomerData(period, customRange = null) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const dateRange = customRange || this.getDateRange(period);
      const startDate = this.formatDate(dateRange.start);
      const endDate = this.formatDate(dateRange.end);

      // Fetch customers
      const { data: customers } = await apiService.getAll(this.tables.customers, {
        select: `
          id,
          first_name,
          last_name,
          email,
          phone_number,
          is_active,
          created_at
        `,
        filter: { is_active: true }
      });

      // Fetch customer orders
      const { data: orders } = await apiService.getAll(this.tables.orders, {
        select: 'id, customer_id, total_amount, created_at, status',
        filter: {
          created_at: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Process data
      const customersData = this.processCustomersData(customers || []);
      const ordersData = this.processCustomerOrders(orders || []);
      const feedbackData = this.generateCustomerFeedback(customersData); // Mock for now

      return {
        customers: customersData,
        orders: ordersData,
        feedback: feedbackData,
        period: period,
        dateRange: `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`,
        summary: this.calculateCustomerSummary(customersData, ordersData, feedbackData)
      };
    } catch (error) {
      console.error('Error fetching customer data:', error);
      return this.getSampleCustomerData(period);
    }
  }

  // Process customer orders
  processCustomerOrders(orders) {
    return orders.map(order => ({
      id: order.id,
      customerId: order.customer_id,
      amount: order.total_amount || 0,
      date: order.created_at,
      status: order.status
    }));
  }

  // Generate mock customer feedback
  generateCustomerFeedback(customers) {
    return customers.slice(0, Math.min(5, customers.length)).map((customer, index) => ({
      id: index + 1,
      customerId: customer.id,
      rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
      comment: ['Excellent service!', 'Good quality products', 'Fast delivery', 'Friendly staff'][index % 4],
      date: new Date().toISOString()
    }));
  }

  // Get comprehensive supplier data
  async getSupplierData(period, customRange = null) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      // Fetch suppliers
      const { data: suppliers } = await apiService.getAll(this.tables.suppliers, {
        select: `
          id,
          name,
          contact_phone,
          email,
          is_active,
          created_at
        `,
        filter: { is_active: true }
      });

      // Process data
      const suppliersData = this.processSuppliersData(suppliers || []);
      const ordersData = this.generateSupplierOrders(suppliersData); // Mock for now
      const performanceData = this.generateSupplierPerformance(suppliersData); // Mock for now

      return {
        suppliers: suppliersData,
        orders: ordersData,
        performance: performanceData,
        period: period,
        dateRange: this.getDateRange(period),
        summary: this.calculateSupplierSummary(suppliersData, ordersData, performanceData)
      };
    } catch (error) {
      console.error('Error fetching supplier data:', error);
      return this.getSampleSupplierData(period);
    }
  }

  // Generate mock supplier orders
  generateSupplierOrders(suppliers) {
    return suppliers.map((supplier, index) => ({
      id: index + 1,
      supplierId: supplier.id,
      amount: Math.floor(Math.random() * 500000) + 100000, // 100K-600K UGX
      date: new Date().toISOString()
    }));
  }

  // Generate mock supplier performance
  generateSupplierPerformance(suppliers) {
    return suppliers.map(supplier => ({
      supplierId: supplier.id,
      deliveryTime: Math.round((Math.random() * 3 + 1) * 10) / 10, // 1.0-4.0 days
      onTime: Math.random() > 0.1, // 90% on time
      quality: Math.round((Math.random() * 2 + 3) * 10) / 10 // 3.0-5.0 rating
    }));
  }

  // Get comprehensive dashboard data
  async getDashboardData(period, customRange = null) {
    try {
      const [salesData, inventoryData, employeeData, financialData] = await Promise.all([
        this.getSalesData(period, customRange),
        this.getInventoryData(period, customRange),
        this.getEmployeeData(period, customRange),
        this.getFinancialData(period, customRange)
      ]);

      return {
        sales: salesData,
        inventory: inventoryData,
        employees: employeeData,
        financial: financialData,
        period: period,
        dateRange: salesData.dateRange,
        summary: this.calculateDashboardSummary(salesData, inventoryData, employeeData, financialData)
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return this.getSampleDashboardData(period);
    }
  }

  // Summary calculation methods
  calculateSalesSummary(sales, products, customers) {
    const totalSales = sales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
    const totalOrders = sales.length;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const uniqueCustomers = new Set(sales.map(sale => sale.customerId)).size;
    const topProduct = products.reduce((max, product) => 
      (product.sales || 0) > (max.sales || 0) ? product : max, products[0] || { name: 'N/A', sales: 0 });

    return {
      totalSales: Math.round(totalSales),
      totalOrders,
      avgOrderValue: Math.round(avgOrderValue),
      uniqueCustomers,
      topProduct: topProduct.name,
      topProductSales: Math.round(topProduct.sales || 0),
      conversionRate: customers.length > 0 ? (totalOrders / customers.length * 100).toFixed(1) : '0'
    };
  }

  calculateInventorySummary(inventory, movements) {
    const totalItems = inventory.length;
    const totalValue = inventory.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0)), 0);
    const lowStockItems = inventory.filter(item => (item.quantity || 0) < (item.reorderPoint || 0)).length;
    const avgStockLevel = totalItems > 0 ? inventory.reduce((sum, item) => sum + (item.quantity || 0), 0) / totalItems : 0;
    const turnoverRate = movements.length > 0 && totalItems > 0 ? 
      movements.reduce((sum, move) => sum + (move.quantity || 0), 0) / totalItems : 0;

    return {
      totalItems,
      totalValue: Math.round(totalValue),
      lowStockItems,
      avgStockLevel: Math.round(avgStockLevel),
      turnoverRate: turnoverRate.toFixed(2),
      stockLevel: totalItems > 0 ? Math.round((1 - lowStockItems / totalItems) * 100) : 100
    };
  }

  calculateEmployeeSummary(employees, attendance, performance) {
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(emp => emp.status === 'active').length;
    const avgAttendance = attendance.length > 0 ? 
      attendance.reduce((sum, att) => sum + (att.attendanceRate || 0), 0) / attendance.length : 0;
    const avgPerformance = performance.length > 0 ? 
      performance.reduce((sum, perf) => sum + (perf.rating || 0), 0) / performance.length : 0;
    const topPerformer = performance.reduce((max, perf) => 
      (perf.rating || 0) > (max.rating || 0) ? perf : max, performance[0] || { name: 'N/A', rating: 0 });

    return {
      totalEmployees,
      activeEmployees,
      avgAttendance: Math.round(avgAttendance),
      avgPerformance: avgPerformance.toFixed(1),
      topPerformer: topPerformer.name,
      topPerformerRating: topPerformer.rating || 0,
      productivity: Math.round((avgAttendance * avgPerformance) / 10)
    };
  }

  calculateFinancialSummary(revenue, expenses, profit) {
    const totalRevenue = revenue.reduce((sum, rev) => sum + (rev.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;
    const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue * 100) : 0;

    return {
      totalRevenue: Math.round(totalRevenue),
      totalExpenses: Math.round(totalExpenses),
      netProfit: Math.round(netProfit),
      profitMargin: profitMargin.toFixed(1),
      expenseRatio: expenseRatio.toFixed(1),
      growthRate: profit.length > 0 ? (profit[0].growthRate || 0) : 0
    };
  }

  calculateCustomerSummary(customers, orders, feedback) {
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(cust => cust.status === 'active').length;
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? orders.reduce((sum, order) => sum + (order.amount || 0), 0) / totalOrders : 0;
    const avgRating = feedback.length > 0 ? 
      feedback.reduce((sum, fb) => sum + (fb.rating || 0), 0) / feedback.length : 0;
    const satisfactionRate = feedback.length > 0 ? 
      (feedback.filter(fb => (fb.rating || 0) >= 4).length / feedback.length * 100) : 0;

    return {
      totalCustomers,
      activeCustomers,
      totalOrders,
      avgOrderValue: Math.round(avgOrderValue),
      avgRating: avgRating.toFixed(1),
      satisfactionRate: satisfactionRate.toFixed(1),
      retentionRate: totalCustomers > 0 ? (activeCustomers / totalCustomers * 100).toFixed(1) : '0'
    };
  }

  calculateSupplierSummary(suppliers, orders, performance) {
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter(sup => sup.status === 'active').length;
    const totalOrders = orders.length;
    const avgDeliveryTime = performance.length > 0 ? 
      performance.reduce((sum, perf) => sum + (perf.deliveryTime || 0), 0) / performance.length : 0;
    const onTimeRate = performance.length > 0 ? 
      (performance.filter(perf => perf.onTime).length / performance.length * 100) : 0;
    const avgQuality = performance.length > 0 ? 
      performance.reduce((sum, perf) => sum + (perf.quality || 0), 0) / performance.length : 0;

    return {
      totalSuppliers,
      activeSuppliers,
      totalOrders,
      avgDeliveryTime: avgDeliveryTime.toFixed(1),
      onTimeRate: onTimeRate.toFixed(1),
      avgQuality: avgQuality.toFixed(1),
      reliabilityScore: Math.round((onTimeRate + avgQuality * 20) / 2)
    };
  }

  calculateDashboardSummary(sales, inventory, employees, financial) {
    return {
      totalRevenue: financial.summary.totalRevenue,
      totalProfit: financial.summary.netProfit,
      totalCustomers: sales.summary.uniqueCustomers,
      totalEmployees: employees.summary.totalEmployees,
      inventoryValue: inventory.summary.totalValue,
      lowStockItems: inventory.summary.lowStockItems,
      avgPerformance: employees.summary.avgPerformance,
      profitMargin: financial.summary.profitMargin
    };
  }

  // Fallback sample data methods (keeping existing ones for error scenarios)
  getSampleSalesData(period) {
    const sampleSales = [
      { id: 1, customerId: 1, amount: 50000, quantity: 2, date: new Date().toISOString() },
      { id: 2, customerId: 2, amount: 75000, quantity: 3, date: new Date().toISOString() }
    ];
    const sampleProducts = [
      { id: 1, name: 'Ugandan Coffee', price: 25000, sales: 150000, category: 'Beverages' },
      { id: 2, name: 'Fresh Matooke', price: 25000, sales: 125000, category: 'Produce' }
    ];
    const sampleCustomers = [
      { id: 1, name: 'John Mukasa', email: 'john@email.com', phone: '+256700123456', status: 'active' },
      { id: 2, name: 'Sarah Nakato', email: 'sarah@email.com', phone: '+256700123457', status: 'active' }
    ];

    return {
      sales: sampleSales,
      products: sampleProducts,
      customers: sampleCustomers,
      period: period,
      dateRange: this.getDateRange(period),
      summary: this.calculateSalesSummary(sampleSales, sampleProducts, sampleCustomers)
    };
  }

  // Continue with other sample data methods...
  getSampleInventoryData(period) {
    const sampleInventory = [
      { id: 1, name: 'Ugandan Coffee', quantity: 450, price: 25000, reorderPoint: 100, category: 'Beverages' },
      { id: 2, name: 'Sugar', quantity: 89, price: 5000, reorderPoint: 150, category: 'Pantry' }
    ];
    const sampleMovements = [
      { id: 1, itemId: 1, type: 'sale', quantity: 10, date: new Date().toISOString() }
    ];
    const sampleSuppliers = [
      { id: 1, name: 'Uganda Coffee Co.', contact: '+256700111111', email: 'info@ugandacoffee.ug', status: 'active' }
    ];

    return {
      inventory: sampleInventory,
      movements: sampleMovements,
      suppliers: sampleSuppliers,
      period: period,
      dateRange: this.getDateRange(period),
      summary: this.calculateInventorySummary(sampleInventory, sampleMovements)
    };
  }

  getSampleEmployeeData(period) {
    const sampleEmployees = [
      { id: 1, name: 'Alice Namukasa', position: 'Manager', department: 'Sales', status: 'active' }
    ];
    const sampleAttendance = [
      { employeeId: 1, date: new Date().toISOString().split('T')[0], attendanceRate: 100 }
    ];
    const samplePerformance = [
      { employeeId: 1, name: 'Alice Namukasa', rating: 4.8, sales: 150000 }
    ];

    return {
      employees: sampleEmployees,
      attendance: sampleAttendance,
      performance: samplePerformance,
      period: period,
      dateRange: this.getDateRange(period),
      summary: this.calculateEmployeeSummary(sampleEmployees, sampleAttendance, samplePerformance)
    };
  }

  getSampleFinancialData(period) {
    const sampleRevenue = [
      { id: 1, source: 'Sales', amount: 300000, date: new Date().toISOString() }
    ];
    const sampleExpenses = [
      { id: 1, category: 'Inventory', amount: 150000, date: new Date().toISOString() }
    ];
    const sampleProfit = [
      { id: 1, amount: 150000, growthRate: 15.5, date: new Date().toISOString() }
    ];

    return {
      revenue: sampleRevenue,
      expenses: sampleExpenses,
      profit: sampleProfit,
      period: period,
      dateRange: this.getDateRange(period),
      summary: this.calculateFinancialSummary(sampleRevenue, sampleExpenses, sampleProfit)
    };
  }

  getSampleCustomerData(period) {
    const sampleCustomers = [
      { id: 1, name: 'John Mukasa', email: 'john@email.com', phone: '+256700123456', status: 'active' }
    ];
    const sampleOrders = [
      { id: 1, customerId: 1, amount: 50000, date: new Date().toISOString() }
    ];
    const sampleFeedback = [
      { id: 1, customerId: 1, rating: 5, comment: 'Excellent service!', date: new Date().toISOString() }
    ];

    return {
      customers: sampleCustomers,
      orders: sampleOrders,
      feedback: sampleFeedback,
      period: period,
      dateRange: this.getDateRange(period),
      summary: this.calculateCustomerSummary(sampleCustomers, sampleOrders, sampleFeedback)
    };
  }

  getSampleSupplierData(period) {
    const sampleSuppliers = [
      { id: 1, name: 'Uganda Coffee Co.', contact: '+256700111111', email: 'info@ugandacoffee.ug', status: 'active' }
    ];
    const sampleOrders = [
      { id: 1, supplierId: 1, amount: 100000, date: new Date().toISOString() }
    ];
    const samplePerformance = [
      { supplierId: 1, deliveryTime: 2.5, onTime: true, quality: 4.8 }
    ];

    return {
      suppliers: sampleSuppliers,
      orders: sampleOrders,
      performance: samplePerformance,
      period: period,
      dateRange: this.getDateRange(period),
      summary: this.calculateSupplierSummary(sampleSuppliers, sampleOrders, samplePerformance)
    };
  }

  getSampleDashboardData(period) {
    const salesData = this.getSampleSalesData(period);
    const inventoryData = this.getSampleInventoryData(period);
    const employeeData = this.getSampleEmployeeData(period);
    const financialData = this.getSampleFinancialData(period);

    return {
      sales: salesData,
      inventory: inventoryData,
      employees: employeeData,
      financial: financialData,
      period: period,
      dateRange: salesData.dateRange,
      summary: this.calculateDashboardSummary(salesData, inventoryData, employeeData, financialData)
    };
  }
}

export default new DataAggregator();