-- ============================================================================
-- CHAT: TEAM CHANNEL — Run ONCE in Supabase SQL Editor (after
-- CREATE_CHAT_SUPPORT_SYSTEM.sql)
-- ============================================================================
-- Adds a second channel to the chat widget: alongside "Support" (talks to
-- the Dev Panel), staff now get "My Store Team" — one shared conversation
-- per supermarket where admins/managers/cashiers/suppliers linked to that
-- store can talk to each other. Reuses the existing chat_conversations /
-- chat_messages tables; a `kind` column tells them apart.
-- ============================================================================

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'support';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public' AND table_name = 'chat_conversations' AND constraint_name = 'chat_conversations_kind_check'
  ) THEN
    ALTER TABLE public.chat_conversations
      ADD CONSTRAINT chat_conversations_kind_check CHECK (kind IN ('support', 'team'));
  END IF;
END $$;

-- One team conversation per supermarket — lets the widget "get or create"
-- the room without ever creating duplicates under concurrent first-opens.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_team_unique
  ON public.chat_conversations (supermarket_id)
  WHERE kind = 'team';

DO $$
BEGIN
  RAISE NOTICE '✅ chat_conversations.kind ready — team channel enabled.';
END $$;
