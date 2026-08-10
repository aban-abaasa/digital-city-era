-- Separate POS selling, internal buying, and wholesale purchasing prices.
-- Admins may accept a supplier price without changing the POS price.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_supplier_price NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS purchasing_price_source TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_purchasing_price_source_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_purchasing_price_source_check
  CHECK (purchasing_price_source IN ('admin', 'supplier'));
