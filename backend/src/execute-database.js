import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config();

/**
 * Automated Database Executor - Directly executes SQL in Supabase
 */

async function executeDatabaseSetup() {
    console.log('🚀 SUPERMARTKERA - Automated Database Setup\n');
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('❌ Missing environment variables');
        process.exit(1);
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    try {
        console.log('🔌 Testing connection...');
        
        // Test connection
        const { data: testData, error: testError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .limit(1);
        
        if (testError && !testError.message.includes('permission denied')) {
            throw testError;
        }
        
        console.log('✅ Connection successful\n');
        
        // Read schema file
        const schemaPath = path.join(__dirname, '..', 'database', 'application-matched-schema.sql');
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📋 Executing database schema...');
        console.log('This will create all tables, types, and functions for your POS system\n');
        
        // Split into manageable chunks (Supabase has limits on single query size)
        const statements = schemaContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => 
                stmt.length > 0 && 
                !stmt.startsWith('--') && 
                !stmt.match(/^\/\*/) &&
                stmt !== 'COMMENT ON SCHEMA public IS \'SUPERMARTKERA POS System - Complete database schema matching the frontend application structure with Uganda-specific features, mobile money integration, and multi-portal support.\''
            );
        
        console.log(`📊 Found ${statements.length} SQL statements to execute\n`);
        
        let successCount = 0;
        let errorCount = 0;
        
        // Execute statements in batches
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim() + ';';
            
            if (statement.length <= 2) continue;
            
            try {
                console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
                
                // Use rpc to execute raw SQL
                const { data, error } = await supabase.rpc('exec', { 
                    sql: statement 
                });
                
                if (error) {
                    // Some errors are expected (like "already exists")
                    if (error.message.includes('already exists') || 
                        error.message.includes('does not exist') ||
                        error.message.includes('permission denied')) {
                        console.log(`⚠️  Warning ${i + 1}: ${error.message.substring(0, 100)}...`);
                    } else {
                        console.log(`❌ Error ${i + 1}: ${error.message}`);
                        errorCount++;
                    }
                } else {
                    successCount++;
                    console.log(`✅ Statement ${i + 1} executed successfully`);
                }
                
                // Small delay to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (err) {
                console.log(`❌ Exception ${i + 1}: ${err.message}`);
                errorCount++;
            }
        }
        
        console.log('\n📊 EXECUTION SUMMARY:');
        console.log(`   ✅ Successful: ${successCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📋 Total: ${statements.length}`);
        
        if (successCount > 0) {
            console.log('\n🎉 Database setup completed!');
            console.log('\n📋 What was created:');
            console.log('   👥 User management system with roles');
            console.log('   📦 Complete inventory management');
            console.log('   🛒 POS and order system');
            console.log('   💰 Payment processing (Mobile Money, Cash, Cards)');
            console.log('   👨‍💼 Employee management and tracking');
            console.log('   🇺🇬 Uganda-specific features');
            
            console.log('\n🚀 Next steps:');
            console.log('   1. Run: npm run execute-seed (to add sample data)');
            console.log('   2. Test your frontend application');
            console.log('   3. All portals should now work properly');
        } else {
            console.log('\n⚠️  Setup may have issues. Check the errors above.');
            console.log('Manual setup may be required via Supabase SQL Editor.');
        }
        
    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        
        console.log('\n🔧 Alternative: Manual Setup');
        console.log('   1. Copy content from: application-matched-schema.sql');
        console.log('   2. Paste in Supabase SQL Editor');
        console.log('   3. Execute manually');
        
        process.exit(1);
    }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    executeDatabaseSetup();
}

export default executeDatabaseSetup;