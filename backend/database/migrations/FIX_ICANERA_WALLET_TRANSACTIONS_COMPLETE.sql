-- ================================================================
-- FIX ICANERA WALLET TRANSACTIONS - COMPLETE ENHANCEMENT
-- ================================================================
-- This migration ensures all wallet payments properly record:
-- 1. Amount in local currency (UGX, etc.)
-- 2. Store/merchant name
-- 3. Business vs Personal expenditure classification
-- 4. Complete transaction metadata
-- ================================================================

-- Step 1: Add missing columns to transactions table
DO $$ 
BEGIN
    -- Add currency code column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'currency_code'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN currency_code VARCHAR(10) DEFAULT 'UGX';
        RAISE NOTICE '✅ currency_code column added';
    ELSE
        RAISE NOTICE '✓ currency_code column already exists';
    END IF;

    -- Add amount_in_local_currency column (stores actual UGX, KES, etc. amount)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'amount_in_local_currency'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN amount_in_local_currency DECIMAL(15, 2) DEFAULT 0.00;
        RAISE NOTICE '✅ amount_in_local_currency column added';
    ELSE
        RAISE NOTICE '✓ amount_in_local_currency column already exists';
    END IF;

    -- Add ican_amount column (amount in ICAN coins)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'ican_amount'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN ican_amount DECIMAL(15, 6) DEFAULT 0.000000;
        RAISE NOTICE '✅ ican_amount column added';
    ELSE
        RAISE NOTICE '✓ ican_amount column already exists';
    END IF;

    -- Add merchant_name column (store name, business name)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'merchant_name'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN merchant_name VARCHAR(255);
        RAISE NOTICE '✅ merchant_name column added';
    ELSE
        RAISE NOTICE '✓ merchant_name column already exists';
    END IF;

    -- Add merchant_type column (supermarket, restaurant, shop, etc.)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'merchant_type'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN merchant_type VARCHAR(100);
        RAISE NOTICE '✅ merchant_type column added';
    ELSE
        RAISE NOTICE '✓ merchant_type column already exists';
    END IF;

    -- Add expenditure_type column (business, personal)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'expenditure_type'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN expenditure_type VARCHAR(50) DEFAULT 'personal';
        RAISE NOTICE '✅ expenditure_type column added';
    ELSE
        RAISE NOTICE '✓ expenditure_type column already exists';
    END IF;

    -- Add expenditure_category column (groceries, utilities, supplies, etc.)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'expenditure_category'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN expenditure_category VARCHAR(100);
        RAISE NOTICE '✅ expenditure_category column added';
    ELSE
        RAISE NOTICE '✓ expenditure_category column already exists';
    END IF;

    -- Add exchange_rate column (ICAN to local currency rate at time of transaction)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'exchange_rate'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN exchange_rate DECIMAL(15, 6) DEFAULT 1000.000000;
        RAISE NOTICE '✅ exchange_rate column added';
    ELSE
        RAISE NOTICE '✓ exchange_rate column already exists';
    END IF;

    -- Add wallet_transaction_id column (link to ican_transactions)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'wallet_transaction_id'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN wallet_transaction_id UUID;
        RAISE NOTICE '✅ wallet_transaction_id column added';
    ELSE
        RAISE NOTICE '✓ wallet_transaction_id column already exists';
    END IF;

    -- Add customer_wallet_address column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'customer_wallet_address'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN customer_wallet_address VARCHAR(255);
        RAISE NOTICE '✅ customer_wallet_address column added';
    ELSE
        RAISE NOTICE '✓ customer_wallet_address column already exists';
    END IF;

    -- Add metadata_json column for flexible additional data
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'metadata_json'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN metadata_json JSONB;
        RAISE NOTICE '✅ metadata_json column added';
    ELSE
        RAISE NOTICE '✓ metadata_json column already exists';
    END IF;

END $$;

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_currency_code 
    ON public.transactions(currency_code);

CREATE INDEX IF NOT EXISTS idx_transactions_merchant_name 
    ON public.transactions(merchant_name);

CREATE INDEX IF NOT EXISTS idx_transactions_expenditure_type 
    ON public.transactions(expenditure_type);

