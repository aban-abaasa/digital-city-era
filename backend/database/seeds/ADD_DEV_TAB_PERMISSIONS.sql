-- ============================================================================
-- ADD DEV TAB PERMISSIONS — Run ONCE in Supabase SQL Editor, AFTER
-- ADD_DEV_OPERATOR_SELF_SERVICE.sql (depends on public.dev_operators and
-- public.is_dev_operator() from that migration and SECURE_DEV_PANEL_ACCESS.sql).
-- ============================================================================
-- Lets ONE main developer (supermatkera@gmail.com) control which DevPanel
-- tabs each other developer can see, instead of every operator seeing
-- everything. Regular operators (added via add_dev_operator) start locked
-- to no tabs until the main developer assigns some; the main developer
-- always sees every tab regardless of allowed_tabs.
--
-- allowed_tabs = NULL means "unrestricted / all tabs" — used for any
-- operator that existed before this migration, so nobody who already had
-- full access loses it silently.
-- ============================================================================

ALTER TABLE public.dev_operators ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.dev_operators ADD COLUMN IF NOT EXISTS allowed_tabs TEXT[] DEFAULT NULL;

UPDATE public.dev_operators SET is_main = true WHERE email = 'supermatkera@gmail.com';

-- New operators added from now on start locked out (empty tabs) until the
-- main developer grants some — existing rows are untouched by this DEFAULT
-- since it only applies to future inserts.
ALTER TABLE public.dev_operators ALTER COLUMN allowed_tabs SET DEFAULT '{}';

-- Re-point add_dev_operator so a genuinely NEW operator gets the locked-out
-- default above; re-adding an email that's already present (ON CONFLICT)
-- leaves their existing allowed_tabs/is_main untouched. Now also requires
-- the email to belong to a real, already-signed-up account — previously
-- this accepted any typed string, so a typo (or the wrong person's email)
-- would silently sit in the allowlist waiting for whoever eventually signs
-- up with that address, unnoticed.
--
-- Checks public.users, not auth.users directly — same table
-- dev_get_users()/AdminPortal.jsx's checkAdminAccess already read from.
-- auth.users lives in Supabase's internal auth schema and isn't reliably
-- selectable even from a SECURITY DEFINER function depending on project
-- config; public.users is the app-level mirror every signup already
-- writes to (see CREATE_AUTO_SIGNUP_TRIGGERS.sql) and is what the rest of
-- this dev panel already successfully queries.
CREATE OR REPLACE FUNCTION public.add_dev_operator(new_email TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_email TEXT := lower(trim(new_email));
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE lower(email) = normalized_email) THEN
    RAISE EXCEPTION 'No account with that email exists yet — they need to sign up first';
  END IF;

  INSERT INTO public.dev_operators (email, allowed_tabs)
  VALUES (normalized_email, '{}')
  ON CONFLICT (email) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_dev_operator(TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- dev_operator_self — the caller's own row, so DevPanel.jsx knows which
-- tabs to show without needing a separate "list everyone" permission.
-- Uses lower() on both sides of the email match (here and in every other
-- is_main check below) — dev_operators.email is always stored lowercase
-- (add_dev_operator normalizes it), but auth.email() reflects whatever
-- case the account's email happens to be stored as in auth.users, which
-- isn't guaranteed to be lowercase.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_operator_self()
RETURNS TABLE (email TEXT, is_main BOOLEAN, allowed_tabs TEXT[])
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT d.email, d.is_main, d.allowed_tabs
    FROM public.dev_operators d
    WHERE d.email = lower(auth.email());
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_operator_self() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- list_dev_operators — every operator's row, for the main developer's
-- management UI. Restricted to is_main, not just any operator.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_dev_operators()
RETURNS TABLE (email TEXT, is_main BOOLEAN, allowed_tabs TEXT[], added_at TIMESTAMPTZ)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.dev_operators WHERE email = lower(auth.email()) AND is_main = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT d.email, d.is_main, d.allowed_tabs, d.added_at
    FROM public.dev_operators d
    ORDER BY d.is_main DESC, d.added_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_dev_operators() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- set_dev_operator_tabs — main-developer-only. Pass tabs = NULL to grant
-- unrestricted (all tabs) access to that operator.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_dev_operator_tabs(target_email TEXT, tabs TEXT[])
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.dev_operators WHERE email = lower(auth.email()) AND is_main = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.dev_operators
    SET allowed_tabs = tabs
    WHERE email = lower(trim(target_email));
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_dev_operator_tabs(TEXT, TEXT[]) TO authenticated;
