-- =========================================
-- DROP DEPENDENT TABLES IN CORRECT ORDER
-- =========================================
-- Drop tables that reference users table first
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Finally drop the users table
DROP TABLE IF EXISTS users CASCADE;

-- =========================================
-- SUCCESS MESSAGE
-- =========================================
DO $$
BEGIN
  RAISE NOTICE '✅ ALL TABLES DROPPED SUCCESSFULLY!';
  RAISE NOTICE '✅ Ready to create new schema';
END $$;
