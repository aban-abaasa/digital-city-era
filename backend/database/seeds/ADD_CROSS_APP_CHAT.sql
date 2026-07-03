-- ============================================================================
-- CROSS-APP PRIVATE SUPPORT CHAT — Run ONCE in Supabase SQL Editor
-- ============================================================================
-- Makes chat_conversations/chat_messages (built for digital-city-era's
-- floating ChatWidget in CREATE_CHAT_SUPPORT_SYSTEM.sql / ADD_CHAT_TEAM_
-- CHANNEL.sql) usable by FARM-AGENT, ICAN, and mybodaguy's own floating
-- widgets too — same shared Supabase project, same open-RLS convention
-- those tables already use (privacy relies on the conversation id being an
-- unguessable UUID, not on RLS — documented in CREATE_CHAT_SUPPORT_SYSTEM.sql).
--
-- Four changes:
--   1. origin_app tags which app a conversation came from (mirrors
--      landing_messages.origin_app), so every app's dev-panel inbox can
--      show/filter where a conversation started.
--   2. portal's CHECK constraint is dropped — it was hardcoded to digital-
--      city-era's portal names (landing/customer/cashier/manager/supplier/
--      admin). FARM-AGENT/ICAN/mybodaguy have different vocabularies
--      (farmer, rider, chairperson, etc.); portal becomes free text,
--      purely descriptive, badge-rendered with a neutral fallback style
--      for values a given dev panel doesn't recognize.
--   3. user_id's foreign key is dropped — it currently points at
--      public.users(id), digital-city-era's OWN local profile table.
--      FARM-AGENT/ICAN/mybodaguy each have their own separate
--      profile/users table (not public.users), so inserting one of their
--      ids here would violate that FK. These tables already don't
--      strictly type-enforce identity elsewhere (RLS is fully open,
--      supermarket_id/portal are just descriptive per-app fields) — this
--      makes user_id consistent with that: still a UUID, no cross-table
--      guarantee, each app stores whatever locally-meaningful id it uses
--      (digital-city-era keeps using its local public.users.id unchanged;
--      nothing about its existing behavior changes).
--   4. chat_messages.sender_role's CHECK constraint is dropped — same
--      class of bug as #2, just missed the first time. It was hardcoded to
--      (guest,customer,cashier,manager,supplier,admin,dev), so any other
--      app's real role value (e.g. FARM-AGENT/ICAN's 'user', mybodaguy's
--      'rider'/'chairperson'/'developer') got rejected with a 400 the
--      moment someone actually tried to send a support message. sender_role
--      becomes free text; the dev-panel badge styling already falls back
--      gracefully for values it doesn't recognize (same as origin_app).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. origin_app — ALTER ... ADD COLUMN IF NOT EXISTS, not folded into a
--    CREATE TABLE IF NOT EXISTS anywhere (that exact mistake already bit
--    landing_messages once — CREATE TABLE IF NOT EXISTS silently no-ops
--    on a pre-existing table and never adds new columns retroactively).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS origin_app TEXT NOT NULL DEFAULT 'digital-city-era'
    CHECK (origin_app IN ('ican','digital-city-era','farm-agent','mybodaguy'));

CREATE INDEX IF NOT EXISTS idx_chat_conversations_origin_app ON public.chat_conversations(origin_app);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop portal's CHECK constraint (whatever Postgres auto-named it) —
--    dynamically located so this doesn't depend on guessing the exact
--    system-generated constraint name.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'public.chat_conversations'::regclass
      AND c.contype = 'c'
      AND a.attname = 'portal'
  LOOP
    EXECUTE format('ALTER TABLE public.chat_conversations DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Drop user_id's foreign key to public.users(id) — see note above.
--    Located dynamically the same way as the portal CHECK.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'public.chat_conversations'::regclass
      AND c.contype = 'f'
      AND a.attname = 'user_id'
  LOOP
    EXECUTE format('ALTER TABLE public.chat_conversations DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Drop chat_messages.sender_role's CHECK constraint — same reasoning
--    and technique as #2, just on the other table.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'public.chat_messages'::regclass
      AND c.contype = 'c'
      AND a.attname = 'sender_role'
  LOOP
    EXECUTE format('ALTER TABLE public.chat_messages DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;


DO $$
BEGIN
  RAISE NOTICE '✅ chat_conversations/chat_messages are cross-app ready (origin_app added, portal + sender_role free-text, user_id FK dropped).';
END $$;
