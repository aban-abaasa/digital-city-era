-- =====================================================================
-- QUICK FIX: Deploy Payment Functions to Supabase
-- =====================================================================
-- Copy this ENTIRE file and paste into Supabase SQL Editor, then click RUN
-- This will verify and deploy all necessary functions for both portals
-- =====================================================================

-- =====================================================================
-- STEP 1: Verify Current State
-- =====================================================================
DO $$
DECLARE
    v_functions_count INTEGER;
    v_tables_count INTEGER;
BEGIN
    -- Check if payment functions exist
    SELECT COUNT(*) INTO v_functions_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN (
        'get_pending_payment_confirmations',
        'supplier_confirm_payment',
        'approve_order_with_payment',
        'record_payment_with_tracking'
    );

    -- Check if payment tables exist
    SELECT COUNT(*) INTO v_tables_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'purchase_orders',
        'payment_transactions',
        'payment_installments',
        'payment_metrics'
    );

    RAISE NOTICE '====================================';
    RAISE NOTICE 'CURRENT DATABASE STATE:';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Payment Functions Found: % / 4', v_functions_count;
    RAISE NOTICE 'Payment Tables Found: % / 4', v_tables_count;
    RAISE NOTICE '====================================';
    
    IF v_functions_count = 4 AND v_tables_count = 4 THEN
        RAISE NOTICE '✅ ALL REQUIRED COMPONENTS EXIST!';
        RAISE NOTICE 'Both portals should be working correctly.';
        RAISE NOTICE 'If not, check:';
        RAISE NOTICE '1. Browser console for errors';
        RAISE NOTICE '2. User authentication (localStorage userId)';
        RAISE NOTICE '3. RLS policies for access control';
    ELSIF v_functions_count = 0 AND v_tables_count = 0 THEN
        RAISE NOTICE '❌ PAYMENT SYSTEM NOT DEPLOYED!';
        RAISE NOTICE 'ACTION REQUIRED:';
        RAISE NOTICE '1. Go to Supabase SQL Editor';
        RAISE NOTICE '2. Open file: backend/sql/08-smart-progressive-payment-tracking.sql';
        RAISE NOTICE '3. Copy entire content and paste in SQL Editor';
        RAISE NOTICE '4. Click RUN to deploy';
    ELSE
        RAISE NOTICE '⚠️  PARTIAL DEPLOYMENT DETECTED!';
        RAISE NOTICE 'Some components exist but not all.';
        RAISE NOTICE 'Recommend re-deploying full SQL file.';
    END IF;
    RAISE NOTICE '====================================';
END $$;

-- =====================================================================
-- STEP 2: List All Payment-Related Functions
-- =====================================================================
SELECT 
    routine_name as function_name,
    routine_type as type,
    CASE 
        WHEN routine_name IN (
            'get_pending_payment_confirmations',
            'supplier_confirm_payment',
            'approve_order_with_payment',
            'record_payment_with_tracking'
        ) THEN '✅ Required'
        ELSE '📦 Additional'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (
    routine_name LIKE '%payment%'
    OR routine_name LIKE '%supplier%'
    OR routine_name LIKE '%order%'
)
ORDER BY 
    CASE 
        WHEN routine_name IN (
            'get_pending_payment_confirmations',
            'supplier_confirm_payment',
            'approve_order_with_payment',
            'record_payment_with_tracking'
        ) THEN 1
        ELSE 2
    END,
    routine_name;

-- =====================================================================
-- STEP 3: List All Payment-Related Tables
-- =====================================================================
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = t.table_name) as column_count,
    CASE 
        WHEN table_name IN (
            'purchase_orders',
            'payment_transactions',
            'payment_installments',
            'payment_metrics'
        ) THEN '✅ Required'
        ELSE '📦 Additional'
    END as status
FROM information_schema.tables t
WHERE table_schema = 'public'
AND (
    table_name LIKE '%payment%'
    OR table_name LIKE '%purchase%'
    OR table_name LIKE '%order%'
    OR table_name LIKE '%supplier%'
)
ORDER BY 
    CASE 
        WHEN table_name IN (
            'purchase_orders',
            'payment_transactions',
            'payment_installments',
            'payment_metrics'
        ) THEN 1
        ELSE 2
    END,
    table_name;

-- =====================================================================
-- STEP 4: Check Data Counts
-- =====================================================================
DO $$
DECLARE
    v_orders_count INTEGER := 0;
    v_transactions_count INTEGER := 0;
    v_pending_confirmations INTEGER := 0;
BEGIN
    -- Count purchase orders (if table exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'purchase_orders'
    ) THEN
        EXECUTE 'SELECT COUNT(*) FROM purchase_orders' INTO v_orders_count;
    END IF;

    -- Count payment transactions (if table exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'payment_transactions'
    ) THEN
        EXECUTE 'SELECT COUNT(*) FROM payment_transactions' INTO v_transactions_count;
        
        -- Count pending confirmations
        EXECUTE 'SELECT COUNT(*) FROM payment_transactions WHERE confirmed_by_supplier = false' 
            INTO v_pending_confirmations;
    END IF;

    RAISE NOTICE '====================================';
    RAISE NOTICE 'DATABASE DATA STATUS:';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Purchase Orders: %', v_orders_count;
    RAISE NOTICE 'Payment Transactions: %', v_transactions_count;
    RAISE NOTICE 'Pending Confirmations: %', v_pending_confirmations;
    RAISE NOTICE '====================================';
    
    IF v_orders_count = 0 THEN
        RAISE NOTICE '💡 TIP: No purchase orders yet.';
        RAISE NOTICE 'Create orders via Manager Portal → Orders tab.';
    END IF;
    
    IF v_pending_confirmations > 0 THEN
        RAISE NOTICE '⚠️  You have % payment(s) awaiting supplier confirmation!', v_pending_confirmations;
        RAISE NOTICE 'Suppliers can confirm via Supplier Portal → Payment Confirmations.';
    END IF;
