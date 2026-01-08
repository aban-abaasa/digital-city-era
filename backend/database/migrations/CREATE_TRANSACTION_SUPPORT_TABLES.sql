-- ===================================================
-- CREATE TRANSACTION SUPPORT TABLES
-- ===================================================

-- 1. DAILY SALES REPORTS TABLE
-- ===================================================
DROP TABLE IF EXISTS public.daily_sales_reports CASCADE;

CREATE TABLE public.daily_sales_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Report Date
  report_date DATE NOT NULL UNIQUE,
  
  -- Transaction Totals
  total_transactions INTEGER DEFAULT 0,
  total_sales_ugx DECIMAL(15, 2) DEFAULT 0.00,
  total_tax_collected DECIMAL(15, 2) DEFAULT 0.00,
  total_discounts_given DECIMAL(15, 2) DEFAULT 0.00,
  
  -- Payment Method Breakdown
  cash_transactions INTEGER DEFAULT 0,
  cash_amount DECIMAL(15, 2) DEFAULT 0.00,
  
  momo_transactions INTEGER DEFAULT 0,
  momo_amount DECIMAL(15, 2) DEFAULT 0.00,
  
  airtel_transactions INTEGER DEFAULT 0,
  airtel_amount DECIMAL(15, 2) DEFAULT 0.00,
  
  card_transactions INTEGER DEFAULT 0,
  card_amount DECIMAL(15, 2) DEFAULT 0.00,
  
  -- Performance Metrics
  average_basket_size DECIMAL(15, 2) DEFAULT 0.00,
  largest_transaction DECIMAL(15, 2) DEFAULT 0.00,
  smallest_transaction DECIMAL(15, 2) DEFAULT 0.00,
  total_items_sold INTEGER DEFAULT 0,
  
  -- Metadata
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT daily_sales_reports_date_unique UNIQUE (report_date)
);

-- Create indexes
CREATE INDEX idx_daily_sales_reports_report_date ON public.daily_sales_reports(report_date DESC);
CREATE INDEX idx_daily_sales_reports_generated_at ON public.daily_sales_reports(generated_at DESC);

-- Enable RLS
ALTER TABLE public.daily_sales_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read daily sales reports"
  ON public.daily_sales_reports
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert daily sales reports"
  ON public.daily_sales_reports
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update daily sales reports"
  ON public.daily_sales_reports
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE ON public.daily_sales_reports TO authenticated;
GRANT SELECT ON public.daily_sales_reports TO anon;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_daily_sales_reports_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_sales_reports_update_timestamp
  BEFORE UPDATE ON public.daily_sales_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_sales_reports_timestamp();

-- 2. SALES TRANSACTION ITEMS TABLE
-- ===================================================
DROP TABLE IF EXISTS public.sales_transaction_items CASCADE;

CREATE TABLE public.sales_transaction_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Foreign Keys
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  
  -- Product Information
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  product_barcode VARCHAR(100),
  category_name VARCHAR(255),
  
  -- Pricing & Quantity
  unit_price DECIMAL(15, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  line_total DECIMAL(15, 2) NOT NULL,
  
  -- Tax Information
  tax_included BOOLEAN DEFAULT TRUE,
  tax_amount DECIMAL(15, 2) DEFAULT 0.00,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT items_price_positive CHECK (unit_price >= 0)
);

-- Create indexes
CREATE INDEX idx_sales_transaction_items_transaction_id ON public.sales_transaction_items(transaction_id);
CREATE INDEX idx_sales_transaction_items_product_id ON public.sales_transaction_items(product_id);
CREATE INDEX idx_sales_transaction_items_created_at ON public.sales_transaction_items(created_at DESC);

-- Enable RLS
ALTER TABLE public.sales_transaction_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read transaction items"
  ON public.sales_transaction_items
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert transaction items"
  ON public.sales_transaction_items
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT ON public.sales_transaction_items TO authenticated;
GRANT SELECT ON public.sales_transaction_items TO anon;

