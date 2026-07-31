-- ===================================================
-- DIAGNOSE DATABASE STATE FOR CASHIER PORTAL
-- ===================================================
-- Run this to see exactly what's missing in your database

-- ===================================================
-- CHECK 1: Does transactions table exist?
-- ===================================================
SELECT 
    '=== CHECK 1: TRANSACTIONS TABLE ===' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'transactions'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING - Run CREATE_TRANSACTIONS_TABLE.sql'
    END AS table_status;

-- ===================================================
-- CHECK 2: Which columns are missing from transactions?
-- ===================================================
SELECT 
    '=== CHECK 2: MISSING COLUMNS IN TRANSACTIONS ===' AS check_name,
    column_to_check,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'transactions' 
            AND column_name = column_to_check
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END AS column_status
FROM (
    VALUES 
        ('payment_fee'),
        ('register_number'),
        ('store_location'),
        ('change_given'),
        ('payment_provider'),
        ('payment_reference'),
        ('items'),
        ('items_count'),
        ('receipt_printed'),
        ('cashier_name'),
        ('customer_name'),
        ('customer_phone'),
        ('cashier_id'),
        ('transaction_id'),
        ('receipt_number'),
        ('subtotal'),
        ('tax_amount'),
        ('total_amount'),
        ('payment_method'),
        ('status'),
        ('created_at')
) AS columns(column_to_check)
ORDER BY 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'transactions' 
            AND column_name = column_to_check
        ) THEN 1
        ELSE 0
    END,
    column_to_check;

-- ===================================================
-- CHECK 3: Does receipts table exist?
-- ===================================================
SELECT 
    '=== CHECK 3: RECEIPTS TABLE ===' AS check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'receipts'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING - Run CREATE_RECEIPTS_TABLE.sql or FIX_ALL_CASHIER_PORTAL_TABLES.sql'
    END AS table_status;

-- ===================================================
-- CHECK 4: List ALL current transactions columns
-- ===================================================
SELECT 
    '=== CHECK 4: ALL TRANSACTIONS COLUMNS ===' AS check_name,
    column_name,
    data_type,
    CASE 
        WHEN is_nullable = 'YES' THEN 'NULL'
        ELSE 'NOT NULL'
    END AS nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transactions'
ORDER BY ordinal_position;

-- ===================================================
-- CHECK 5: List ALL receipts columns (if table exists)
-- ===================================================
SELECT 
    '=== CHECK 5: ALL RECEIPTS COLUMNS ===' AS check_name,
    column_name,
    data_type,
    CASE 
        WHEN is_nullable = 'YES' THEN 'NULL'
        ELSE 'NOT NULL'
    END AS nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'receipts'
ORDER BY ordinal_position;

-- ===================================================
-- CHECK 6: Count existing transactions
-- ===================================================
SELECT 
    '=== CHECK 6: EXISTING DATA ===' AS check_name,
    COUNT(*) AS total_transactions
FROM public.transactions
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions'
);

-- ===================================================
-- SUMMARY & RECOMMENDATIONS
-- ===================================================
SELECT 
    '=== SUMMARY ===' AS section,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions')
        THEN '❌ CRITICAL: transactions table missing - Run CREATE_TRANSACTIONS_TABLE.sql'
        
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'payment_fee')
        THEN '⚠️ WARNING: Missing columns detected - Run FIX_ALL_CASHIER_PORTAL_TABLES.sql'
        
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receipts')
        THEN '⚠️ WARNING: receipts table missing - Run FIX_ALL_CASHIER_PORTAL_TABLES.sql'
        
        ELSE '✅ GOOD: All required tables and columns exist!'
    END AS status,
    
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions')
        THEN 'Run: CREATE_TRANSACTIONS_TABLE.sql'
        
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'payment_fee')
             OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receipts')
        THEN 'Run: FIX_ALL_CASHIER_PORTAL_TABLES.sql'
        
        ELSE 'No action needed - Your database is ready!'
    END AS recommended_action;
