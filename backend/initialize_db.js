#!/usr/bin/env node

/**
 * Database initialization script for FAREDEAL platform.
 * This script reads and executes SQL files in the schemas directory in the correct order.
 * 
 * Usage:
 * - Run all schemas: node initialize_db.js
 * - Run specific schemas: node initialize_db.js users products
 * - Run with verbose output: node initialize_db.js --verbose
 * - Run specific SQL file: node initialize_db.js --file=path/to/file.sql
 * - Show help: node initialize_db.js --help
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const showHelp = args.includes('--help');
const verbose = args.includes('--verbose');

// Check for file parameter
let specificFile = null;
let specificDirectory = null;
let sequentialExecution = false;

args.forEach(arg => {
  if (arg.startsWith('--file=')) {
    specificFile = arg.substring(7); // Extract file path after --file=
  } else if (arg.startsWith('--dir=')) {
    specificDirectory = arg.substring(6); // Extract directory path after --dir=
  } else if (arg === '--seq') {
    sequentialExecution = true;
  }
});

// Remove flags from args to get only the schema names
const requestedSchemas = args.filter(arg => !arg.startsWith('--'));

// Show help if requested
if (showHelp) {
  console.log(`
Database Initialization Script for FAREDEAL Platform

Usage:
  node initialize_db.js [options] [schemas...]

Options:
  --help              Show this help message
  --verbose           Show more detailed output during execution
  --file=path/to.sql  Execute a specific SQL file against the database
  --dir=path/to/dir   Execute all SQL files in a directory sequentially
  --seq               Use with --dir to ensure sequential execution (default behavior)

Schemas:
  users           Initialize user authentication and profile tables
  products        Initialize product catalog tables
  categories      Initialize product category tables
  inventory       Initialize inventory management tables
  customers       Initialize customer management tables
  orders          Initialize order and transaction tables
  payments        Initialize payment processing tables
  suppliers       Initialize supplier management tables
  loyalty         Initialize loyalty points and rewards tables
  reports         Initialize analytics and reporting tables
  settings        Initialize system configuration tables
  admins          Initialize admin management tables
  employees       Initialize employee management tables

Examples:
  node initialize_db.js                                   # Initialize all schemas
  node initialize_db.js users products                    # Initialize only users and products schemas
  node initialize_db.js --verbose orders                  # Initialize orders schema with verbose output
  node initialize_db.js --file=db/schemas/fix_images.sql  # Execute a specific SQL file
  node initialize_db.js --dir=db/schemas/users            # Execute all SQL files in users directory
  node initialize_db.js --dir=custom/sql/path --verbose   # Execute custom directory with verbose output
  `);
  process.exit(0);
}

// Check if we're using Supabase (modern approach) or traditional PostgreSQL
const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

if (useSupabase) {
  console.log("🔄 Redirecting to modern Supabase setup...");
  console.log("📋 Your project now uses Supabase with application-matched schema");
  console.log("");
  console.log("🚀 To setup your database, run:");
  console.log("   npm run setup    - Shows setup instructions");
  console.log("   npm run execute  - Attempts automated setup");
  console.log("");
  console.log("📁 Or manually execute this file in Supabase SQL Editor:");
  console.log("   backend/database/simple-executable-schema.sql");
  console.log("");
  console.log("✅ This gives you:");
  console.log("   • All portal roles (admin, manager, cashier, etc.)");
  console.log("   • Uganda features (Mobile Money, UGX currency)");
  console.log("   • Complete POS system with inventory tracking");
  console.log("   • Employee management and performance tracking");
  process.exit(0);
}

// Traditional PostgreSQL setup (fallback)
let dbUrl = process.env.DATABASE_URL;

// If no DATABASE_URL is provided, try to construct it from individual parameters
if (!dbUrl) {
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME;
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  
  if (!(dbHost && dbName && dbUser && dbPassword)) {
    console.error("Error: Database connection parameters not found in environment variables.");
    console.error("For Supabase, provide: SUPABASE_URL and SUPABASE_SERVICE_KEY");
    console.error("For PostgreSQL, provide: DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD");
    process.exit(1);
  }
  
  dbUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
  console.log(`Constructed database URL from individual parameters: ${dbUrl.replace(/:[^:]*@/, ':****@')}`);
}

// Map of schema names to file names or directories
const SCHEMA_MAP = {
  'users': "01_users_tables.sql",
  'products': "02_products_tables.sql", 
  'categories': "03_categories_tables.sql",
  'inventory': "04_inventory_tables.sql",
  'customers': "05_customers_tables.sql",
  'orders': "06_orders_tables.sql",
  'payments': "07_payments_tables.sql",
  'suppliers': "08_suppliers_tables.sql",
  'loyalty': "09_loyalty_tables.sql",
  'reports': "10_reports_tables.sql",
  'settings': "11_settings_tables.sql",
  'constraints': "12_foreign_key_constraints.sql",
  'admins': "13_admin_tables.sql",
  'employees': "14_employee_tables.sql"
};

// Default order of schema files to execute
const SCHEMA_FILES_ORDER = [
  "01_users_tables.sql",
  "02_products_tables.sql",
  "03_categories_tables.sql", 
  "04_inventory_tables.sql",
  "05_customers_tables.sql",
  "06_orders_tables.sql",
  "07_payments_tables.sql",
  "08_suppliers_tables.sql",
  "09_loyalty_tables.sql",
  "10_reports_tables.sql",
  "11_settings_tables.sql",
  "13_admin_tables.sql",
  "14_employee_tables.sql",
  "12_foreign_key_constraints.sql" // Must be last to add deferred constraints
];

/**
 * Execute SQL files from a directory in numerical order.
 * @param {postgres.Sql} sql - Postgres SQL client
 * @param {string} dirPath - Path to directory containing SQL files
 * @returns {Promise<boolean>} - Success status
 */
