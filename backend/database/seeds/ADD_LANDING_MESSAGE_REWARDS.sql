-- ============================================================================
-- LANDING MESSAGE REWARDS (correct answer + popular message) — Run ONCE
-- ============================================================================
-- Adds coin rewards on top of ADD_LANDING_MESSAGE_REPLIES.sql (run that first):
--   • A developer can mark a reply as the "correct answer" to a question —
--     the replier gets a fixed 1 ICAN reward.
--   • A message that collects 10 likes from real (non-guest) accounts
--     auto-rewards its author 1 ICAN, no developer action needed.
--   • Both paths require the recipient to have a real account (user_id set)
--     — guests can never be rewarded, they have no wallet to credit.
--   • Both paths route through the existing credit_ican_earning() function
--     (ICAN/backend/ICAN_CROSS_APP_WALLET_MIGRATION.sql) — the same
--     wallet-creation + 10% tithe + ledger logging every other ICAN reward
--     in this workspace already uses. No new balance/ledger logic here.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Reward tracking on landing_messages — idempotency guard so a message
--    is never rewarded twice, by either path.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.landing_messages
  ADD COLUMN IF NOT EXISTS rewarded_at TIMESTAMPTZ;

ALTER TABLE public.landing_messages
  ADD COLUMN IF NOT EXISTS reward_reason TEXT
    CHECK (reward_reason IN ('correct_answer', 'popular'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Reactions ("likes") — one per identity per message. Guests can like
--    (guest_key, a client-persisted UUID) but only real-account likes
--    (user_id set) count toward the popularity reward threshold below —
--    otherwise clearing localStorage would make the reward trivially
--    farmable. Guest likes still count in the *visible* counter.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.landing_message_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.landing_messages(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_key  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT landing_message_reactions_one_identity CHECK (
    (user_id IS NOT NULL AND guest_key IS NULL) OR (user_id IS NULL AND guest_key IS NOT NULL)
  ),
  UNIQUE (message_id, user_id),
  UNIQUE (message_id, guest_key)
);

CREATE INDEX IF NOT EXISTS idx_landing_message_reactions_message ON public.landing_message_reactions(message_id);

ALTER TABLE public.landing_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "landing_message_reactions_select" ON public.landing_message_reactions;
CREATE POLICY "landing_message_reactions_select" ON public.landing_message_reactions
  FOR SELECT TO anon, authenticated USING (true);

-- No spoofing another account's like; guests must supply a guest_key instead
-- of a user_id. Anti-dup enforcement is the UNIQUE constraints above.
DROP POLICY IF EXISTS "landing_message_reactions_insert" ON public.landing_message_reactions;
CREATE POLICY "landing_message_reactions_insert" ON public.landing_message_reactions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL AND guest_key IS NOT NULL)
    OR user_id = auth.uid()
  );

GRANT SELECT, INSERT ON TABLE public.landing_message_reactions TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'landing_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.landing_message_reactions;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. dev_mark_correct_answer — developer-only, fixed 1 ICAN reward
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_mark_correct_answer(
  dev_token TEXT DEFAULT NULL,
  reply_id  UUID DEFAULT NULL
)
RETURNS public.landing_messages
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
-- Same #variable_conflict fix already needed in dev_reply_landing_message —
-- applied here from the start so this function doesn't hit the identical
-- "ambiguous column" bug the first time someone calls it (reply_id vs any
-- future/aliased column of the same name).
#variable_conflict use_variable
DECLARE
  target public.landing_messages;
  result public.landing_messages;
BEGIN
  IF NOT public.landing_messages_is_dev(dev_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO target FROM public.landing_messages WHERE id = reply_id;

  IF target.id IS NULL THEN
    RAISE EXCEPTION 'message not found';
  END IF;
  IF target.parent_id IS NULL THEN
    RAISE EXCEPTION 'only a reply can be marked as the correct answer';
  END IF;
  IF target.rewarded_at IS NOT NULL THEN
    RAISE EXCEPTION 'already rewarded';
  END IF;
  IF target.user_id IS NULL THEN
    RAISE EXCEPTION 'guest replies have no wallet to reward';
  END IF;

  PERFORM public.credit_ican_earning(
    target.user_id,
    1.0,
    target.origin_app,
    'Correct answer reward on the community board',
    target.id::text
  );

  UPDATE public.landing_messages
  SET rewarded_at = NOW(), reward_reason = 'correct_answer'
  WHERE id = reply_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_mark_correct_answer(TEXT, UUID) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Popular-message auto-reward — trigger, not an RPC, so it can never be
--    invoked directly by a client (only ever fires from a real INSERT on
--    landing_message_reactions, itself already anti-spoof/anti-dup guarded).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.landing_messages_check_like_reward()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  msg        public.landing_messages;
  real_likes INTEGER;
BEGIN
  SELECT * INTO msg FROM public.landing_messages WHERE id = NEW.message_id;

  IF msg.id IS NULL OR msg.rewarded_at IS NOT NULL OR msg.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO real_likes
  FROM public.landing_message_reactions
  WHERE message_id = NEW.message_id AND user_id IS NOT NULL;

  IF real_likes >= 10 THEN
    PERFORM public.credit_ican_earning(
      msg.user_id,
      1.0,
      msg.origin_app,
      'Popular message reward (10+ likes) on the community board',
      msg.id::text
    );

    UPDATE public.landing_messages
    SET rewarded_at = NOW(), reward_reason = 'popular'
    WHERE id = NEW.message_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_landing_messages_like_reward ON public.landing_message_reactions;
CREATE TRIGGER trg_landing_messages_like_reward
  AFTER INSERT ON public.landing_message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.landing_messages_check_like_reward();


DO $$
BEGIN
  RAISE NOTICE '✅ landing_messages rewards ready (correct-answer RPC + popular-message trigger).';
END $$;
