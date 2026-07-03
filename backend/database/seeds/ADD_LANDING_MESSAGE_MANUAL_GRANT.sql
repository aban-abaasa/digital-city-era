-- ============================================================================
-- LANDING MESSAGE MANUAL ICAN GRANT — Run ONCE in Supabase SQL Editor
-- ============================================================================
-- Adds a general "grant ICAN to any poster" dev action on top of
-- ADD_LANDING_MESSAGE_REWARDS.sql (run that first) — independent of the
-- existing correct-answer/popular-message auto-rewards, for a developer to
-- award a custom amount to anyone who has posted on the community board.
-- Reuses credit_ican_earning() (same tithe/ledger path as every other
-- reward) and landing_messages_is_dev() (same cross-app dev authorization
-- as dev_reply_landing_message/dev_mark_correct_answer) — no new security
-- model, just a third dev action.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dev_grant_landing_bonus(
  dev_token      TEXT    DEFAULT NULL,
  target_user_id UUID    DEFAULT NULL,
  amount         NUMERIC DEFAULT NULL,
  note           TEXT    DEFAULT 'Developer bonus',
  source_app     TEXT    DEFAULT 'digital-city-era'
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.landing_messages_is_dev(dev_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;
  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'amount must be a positive number';
  END IF;

  RETURN public.credit_ican_earning(target_user_id, amount, source_app, note, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_grant_landing_bonus(TEXT, UUID, NUMERIC, TEXT, TEXT) TO anon, authenticated;


DO $$
BEGIN
  RAISE NOTICE '✅ dev_grant_landing_bonus ready — developers can award a custom ICAN amount to any poster.';
END $$;
