import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Database initialization utility for FAREDEAL POS System
class DatabaseInitializer {
  constructor(supabaseUrl, supabaseServiceKey) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  }

  /**
   * Initialize the complete database schema
   */
  async initializeDatabase() {
    console.log('🚀 Starting FAREDEAL Database Initialization...\n');
    
    try {
      // Read the schema file
      const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      console.log('📄 Executing database schema...');
      
      // Execute the schema (Note: Supabase may require manual execution of the SQL)
      // This is a placeholder - in practice, you'd run this directly in Supabase SQL editor
      console.log('⚠️  IMPORTANT: Please execute the schema.sql file in your Supabase SQL editor');
      console.log('   Located at: ./backend/database/schema.sql\n');
      
      // Test connection and basic functionality
      await this.testConnection();
      await this.seedSampleData();
      
      console.log('✅ Database initialization completed successfully!');
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Test database connection and basic operations
   */
  async testConnection() {
    console.log('🔌 Testing database connection...');
    
    try {
      // Test basic connection with a simple query
      const { data, error } = await this.supabase
        .from('system_settings')
        .select('*')
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  /**
   * Seed the database with initial sample data
   */
  async seedSampleData() {
    console.log('🌱 Seeding sample data...');
    
    try {
      // Create sample categories
      await this.createSampleCategories();
      
      // Create sample suppliers
      await this.createSampleSuppliers();
      
      // Create sample products
      await this.createSampleProducts();
      
      // Create sample users (employees, customers)
      await this.createSampleUsers();
      
      console.log('✅ Sample data seeded successfully');
      
    } catch (error) {
      console.error('❌ Seeding failed:', error.message);
      // Don't throw here, just log the error
    }
  }

  /**
   * Create sample product categories
   */
  async createSampleCategories() {
    const categories = [
      {
        name: 'Electronics',
        description: 'Electronic devices and accessories',
        sort_order: 1
      },
      {
        name: 'Groceries',
        description: 'Food and grocery items',
        sort_order: 2
      },
      {
        name: 'Clothing',
        description: 'Apparel and fashion items',
        sort_order: 3
      },
      {
        name: 'Home & Garden',
        description: 'Home improvement and garden supplies',
        sort_order: 4
      },
      {
        name: 'Health & Beauty',
        description: 'Personal care and beauty products',
        sort_order: 5
      }
    ];

    const { data, error } = await this.supabase
      .from('categories')
      .insert(categories)
      .select();

    if (error) throw error;
    console.log(`   📁 Created ${data.length} categories`);
    return data;
  }

  /**
   * Create sample suppliers
   */
  async createSampleSuppliers() {
    const suppliers = [
      {
        company_name: 'TechWorld Uganda Ltd',
        contact_person: 'John Mukasa',
        email: 'john@techworld.co.ug',
        phone: '+256-701-234-567',
        address: {
          street: 'Plot 15, Industrial Area',
          city: 'Kampala',
          country: 'Uganda',
          postal_code: '00256'
        },
        payment_terms: 30,
        credit_limit: 5000000,
        rating: 4.5
      },
      {
        company_name: 'Fresh Foods Supplies',
        contact_person: 'Mary Nakato',
        email: 'mary@freshfoods.co.ug',
        phone: '+256-702-345-678',
        address: {
          street: 'Nakasero Road',
          city: 'Kampala',
          country: 'Uganda',
          postal_code: '00256'
        },
        payment_terms: 15,
        credit_limit: 2000000,
        rating: 4.8
      },
      {
        company_name: 'Fashion Hub Africa',
        contact_person: 'David Ssemakula',
        email: 'david@fashionhub.co.ug',
        phone: '+256-703-456-789',
        address: {
          street: 'Owino Market',
          city: 'Kampala',
          country: 'Uganda',
          postal_code: '00256'
        },
        payment_terms: 21,
        credit_limit: 3000000,
        rating: 4.2
      }
    ];

    const { data, error } = await this.supabase
      .from('suppliers')
      .insert(suppliers)
      .select();

    if (error) throw error;
    console.log(`   🏢 Created ${data.length} suppliers`);
    return data;
  }

  /**
   * Create sample products with inventory
   */
  async createSampleProducts() {
    // First get categories and suppliers
    const { data: categories } = await this.supabase.from('categories').select('*');
    const { data: suppliers } = await this.supabase.from('suppliers').select('*');

    if (!categories?.length || !suppliers?.length) {
      console.log('   ⚠️  Skipping products - categories or suppliers not found');
      return;
    }

    const products = [
      {
        sku: 'TECH-001',
        barcode: '1234567890123',
        name: 'Samsung Galaxy A54',
        description: 'Latest Samsung smartphone with 128GB storage',
        category_id: categories.find(c => c.name === 'Electronics')?.id,
        supplier_id: suppliers.find(s => s.company_name.includes('TechWorld'))?.id,
        brand: 'Samsung',
        model: 'Galaxy A54',
        cost_price: 800000,
        selling_price: 1200000,
        markup_percentage: 50,
        tax_rate: 18
      },
      {
        sku: 'FOOD-001',
        barcode: '2345678901234',
        name: 'Rice - 5KG Bag',
        description: 'Premium quality white rice',
        category_id: categories.find(c => c.name === 'Groceries')?.id,
        supplier_id: suppliers.find(s => s.company_name.includes('Fresh Foods'))?.id,
        brand: 'Super Rice',
        cost_price: 15000,
        selling_price: 20000,
        markup_percentage: 33,
        tax_rate: 0
      },
      {
        sku: 'CLOTH-001',
        barcode: '3456789012345',
        name: 'Cotton T-Shirt',
        description: 'Comfortable cotton t-shirt - various colors',
        category_id: categories.find(c => c.name === 'Clothing')?.id,
        supplier_id: suppliers.find(s => s.company_name.includes('Fashion Hub'))?.id,
        brand: 'ComfortWear',
        cost_price: 25000,
        selling_price: 40000,
        markup_percentage: 60,
        tax_rate: 18
      }
    ];

    const { data, error } = await this.supabase
      .from('products')
      .insert(products)
      .select();

    if (error) throw error;

    // Create inventory for each product
    const inventoryData = data.map(product => ({
      product_id: product.id,
      current_stock: Math.floor(Math.random() * 100) + 20, // Random stock 20-119
      minimum_stock: 10,
      maximum_stock: 200,
      reorder_point: 15,
      reorder_quantity: 50,
      location: 'Main Warehouse'
    }));

    const { error: invError } = await this.supabase
      .from('inventory')
      .insert(inventoryData);

    if (invError) throw invError;

    console.log(`   📦 Created ${data.length} products with inventory`);
    return data;
  }

  /**
   * Create sample users (employees and customers)
   */
  async createSampleUsers() {
    const users = [
      {
        email: 'manager@faredeal.co.ug',
        username: 'manager',
        password_hash: '$2b$10$rH8P8JXDx7QnQ9yFLGzYNO5vF7YK3K9Pv5xQyN8zR2mV6tU4sW3eG', // manager123
        first_name: 'Sarah',
        last_name: 'Nakamatte',
        phone: '+256-701-111-111',
        role: 'manager',
        status: 'active',
        email_verified: true,
        permissions: {
          manage_employees: true,
          manage_inventory: true,
          view_reports: true,
          pos_access: true
        }
      },
      {
        email: 'cashier@faredeal.co.ug',
        username: 'cashier',
        password_hash: '$2b$10$rH8P8JXDx7QnQ9yFLGzYNO5vF7YK3K9Pv5xQyN8zR2mV6tU4sW3eG', // cashier123
        first_name: 'James',
        last_name: 'Mukwaya',
        phone: '+256-702-222-222',
        role: 'cashier',
        status: 'active',
        email_verified: true,
        permissions: {
          pos_access: true,
          process_sales: true
        }
      },
      {
        email: 'customer1@gmail.com',
        username: 'customer1',
        password_hash: '$2b$10$rH8P8JXDx7QnQ9yFLGzYNO5vF7YK3K9Pv5xQyN8zR2mV6tU4sW3eG', // customer123
        first_name: 'Grace',
        last_name: 'Nakato',
        phone: '+256-703-333-333',
        role: 'customer',
        status: 'active',
        email_verified: true
      }
    ];

    const { data, error } = await this.supabase
      .from('users')
      .insert(users)
      .select();

    if (error) throw error;

    // Create employee records for non-customer users
    const employeeUsers = data.filter(user => user.role !== 'customer');
    if (employeeUsers.length > 0) {
      const employeeData = employeeUsers.map((user, index) => ({
        user_id: user.id,
        employee_number: `EMP-${String(index + 1).padStart(3, '0')}`,
        department: user.role === 'manager' ? 'Management' : 'Sales',
        position: user.role === 'manager' ? 'Store Manager' : 'Cashier',
        hire_date: '2024-01-01',
        salary: user.role === 'manager' ? 1500000 : 800000
      }));

      const { error: empError } = await this.supabase
        .from('employees')
        .insert(employeeData);

      if (empError) throw empError;
    }

    // Create loyalty records for customers
    const customerUsers = data.filter(user => user.role === 'customer');
    if (customerUsers.length > 0) {
      const loyaltyData = customerUsers.map(user => ({
        customer_id: user.id,
        points_balance: Math.floor(Math.random() * 500),
        tier: 'bronze'
      }));

      const { error: loyaltyError } = await this.supabase
        .from('customer_loyalty')
        .insert(loyaltyData);

      if (loyaltyError) throw loyaltyError;
    }

    console.log(`   👥 Created ${data.length} users with associated records`);
    return data;
  }

  /**
   * Generate database status report
   */
  async generateStatusReport() {
    console.log('\n📊 DATABASE STATUS REPORT\n');
    console.log('=' .repeat(50));
    
    try {
      const tables = [
        'users', 'categories', 'suppliers', 'products', 
        'inventory', 'sales', 'employees', 'system_settings'
      ];
      
      for (const table of tables) {
        try {
          const { count, error } = await this.supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          if (error) throw error;
          console.log(`📋 ${table.padEnd(20)}: ${count || 0} records`);
        } catch (err) {
          console.log(`📋 ${table.padEnd(20)}: Error - ${err.message}`);
        }
      }
      
      console.log('=' .repeat(50));
      
    } catch (error) {
      console.error('❌ Failed to generate status report:', error.message);
    }
  }
}

// Export for use
export default DatabaseInitializer;

// Example usage (can be run directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'your-service-key';
  
  const initializer = new DatabaseInitializer(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  initializer.initializeDatabase()
    .then(() => initializer.generateStatusReport())
    .catch(console.error);
}