-- ===================================================
-- COMPREHENSIVE FIX FOR CASHIER PORTAL TABLES
-- ===================================================
-- This script fixes all missing columns and tables for the cashier portal

-- ===================================================
-- PART 1: FIX TRANSACTIONS TABLE
-- ===================================================

DO $$ 
BEGIN
    -- Check if transactions table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
    ) THEN
        RAISE EXCEPTION 'transactions table does not exist! Please run CREATE_TRANSACTIONS_TABLE.sql first';
    END IF;

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

    -- Add payment_reference column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'payment_reference'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN payment_reference VARCHAR(255);
        RAISE NOTICE '✅ payment_reference column added';
    ELSE
        RAISE NOTICE '✓ payment_reference column already exists';
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

    -- Add cashier_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'cashier_name'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN cashier_name VARCHAR(255) DEFAULT 'Cashier';
        RAISE NOTICE '✅ cashier_name column added';
    ELSE
        RAISE NOTICE '✓ cashier_name column already exists';
    END IF;

    -- Add customer_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'customer_name'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN customer_name VARCHAR(255) DEFAULT 'Walk-in Customer';
        RAISE NOTICE '✅ customer_name column added';
    ELSE
        RAISE NOTICE '✓ customer_name column already exists';
    END IF;

    -- Add customer_phone column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN customer_phone VARCHAR(20);
        RAISE NOTICE '✅ customer_phone column added';
    ELSE
        RAISE NOTICE '✓ customer_phone column already exists';
    END IF;

END $$;

-- ===================================================
-- PART 2: CREATE OR FIX RECEIPTS TABLE
-- ===================================================

DO $$ 
BEGIN
    -- Check if receipts table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'receipts'
    ) THEN
        RAISE NOTICE '❌ receipts table does not exist - creating it now...';
        
        -- Create receipts table
        CREATE TABLE public.receipts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          receipt_number VARCHAR(50) UNIQUE NOT NULL,
          transaction_id VARCHAR(100),
          cashier_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
          cashier_name VARCHAR(255) NOT NULL DEFAULT 'Cashier',
          register_id VARCHAR(50) DEFAULT 'POS-001',
          store_location VARCHAR(255) DEFAULT 'Kampala Main Branch',
          customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
          customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
          customer_phone VARCHAR(20),
          subtotal DECIMAL(15, 2) DEFAULT 0.00,
          tax_amount DECIMAL(15, 2) DEFAULT 0.00,
          total_amount DECIMAL(15, 2) NOT NULL,
          amount_paid DECIMAL(15, 2) DEFAULT 0.00,
          change_given DECIMAL(15, 2) DEFAULT 0.00,
          payment_method VARCHAR(50) DEFAULT 'cash',
          payment_provider VARCHAR(100) DEFAULT 'Cash',
          payment_reference VARCHAR(255),
          items_json JSONB,
          status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'voided', 'refunded')),
          printed_at TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );

        -- Create indexes
        CREATE INDEX idx_receipts_created_at ON public.receipts(created_at DESC);
        CREATE INDEX idx_receipts_cashier_id ON public.receipts(cashier_id);
        CREATE INDEX idx_receipts_receipt_number ON public.receipts(receipt_number);
        CREATE INDEX idx_receipts_transaction_id ON public.receipts(transaction_id);

        -- Enable RLS
        ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

        -- Create RLS Policies
        CREATE POLICY "Allow authenticated users to read receipts"
          ON public.receipts FOR SELECT
          USING (auth.role() = 'authenticated');

        CREATE POLICY "Allow users to insert receipts"
          ON public.receipts FOR INSERT
          WITH CHECK (auth.role() = 'authenticated');

        CREATE POLICY "Allow users to update own receipts"
          ON public.receipts FOR UPDATE
          USING (auth.role() = 'authenticated')
          WITH CHECK (auth.role() = 'authenticated');

        -- Grant permissions
        GRANT SELECT, INSERT, UPDATE ON public.receipts TO authenticated;

        -- Create timestamp trigger
        CREATE OR REPLACE FUNCTION update_receipts_timestamp()
        RETURNS TRIGGER AS $func$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;

        CREATE TRIGGER receipts_update_timestamp
          BEFORE UPDATE ON public.receipts
          FOR EACH ROW
          EXECUTE FUNCTION update_receipts_timestamp();

        RAISE NOTICE '✅ receipts table created successfully';
    ELSE
        RAISE NOTICE '✓ receipts table already exists';
    END IF;
END $$;

-- ===================================================
-- VERIFICATION
-- ===================================================

-- Verify transactions table columns
SELECT 
    '=== TRANSACTIONS TABLE COLUMNS ===' AS info,
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
    'payment_reference',
    'items',
    'items_count',
    'receipt_printed',
    'cashier_name',
    'customer_name',
    'customer_phone'
)
ORDER BY column_name;

-- Verify receipts table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'receipts'
        ) THEN '✅ receipts table EXISTS'
        ELSE '❌ receipts table MISSING'
    END AS receipts_table_status;

-- Final status
SELECT '✅ ✅ ✅ ALL CASHIER PORTAL FIXES COMPLETED ✅ ✅ ✅' AS status;
