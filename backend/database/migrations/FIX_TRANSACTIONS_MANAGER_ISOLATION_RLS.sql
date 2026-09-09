-- ============================================================================
-- TRANSACTIONS: MANAGER-TIER READ ISOLATION
-- Admin:   sees all transactions in their supermarket (unchanged).
-- Manager: sees only transactions whose cashier belongs to a cashier they
--          manage (users.manager_id = them).
-- Cashier: sees only their own transactions.
-- Deliberately does NOT add a manager_id column to transactions — resolves
-- ownership via a subquery against public.users.manager_id instead, so no
-- backfill is required on this table.
-- Requires ADD_MANAGER_ID_TO_USERS.sql to have been run first.
-- Replaces the policy created in FIX_SUPERMARKET_ISOLATION_V2.sql.
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own supermarket transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tiered transaction read access" ON public.transactions;

CREATE POLICY "Tiered transaction read access" ON public.transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
        AND u.role = 'admin'
        AND u.supermarket_id = transactions.supermarket_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users mgr
      WHERE (mgr.id = auth.uid() OR mgr.auth_id = auth.uid())
        AND mgr.role = 'manager'
        AND mgr.supermarket_id = transactions.supermarket_id
        AND transactions.cashier_id IN (
          SELECT c.id FROM public.users c WHERE c.manager_id = mgr.id
        )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users self
      WHERE (self.id = auth.uid() OR self.auth_id = auth.uid())
        AND self.id = transactions.cashier_id
    )
  );
