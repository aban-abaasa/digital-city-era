-- ============================================================
-- Categories for products vs. categories for services
-- ============================================================
-- public.categories was one global list, so a laundry or a salon picking a
-- category for a service was offered "Groceries" and "Dairy". This adds
-- categories.kind ('product' | 'service') and seeds a real list for each.
--
-- The Add Product / Add Service form shows only the kind that matches what
-- is being added (see AddProductModal.jsx). Until this is run the form keeps
-- working: it shows the whole list when no category carries a kind.
--
-- Names stay unique across both kinds (categories_name_key is untouched), so
-- the service names below deliberately differ from the product ones.
-- Existing categories keep working: they default to 'product'. The product
-- names reuse the ones in INSERT_SAMPLE_CATEGORIES.sql so running both is safe.
--
-- Safe to run more than once.
-- ============================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'product';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.categories'::regclass AND conname = 'categories_kind_check'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_kind_check CHECK (kind IN ('product', 'service'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_kind ON public.categories (kind);

-- Things a shop sells
INSERT INTO public.categories (name, description, is_active, kind) VALUES
  ('Groceries',            'Everyday food items',                          true, 'product'),
  ('Beverages',            'Drinks and beverages',                         true, 'product'),
  ('Dairy & Eggs',         'Milk, cheese, eggs and dairy products',        true, 'product'),
  ('Baked Goods',          'Bread, cakes and baked items',                 true, 'product'),
  ('Fruits & Vegetables',  'Fresh produce',                                true, 'product'),
  ('Meats & Proteins',     'Meat, fish, beans and protein sources',        true, 'product'),
  ('Grains & Cereals',     'Rice, maize, wheat and other grains',          true, 'product'),
  ('Oils & Fats',          'Cooking oils and fats',                        true, 'product'),
  ('Spices & Seasonings',  'Salt, spices, herbs and seasonings',           true, 'product'),
  ('Canned & Packaged',    'Canned foods and packaged goods',              true, 'product'),
  ('Household Supplies',   'Cleaning supplies and household items',        true, 'product'),
  ('Personal Care',        'Soap, lotions and personal care products',     true, 'product'),
  ('Health & Pharmacy',    'Medicines and health products',                true, 'product'),
  ('Electronics',          'Phones, accessories and electronics',          true, 'product'),
  ('Clothing & Shoes',     'Clothes, shoes and fashion items',             true, 'product'),
  ('Stationery & Office',  'School and office supplies',                   true, 'product'),
  ('Hardware & Building',  'Tools and building materials',                 true, 'product')
ON CONFLICT (name) DO NOTHING;

-- Things a business does for a customer (no stock, often booked)
INSERT INTO public.categories (name, description, is_active, kind) VALUES
  ('Hair & Beauty',           'Haircuts, braiding, salon and beauty treatments', true, 'service'),
  ('Laundry & Dry Cleaning',  'Washing, ironing and dry cleaning',               true, 'service'),
  ('Cleaning Services',       'Home, office and car cleaning',                   true, 'service'),
  ('Repairs & Maintenance',   'Fixing and servicing equipment, vehicles, homes', true, 'service'),
  ('Installation & Setup',    'Installing and setting up equipment',             true, 'service'),
  ('Delivery & Errands',      'Courier, delivery and errand running',            true, 'service'),
  ('Consultation & Advice',   'Professional advice and consultations',           true, 'service'),
  ('Health & Wellness',       'Clinics, therapy, fitness and wellness',          true, 'service'),
  ('Training & Lessons',      'Classes, coaching and tutoring',                  true, 'service'),
  ('Events & Entertainment',  'Event planning, hire and entertainment',          true, 'service'),
  ('Transport & Rentals',     'Vehicle, equipment and space hire',               true, 'service'),
  ('Printing & Design',       'Printing, photography and graphic design',        true, 'service')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';

SELECT kind, count(*) AS categories FROM public.categories GROUP BY kind ORDER BY kind;
