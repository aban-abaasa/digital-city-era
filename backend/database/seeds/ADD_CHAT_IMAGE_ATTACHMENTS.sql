-- ============================================================================
-- IMAGE ATTACHMENTS FOR CROSS-APP CHAT + COMMUNITY BOARD — Run ONCE in
-- Supabase SQL Editor
-- ============================================================================
-- Adds a picture to a chat_messages row (support ChatWidget, every portal,
-- all 4 apps — see ADD_CROSS_APP_CHAT.sql) and to a landing_messages row
-- (the shared public Community board + the "Go Live" chat drawer built on
-- top of it — see CREATE_LANDING_MESSAGES_BOARD.sql). Both tables already
-- share one Supabase project across ICAN, digital-city-era, mybodaguy and
-- FARM-AGENT, so this one migration lights the feature up everywhere at
-- once — no per-app schema, no new backend/serverless function anywhere:
-- every app already has a working direct-to-Supabase-Storage upload
-- (AddProductModal/bookingService's `booking-uploads` bucket, mybodaguy's
-- avatarService/businessLogoService, ICAN's own storage.buckets usage) —
-- this just adds one more public bucket in that exact same shape, so each
-- app's chat composer can call `supabase.storage.from('chat-attachments')
-- .upload(...)` straight from the browser like those already do.
--
-- attachment_url stores a plain public Storage URL (not an r2:// key) on
-- purpose — every app can render it with a bare <img src>, no per-app
-- resolver/backend round-trip needed to view an attachment posted from a
-- different app. Keeps this in lockstep with how the rest of chat_messages/
-- landing_messages already works: open RLS, unguessable ids, zero server
-- involvement beyond Postgres + Storage.
--
-- Safe to run more than once.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columns — same three on both tables, all optional (a plain text
--    message keeps working exactly as before).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

ALTER TABLE public.landing_messages
  ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- chat_messages.body is NOT NULL (a message always has at least placeholder
-- text today); an attachment-only send still needs a body, so callers pass
-- an empty string. landing_messages.message is the same shape — no schema
-- change needed for either, just documented here so it isn't surprising.

-- field_type-style CHECK, added the same dynamically-located way the other
-- migrations in this file's family use, so a re-run doesn't error on an
-- already-applied constraint with an unpredictable auto-generated name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.chat_messages'::regclass
      AND conname = 'chat_messages_attachment_type_check'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_attachment_type_check
      CHECK (attachment_type IS NULL OR attachment_type = 'image');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.landing_messages'::regclass
      AND conname = 'landing_messages_attachment_type_check'
  ) THEN
    ALTER TABLE public.landing_messages
      ADD CONSTRAINT landing_messages_attachment_type_check
      CHECK (attachment_type IS NULL OR attachment_type = 'image');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Storage bucket — public, images only, 8MB cap. Mirrors booking-uploads
--    in ADD_SERVICE_BOOKING_FORMS.sql, except INSERT is open to anon too
--    (guests already post/reply in both chat_messages and landing_messages
--    without an account, same open-RLS convention those tables document).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-attachments', 'chat-attachments', true, 8388608, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 8388608,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;
CREATE POLICY "chat_attachments_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat_attachments_read" ON storage.objects;
CREATE POLICY "chat_attachments_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'chat-attachments');


DO $$
BEGIN
  RAISE NOTICE '✅ chat_messages + landing_messages accept image attachments; chat-attachments bucket ready.';
END $$;