async function executeSqlFilesFromDirectory(sql, dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      console.error(`Error: Directory not found at ${dirPath}`);
      return false;
    }

    // Read all SQL files from the directory
    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically (which will handle numerical prefixes correctly)

    if (files.length === 0) {
      console.warn(`Warning: No SQL files found in directory ${dirPath}`);
      return true;
    }

    console.log(`Found ${files.length} SQL files in ${dirPath}`);
    if (verbose) {
      console.log(`Files to execute: ${files.join(', ')}`);
    }

    let allSuccessful = true;
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const success = await executeSqlFile(sql, filePath);
      if (!success) {
        allSuccessful = false;
        console.error(`Failed to execute ${file}. Stopping directory execution.`);
        break;
      }
    }

    return allSuccessful;
  } catch (error) {
    console.error(`Error executing SQL files from directory ${dirPath}: ${error.message}`);
    return false;
  }
}

/**
 * Execute an SQL file against the database.
 * @param {postgres.Sql} sql - Postgres SQL client
 * @param {string} filePath - Path to SQL file
 * @returns {Promise<boolean>} - Success status
 */
async function executeSqlFile(sql, filePath) {
  try {
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    console.log(`Executing ${filePath}...`);
    if (verbose) {
      console.log(`SQL content length: ${sqlContent.length} characters`);
    }
    
    await sql.unsafe(sqlContent);
    
    console.log(`Successfully executed ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error executing ${filePath}: ${error.message}`);
    if (verbose && error.position) {
      // For syntax errors, show context around the error position
      const errorPosition = parseInt(error.position);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const errorContext = sqlContent.substring(
        Math.max(0, errorPosition - 100), 
        Math.min(sqlContent.length, errorPosition + 100)
      );
      console.error(`Error context:\n${errorContext}`);
    }
    return false;
  }
}

/**
 * Initialize the database by executing schema files in order.
 * @param {Array<string>} schemaNames - Optional array of schema names to initialize
 * @returns {Promise<boolean>} - Success status
 */
async function initializeDatabase(schemaNames = []) {
  // Create postgres SQL client
  const sql = postgres(dbUrl, {
    max: 1, // Use only one connection
    idle_timeout: 30, // Close idle connections after 30 seconds
    connect_timeout: 30, // Connection timeout after 30 seconds
  });
  
  try {
    console.log("Connecting to database...");
    await sql`SELECT 1`; // Test connection
    console.log("Connected successfully!");
    
    // Get the directory where the db files are located - script is in backend folder
    const dbDir = path.join(__dirname, "db");
    const schemasDir = path.join(dbDir, "schemas");
    
    if (!fs.existsSync(schemasDir)) {
      console.error(`Error: Schemas directory not found at ${schemasDir}`);
      return false;
    }
    
    // Determine which schema files to execute
    let schemaFilesToExecute = [];
    
    if (schemaNames.length === 0) {
      // If no specific schemas requested, use default order
      schemaFilesToExecute = SCHEMA_FILES_ORDER;
      console.log("No specific schemas requested. Initializing all schemas in default order.");
    } else {
      // Map requested schema names to file names or directory names
      for (const name of schemaNames) {
        const fileOrDir = SCHEMA_MAP[name.toLowerCase()];
        if (fileOrDir) {
          schemaFilesToExecute.push(fileOrDir);
        } else {
          console.warn(`Warning: Unknown schema name '${name}'. Skipping.`);
        }
      }
      
      if (schemaFilesToExecute.length === 0) {
        console.error("Error: No valid schema names provided.");
        return false;
      }
      
      console.log(`Initializing the following schemas: ${schemaFilesToExecute.join(', ')}`);
    }
    
    // Execute schema files or directories in order
    let allSuccessful = true;
    for (const schemaItem of schemaFilesToExecute) {
      const itemPath = path.join(schemasDir, schemaItem);
      
      // Check if it's a directory or a file
      if (fs.existsSync(itemPath)) {
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          console.log(`Processing directory: ${schemaItem}`);
          const success = await executeSqlFilesFromDirectory(sql, itemPath);
          if (!success) {
            allSuccessful = false;
            console.error(`Failed to process directory: ${schemaItem}`);
          }
        } else if (stat.isFile() && schemaItem.endsWith('.sql')) {
          console.log(`Processing file: ${schemaItem}`);
          const success = await executeSqlFile(sql, itemPath);
          if (!success) {
            allSuccessful = false;
            console.error(`Failed to process file: ${schemaItem}`);
          }
        } else {
          console.warn(`Warning: ${schemaItem} is neither a directory nor an SQL file. Skipping.`);
        }
      } else {
        console.warn(`Warning: Schema item ${schemaItem} not found at ${itemPath}`);
        allSuccessful = false;
      }
    }
    
    // Close the database connection
    await sql.end();
    
    if (allSuccessful) {
      console.log("Database initialization completed successfully!");
    } else {
      console.log("Database initialization completed with some errors. Check the logs above.");
    }
    
    return allSuccessful;
  } catch (error) {
    console.error(`Error initializing database: ${error.message}`);
    // Ensure connection is closed even on error
    await sql.end().catch(() => {});
    return false;
  }
}

