-- ===================================================
-- FIX TRANSACTIONS TABLE - ADD ALL MISSING COLUMNS
-- ===================================================
-- This adds all missing columns required for the cashier portal

DO $$ 
BEGIN
    -- Add payment_fee column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'payment_fee'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN payment_fee DECIMAL(15, 2) DEFAULT 0.00;
        RAISE NOTICE '✅ payment_fee column added';
    ELSE
        RAISE NOTICE '✓ payment_fee column already exists';
    END IF;

    -- Add register_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'register_number'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN register_number VARCHAR(50) DEFAULT 'POS-001';
        RAISE NOTICE '✅ register_number column added';
    ELSE
        RAISE NOTICE '✓ register_number column already exists';
    END IF;

    -- Add store_location column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'store_location'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN store_location VARCHAR(255) DEFAULT 'Kampala Main Branch';
        RAISE NOTICE '✅ store_location column added';
    ELSE
        RAISE NOTICE '✓ store_location column already exists';
    END IF;

    -- Add change_given column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'change_given'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN change_given DECIMAL(15, 2) DEFAULT 0.00;
        RAISE NOTICE '✅ change_given column added';
    ELSE
        RAISE NOTICE '✓ change_given column already exists';
    END IF;

    -- Add payment_provider column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'payment_provider'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN payment_provider VARCHAR(100) DEFAULT 'Cash';
        RAISE NOTICE '✅ payment_provider column added';
    ELSE
        RAISE NOTICE '✓ payment_provider column already exists';
    END IF;

    -- Add items column if it doesn't exist (stores items as JSON)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'items'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN items JSONB;
        RAISE NOTICE '✅ items column added';
    ELSE
        RAISE NOTICE '✓ items column already exists';
    END IF;

    -- Add items_count column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'items_count'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN items_count INTEGER DEFAULT 0;
        RAISE NOTICE '✅ items_count column added';
    ELSE
        RAISE NOTICE '✓ items_count column already exists';
    END IF;

    -- Add receipt_printed column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'receipt_printed'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN receipt_printed BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ receipt_printed column added';
    ELSE
        RAISE NOTICE '✓ receipt_printed column already exists';
    END IF;

END $$;

-- Verify all critical columns exist
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transactions' 
AND column_name IN (
    'payment_fee', 
    'register_number', 
    'store_location', 
    'change_given', 
    'payment_provider',
    'items',
    'items_count',
    'receipt_printed'
)
ORDER BY column_name;

SELECT '✅ All missing columns fix completed' AS status;