-- 3. RECEIPT PRINT LOG TABLE
-- ===================================================
DROP TABLE IF EXISTS public.receipt_print_log CASCADE;

CREATE TABLE public.receipt_print_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Foreign Keys
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  
  -- Receipt Information
  receipt_number VARCHAR(50) NOT NULL,
  print_type VARCHAR(50) DEFAULT 'original', -- original, reprint, duplicate
  print_format VARCHAR(50) DEFAULT 'thermal', -- thermal, a4, email
  
  -- Printer Information
  printer_name VARCHAR(255),
  printed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  printed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT print_log_type_check CHECK (print_type IN ('original', 'reprint', 'duplicate')),
  CONSTRAINT print_log_format_check CHECK (print_format IN ('thermal', 'a4', 'email', 'sms'))
);

-- Create indexes
CREATE INDEX idx_receipt_print_log_transaction_id ON public.receipt_print_log(transaction_id);
CREATE INDEX idx_receipt_print_log_receipt_number ON public.receipt_print_log(receipt_number);
CREATE INDEX idx_receipt_print_log_printed_at ON public.receipt_print_log(printed_at DESC);

-- Enable RLS
ALTER TABLE public.receipt_print_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read receipt print logs"
  ON public.receipt_print_log
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert receipt print logs"
  ON public.receipt_print_log
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT ON public.receipt_print_log TO authenticated;
GRANT SELECT ON public.receipt_print_log TO anon;

-- 4. TRANSACTION SUMMARY VIEW
-- ===================================================
DROP VIEW IF EXISTS public.transaction_summary CASCADE;

CREATE VIEW public.transaction_summary AS
SELECT 
  t.id,
  t.transaction_id,
  t.receipt_number,
  t.cashier_name,
  t.store_location,
  t.total_amount,
  t.tax_amount,
  t.payment_method,
  t.customer_name,
  t.status,
  COUNT(sti.id) as line_items_count,
  SUM(sti.quantity) as total_quantity,
  t.created_at
FROM public.transactions t
LEFT JOIN public.sales_transaction_items sti ON t.id = sti.transaction_id
GROUP BY t.id, t.transaction_id, t.receipt_number, t.cashier_name, t.store_location, 
         t.total_amount, t.tax_amount, t.payment_method, t.customer_name, t.status, t.created_at;

-- 5. DAILY PERFORMANCE VIEW
-- ===================================================
DROP VIEW IF EXISTS public.daily_performance CASCADE;

CREATE VIEW public.daily_performance AS
SELECT 
  DATE(t.created_at) as report_date,
  COUNT(DISTINCT t.id) as total_transactions,
  COUNT(DISTINCT t.cashier_id) as active_cashiers,
  SUM(t.total_amount) as total_sales,
  SUM(t.tax_amount) as total_tax,
  AVG(t.total_amount) as average_transaction_value,
  MAX(t.total_amount) as largest_transaction,
  MIN(CASE WHEN t.total_amount > 0 THEN t.total_amount END) as smallest_transaction,
  SUM(t.items_count) as total_items_sold,
  COUNT(CASE WHEN t.payment_method = 'cash' THEN 1 END) as cash_transactions,
  SUM(CASE WHEN t.payment_method = 'cash' THEN t.total_amount ELSE 0 END) as cash_amount,
  COUNT(CASE WHEN t.payment_method IN ('mtn_momo', 'airtel_money') THEN 1 END) as mobile_transactions,
  SUM(CASE WHEN t.payment_method IN ('mtn_momo', 'airtel_money') THEN t.total_amount ELSE 0 END) as mobile_amount
FROM public.transactions t
GROUP BY DATE(t.created_at);

-- Verification
SELECT 'Daily Sales Reports table created' AS status
UNION ALL
SELECT 'Sales Transaction Items table created' AS status
UNION ALL
SELECT 'Receipt Print Log table created' AS status
UNION ALL
SELECT 'Transaction Summary view created' AS status
UNION ALL
SELECT 'Daily Performance view created' AS status;