/**
 * Execute all SQL files in a specified directory.
 * @param {string} dirPath - Path to the directory containing SQL files
 * @returns {Promise<boolean>} - Success status
 */
async function executeDirectorySequentially(dirPath) {
  // Create postgres SQL client
  const sql = postgres(dbUrl, {
    max: 1, // Use only one connection
    idle_timeout: 30, // Close idle connections after 30 seconds
    connect_timeout: 30, // Connection timeout after 30 seconds
  });
  
  try {
    console.log("Connecting to database...");
    await sql`SELECT 1`; // Test connection
    console.log("Connected successfully!");
    
    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      console.error(`Error: Directory not found at ${dirPath}`);
      return false;
    }
    
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      console.error(`Error: ${dirPath} is not a directory`);
      return false;
    }
    
    console.log(`Executing SQL files from directory: ${dirPath}`);
    
    // Execute all SQL files in the directory
    const success = await executeSqlFilesFromDirectory(sql, dirPath);
    
    // Close the database connection
    await sql.end();
    
    if (success) {
      console.log(`Successfully executed all SQL files from directory: ${dirPath}`);
    } else {
      console.error(`Failed to execute some SQL files from directory: ${dirPath}`);
    }
    
    return success;
  } catch (error) {
    console.error(`Error executing directory: ${error.message}`);
    // Ensure connection is closed even on error
    await sql.end().catch(() => {});
    return false;
  }
}

/**
 * Execute a specific SQL file against the database.
 * @param {string} filePath - Path to the SQL file to execute
 * @returns {Promise<boolean>} - Success status
 */
async function executeSingleFile(filePath) {
  // Create postgres SQL client
  const sql = postgres(dbUrl, {
    max: 1, // Use only one connection
    idle_timeout: 30, // Close idle connections after 30 seconds
    connect_timeout: 30, // Connection timeout after 30 seconds
  });
  
  try {
    console.log("Connecting to database...");
    await sql`SELECT 1`; // Test connection
    console.log("Connected successfully!");
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found at ${filePath}`);
      return false;
    }
    
    // Execute the file
    const success = await executeSqlFile(sql, filePath);
    
    // Close the database connection
    await sql.end();
    
    if (success) {
      console.log(`Successfully executed file: ${filePath}`);
    } else {
      console.error(`Failed to execute file: ${filePath}`);
    }
    
    return success;
  } catch (error) {
    console.error(`Error executing file: ${error.message}`);
    // Ensure connection is closed even on error
    await sql.end().catch(() => {});
    return false;
  }
}

// Run the initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  if (specificFile) {
    // If a specific file was specified, execute only that file
    executeSingleFile(specificFile)
      .then(success => {
        process.exit(success ? 0 : 1);
      })
      .catch(error => {
        console.error(`Unhandled error: ${error.message}`);
        process.exit(1);
      });
  } else if (specificDirectory) {
    // If a specific directory was specified, execute all SQL files in it sequentially
    executeDirectorySequentially(specificDirectory)
      .then(success => {
        process.exit(success ? 0 : 1);
      })
      .catch(error => {
        console.error(`Unhandled error: ${error.message}`);
        process.exit(1);
      });
  } else {
    // Otherwise run normal initialization with requested schemas
    initializeDatabase(requestedSchemas)
      .then(success => {
        process.exit(success ? 0 : 1);
      })
      .catch(error => {
        console.error(`Unhandled error: ${error.message}`);
        process.exit(1);
      });
  }
}

export { initializeDatabase, executeSingleFile, executeSqlFilesFromDirectory, executeDirectorySequentially }; 