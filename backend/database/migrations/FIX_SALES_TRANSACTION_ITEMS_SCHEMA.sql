-- Safe repair for cashier receipt line items.
-- Unlike CREATE_TRANSACTION_SUPPORT_TABLES.sql, this migration never drops data.

CREATE TABLE IF NOT EXISTS public.sales_transaction_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  product_barcode VARCHAR(100),
  category_name VARCHAR(255),
  unit_price DECIMAL(15, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  line_total DECIMAL(15, 2) NOT NULL,
  tax_included BOOLEAN DEFAULT TRUE,
  tax_amount DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT items_price_positive CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_transaction_items_transaction_id
  ON public.sales_transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sales_transaction_items_product_id
  ON public.sales_transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_transaction_items_created_at
  ON public.sales_transaction_items(created_at DESC);

ALTER TABLE public.sales_transaction_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales_transaction_items'
      AND policyname = 'Allow authenticated users to read transaction items'
  ) THEN
    CREATE POLICY "Allow authenticated users to read transaction items"
      ON public.sales_transaction_items FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales_transaction_items'
      AND policyname = 'Allow authenticated users to insert transaction items'
  ) THEN
    CREATE POLICY "Allow authenticated users to insert transaction items"
      ON public.sales_transaction_items FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT ON public.sales_transaction_items TO authenticated;
GRANT SELECT ON public.sales_transaction_items TO anon;

NOTIFY pgrst, 'reload schema';
