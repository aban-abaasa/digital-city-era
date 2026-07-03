/**
 * ICAN Wallet Service — digital-city-era (Supermarket POS)
 * Connects to the shared Supabase ICAN coin tables.
 * 1 ICAN = 5,000 UGX floor price.
 * 10% tithe is auto-deducted on all earnings via DB function.
 */

import { supabase } from './supabase';

export const ICAN_TO_UGX = 5000;
export const SOURCE_APP = 'digital-city-era';

// ─── Wallet ────────────────────────────────────────────────────────────────

export async function getOrCreateWallet(userId) {
  const { data, error } = await supabase.rpc('get_or_create_ican_wallet', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

export async function getWallet(userId) {
  const { data, error } = await supabase
    .from('ican_user_wallets')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getBalance(userId) {
  const wallet = await getWallet(userId);
  return {
    ican: wallet?.ican_balance ?? 0,
    ugx: (wallet?.ican_balance ?? 0) * ICAN_TO_UGX,
    address: wallet?.wallet_address ?? null,
    totalEarned: wallet?.total_earned ?? 0,
    totalSpent: wallet?.total_spent ?? 0,
    totalTithe: wallet?.total_tithe_paid ?? 0,
  };
}

// ─── Country-aware live pricing ─────────────────────────────────────────────

/**
 * Resolves the user's ICAN sign-up country (user_accounts.country_code) to
 * their local currency and live coin price via the shared pricing engine —
 * the same RPC IcanCoinBadge already uses. Falls back gracefully (UGX floor
 * price) if the RPC/tables aren't reachable, so the wallet always renders.
 */
export async function getUserWalletDisplay(userId) {
  try {
    const { data, error } = await supabase.rpc('ican_get_user_wallet_display', {
      p_user_id: userId,
    });
    if (error || !data?.[0]) return null;
    return data[0];
  } catch {
    return null;
  }
}

// ─── Transactions ──────────────────────────────────────────────────────────

export async function getTransactions(userId, limit = 30) {
  const { data, error } = await supabase
    .from('ican_coin_transactions')
    .select('*')
    .or(`sender_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((tx) => ({
    ...tx,
    direction: tx.recipient_user_id === userId ? 'in' : 'out',
    ugx_equivalent: tx.ican_amount * ICAN_TO_UGX,
  }));
}

// ─── Transfers ─────────────────────────────────────────────────────────────

/** Send ICAN from one user to another (10% tithe auto-deducted on recipient side). */
export async function sendICAN({ fromUserId, toUserId, amount, note = '', referenceId = null }) {
  const { data, error } = await supabase.rpc('transfer_ican', {
    p_from_user: fromUserId,
    p_to_user: toUserId,
    p_amount: amount,
    p_note: note,
    p_source_app: SOURCE_APP,
    p_reference_id: referenceId,
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error);
  return data;
}

// ─── Earnings (cashier receives payment in ICAN) ───────────────────────────

/**
 * Called when a customer pays a supermarket order with ICAN.
 * Debits customer, credits store cashier/account.
 */
export async function payWithICAN({ customerUserId, cashierUserId, icanAmount, orderId, note = '' }) {
  return sendICAN({
    fromUserId: customerUserId,
    toUserId: cashierUserId,
    amount: icanAmount,
    note: note || `Supermarket payment for order ${orderId}`,
    referenceId: orderId,
  });
}

/**
 * Credit ICAN cashback to a customer (1% of UGX purchase).
 * Uses the role-aware DB function dce_credit_cashback which enforces
 * the digital-city-era cashback rate and floor automatically.
 */
export async function creditCashback({ userId, ugxPurchaseAmount, orderId }) {
  const { data, error } = await supabase.rpc('dce_credit_cashback', {
    p_customer_user_id: userId,
    p_ugx_purchase: ugxPurchaseAmount,
    p_order_id: orderId ?? null,
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error ?? 'Cashback failed');
  return data;
}

/**
 * Admin/manager approves a supplier delivery and credits ICAN.
 * Enforces admin|manager role check inside the DB function.
 */
export async function creditSupplierDelivery({ supplierUserId, ugxValue, orderId }) {
  const { data, error } = await supabase.rpc('dce_credit_supplier_delivery', {
    p_supplier_user_id: supplierUserId,
    p_ugx_value: ugxValue,
    p_order_id: orderId ?? null,
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error ?? 'Supplier credit failed');
  return data;
}

// ─── Buy / Sell ────────────────────────────────────────────────────────────

/**
 * Buy ICAN coins — user pays UGX (notional), ICAN credited to wallet.
 * 1 ICAN = 5,000 UGX floor price. No tithe on purchases.
 */
export async function buyICAN({ userId, icanAmount, paymentRef = null }) {
  const { data, error } = await supabase.rpc('buy_ican_coins', {
    p_user_id: userId,
    p_ican_amount: icanAmount,
    p_source_app: SOURCE_APP,
    p_payment_ref: paymentRef,
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error ?? 'Buy failed');
  return data;
}

/**
 * Sell ICAN coins — ICAN debited, UGX payout handled offline by cashier/admin.
 */
export async function sellICAN({ userId, icanAmount, reference = null }) {
  const { data, error } = await supabase.rpc('sell_ican_coins', {
    p_user_id: userId,
    p_ican_amount: icanAmount,
    p_source_app: SOURCE_APP,
    p_reference: reference,
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error ?? 'Sell failed');
  return data;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Convert UGX to ICAN at floor price (rounds down to 8 dp). */
export function ugxToICAN(ugx) {
  return Math.floor((ugx / ICAN_TO_UGX) * 1e8) / 1e8;
}

/** Convert ICAN to UGX at floor price. */
export function icanToUGX(ican) {
  return ican * ICAN_TO_UGX;
}

/** Format ICAN with 4 decimal places for display. */
export function formatICAN(amount) {
  return Number(amount).toFixed(4);
}

/** 1% of purchase in ICAN (cashback incentive). */
export function calcCashback(ugxPurchaseAmount) {
  return ugxToICAN(ugxPurchaseAmount * 0.01);
}

export default {
  getOrCreateWallet,
  getWallet,
  getBalance,
  getUserWalletDisplay,
  getTransactions,
  sendICAN,
  payWithICAN,
  creditCashback,
  creditSupplierDelivery,
  buyICAN,
  sellICAN,
  ugxToICAN,
  icanToUGX,
  formatICAN,
  calcCashback,
  ICAN_TO_UGX,
  SOURCE_APP,
};
