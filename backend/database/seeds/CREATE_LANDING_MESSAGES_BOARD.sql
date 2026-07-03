-- ============================================================================
-- CROSS-APP PUBLIC MESSAGE BOARD — Run ONCE in Supabase SQL Editor
-- ============================================================================
-- One shared board across all 4 apps in this workspace (ICAN, digital-city-era,
-- mybodaguy, FARM-AGENT) — they share this one Supabase project, so a message
-- posted from any app's landing page is visible on all of them, tagged by
-- `origin_app`. Powers each app's landing-page "Contact us"/Community board:
--   • Guests (no account) who post always go public — everyone can read them.
--   • A logged-in poster can choose public or private, but PRIVATE requires
--     an active ICAN wallet (public.ican_user_wallets) — a stronger identity
--     bar than a bare Supabase login, tying private posting to the same
--     cross-app wallet identity used for tithe/earnings.
--   • Only the developer can delete a message (dev_delete_landing_message,
--     added in ADD_LANDING_MESSAGE_REPLIES.sql), following the SECURITY
--     DEFINER + dev_token pattern in each app's own DEV_PANEL_ACCESS.sql.
--
-- Identity note: user_id references auth.users(id) directly (auth.uid()),
-- NOT any per-app local profile table — this is the one identity space
-- shared by all 4 apps (same as ican_user_wallets.user_id), so a message
-- posted from ICAN and one posted from Supermartkera under the same
-- Supabase login resolve to the same user_id.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.landing_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT,
  email      TEXT,
  company    TEXT,
  message    TEXT NOT NULL,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  origin_app TEXT NOT NULL DEFAULT 'digital-city-era' CHECK (origin_app IN ('ican','digital-city-era','farm-agent','mybodaguy')),
  is_public  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Self-healing for anyone who ran an earlier version of this file before
-- origin_app existed — CREATE TABLE IF NOT EXISTS is a no-op on a table
-- that's already there, so the column above never gets added retroactively
-- without this. Safe to re-run on a brand-new table too (IF NOT EXISTS).
ALTER TABLE public.landing_messages
  ADD COLUMN IF NOT EXISTS origin_app TEXT NOT NULL DEFAULT 'digital-city-era'
    CHECK (origin_app IN ('ican','digital-city-era','farm-agent','mybodaguy'));

CREATE INDEX IF NOT EXISTS idx_landing_messages_public ON public.landing_messages(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_messages_user ON public.landing_messages(user_id);

ALTER TABLE public.landing_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read public messages; a logged-in poster can also read their
-- own private ones. Private rows never appear to anyone else via this
-- policy — the developer reads everything through the SECURITY DEFINER
-- RPC in ADD_LANDING_MESSAGE_REPLIES.sql instead.
DROP POLICY IF EXISTS "landing_messages_select" ON public.landing_messages;
CREATE POLICY "landing_messages_select" ON public.landing_messages
  FOR SELECT TO anon, authenticated
  USING (
    is_public = true
    OR user_id = auth.uid()
  );

-- Guests (user_id IS NULL) can only ever insert public rows. A logged-in
-- poster (user_id = auth.uid(), no spoofing another user's id) can post
-- public freely, but private requires an active ICAN wallet — proof of a
-- real cross-app financial identity, not just a Supabase signup.
DROP POLICY IF EXISTS "landing_messages_insert" ON public.landing_messages;
CREATE POLICY "landing_messages_insert" ON public.landing_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
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
  );

-- No UPDATE/DELETE policy for anon/authenticated — deleting a message is a
-- developer-only action performed through dev_delete_landing_message.

GRANT SELECT, INSERT ON TABLE public.landing_messages TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Enable Realtime so every app's board/widget updates live
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'landing_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.landing_messages;
  END IF;
END $$;


DO $$
BEGIN
  RAISE NOTICE '✅ landing_messages ready (cross-app, wallet-gated privacy), realtime enabled.';
  RAISE NOTICE 'Next: run ADD_LANDING_MESSAGE_REPLIES.sql for threading + developer moderation.';
END $$;
