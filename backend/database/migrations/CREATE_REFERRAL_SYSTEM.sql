-- =========================================
-- CUSTOMER REFERRAL SYSTEM
-- Backs the "Refer Friends" feature in the customer portal with real,
-- persisted data instead of the hardcoded FAREDEAL2024 / 3-friends demo
-- values that used to live in CustomerDashboard.jsx.
--
-- Run this in the Supabase SQL editor (or via a service-role migration
-- runner) against the project referenced in backend/.env.unified.
-- =========================================

-- Each user gets one durable referral code, and (optionally) remembers
-- whose code they signed up with.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON public.users (referral_code)
  WHERE referral_code IS NOT NULL;

-- =========================================
-- REFERRALS TABLE
-- One row per successful referral: referred_id is UNIQUE so a given
-- person can only ever credit one referrer, no matter how many times
-- applyReferral() runs.
-- =========================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON public.referrals(referral_code);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- A user can see referrals where they are the referrer (their "Friends
-- Referred" list) — matching the id-or-auth_id pattern used elsewhere
-- (e.g. ADD_PHARMACY_FLEXIBLE_INVENTORY.sql) since public.users.id is not
-- always the same as auth.uid().
DROP POLICY IF EXISTS "Users can read their own referrals" ON public.referrals;
CREATE POLICY "Users can read their own referrals"
ON public.referrals FOR SELECT
TO authenticated
USING (
  referrer_id IN (SELECT id FROM public.users WHERE id = auth.uid() OR auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- The newly-referred person is the one who "redeems" a code after signing
-- in for the first time, so the insert is keyed off their own identity.
DROP POLICY IF EXISTS "Users can record a referral for themselves" ON public.referrals;
CREATE POLICY "Users can record a referral for themselves"
ON public.referrals FOR INSERT
TO authenticated
WITH CHECK (
  referred_id IN (SELECT id FROM public.users WHERE id = auth.uid() OR auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Admin can manage all referrals" ON public.referrals;
CREATE POLICY "Admin can manage all referrals"
ON public.referrals FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Let a signed-in user set their own referral_code / referred_by_code
-- (the users table's existing UPDATE policy, if any, may already cover
-- this — this one is scoped tightly to just those two columns' intent).
DROP POLICY IF EXISTS "Users can set their own referral fields" ON public.users;
CREATE POLICY "Users can set their own referral fields"
ON public.users FOR UPDATE
TO authenticated
USING (id = auth.uid() OR auth_id = auth.uid())
WITH CHECK (id = auth.uid() OR auth_id = auth.uid());
