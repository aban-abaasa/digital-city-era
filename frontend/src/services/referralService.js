/**
 * Referral Service — digital-city-era customer portal
 * Talks to the REAL Supabase project (./supabase), not the mocked
 * supabaseClient.jsx used by apiService/customerService/loyaltyService.
 * Backed by backend/database/migrations/CREATE_REFERRAL_SYSTEM.sql
 * (public.users.referral_code / referred_by_code + public.referrals).
 */

import { supabase } from './supabase';

const PENDING_REF_KEY = 'pending_referral_code';
const REWARD_POINTS = 100;

// Resolves the signed-in auth user to their row in public.users (the same
// id-or-auth_id lookup CustomerDashboard already uses for staffRole) and
// says *why* when that fails, instead of collapsing every failure mode
// into a single misleading "not signed in".
//
// status is one of:
//   'no-session'      — no real Supabase auth session at all
//   'no-account-row'  — signed in, but auth.uid() has no matching row in
//                        public.users, so there's nothing to attach a
//                        referral code to yet
//   'error'           — the lookup itself failed (network, RLS, etc.)
//   'ok'              — userRow is populated
export async function diagnoseAvailability() {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  if (authError || !authUser) return { status: 'no-session' };

  // Deliberately not .single()/.maybeSingle(): this codebase has a known
  // history of accounts with more than one public.users row matching the
  // same auth identity (see backend/link-*-auth.js, FIX_RLS_USER_CREATION.sql
  // etc. — auth linking has needed manual patching before). Either of
  // those throws "multiple (or no) rows returned" the moment that happens,
  // which is exactly what surfaced as a generic error here. Fetching as a
  // plain array lets us pick the best match instead of hard-failing.
  const { data: rows, error } = await supabase
    .from('users')
    .select('id, auth_id, full_name, email, referral_code, referred_by_code, created_at')
    .or(`auth_id.eq.${authUser.id},id.eq.${authUser.id}`);

  if (error) {
    console.error('[referralService] users lookup failed:', error);
    return { status: 'error', message: error.message };
  }
  if (!rows || rows.length === 0) {
    console.warn(
      '[referralService] Signed in as', authUser.email || authUser.id,
      'but found no matching public.users row (auth.uid() =', authUser.id, ') —',
      'this account can\'t get a referral code until it has a users row.'
    );
    return { status: 'no-account-row', authEmail: authUser.email };
  }

  let data = rows[0];
  if (rows.length > 1) {
    // Prefer the row explicitly linked via auth_id over one that only
    // happens to match on id — that's the authoritative link once an
    // account has been through the auth-linking fix scripts.
    data = rows.find(r => r.auth_id === authUser.id) || rows[0];
    console.warn(
      `[referralService] ${rows.length} public.users rows matched auth.uid() = ${authUser.id}`,
      '(ids:', rows.map(r => r.id).join(', ') + ') — using', data.id,
      '. This account has a duplicate/unlinked users row that should be cleaned up.'
    );
  }

  return { status: 'ok', userRow: data };
}

// Convenience wrapper for the call sites below that only care about the
// row (or its absence) — diagnoseAvailability() is the one to use for
// anything that needs to explain *why* to the person looking at the UI.
export async function getCurrentUserRow() {
  const result = await diagnoseAvailability();
  return result.status === 'ok' ? result.userRow : null;
}

function slugify(userRow) {
  const firstName = (userRow.full_name || '').trim().split(/\s+/)[0] || '';
  const base = (firstName || userRow.email || 'friend')
    .toString()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 6) || 'FRIEND';
  return base;
}

