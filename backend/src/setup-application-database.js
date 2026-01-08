import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config();

/**
 * Application-Matched Database Setup Script for FAREDEAL
 * This script sets up the complete database schema that matches your frontend application
 */

async function setupDatabase() {
    console.log('🚀 FAREDEAL POS - Application-Matched Database Setup\n');
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Fixed environment variable name
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('❌ Missing required environment variables:');
        console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
        console.error('   SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
        console.error('\nPlease check your .env file in the backend directory.');
        process.exit(1);
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    try {
        // Test connection
        console.log('🔌 Testing database connection...');
        const { data, error } = await supabase.from('_test').select('*').limit(1);
        
        if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
            throw new Error(`Connection failed: ${error.message}`);
        }
        console.log('✅ Database connection successful\n');
        
        // Read schema file
        const schemaPath = path.join(__dirname, '..', 'database', 'application-matched-schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found: ${schemaPath}`);
        }
        
        console.log('📋 COMPLETE SCHEMA SETUP REQUIRED:');
        console.log('=' .repeat(70));
        console.log('🎯 This schema is specifically designed for your application with:');
        console.log('   ✅ All user roles: admin, manager, employee, cashier, customer, supplier');
        console.log('   ✅ Uganda-specific features: Mobile Money, UGX currency, districts');
        console.log('   ✅ Complete POS system: Products, inventory, orders, payments');
        console.log('   ✅ Employee management: Attendance, performance tracking');
        console.log('   ✅ Portal permissions: Role-based access control');
        console.log('   ✅ Payment methods: MTN/Airtel Mobile Money, Cash, Cards');
        console.log('\n📝 SETUP INSTRUCTIONS:');
        console.log('1. Open your Supabase Dashboard: https://supabase.com/dashboard');
        console.log('2. Navigate to SQL Editor in your project');
        console.log('3. Copy and paste the contents from:');
        console.log(`   ${schemaPath}`);
        console.log('4. Execute the SQL to create all tables and structures');
        console.log('5. Run: npm run seed (to add Uganda-specific sample data)\n');
        
        console.log('🗄️ DATABASE STRUCTURE OVERVIEW:');
        console.log('=' .repeat(70));
        const tableGroups = {
            '👥 User Management': [
                'users - User accounts with portal roles',
                'user_permissions - Role-based permissions',
                'customers - Customer profiles and loyalty'
            ],
            '📦 Inventory System': [
                'categories - Product categories with icons',
                'suppliers - Uganda suppliers (local/verified)',
                'products - Complete product catalog',
                'inventory - Real-time stock tracking',
                'stock_movements - Inventory audit trail'
            ],
            '🛒 Sales & Orders': [
                'orders - POS transactions and deliveries',
                'order_items - Transaction line items',
                'payments - Multi-method payment tracking'
            ],
            '👨‍💼 Employee Management': [
                'employee_attendance - Clock in/out tracking',
                'employee_performance - Sales metrics and KPIs'
            ],
            '⚙️ System Features': [
                'system_settings - Configuration management',
                'notifications - Real-time alerts',
                'audit_logs - Security and change tracking'
            ]
        };
        
        Object.entries(tableGroups).forEach(([group, tables]) => {
            console.log(`\n${group}:`);
            tables.forEach(table => {
                console.log(`   📋 ${table}`);
            });
        });
        
        console.log('\n💰 PAYMENT SYSTEM FEATURES:');
        console.log('   📱 MTN Mobile Money integration');
        console.log('   📶 Airtel Money support');
        console.log('   💳 Card payment tracking');
        console.log('   💵 Cash transaction management');
        console.log('   🏦 Bank transfer support');
        
        console.log('\n🔐 SECURITY & PERMISSIONS:');
        console.log('   🛡️ Row Level Security (RLS) policies');
        console.log('   🔑 Role-based access control');
        console.log('   📊 Audit trail for all changes');
        console.log('   🔒 Secure password handling');
        
        console.log('\n🇺🇬 UGANDA-SPECIFIC FEATURES:');
        console.log('   🌍 District and region support');
        console.log('   💱 UGX currency as default');
        console.log('   📱 Mobile money transaction IDs');
        console.log('   🏪 Local supplier verification');
        console.log('   📊 18% VAT tax calculation');
        
        console.log('\n🎯 AFTER SETUP COMPLETION:');
        console.log('   1. All your portal components will work properly');
        console.log('   2. POS system will have full functionality');
        console.log('   3. Employee management features will be active');
        console.log('   4. Payment processing will support all methods');
        console.log('   5. Inventory tracking will be real-time');
        
        console.log('\n🚀 NEXT STEPS:');
        console.log('   1. Execute the schema in Supabase SQL Editor');
        console.log('   2. Run: npm run seed (adds realistic sample data)');
        console.log('   3. Test all portal features:');
        console.log('      • Admin Portal - Full system control');
        console.log('      • Manager Portal - Team and business management');
        console.log('      • Employee/Cashier Portal - POS operations');
        console.log('      • Customer Portal - Order and account management');
        console.log('      • Supplier Portal - Partnership management');
        
        console.log('\n📖 FOR REFERENCE:');
        console.log(`   Schema file: ${schemaPath}`);
        console.log(`   Sample data: ${path.join(__dirname, '..', 'database', 'sample-data-uganda.sql')}`);
        
    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Verify your Supabase credentials in .env');
        console.log('   2. Ensure you have service role key (not anon key)');
        console.log('   3. Check your network connection');
        process.exit(1);
    }
}

