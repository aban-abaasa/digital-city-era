-- ===================================================
-- CHECK TRANSACTIONS TABLE SCHEMA
-- ===================================================
-- This script checks what columns currently exist in the transactions table

-- List all columns in transactions table
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    column_default,
    is_nullable,
    ordinal_position
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transactions'
ORDER BY ordinal_position;

-- Check if payment_fee specifically exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'transactions' 
            AND column_name = 'payment_fee'
        ) THEN '✅ payment_fee column EXISTS'
        ELSE '❌ payment_fee column MISSING'
    END AS payment_fee_status;
