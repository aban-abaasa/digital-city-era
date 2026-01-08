-- =========================================
-- INSERT SAMPLE CATEGORIES
-- =========================================
-- Add sample categories for testing

INSERT INTO public.categories (name, description, is_active) VALUES
('Beverages', 'Drinks and beverages', true),
('Grains & Cereals', 'Rice, maize, wheat, and other grains', true),
('Oils & Fats', 'Cooking oils and fats', true),
('Spices & Seasonings', 'Salt, spices, herbs, and seasonings', true),
('Dairy & Eggs', 'Milk, cheese, eggs, and dairy products', true),
('Fruits & Vegetables', 'Fresh produce', true),
('Meats & Proteins', 'Meat, fish, beans, and protein sources', true),
('Baked Goods', 'Bread, cakes, and baked items', true),
('Canned & Packaged', 'Canned foods and packaged goods', true),
('Household Supplies', 'Cleaning supplies and household items', true)
ON CONFLICT (name) DO NOTHING;

-- Verify categories were inserted
SELECT COUNT(*) as total_categories FROM public.categories;
