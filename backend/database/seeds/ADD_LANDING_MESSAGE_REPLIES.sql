-- ============================================================================
-- LANDING MESSAGE REPLIES + CROSS-APP DEVELOPER MODERATION — Run ONCE
-- ============================================================================
-- Adds single-level threading and developer moderation on top of
-- CREATE_LANDING_MESSAGES_BOARD.sql (run that file first):
--   • Any visitor (guest or logged-in) can reply to a public top-level
--     message, under their own name. Replies can't have replies (parent
--     must itself be a top-level, public message) — keeps the board a
--     simple flat Q&A thread.
--   • The developer of ANY of the 4 apps can reply/delete/read every
--     message (public + private) through SECURITY DEFINER RPCs, since
--     each app identifies "the developer" differently:
--       - digital-city-era, FARM-AGENT, ICAN: a hidden hardcoded dev_token
--         (each app's own DEV_PANEL_ACCESS.sql / DevPanel.jsx constant).
--       - mybodaguy: no token — a real authenticated account with
--         mbg_users.role_type = 'developer'.
--     landing_messages_is_dev() checks both paths so every app's existing
--     developer surface can moderate this one shared board without a new
--     shared secret.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.landing_messages
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.landing_messages(id) ON DELETE CASCADE;

ALTER TABLE public.landing_messages
  ADD COLUMN IF NOT EXISTS sender_role TEXT NOT NULL DEFAULT 'guest'
    CHECK (sender_role IN ('guest','user','dev'));

CREATE INDEX IF NOT EXISTS idx_landing_messages_parent ON public.landing_messages(parent_id, created_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INSERT policy — top-level rule unchanged, plus a reply branch.
--    sender_role = 'dev' can only ever be written by the SECURITY DEFINER
--    RPC below (it bypasses RLS as table owner), never by a direct insert.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "landing_messages_insert" ON public.landing_messages;
CREATE POLICY "landing_messages_insert" ON public.landing_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    sender_role <> 'dev'
    AND (
      (
        parent_id IS NULL
        AND (
          (user_id IS NULL AND is_public = true)
          OR (
            user_id = auth.uid()
            AND (
              is_public = true
              OR EXISTS (
                SELECT 1 FROM public.ican_user_wallets w
                WHERE w.user_id = auth.uid() AND w.status = 'active'
              )
            )
          )
        )
      )
      OR (
        parent_id IS NOT NULL
        AND is_public = true
        AND (user_id IS NULL OR user_id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.landing_messages pm
          WHERE pm.id = parent_id AND pm.parent_id IS NULL AND pm.is_public = true
        )
      )
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. landing_messages_is_dev — shared authorization check for moderation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.landing_messages_is_dev(dev_token TEXT DEFAULT NULL)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF dev_token IN ('dev_Sup3rmarktera_KV25', 'dev_Farm_Ag3nt_KV25', 'dev_ICAN_Pr0_KV25') THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.mbg_users
    WHERE id = auth.uid() AND role_type = 'developer'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. dev_get_landing_messages — every message, public + private
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.dev_get_landing_messages(TEXT);

CREATE FUNCTION public.dev_get_landing_messages(dev_token TEXT DEFAULT NULL)
RETURNS TABLE (
  id          UUID,
  name        TEXT,
  email       TEXT,
  company     TEXT,
  message     TEXT,
  user_id     UUID,
  origin_app  TEXT,
  is_public   BOOLEAN,
  parent_id   UUID,
  sender_role TEXT,
  created_at  TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.landing_messages_is_dev(dev_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT m.id, m.name, m.email, m.company, m.message, m.user_id,
           m.origin_app, m.is_public, m.parent_id, m.sender_role, m.created_at
    FROM public.landing_messages m
    ORDER BY m.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_get_landing_messages(TEXT) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. dev_delete_landing_message — hard delete (cascades to replies)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_delete_landing_message(dev_token TEXT DEFAULT NULL, message_id UUID DEFAULT NULL)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.landing_messages_is_dev(dev_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  DELETE FROM public.landing_messages WHERE id = message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_delete_landing_message(TEXT, UUID) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. dev_reply_landing_message — developer reply, labeled per app
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_reply_landing_message(
  dev_token TEXT DEFAULT NULL,
  parent_id UUID DEFAULT NULL,
  body      TEXT DEFAULT NULL,
  team_name TEXT DEFAULT 'ICANERA Team'
)
RETURNS public.landing_messages
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
-- Without this, a bare `parent_id` inside the embedded SQL below is
-- ambiguous between the function parameter and landing_messages' own
-- parent_id column (default behavior is to error rather than guess).
-- use_variable makes plpgsql always prefer the parameter — the correct,
-- documented fix for this, unlike qualifying with a block label (which
-- Postgres does NOT substitute inside embedded SQL text; that was tried
-- and failed with "missing FROM-clause entry for table").
#variable_conflict use_variable
DECLARE
  result       public.landing_messages;
  parent_app   TEXT;
BEGIN
  IF NOT public.landing_messages_is_dev(dev_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT origin_app INTO parent_app FROM public.landing_messages WHERE id = parent_id;

  INSERT INTO public.landing_messages (parent_id, message, sender_role, name, is_public, origin_app)
  VALUES (parent_id, body, 'dev', team_name, true, COALESCE(parent_app, 'digital-city-era'))
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_reply_landing_message(TEXT, UUID, TEXT, TEXT) TO anon, authenticated;


DO $$
BEGIN
  RAISE NOTICE '✅ landing_messages replies + cross-app developer moderation ready.';
END $$;
