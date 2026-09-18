-- ============================================================================
-- SENDER AVATAR ON CROSS-APP CHAT + COMMUNITY BOARD — Run ONCE in Supabase
-- SQL Editor
-- ============================================================================
-- Adds sender_avatar_url to chat_messages and landing_messages (see
-- ADD_CROSS_APP_CHAT.sql / CREATE_LANDING_MESSAGES_BOARD.sql), denormalized
-- onto the message row at send time exactly like sender_name already is —
-- no join needed to render it, and it keeps working for guests (who have no
-- profile row to join against at all).
--
-- Each app writes whatever its own profile table already has:
--   - mybodaguy (mbg_user_profiles.avatar_url) and digital-city-era
--     (users.avatar_url) store a plain public Supabase Storage URL, so it
--     renders everywhere with a bare <img src>.
--   - ICAN (profiles.avatar_url) stores an r2:// key (see r2StorageService.js)
--     — written here AS-IS, not resolved to a real URL, because a resolved
--     presigned URL would go stale (it expires) the moment it's baked into
--     a permanently-stored row. Only ICAN's own frontend can turn r2://...
--     into something paintable (resolveMediaValues), so mybodaguy/digital-
--     city-era just detect and skip that prefix, falling back to their
--     initials avatar the same way they already do for a poster with no
--     avatar at all — a message from an ICAN user never breaks another
--     app's chat, it just shows initials there instead of a photo.
--
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS sender_avatar_url TEXT;

ALTER TABLE public.landing_messages
  ADD COLUMN IF NOT EXISTS sender_avatar_url TEXT;

DO $$
BEGIN
  RAISE NOTICE '✅ chat_messages + landing_messages store sender_avatar_url.';
END $$;
