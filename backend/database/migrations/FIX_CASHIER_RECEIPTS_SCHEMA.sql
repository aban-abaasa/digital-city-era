-- Safe cashier receipt schema repair. This migration never drops existing data.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS register_number VARCHAR(50) DEFAULT 'POS-001',
  ADD COLUMN IF NOT EXISTS store_location VARCHAR(255) DEFAULT 'Kampala Main Branch',
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(100) DEFAULT 'Cash',
  ADD COLUMN IF NOT EXISTS payment_fee DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_given DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_printed BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  transaction_id VARCHAR(100),
  cashier_id UUID,
  cashier_name VARCHAR(255) NOT NULL DEFAULT 'Cashier',
  register_id VARCHAR(50) DEFAULT 'POS-001',
  store_location VARCHAR(255) DEFAULT 'Kampala Main Branch',
  customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
  total_amount DECIMAL(15, 2) NOT NULL,
  subtotal DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  change_given DECIMAL(15, 2) DEFAULT 0,
  payment_method VARCHAR(50) DEFAULT 'cash',
  payment_provider VARCHAR(100) DEFAULT 'Cash',
  payment_reference VARCHAR(255),
  items_json JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(100) DEFAULT 'Cash';

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read receipts" ON public.receipts;
CREATE POLICY "Authenticated users can read receipts"
  ON public.receipts FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert receipts" ON public.receipts;
CREATE POLICY "Authenticated users can insert receipts"
  ON public.receipts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE ON public.receipts TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'Cashier transactions and receipts schema is ready' AS status;
