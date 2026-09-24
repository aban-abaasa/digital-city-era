-- ============================================================
-- SUPPLIER CATALOG: FULL PRODUCT FIELDS (ADD-ONLY)
-- ============================================================
-- The supplier portal's "Add Item" now uses the same full product form as the
-- admin portal (photo, SKU, barcode, brand, cost/selling price, tax, stock,
-- bulk price tiers). supplier_catalog_items only had the basic offer columns,
-- so these are added here. Nothing is dropped or rewritten; existing rows keep
-- working and the new columns are simply NULL/default for them.
--
-- Until this is run the form still saves name, category, description, unit,
-- minimum order, price and photo — it just can't keep the extra fields.
-- Safe to run multiple times.
-- ============================================================

ALTER TABLE public.supplier_catalog_items
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS minimum_stock INTEGER,
  -- [{ "min_quantity": 50, "unit_price": 4200 }, ...] bulk pricing shown to buyers
  ADD COLUMN IF NOT EXISTS price_tiers JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';

SELECT 'supplier_catalog_items full product fields ready' AS status;
