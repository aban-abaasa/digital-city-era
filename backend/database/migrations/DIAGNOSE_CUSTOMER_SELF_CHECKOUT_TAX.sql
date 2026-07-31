-- Run this in Supabase SQL Editor to identify the live object that owns v_product.

SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('v_product', 'products');

SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('v_product', 'products')
ORDER BY table_name, ordinal_position;

SELECT p.oid::regprocedure AS function_signature,
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'customer_self_checkout';