CREATE INDEX IF NOT EXISTS idx_transactions_wallet_transaction_id 
    ON public.transactions(wallet_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_customer_wallet_address 
    ON public.transactions(customer_wallet_address);

-- Step 3: Backfill existing transactions with merchant data
UPDATE public.transactions
SET 
    merchant_name = COALESCE(store_location, 'Unknown Store'),
    merchant_type = 'supermarket',
    expenditure_type = 'personal',
    expenditure_category = 'groceries',
    currency_code = 'UGX',
    amount_in_local_currency = total_amount,
    ican_amount = CASE 
        WHEN total_amount > 0 THEN total_amount / 1000.0 
        ELSE 0 
    END
WHERE merchant_name IS NULL 
    AND total_amount IS NOT NULL;

-- Step 4: Create helper function to classify expenditure
CREATE OR REPLACE FUNCTION public.classify_expenditure(
    p_items JSONB,
    p_total_amount DECIMAL,
    p_customer_name VARCHAR
)
RETURNS TABLE (
    expenditure_type VARCHAR(50),
    expenditure_category VARCHAR(100),
    is_business_expense BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_item_count INT;
    v_avg_item_price DECIMAL;
    v_has_business_items BOOLEAN := FALSE;
BEGIN
    -- Count items
    v_item_count := COALESCE(jsonb_array_length(p_items), 0);
    
    -- Calculate average item price
    IF v_item_count > 0 THEN
        v_avg_item_price := p_total_amount / v_item_count;
    ELSE
        v_avg_item_price := p_total_amount;
    END IF;
    
    -- Check for business-related keywords
    IF p_customer_name ILIKE '%company%' OR 
       p_customer_name ILIKE '%ltd%' OR 
       p_customer_name ILIKE '%business%' OR
       p_customer_name ILIKE '%enterprise%' THEN
        v_has_business_items := TRUE;
    END IF;
    
    -- Classify based on amount and items
    IF v_has_business_items THEN
        expenditure_type := 'business';
        expenditure_category := 'business_supplies';
        is_business_expense := TRUE;
    ELSIF p_total_amount > 500000 THEN -- Large purchase
        expenditure_type := 'business';
        expenditure_category := 'bulk_purchase';
        is_business_expense := TRUE;
    ELSIF v_item_count > 20 THEN -- Many items
        expenditure_type := 'business';
        expenditure_category := 'inventory';
        is_business_expense := TRUE;
    ELSE
        expenditure_type := 'personal';
        expenditure_category := 'groceries';
        is_business_expense := FALSE;
    END IF;
    
    RETURN QUERY SELECT 
        classify_expenditure.expenditure_type,
        classify_expenditure.expenditure_category,
        classify_expenditure.is_business_expense;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.classify_expenditure(JSONB, DECIMAL, VARCHAR) 
    TO authenticated, anon;

-- Step 5: Create view for wallet transaction summary
CREATE OR REPLACE VIEW public.wallet_transaction_summary AS
SELECT 
    t.id,
    t.transaction_id,
    t.receipt_number,
    t.created_at,
    t.cashier_id,
    t.cashier_name,
    t.customer_name,
    t.customer_wallet_address,
    t.merchant_name,
    t.merchant_type,
    t.total_amount,
    t.currency_code,
    t.amount_in_local_currency,
    t.ican_amount,
    t.exchange_rate,
    t.expenditure_type,
    t.expenditure_category,
    t.payment_method,
    t.payment_provider,
    t.items_count,
    t.status,
    CASE 
        WHEN t.expenditure_type = 'business' THEN '🏢 Business'
        ELSE '👤 Personal'
    END as expenditure_icon,
    CASE 
        WHEN t.payment_provider ILIKE '%ican%' OR t.payment_method = 'icanera_wallet' 
        THEN '💎 IcanEra Wallet'
        ELSE t.payment_provider
    END as payment_display
FROM public.transactions t
WHERE t.payment_method = 'icanera_wallet' 
   OR t.payment_provider ILIKE '%ican%'
ORDER BY t.created_at DESC;

-- Grant access to view
GRANT SELECT ON public.wallet_transaction_summary TO authenticated, anon;

-- Step 6: Create function to record wallet payment with complete metadata
CREATE OR REPLACE FUNCTION public.record_wallet_payment(
    p_cashier_id UUID,
    p_customer_wallet_address VARCHAR,
    p_total_amount DECIMAL,
    p_currency_code VARCHAR DEFAULT 'UGX',
    p_ican_amount DECIMAL DEFAULT 0,
    p_exchange_rate DECIMAL DEFAULT 1000,
    p_merchant_name VARCHAR DEFAULT NULL,
    p_merchant_type VARCHAR DEFAULT 'supermarket',
    p_items JSONB DEFAULT '[]'::JSONB,
    p_supermarket_id UUID DEFAULT NULL,
    p_wallet_transaction_id UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    transaction_id VARCHAR,
    receipt_number VARCHAR,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id VARCHAR;
    v_receipt_number VARCHAR;
    v_expenditure_class RECORD;
    v_merchant_name VARCHAR;
    v_customer_name VARCHAR := 'IcanEra Wallet Customer';
BEGIN
    -- Generate IDs
    v_transaction_id := 'TXN_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || 
                        SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8);
    v_receipt_number := 'RCP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD(FLOOR(RANDOM() * 9999)::TEXT, 4, '0');
    
    -- Get merchant name from supermarket if not provided
    IF p_merchant_name IS NULL AND p_supermarket_id IS NOT NULL THEN
        SELECT name INTO v_merchant_name 
        FROM public.supermarkets 
        WHERE id = p_supermarket_id 
        LIMIT 1;
    ELSE
        v_merchant_name := COALESCE(p_merchant_name, 'Supermarket');
    END IF;
    
    -- Classify expenditure
    SELECT * INTO v_expenditure_class
    FROM public.classify_expenditure(p_items, p_total_amount, v_customer_name);
    
    -- Insert transaction
    INSERT INTO public.transactions (
        transaction_id,
        receipt_number,
        cashier_id,
        customer_name,
        customer_wallet_address,
        merchant_name,
        merchant_type,
        total_amount,
        currency_code,
        amount_in_local_currency,
        ican_amount,
        exchange_rate,
        expenditure_type,
        expenditure_category,
        payment_method,
        payment_provider,
        items,
        items_count,
        status,
        supermarket_id,
        wallet_transaction_id,
        created_at
    ) VALUES (
        v_transaction_id,
        v_receipt_number,
        p_cashier_id,
        v_customer_name,
        p_customer_wallet_address,
        v_merchant_name,
        p_merchant_type,
        p_total_amount,
        p_currency_code,
        p_total_amount, -- amount_in_local_currency
        p_ican_amount,
        p_exchange_rate,
        v_expenditure_class.expenditure_type,
        v_expenditure_class.expenditure_category,
        'icanera_wallet',
        'IcanEra Wallet',
        p_items,
        COALESCE(jsonb_array_length(p_items), 0),
        'completed',
        p_supermarket_id,
        p_wallet_transaction_id,
        NOW()
    );
    
    RETURN QUERY SELECT 
        TRUE as success,
        v_transaction_id as transaction_id,
        v_receipt_number as receipt_number,
        '✅ Wallet payment recorded successfully' as message;
        
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
        FALSE as success,
        NULL::VARCHAR as transaction_id,
        NULL::VARCHAR as receipt_number,
        ('❌ Error: ' || SQLERRM) as message;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.record_wallet_payment(
    UUID, VARCHAR, DECIMAL, VARCHAR, DECIMAL, DECIMAL, VARCHAR, VARCHAR, JSONB, UUID, UUID
) TO authenticated;

-- Step 7: Verification queries
SELECT '================================================================' as "Status";
SELECT '✅ ICANERA WALLET TRANSACTIONS MIGRATION COMPLETE' as "Status";
SELECT '================================================================' as "Status";

-- Show updated schema
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'transactions' 
  AND column_name IN (
    'currency_code',
    'amount_in_local_currency',
    'ican_amount',
    'merchant_name',
    'merchant_type',
    'expenditure_type',
    'expenditure_category',
    'exchange_rate',
    'wallet_transaction_id',
    'customer_wallet_address'
  )
ORDER BY column_name;

SELECT '✅ All columns added successfully' as "Status";
SELECT '✅ Indexes created' as "Status";
SELECT '✅ Helper functions created' as "Status";
SELECT '✅ Wallet transaction summary view created' as "Status";
