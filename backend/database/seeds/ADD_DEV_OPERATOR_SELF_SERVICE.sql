-- ============================================================================
-- ADD DEV OPERATOR SELF-SERVICE — Run ONCE in Supabase SQL Editor, AFTER
-- SECURE_DEV_PANEL_ACCESS.sql (this depends on public.dev_operators and
-- public.is_dev_operator() from that migration).
-- ============================================================================
-- Until now, public.dev_operators could only be edited by re-running SQL by
-- hand. This adds a self-service RPC so any existing dev operator can grant
-- dev-panel access to another account without needing DB access — wired to
-- a small "Operators" control in DevPanel.jsx's System tab.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_dev_operator(new_email TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF new_email IS NULL OR trim(new_email) = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;

  INSERT INTO public.dev_operators (email)
  VALUES (lower(trim(new_email)))
  ON CONFLICT (email) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_dev_operator(TEXT) TO authenticated;


-- Seed supermatkera@gmail.com as a dev operator (production dev-panel
-- account for the supermarkera side of the ecosystem, alongside
-- agrobone0@gmail.com from SECURE_DEV_PANEL_ACCESS.sql). Run
-- CREATE_SUPERMARTKERA_DEV_USER.sql first so the auth account exists.
INSERT INTO public.dev_operators (email) VALUES
  ('supermatkera@gmail.com')
ON CONFLICT (email) DO NOTHING;
