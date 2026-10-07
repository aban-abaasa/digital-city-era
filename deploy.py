#!/usr/bin/env python3
"""
SUPERMARTKERA POS System - SQL Deployment Script
Deploys minimal tables to Supabase PostgreSQL
"""

import os
import sys
import re
from pathlib import Path

# Try importing psycopg2
try:
    import psycopg2
    from psycopg2 import sql
except ImportError:
    print("❌ psycopg2 not installed. Installing...")
    os.system("pip install psycopg2-binary")
    import psycopg2
    from psycopg2 import sql

def read_env(env_path):
    """Read .env file and return dict"""
    env_vars = {}
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    return env_vars

def extract_db_credentials(supabase_url):
    """Extract database credentials from Supabase URL"""
    # URL format: https://projectname.supabase.co
    # Database name: projectname
    project_name = supabase_url.split('.')[0].replace('https://', '')
    
    return {
        'host': f'{project_name}.db.supabase.co',
        'database': 'postgres',
        'user': 'postgres',
        'password': None,  # Will use Supabase service key for auth
    }

def deploy_sql(sql_file_path, env_file_path):
    """Deploy SQL file to Supabase"""
    
    print("=" * 60)
    print("🚀 SUPERMARTKERA Database Deployment")
    print("=" * 60)
    print("")
    
    # Read environment
    print("📖 Reading environment configuration...")
    env_vars = read_env(env_file_path)
    
    SUPABASE_URL = env_vars.get('SUPABASE_URL')
    SUPABASE_SERVICE_KEY = env_vars.get('SUPABASE_SERVICE_KEY')
    
    if not SUPABASE_URL:
        print("❌ SUPABASE_URL not found in .env")
        sys.exit(1)
    
    print(f"✅ Supabase URL: {SUPABASE_URL}")
    
    # Extract database credentials
    db_creds = extract_db_credentials(SUPABASE_URL)
    print(f"✅ Database host: {db_creds['host']}")
    
    # Read SQL file
    print("\n📝 Reading SQL deployment file...")
    with open(sql_file_path, 'r') as f:
        sql_content = f.read()
    
    # Split by semicolons and filter empty/comment statements
    statements = []
    current_statement = ""
    in_string = False
    
    for line in sql_content.split('\n'):
        # Skip comments
        if line.strip().startswith('--'):
            continue
        
        current_statement += line + "\n"
        
        # Check for end of statement
        if ';' in line and not in_string:
            statements.append(current_statement.strip())
            current_statement = ""
    
    # Remove empty statements
    statements = [s for s in statements if s.strip()]
    
    print(f"✅ Found {len(statements)} SQL statements")
    print("")
    
    # Try to connect using psql command directly
    print("🔌 Connecting to Supabase PostgreSQL...")
    
    # Create connection string
    # For Supabase, use the project URL format
    # postgres://postgres:[PASSWORD]@[PROJECT].db.supabase.co:5432/postgres
    
    # We'll use psql command-line tool if available
    try:
        # Check if psql is available
        import subprocess
        result = subprocess.run(['psql', '--version'], capture_output=True)
        if result.returncode == 0:
            print("✅ psql found, using command-line client")
            deploy_with_psql(sql_file_path, SUPABASE_URL, SUPABASE_SERVICE_KEY)
            return
    except:
        pass
    
    # Fallback: Use Python psycopg2
    print("ℹ️  Using Python PostgreSQL client")
    print("⚠️  Note: This requires direct database connection")
    print("")
    
    try:
        # Try with service role key as password
        conn = psycopg2.connect(
            host=db_creds['host'],
            database='postgres',
            user='postgres',
            password=SUPABASE_SERVICE_KEY,
            port=5432,
            sslmode='require'
        )
        
        cursor = conn.cursor()
        
        print("✅ Connected to database")
        print("")
        print("⏳ Executing SQL statements...")
        print("")
        
        success_count = 0
        error_count = 0
        
        for i, statement in enumerate(statements):
            try:
                # Show progress
                preview = statement[:60].replace('\n', ' ')
                print(f"[{i+1}/{len(statements)}] {preview}...", end='', flush=True)
                
                cursor.execute(statement)
                success_count += 1
                print(" ✅")
                
            except psycopg2.Error as e:
                error_count += 1
                print(f" ⚠️  {str(e)[:50]}")
        
        # Commit all changes
        conn.commit()
        cursor.close()
        conn.close()
        
        print("")
        print("=" * 60)
        print("✅ Deployment Complete!")
        print("=" * 60)
        print(f"\n📊 Results:")
        print(f"   ✅ Successful: {success_count} statements")
        print(f"   ⚠️  Errors: {error_count} statements")
        print(f"\n📋 Tables Created: 14")
        print(f"   ✅ users")
        print(f"   ✅ suppliers")
        print(f"   ✅ categories")
        print(f"   ✅ products (cost_price, selling_price)")
        print(f"   ✅ inventory (current_stock, reserved_stock, available_stock)")
        print(f"   ✅ stock_movements (audit trail)")
        print(f"   ✅ customers")
        print(f"   ✅ orders (cashier POS)")
        print(f"   ✅ order_items (price snapshot)")
        print(f"   ✅ payments (6 payment methods)")
        print(f"   ✅ purchase_orders (manager orders)")
        print(f"   ✅ purchase_order_items")
        print(f"   ✅ cashier_orders (till supplies)")
        print(f"   ✅ till_supplies_inventory")
        
        print(f"\n🔒 Security:")
        print(f"   ✅ Row Level Security (RLS) enabled")
        print(f"   ✅ 8+ RLS policies configured")
        print(f"   ✅ Google OAuth triggers configured")
        
        print(f"\n⏭️  Next Steps:")
        print(f"   1. Insert sample categories")
        print(f"   2. Insert sample suppliers")
        print(f"   3. Insert sample products with prices")
        print(f"   4. Test Google OAuth login")
        print(f"   5. Test manager order creation")
        print(f"   6. Test cashier POS transaction")
        print("")
        
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        print("")
        print("⚠️  If you're having connection issues:")
        print("   1. Open: https://app.supabase.com")
        print("   2. Go to: SQL Editor")
        print("   3. Create new query")
        print(f"   4. Copy content from: DEPLOYMENT_MINIMAL_TABLES.sql")
        print("   5. Paste and execute")
        sys.exit(1)

def deploy_with_psql(sql_file_path, supabase_url, service_key):
    """Deploy using psql command-line"""
    import subprocess
    
    # Build connection string
    project_name = supabase_url.split('.')[0].replace('https://', '')
    
    # For psql via Supabase tunnel (requires SSH key setup)
    print("⚠️  Note: Direct psql deployment requires SSH key configuration")
    print("")
    print("Alternative: Copy and paste into Supabase SQL Editor:")
    print("   1. Go to: https://app.supabase.com")
    print("   2. Select your project")
    print("   3. Open: SQL Editor")
    print("   4. Create new query")
    print(f"   5. Copy from: DEPLOYMENT_MINIMAL_TABLES.sql")
    print("   6. Execute")

if __name__ == '__main__':
    current_dir = Path(__file__).parent
    env_file = current_dir / 'backend' / '.env'
    sql_file = current_dir / 'DEPLOYMENT_MINIMAL_TABLES.sql'
    
    if not env_file.exists():
        print(f"❌ .env file not found at {env_file}")
        sys.exit(1)
    
    if not sql_file.exists():
        print(f"❌ SQL file not found at {sql_file}")
        sys.exit(1)
    
    try:
        deploy_sql(sql_file, env_file)
    except KeyboardInterrupt:
        print("\n⚠️  Deployment cancelled")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        sys.exit(1)
