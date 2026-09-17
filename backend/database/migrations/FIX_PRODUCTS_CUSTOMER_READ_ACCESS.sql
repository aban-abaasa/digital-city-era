-- ============================================================
-- FIX: customers could see NO products/services from any store
-- ============================================================
-- Root cause of "customers are getting nothing" on the cross-business
-- service search (and, by the same mechanism, anything else that reads
-- public.products as a customer): FIX_PRODUCTS_SUPERMARKET_ISOLATION.sql
-- replaced products' SELECT policy with one scoped ONLY to the viewer's own
-- store:
--
--   USING (supermarket_id IN (SELECT u.supermarket_id FROM users u WHERE u.auth_id = auth.uid()))
--
-- That's correct for a store's own staff managing their own inventory, but
-- a customer's public.users row has supermarket_id = NULL (they don't work
-- at any store), and `supermarket_id IN (NULL)` is never true for ANY row
-- in SQL -- so every customer-facing read of products, from every store,
-- silently returned zero rows. supermarkets itself was already fixed the
-- same way this fixes products (see supermarkets_read_all in
-- FIX_SUPERMARKETS_RLS_AND_SUPPLIER_APPLICATIONS.sql) -- products was
-- simply missed.
--
-- Fix: RLS SELECT policies on the same table are OR'd together, so this
-- ADDS a second, purely additive policy opening read access to active
-- products for everyone (anon + authenticated), without touching the
-- existing staff-isolation SELECT policy or any INSERT/UPDATE/DELETE
-- policy -- writes remain scoped to one's own store exactly as before.
-- This is the same "open read, restricted write" shape already used for
-- supermarkets and service_availability_rules in this codebase.
--
-- Run after: FIX_PRODUCTS_SUPERMARKET_ISOLATION.sql.
-- Safe to run more than once.
-- ============================================================

DROP POLICY IF EXISTS "products_customer_read_policy" ON public.products;
CREATE POLICY "products_customer_read_policy" ON public.products
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

GRANT SELECT ON TABLE public.products TO anon, authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Customers can now read active products/services from every store, not just their own.';
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Products customer read access fixed.' AS status;
