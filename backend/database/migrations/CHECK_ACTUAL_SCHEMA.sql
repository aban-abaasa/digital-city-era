-- =========================================
-- CHECK ACTUAL DATABASE SCHEMA
-- =========================================
-- Find out what tables and columns actually exist

-- 1. LIST ALL TABLES IN PUBLIC SCHEMA
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. CHECK COLUMNS IN SALES_TRANSACTIONS TABLE
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sales_transactions'
ORDER BY ordinal_position;

-- 3. CHECK COLUMNS IN PAYMENT_TRANSACTIONS TABLE
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'payment_transactions'
ORDER BY ordinal_position;

-- 4. CHECK COLUMNS IN ORDERS TABLE
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- 5. SAMPLE DATA FROM SALES_TRANSACTIONS
SELECT * FROM public.sales_transactions LIMIT 5;

-- 6. SAMPLE DATA FROM ORDERS
SELECT * FROM public.orders LIMIT 5;

-- 7. SAMPLE DATA FROM PAYMENT_TRANSACTIONS (if exists)
SELECT * FROM public.payment_transactions LIMIT 5;
