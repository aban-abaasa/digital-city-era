-- ===================================================
-- CREATE RECEIPTS TABLE
-- ===================================================
-- This creates the receipts table for storing receipt data

-- Drop table if exists (for clean creation)
DROP TABLE IF EXISTS public.receipts CASCADE;

-- Create receipts table
CREATE TABLE public.receipts (
  -- Primary Key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Receipt Identifiers
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  transaction_id VARCHAR(100),
  
  -- Cashier Information
  cashier_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cashier_name VARCHAR(255) NOT NULL DEFAULT 'Cashier',
  register_id VARCHAR(50) DEFAULT 'POS-001',
  store_location VARCHAR(255) DEFAULT 'Kampala Main Branch',
  
  -- Customer Information
  customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
  customer_phone VARCHAR(20),
  
  -- Financial Information
  subtotal DECIMAL(15, 2) DEFAULT 0.00,
  tax_amount DECIMAL(15, 2) DEFAULT 0.00,
  total_amount DECIMAL(15, 2) NOT NULL,
  amount_paid DECIMAL(15, 2) DEFAULT 0.00,
  change_given DECIMAL(15, 2) DEFAULT 0.00,
  
  -- Payment Information
  payment_method VARCHAR(50) DEFAULT 'cash',
  payment_provider VARCHAR(100) DEFAULT 'Cash',
  payment_reference VARCHAR(255),
  
  -- Items Information (stored as JSON)
  items_json JSONB,
  
  -- Status
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'voided', 'refunded')),
  
  -- Print Status
  printed_at TIMESTAMP,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_receipts_created_at ON public.receipts(created_at DESC);
CREATE INDEX idx_receipts_cashier_id ON public.receipts(cashier_id);
CREATE INDEX idx_receipts_customer_id ON public.receipts(customer_id);
CREATE INDEX idx_receipts_receipt_number ON public.receipts(receipt_number);
CREATE INDEX idx_receipts_transaction_id ON public.receipts(transaction_id);
CREATE INDEX idx_receipts_status ON public.receipts(status);

-- Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy - Allow all authenticated users to read receipts
CREATE POLICY "Allow authenticated users to read receipts"
  ON public.receipts
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create RLS Policy - Allow users to insert receipts
CREATE POLICY "Allow users to insert receipts"
  ON public.receipts
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create RLS Policy - Allow users to update their own receipts
CREATE POLICY "Allow users to update own receipts"
  ON public.receipts
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
GRANT SELECT, INSERT, UPDATE ON public.receipts TO authenticated;
GRANT SELECT ON public.receipts TO anon;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_receipts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receipts_update_timestamp
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_receipts_timestamp();

-- Verify table creation
SELECT 'Receipts table created successfully' AS status;
