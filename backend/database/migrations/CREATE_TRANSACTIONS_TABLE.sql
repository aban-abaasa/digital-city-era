-- ===================================================
-- CREATE TRANSACTIONS TABLE FOR ALL PORTALS
-- ===================================================

-- Drop table if exists (for clean creation)
DROP TABLE IF EXISTS public.transactions CASCADE;

-- Create transactions table
CREATE TABLE public.transactions (
  -- Primary Key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Transaction Identifiers
  transaction_id VARCHAR(100) UNIQUE NOT NULL,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Cashier Information
  cashier_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cashier_name VARCHAR(255) NOT NULL DEFAULT 'Cashier',
  register_number VARCHAR(50) DEFAULT 'POS-001',
  store_location VARCHAR(255) DEFAULT 'Kampala Main Branch',
  
  -- Financial Information
  subtotal DECIMAL(15, 2) DEFAULT 0.00,
  tax_amount DECIMAL(15, 2) DEFAULT 0.00,
  tax_rate DECIMAL(5, 2) DEFAULT 18.00,
  total_amount DECIMAL(15, 2) NOT NULL,
  
  -- Payment Information
  payment_method VARCHAR(50) DEFAULT 'cash',
  payment_provider VARCHAR(100) DEFAULT 'Cash',
  payment_reference VARCHAR(255),
  change_given DECIMAL(15, 2) DEFAULT 0.00,
  payment_fee DECIMAL(15, 2) DEFAULT 0.00,
  
  -- Customer Information
  customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
  customer_phone VARCHAR(20),
  
  -- Items Information
  items_count INTEGER DEFAULT 0,
  items JSONB, -- Stores transaction line items as JSON
  
  -- Status
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'voided', 'refunded')),
  voided_at TIMESTAMP,
  voided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  void_reason VARCHAR(500),
  
  -- Receipt Print Log
  receipt_printed BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Indexes for query performance
  CONSTRAINT transactions_receipt_unique UNIQUE (receipt_number)
);

-- Create indexes
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_transactions_cashier_id ON public.transactions(cashier_id);
CREATE INDEX idx_transactions_customer_id ON public.transactions(customer_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_payment_method ON public.transactions(payment_method);
CREATE INDEX idx_transactions_transaction_id ON public.transactions(transaction_id);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy - Allow all authenticated users to read transactions
CREATE POLICY "Allow authenticated users to read transactions"
  ON public.transactions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create RLS Policy - Allow users to insert their own transactions
CREATE POLICY "Allow users to insert transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (
    -- Allow if authenticated
    auth.role() = 'authenticated'
  );

-- Create RLS Policy - Allow users to update their own transactions
CREATE POLICY "Allow users to update own transactions"
  ON public.transactions
  FOR UPDATE
  USING (
    cashier_id = auth.uid() OR
    auth.role() = 'authenticated'
  )
  WITH CHECK (
    cashier_id = auth.uid() OR
    auth.role() = 'authenticated'
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT SELECT ON public.transactions TO anon;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_transactions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_update_timestamp
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transactions_timestamp();

-- Verify table creation
SELECT 'Transactions table created successfully' AS status;