async function seedDatabase() {
    console.log('🌱 UGANDA-SPECIFIC SAMPLE DATA SEEDING\n');
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Fixed environment variable name
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('❌ Missing environment variables for seeding');
        process.exit(1);
    }
    
    try {
        // Read sample data file
        const seedPath = path.join(__dirname, '..', 'database', 'sample-data-uganda.sql');
        
        if (!fs.existsSync(seedPath)) {
            throw new Error(`Sample data file not found: ${seedPath}`);
        }
        
        console.log('📋 SAMPLE DATA SEEDING INSTRUCTIONS:');
        console.log('=' .repeat(60));
        console.log('🎯 This will add realistic Uganda-based sample data:');
        console.log('   👥 Sample users for each role type');
        console.log('   🏢 Real Uganda suppliers (Mukwano, Tilda, etc.)');
        console.log('   📦 Local products (Posho, Rice, Cooking Oil, etc.)');
        console.log('   🛒 Recent POS transaction samples');
        console.log('   💰 Mobile money payment examples');
        console.log('   📊 Employee performance data');
        console.log('\n📝 TO SEED THE DATA:');
        console.log('1. Ensure the main schema has been executed first');
        console.log('2. Copy and paste the contents from:');
        console.log(`   ${seedPath}`);
        console.log('3. Execute the SQL in Supabase SQL Editor');
        console.log('\n✨ SAMPLE DATA INCLUDES:');
        
        const sampleData = [
            '👤 Admin: admin@faredeal.ug',
            '👨‍💼 Managers: Mukasa James, Sarah Johnson',
            '👩‍💼 Cashiers: Nakato Sarah, Okello Patrick',
            '🛍️ Customers: Namukasa Grace, Mubiru John',
            '🏭 Suppliers: Mukwano Group, Fresh Dairy Uganda',
            '📦 Products: Cooking oil, rice, posho, sugar, beans',
            '🛒 Orders: Recent POS transactions with payments',
            '📊 Performance: 30 days of employee metrics'
        ];
        
        sampleData.forEach(item => {
            console.log(`   ${item}`);
        });
        
        console.log('\n🎯 AFTER SEEDING:');
        console.log('   • Login to test each portal with sample users');
        console.log('   • Process sample transactions in POS');
        console.log('   • View analytics with real data');
        console.log('   • Test all payment methods');
        
    } catch (error) {
        console.error('\n❌ Seeding preparation failed:', error.message);
    }
}

// Export functions
export { setupDatabase, seedDatabase };

// Handle command line execution
const command = process.argv[2];

if (command === 'seed') {
    seedDatabase();
} else {
    setupDatabase();
}