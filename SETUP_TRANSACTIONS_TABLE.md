# Create Transactions Tables - Complete Setup Guide

## Overview
Creates all transaction-related tables needed for the Cashier, Manager, and Admin portals:
1. **transactions** - Main transaction records
2. **daily_sales_reports** - Daily summary reports
3. **sales_transaction_items** - Line items for each transaction
4. **receipt_print_log** - Receipt printing history

## How to Execute

### Step 1: Create Main Transactions Table
1. Go to https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]/sql
2. Click "New Query"
3. Copy all content from `CREATE_TRANSACTIONS_TABLE.sql`
4. Click "Run"
5. Wait for confirmation: "Transactions table created successfully"

### Step 2: Create Support Tables
1. Click "New Query" again
2. Copy all content from `CREATE_TRANSACTION_SUPPORT_TABLES.sql`
3. Click "Run"
4. Wait for confirmations for all 5 tables/views

## What Gets Created

### 1. transactions (Main Table)
- Stores all sales transactions from Cashier portal
- Columns: transaction_id, receipt_number, cashier_info, financial data, payment info, customer info, items_count, status, timestamps
- Indexes for performance on: created_at, cashier_id, customer_id, status, payment_method

### 2. daily_sales_reports
- Daily summary of sales metrics
- Tracks: total transactions, total sales, tax collected, payment method breakdown
- Calculates: average basket size, largest/smallest transactions, items sold

### 3. sales_transaction_items
- Line items for each transaction
- Stores: product info, quantity, unit price, line total, tax information
- Links transactions to products via product_id

### 4. receipt_print_log
- Tracks every receipt print event
- Records: print type (original/reprint/duplicate), format (thermal/A4/email), printer name, when printed

### 5. Views (Automatic Calculations)
- **transaction_summary** - Transaction with line item counts
- **daily_performance** - Daily metrics automatically calculated from transactions
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| transaction_id | VARCHAR | Unique transaction identifier |
| receipt_number | VARCHAR | Unique receipt number |
| cashier_id | UUID | References cashier user |
| cashier_name | VARCHAR | Cashier name for audit |
| register_number | VARCHAR | POS register ID |
| store_location | VARCHAR | Store location |
| subtotal | DECIMAL | Amount before tax |
| tax_amount | DECIMAL | Tax collected |
| tax_rate | DECIMAL | Tax percentage (default 18%) |
| total_amount | DECIMAL | Final amount (subtotal + tax) |
| payment_method | VARCHAR | How payment was made (cash, mtn_momo, etc.) |
| payment_provider | VARCHAR | Payment provider name |
| payment_reference | VARCHAR | Payment reference ID |
| change_given | DECIMAL | Change returned to customer |
| payment_fee | DECIMAL | Processing fee (if any) |
| customer_id | UUID | References customer user (if registered) |
| customer_name | VARCHAR | Customer name |
| customer_phone | VARCHAR | Customer phone number |
| items_count | INTEGER | Number of items sold |
| items | JSONB | Detailed items as JSON |
| status | VARCHAR | Transaction status (completed, voided, refunded) |
| voided_at | TIMESTAMP | When transaction was voided |
| voided_by | UUID | User who voided transaction |
| void_reason | VARCHAR | Reason for voiding |
| receipt_printed | BOOLEAN | Whether receipt was printed |
| created_at | TIMESTAMP | Transaction timestamp |
| updated_at | TIMESTAMP | Last updated timestamp |

### Indexes for Performance
- `idx_transactions_created_at` - For date range queries
- `idx_transactions_cashier_id` - For cashier reports
- `idx_transactions_customer_id` - For customer history
- `idx_transactions_status` - For status filtering
- `idx_transactions_payment_method` - For payment analysis
- `idx_transactions_transaction_id` - For quick lookup

### Row Level Security (RLS)
- ✅ Authenticated users can READ all transactions
- ✅ Authenticated users can INSERT new transactions
- ✅ Authenticated users can UPDATE transactions (for voiding/refunds)

## Testing the Tables

After creation, test with these queries in Supabase:

```sql
-- Check all transaction tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('transactions', 'daily_sales_reports', 'sales_transaction_items', 'receipt_print_log')
ORDER BY table_name;

-- Count records in each
SELECT 'transactions' as table_name, COUNT(*) as record_count FROM public.transactions
UNION ALL
SELECT 'daily_sales_reports', COUNT(*) FROM public.daily_sales_reports
UNION ALL
SELECT 'sales_transaction_items', COUNT(*) FROM public.sales_transaction_items
UNION ALL
SELECT 'receipt_print_log', COUNT(*) FROM public.receipt_print_log;

-- Check views exist
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' AND table_name IN ('transaction_summary', 'daily_performance');

-- Test data retrieval
SELECT * FROM public.transaction_summary LIMIT 5;
SELECT * FROM public.daily_performance LIMIT 5;
```

## Next Steps

After table creation:
1. Test Cashier portal payment processing
2. Verify transactions appear in ManagerPortal dashboard
3. Check AdminPortal sees transactions

## Next Steps

After table creation:
1. **Test Cashier portal** - Process a transaction and verify it saves
2. **Check transactions table** - Should have 1+ records with correct data
3. **Check daily_sales_reports** - Manual entry or run generateDailyReport()
4. **Verify ManagerPortal dashboard** - Should show transaction metrics
5. **Check AdminPortal** - Should see transactions in analytics

## Flow Diagram

```
Cashier Portal (sales)
    ↓ transactionService.saveTransaction()
    ├→ INSERT transactions table
    ├→ INSERT sales_transaction_items table
    └→ INSERT receipt_print_log table
    
Manager Portal (dashboard)
    ↓ loadBusinessMetrics()
    ├→ SELECT transactions table
    └→ SELECT daily_performance view
    
Admin Portal (analytics)
    ↓ loadOrderStats()
    └→ SELECT transactions table
    
Daily Report Generation
    ↓ transactionService.generateDailyReport()
    ├→ SELECT transactions table (for the day)
    └→ INSERT daily_sales_reports table
```