function randomSuffix() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Fetch this user's referral code, generating and persisting one on first
// use. Retries on a unique-constraint collision instead of trusting a
// single random guess to be free.
export async function getOrCreateReferralCode() {
  const userRow = await getCurrentUserRow();
  if (!userRow) return null;
  if (userRow.referral_code) return userRow.referral_code;

  const base = slugify(userRow);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}${randomSuffix()}`;
    const { data, error } = await supabase
      .from('users')
      .update({ referral_code: candidate })
      .eq('id', userRow.id)
      .select('referral_code')
      .single();

    if (!error) return data.referral_code;
    // 23505 = unique_violation — someone already holds this code, retry.
    if (error.code !== '23505') throw error;
  }

  throw new Error('Could not generate a unique referral code — please try again.');
}

// Friends referred + points earned, computed straight from the referrals
// table rather than a separately-maintained counter.
export async function getReferralStats() {
  const userRow = await getCurrentUserRow();
  if (!userRow) return { friendsReferred: 0, pointsEarned: 0 };

  const { data, error } = await supabase
    .from('referrals')
    .select('points_awarded')
    .eq('referrer_id', userRow.id);

  if (error) throw error;

  const friendsReferred = data?.length || 0;
  const pointsEarned = (data || []).reduce((sum, r) => sum + (r.points_awarded || 0), 0);
  return { friendsReferred, pointsEarned };
}

// Called by the landing page / registration flow whenever a ?ref=CODE
// link is visited — just remembers the code until someone is actually
// signed in to redeem it.
export function rememberPendingReferralCode(code) {
  if (!code) return;
  try {
    localStorage.setItem(PENDING_REF_KEY, JSON.stringify({ code, savedAt: Date.now() }));
  } catch {
    // Storage unavailable (private mode, etc.) — referral capture is
    // best-effort, never block the page over it.
  }
}

// Applies a stored referral code to the now-signed-in user, awarding the
// referrer 100 points. Safe to call on every dashboard load: it's a no-op
// once the user already has a referred_by_code, once the pending code has
// expired, or once nothing is pending at all.
export async function consumePendingReferralCode() {
  let pending;
  try {
    const raw = localStorage.getItem(PENDING_REF_KEY);
    pending = raw ? JSON.parse(raw) : null;
  } catch {
    pending = null;
  }
  if (!pending?.code) return null;

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const expired = Date.now() - (pending.savedAt || 0) > THIRTY_DAYS_MS;
  if (expired) {
    localStorage.removeItem(PENDING_REF_KEY);
    return null;
  }

  const userRow = await getCurrentUserRow();
  if (!userRow) return null; // not signed in yet — keep the code pending

  // Already used a code (this one or another) — nothing left to do.
  if (userRow.referred_by_code) {
    localStorage.removeItem(PENDING_REF_KEY);
    return null;
  }

  const code = pending.code.trim().toUpperCase();
  if (userRow.referral_code === code) {
    // Can't refer yourself.
    localStorage.removeItem(PENDING_REF_KEY);
    return null;
  }

  const { data: referrer, error: referrerError } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('referral_code', code)
    .maybeSingle();

  if (referrerError || !referrer) {
    localStorage.removeItem(PENDING_REF_KEY);
    return null;
  }

  const { error: insertError } = await supabase
    .from('referrals')
    .insert({
      referrer_id: referrer.id,
      referred_id: userRow.id,
      referral_code: code,
      points_awarded: REWARD_POINTS
    });

  // 23505 here means this account already redeemed a code in a race with
  // another tab/request — treat it the same as "nothing to do".
  if (insertError && insertError.code !== '23505') throw insertError;

  await supabase
    .from('users')
    .update({ referred_by_code: code })
    .eq('id', userRow.id);

  localStorage.removeItem(PENDING_REF_KEY);
  const referrerFirstName = (referrer.full_name || '').trim().split(/\s+/)[0];
  return insertError ? null : { referrerName: referrerFirstName || 'your friend' };
}

export const referralService = {
  diagnoseAvailability,
  getCurrentUserRow,
  getOrCreateReferralCode,
  getReferralStats,
  rememberPendingReferralCode,
  consumePendingReferralCode,
  REWARD_POINTS
};

export default referralService;
