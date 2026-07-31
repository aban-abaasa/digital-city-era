-- Safe repair for the live customer checkout RPC.
-- The checkout function reads v_product.tax_rate from public.products.
-- This migration only adds/backfills the missing field; it does not delete data.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2) DEFAULT 18.00;

UPDATE public.products
SET tax_rate = 18.00
WHERE tax_rate IS NULL;

ALTER TABLE public.products
  ALTER COLUMN tax_rate SET DEFAULT 18.00;

SELECT table_schema, table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name = 'tax_rate';

-- Verification: if v_product is a view/record-backed relation, this shows
-- whether its exposed shape also contains tax_rate.
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'v_product';

SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'v_product'
  AND column_name = 'tax_rate';

NOTIFY pgrst, 'reload schema';