END $$;

-- =====================================================================
-- STEP 5: Test RPC Functions (if they exist)
-- =====================================================================
DO $$
DECLARE
    v_test_supplier_id UUID;
    v_test_result JSONB;
BEGIN
    -- Get a test supplier ID
    SELECT id INTO v_test_supplier_id
    FROM users
    WHERE role = 'supplier'
    LIMIT 1;

    IF v_test_supplier_id IS NOT NULL THEN
        -- Try to call get_pending_payment_confirmations
        BEGIN
            EXECUTE format('SELECT count(*) FROM get_pending_payment_confirmations(%L)', v_test_supplier_id);
            RAISE NOTICE '✅ Function get_pending_payment_confirmations() is working!';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ Function get_pending_payment_confirmations() failed: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '⚠️  No supplier users found for testing.';
        RAISE NOTICE 'Create a supplier user to test payment confirmations.';
    END IF;
END $$;

-- =====================================================================
-- STEP 6: Check RLS Policies
-- =====================================================================
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression
FROM pg_policies
WHERE tablename IN ('purchase_orders', 'payment_transactions', 'payment_installments', 'payment_metrics')
ORDER BY tablename, policyname;

-- =====================================================================
-- FINAL SUMMARY
-- =====================================================================
DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'VERIFICATION COMPLETE!';
    RAISE NOTICE '====================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Check the results above:';
    RAISE NOTICE '';
    RAISE NOTICE '1. If all functions/tables exist (✅):';
    RAISE NOTICE '   → Both portals should work!';
    RAISE NOTICE '   → If not, check browser console for errors';
    RAISE NOTICE '';
    RAISE NOTICE '2. If missing components (❌):';
    RAISE NOTICE '   → Deploy: backend/sql/08-smart-progressive-payment-tracking.sql';
    RAISE NOTICE '   → Copy entire file to Supabase SQL Editor and RUN';
    RAISE NOTICE '';
    RAISE NOTICE '3. If no data (0 records):';
    RAISE NOTICE '   → Create test orders via Manager Portal';
    RAISE NOTICE '   → Make payments to test confirmations';
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '====================================';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Manager Portal → Orders Tab';
    RAISE NOTICE '   Should show list of purchase orders';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Supplier Portal → Payment Confirmations Tab';
    RAISE NOTICE '   Should show payments awaiting confirmation';
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
END $$;

-- =====================================================================
-- OPTIONAL: Create Sample Data for Testing
-- =====================================================================
-- Uncomment and run this section ONLY if you want to create test data

/*
DO $$
DECLARE
    v_manager_id UUID;
    v_supplier_id UUID;
    v_order_id UUID;
    v_transaction_id UUID;
BEGIN
    -- Get manager and supplier IDs
    SELECT id INTO v_manager_id FROM users WHERE role = 'manager' LIMIT 1;
    SELECT id INTO v_supplier_id FROM users WHERE role = 'supplier' LIMIT 1;

    IF v_manager_id IS NULL OR v_supplier_id IS NULL THEN
        RAISE NOTICE '⚠️  Cannot create test data: No manager or supplier users found';
        RETURN;
    END IF;

    -- Create test purchase order
    INSERT INTO purchase_orders (
        po_number, supplier_id, ordered_by, status, priority,
        items, total_amount_ugx, amount_paid_ugx, balance_due_ugx, 
        payment_status, order_date, expected_delivery_date
    ) VALUES (
        'PO-TEST-' || to_char(NOW(), 'YYYYMMDD-HH24MISS'),
        v_supplier_id,
        v_manager_id,
        'approved',
        'normal',
        '[{"product": "Test Product", "quantity": 10, "unit_price": 5000, "total": 50000}]'::jsonb,
        50000,
        0,
        50000,
        'unpaid',
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '7 days'
    )
    RETURNING id INTO v_order_id;

    -- Create test payment transaction (unconfirmed)
    INSERT INTO payment_transactions (
        transaction_number,
        purchase_order_id,
        amount_paid_ugx,
        payment_method,
        payment_reference,
        payment_date,
        paid_by,
        confirmed_by_supplier,
        notes
    ) VALUES (
        'TXN-TEST-' || to_char(NOW(), 'YYYYMMDD-HH24MISS'),
        v_order_id,
        25000,
        'cash',
        'CASH-TEST-001',
        NOW(),
        v_manager_id,
        false,
        'Test payment for testing payment confirmation feature'
    )
    RETURNING id INTO v_transaction_id;

    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ TEST DATA CREATED SUCCESSFULLY!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Purchase Order ID: %', v_order_id;
    RAISE NOTICE 'Payment Transaction ID: %', v_transaction_id;
    RAISE NOTICE '';
    RAISE NOTICE 'You can now:';
    RAISE NOTICE '1. View order in Manager Portal → Orders tab';
    RAISE NOTICE '2. Confirm payment in Supplier Portal → Payment Confirmations';
    RAISE NOTICE '====================================';
END $$;
*/
