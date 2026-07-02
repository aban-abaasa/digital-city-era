-- ============================================================================
-- LIVE CHAT / SUPPORT SYSTEM — Run ONCE in Supabase SQL Editor
-- ============================================================================
-- Powers the floating chat widget shown on the landing page and every portal
-- (customer, cashier, manager, supplier, admin) so anyone can message the
-- Supermartkera team directly, and the Dev Panel "Messages" tab where the
-- team reads/replies to every conversation.
--
-- Security note: like the rest of the dev-panel tooling in this project
-- (see DEV_PANEL_ACCESS.sql), the dev side has no real Supabase auth
-- session, and guests on the landing page have none either. RLS policies
-- below are intentionally open (anon + authenticated) the same way
-- `supermart_subscriptions` already is — privacy for guest threads relies
-- on the conversation id being an unguessable UUID, not on RLS. Do not
-- store anything more sensitive than a support enquiry in these tables.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CONVERSATIONS — one row per chat thread
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name            TEXT,
  guest_email           TEXT,
  user_id               UUID REFERENCES public.users(id) ON DELETE SET NULL,
  role                  TEXT NOT NULL DEFAULT 'guest',
  portal                TEXT NOT NULL DEFAULT 'landing'
                        CHECK (portal IN ('landing','customer','cashier','manager','supplier','admin')),
  supermarket_id        UUID REFERENCES public.supermarkets(id) ON DELETE SET NULL,
  subject               TEXT,
  status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  last_message_at       TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview  TEXT,
  unread_by_dev         BOOLEAN DEFAULT true,
  unread_by_user        BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON public.chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON public.chat_conversations(user_id);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_conversations_select" ON public.chat_conversations;
CREATE POLICY "chat_conversations_select" ON public.chat_conversations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "chat_conversations_insert" ON public.chat_conversations;
CREATE POLICY "chat_conversations_insert" ON public.chat_conversations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "chat_conversations_update" ON public.chat_conversations;
CREATE POLICY "chat_conversations_update" ON public.chat_conversations
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

GRANT ALL PRIVILEGES ON TABLE public.chat_conversations TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MESSAGES — individual chat bubbles inside a conversation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_role      TEXT NOT NULL DEFAULT 'guest'
                   CHECK (sender_role IN ('guest','customer','cashier','manager','supplier','admin','dev')),
  sender_name      TEXT,
  body             TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

GRANT ALL PRIVILEGES ON TABLE public.chat_messages TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Auto-bump the parent conversation whenever a message is inserted
--    (last_message_at / preview / unread flags), so the widget badge and
--    the Dev Panel inbox list stay correct without extra round-trips.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_touch_conversation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET
    last_message_at      = NEW.created_at,
    last_message_preview = LEFT(NEW.body, 140),
    unread_by_dev         = CASE WHEN NEW.sender_role = 'dev' THEN unread_by_dev  ELSE true  END,
    unread_by_user        = CASE WHEN NEW.sender_role = 'dev' THEN true            ELSE unread_by_user END,
    status                = 'open'
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_touch_conversation ON public.chat_messages;
CREATE TRIGGER trg_chat_touch_conversation
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_touch_conversation();


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Enable Realtime so the widget and Dev Panel inbox update live
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
  END IF;
END $$;


DO $$
BEGIN
  RAISE NOTICE '✅ chat_conversations + chat_messages ready, realtime enabled.';
END $$;
