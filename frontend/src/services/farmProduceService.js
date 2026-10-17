import { supabase } from './supabase';

// Farm produce offers: what farmers post in the AgriBone app (farm-agentera) in
// `farm_produce_offers`, with suppliers' "I'm interested" in `farm_produce_interests`.
// Both tables are created by farm-agentera/backend/db/schemas/farm/12_produce_offers.sql in
// the shared Supabase project. Who may read or write what is decided there by row-level
// security; these are thin wrappers that turn its refusals into plain words.

const OFFER_COLUMNS = [
  'id', 'farmer_id', 'farmer_name', 'contact_phone', 'crop', 'quantity', 'unit', 'price_per_unit',
  'region', 'sub_region', 'district', 'ready_date', 'is_organic', 'notes', 'status', 'expires_at', 'created_at',
].join(', ');

/** True when the SQL file has not been run in this Supabase project yet. */
export const isMissingTable = (error) =>
  error?.code === '42P01' || error?.code === 'PGRST205' || /schema cache|does not exist/i.test(error?.message || '');

/** The signed-in user's auth id (what row-level security compares against), or null. */
export const getAuthUserId = async () => {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
};

/** Every offer that is open right now, newest first. */
export const getOpenOffers = async () => {
  const { data, error } = await supabase
    .from('farm_produce_offers')
    .select(OFFER_COLUMNS)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return { success: false, data: [], error: error.message, missingTable: isMissingTable(error) };
  return { success: true, data: data || [], error: null, missingTable: false };
};

/**
 * The supplier's own catalog, trimmed to what matching an offer needs. Uses the same id the
 * My Catalog tab does, so the board sees exactly the items the supplier sees there.
 */
export const getCatalogForMatching = async (userId) => {
  if (!userId) return { success: true, data: [] };
  const { data, error } = await supabase
    .from('supplier_catalog_items')
    .select('id, name, unit, price_per_unit, is_available, stock_quantity, minimum_stock')
    .eq('supplier_user_id', userId);
  // The board still works without a catalog; it just has nothing to match against.
  if (error) return { success: false, data: [], error: error.message };
  return { success: true, data: data || [] };
};

/** offer_id -> { created_at, message } for every offer this supplier has shown interest in. */
export const getMyInterests = async () => {
  const uid = await getAuthUserId();
  if (!uid) return { success: true, data: {} };
  const { data, error } = await supabase
    .from('farm_produce_interests')
    .select('offer_id, message, created_at')
    .eq('supplier_user_id', uid);
  if (error) return { success: false, data: {}, error: error.message };
  return { success: true, data: Object.fromEntries((data || []).map((r) => [r.offer_id, r])) };
};

const interestError = (error) => {
  if (error.code === '23505') return 'You have already shown interest in this offer.';
  if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
    return 'This offer is no longer open, or your account is not set up as a supplier.';
  }
  return error.message || 'That did not go through. Please try again.';
};

/** Tell the farmer you are interested. `name` and `phone` are what the farmer will see. */
export const expressInterest = async (offerId, { name, phone, message }) => {
  const uid = await getAuthUserId();
  if (!uid) return { success: false, error: 'Please sign in again.' };
  const { error } = await supabase.from('farm_produce_interests').insert({
    offer_id: offerId,
    supplier_user_id: uid,
    supplier_name: String(name || '').trim().slice(0, 120) || 'A supplier',
    supplier_phone: String(phone || '').trim() || null,
    message: String(message || '').trim().slice(0, 300) || null,
  });
  if (error) return { success: false, error: interestError(error) };
  return { success: true };
};

export const withdrawInterest = async (offerId) => {
  const uid = await getAuthUserId();
  if (!uid) return { success: false, error: 'Please sign in again.' };
  const { error } = await supabase
    .from('farm_produce_interests')
    .delete()
    .eq('offer_id', offerId)
    .eq('supplier_user_id', uid);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

/**
 * Call `onChange(payload)` whenever any offer is added, changed or removed. Returns a function
 * that stops listening. If realtime is not switched on for the table nothing arrives and the
 * board simply relies on its refresh button.
 */
export const subscribeToOffers = (onChange) => {
  const channel = supabase
    .channel(`farm-produce-offers-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_produce_offers' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

export default {
  getOpenOffers, getCatalogForMatching, getMyInterests, expressInterest, withdrawInterest, subscribeToOffers, getAuthUserId, isMissingTable,
};
