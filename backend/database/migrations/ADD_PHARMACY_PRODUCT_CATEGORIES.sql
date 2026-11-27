-- Add useful pharmacy-specific product categories while keeping pharmacy
-- products in the same product inventory flow as supermarket merchandise.
-- Run after ADD_CATEGORY_KINDS.sql. Safe to run more than once.

INSERT INTO public.categories (name, description, is_active, kind) VALUES
  ('Medicines',                    'Medicines and prescription products',       true, 'product'),
  ('Prescription Medicines',       'Prescription-only medicines',               true, 'product'),
  ('Over-the-Counter Medicines',   'Non-prescription medicines and remedies',   true, 'product'),
  ('Vitamins & Supplements',       'Vitamins, minerals and nutrition products', true, 'product'),
  ('Medical Supplies & Devices',   'Medical equipment and daily care supplies', true, 'product'),
  ('First Aid',                    'First-aid kits, dressings and wound care',   true, 'product'),
  ('Baby & Mother Care',           'Baby care and maternal health products',    true, 'product')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
