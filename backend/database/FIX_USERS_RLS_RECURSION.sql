-- ============================================================================
-- FIX: INFINITE RECURSION IN "users" RLS POLICIES (Postgres error 42P17)
-- ============================================================================
-- CAUSE: FIX_SUPERMARKET_ISOLATION_V2.sql added policies that look up the
-- caller's own supermarket_id/role via `EXISTS (SELECT 1 FROM public.users
-- WHERE ...)` written directly inside a policy defined ON public.users (and,
-- indirectly, inside policies on supermarkets/inventory/transactions/
-- payments/suppliers too, since checking those also requires re-evaluating
-- the users policy). Every one of those subqueries re-triggers the very
-- policy being evaluated, forever.
--
-- FIX: resolve the caller's own supermarket_id/role via a SECURITY DEFINER
-- function instead. Such a function executes with the privileges of its
-- owner and does not re-apply the caller's RLS policies internally, so the
-- recursion is broken.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_supermarket_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT supermarket_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_supermarket_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;

-- ============================================================================
-- USERS — the self-referential policy that causes the recursion directly
-- ============================================================================
DROP POLICY IF EXISTS "Users can read same supermarket users" ON public.users;
CREATE POLICY "Users can read same supermarket users" ON public.users
  FOR SELECT
  USING (
    auth.uid() = auth_id
    OR (
      public.current_user_supermarket_id() IS NOT NULL
      AND supermarket_id = public.current_user_supermarket_id()
    )
  );

-- ============================================================================
-- SUPERMARKETS
-- ============================================================================
DROP POLICY IF EXISTS "Users can read own supermarket" ON public.supermarkets;
CREATE POLICY "Users can read own supermarket" ON public.supermarkets
  FOR SELECT
  USING (id = public.current_user_supermarket_id());

DROP POLICY IF EXISTS "Admins can update own supermarket" ON public.supermarkets;
CREATE POLICY "Admins can update own supermarket" ON public.supermarkets
  FOR UPDATE
  USING (id = public.current_user_supermarket_id() AND public.current_user_role() = 'admin')
  WITH CHECK (id = public.current_user_supermarket_id() AND public.current_user_role() = 'admin');

-- ============================================================================
-- INVENTORY
-- ============================================================================
DROP POLICY IF EXISTS "Users can read own supermarket inventory" ON public.inventory;
CREATE POLICY "Users can read own supermarket inventory" ON public.inventory
  FOR SELECT
  USING (supermarket_id = public.current_user_supermarket_id());

DROP POLICY IF EXISTS "Admins can insert own supermarket inventory" ON public.inventory;
CREATE POLICY "Admins can insert own supermarket inventory" ON public.inventory
  FOR INSERT
  WITH CHECK (
    supermarket_id = public.current_user_supermarket_id()
    AND public.current_user_role() IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Admins can update own supermarket inventory" ON public.inventory;
CREATE POLICY "Admins can update own supermarket inventory" ON public.inventory
  FOR UPDATE
  USING (
    supermarket_id = public.current_user_supermarket_id()
    AND public.current_user_role() IN ('admin', 'manager')
  );

-- ============================================================================
-- TRANSACTIONS
-- ============================================================================
DROP POLICY IF EXISTS "Users can read own supermarket transactions" ON public.transactions;
CREATE POLICY "Users can read own supermarket transactions" ON public.transactions
  FOR SELECT
  USING (supermarket_id = public.current_user_supermarket_id());

DROP POLICY IF EXISTS "Cashiers can insert own supermarket transactions" ON public.transactions;
CREATE POLICY "Cashiers can insert own supermarket transactions" ON public.transactions
  FOR INSERT
  WITH CHECK (
    supermarket_id = public.current_user_supermarket_id()
    AND public.current_user_role() IN ('admin', 'manager', 'cashier')
  );

-- ============================================================================
-- PAYMENTS
-- ============================================================================
DROP POLICY IF EXISTS "Users can read own supermarket payments" ON public.payments;
CREATE POLICY "Users can read own supermarket payments" ON public.payments
  FOR SELECT
  USING (supermarket_id = public.current_user_supermarket_id());

DROP POLICY IF EXISTS "Admins can insert own supermarket payments" ON public.payments;
CREATE POLICY "Admins can insert own supermarket payments" ON public.payments
  FOR INSERT
  WITH CHECK (
    supermarket_id = public.current_user_supermarket_id()
    AND public.current_user_role() IN ('admin', 'manager')
  );

-- ============================================================================
-- SUPPLIERS
-- ============================================================================
DROP POLICY IF EXISTS "Users can read own supermarket suppliers" ON public.suppliers;
CREATE POLICY "Users can read own supermarket suppliers" ON public.suppliers
  FOR SELECT
  USING (
    supermarket_id IS NULL
    OR supermarket_id = public.current_user_supermarket_id()
  );

DROP POLICY IF EXISTS "Suppliers can insert own application" ON public.suppliers;
CREATE POLICY "Suppliers can insert own application" ON public.suppliers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.id = suppliers.user_id
    )
  );
-- Note: left as-is intentionally — this subquery is on suppliers' own policy
-- referencing users by a different key (user_id, not auth_id-to-self), and
-- does not create a cycle back into this same policy.

DROP POLICY IF EXISTS "Admins can update own supermarket suppliers" ON public.suppliers;
CREATE POLICY "Admins can update own supermarket suppliers" ON public.suppliers
  FOR UPDATE
  USING (
    supermarket_id IS NULL
    OR (supermarket_id = public.current_user_supermarket_id() AND public.current_user_role() = 'admin')
  );

-- ============================================================================
-- VERIFY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Recursive users-table policies replaced with SECURITY DEFINER lookups.';
  RAISE NOTICE '✅ Test with: SELECT * FROM public.users LIMIT 1;';
END $$;
