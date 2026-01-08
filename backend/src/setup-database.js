import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Clean Database Setup Script for FAREDEAL
 * This script sets up the database schema and initial data
 */

async function setupDatabase() {
    console.log('🚀 FAREDEAL Database Setup Starting...\n');
    
    // Load environment variables
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
        process.exit(1);
    }
    
    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    try {
        // Test connection
        console.log('🔌 Testing database connection...');
        const { data, error } = await supabase.from('_test').select('*').limit(1);
        
        if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
            throw new Error(`Connection failed: ${error.message}`);
        }
        console.log('✅ Database connection successful\n');
        
        // Read and display schema file location
        const schemaPath = path.join(__dirname, '..', 'database', 'clean-schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found: ${schemaPath}`);
        }
        
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📋 MANUAL SETUP REQUIRED:');
        console.log('=' .repeat(60));
        console.log('1. Open your Supabase Dashboard: https://supabase.com/dashboard');
        console.log('2. Go to SQL Editor in your project');
        console.log('3. Copy and paste the contents from:');
        console.log(`   ${schemaPath}`);
        console.log('4. Execute the SQL to create all tables and data\n');
        
        console.log('📁 Schema file contains:');
        console.log('   • All database tables and relationships');
        console.log('   • Indexes for optimal performance');
        console.log('   • Triggers for automatic updates');
        console.log('   • Initial system settings');
        console.log('   • Default admin user (admin@faredeal.co.ug / admin123)\n');
        
        // Show database structure summary
        console.log('🗄️ Database Structure:');
        console.log('=' .repeat(60));
        const tables = [
            'users - User accounts with role-based access',
            'categories - Product categories',
            'suppliers - Supplier management', 
            'products - Product catalog',
            'inventory - Stock levels and tracking',
            'sales - Sales transactions',
            'sale_items - Transaction line items',
            'employees - Employee records',
            'customer_loyalty - Loyalty program',
            'system_settings - Configuration'
        ];
        
        tables.forEach(table => {
            console.log(`   📋 ${table}`);
        });
        
        console.log('\n🔐 Security Features:');
        console.log('   • Password hashing with bcrypt');
        console.log('   • Role-based permissions');
        console.log('   • Automatic inventory updates');
        console.log('   • Audit trail capabilities\n');
        
        console.log('✨ After executing the schema, you can:');
        console.log('   • Start the frontend application');
        console.log('   • Login with admin credentials');
        console.log('   • Add products and categories');
        console.log('   • Process sales transactions');
        console.log('   • Manage inventory and users\n');
        
        console.log('🎯 Next Steps:');
        console.log('   1. Execute the schema in Supabase SQL Editor');
        console.log('   2. Run: npm run seed (optional - adds sample data)');
        console.log('   3. Start frontend: cd ../frontend && npm run dev');
        console.log('   4. Visit: http://localhost:5173\n');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}

// Also create a function to seed sample data
async function seedSampleData() {
    console.log('🌱 SAMPLE DATA SEEDING\n');
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('❌ Error: Missing environment variables');
        process.exit(1);
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    try {
        // Sample categories
        const { data: categories, error: catError } = await supabase
            .from('categories')
            .insert([
                { name: 'Electronics', description: 'Electronic devices and accessories' },
                { name: 'Groceries', description: 'Food and daily necessities' },
                { name: 'Clothing', description: 'Fashion and apparel' }
            ])
            .select();
        
        if (catError) throw catError;
        console.log(`✅ Created ${categories.length} categories`);
        
        // Sample supplier
        const { data: suppliers, error: supError } = await supabase
            .from('suppliers')
            .insert([{
                company_name: 'TechWorld Uganda Ltd',
                contact_person: 'John Mukasa',
                email: 'john@techworld.co.ug',
                phone: '+256-701-234-567'
            }])
            .select();
        
        if (supError) throw supError;
        console.log(`✅ Created ${suppliers.length} suppliers`);
        
        // Sample product
        if (categories.length > 0 && suppliers.length > 0) {
            const { data: products, error: prodError } = await supabase
                .from('products')
                .insert([{
                    sku: 'DEMO-001',
                    name: 'Sample Product',
                    description: 'This is a demo product',
                    category_id: categories[0].id,
                    supplier_id: suppliers[0].id,
                    cost_price: 50000,
                    selling_price: 75000
                }])
                .select();
            
            if (prodError) throw prodError;
            
            // Create inventory for the product
            const { error: invError } = await supabase
                .from('inventory')
                .insert([{
                    product_id: products[0].id,
                    current_stock: 100,
                    minimum_stock: 10
                }]);
            
            if (invError) throw invError;
            console.log(`✅ Created ${products.length} products with inventory`);
        }
        
        console.log('\n🎉 Sample data seeded successfully!');
        console.log('You can now test the POS system with sample data.\n');
        
    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
    }
}

// Export functions for use
export { setupDatabase, seedSampleData };

// Check command line arguments
const command = process.argv[2];

if (command === 'setup') {
    setupDatabase();
} else if (command === 'seed') {
    seedSampleData();
} else {
    setupDatabase();
}