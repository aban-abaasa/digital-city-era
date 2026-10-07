import { supabase } from './supabase';

// Supply requests raised from CMMS requisitions (see
// ICAN/backend/CMMS_REQUISITION_SUPPLIER_BIDS.sql). A supplier is a published
// business profile, so every call is scoped to that profile and authorised in
// the database (unified_business_member) -- these are thin RPC wrappers.

const unwrap = (data, error) => (error
  ? { success: false, error: error.message, data: [] }
  : { success: true, data: data || [] });

export const getOpenSupplyRequests = async (supplierBusinessProfileId) => {
  const { data, error } = await supabase.rpc('cmms_get_open_supply_requests', {
    p_supplier_business_profile_id: supplierBusinessProfileId,
  });
  return unwrap(data, error);
};

export const getMySupplierBids = async (supplierBusinessProfileId) => {
  const { data, error } = await supabase.rpc('cmms_get_my_supplier_bids', {
    p_supplier_business_profile_id: supplierBusinessProfileId,
  });
  return unwrap(data, error);
};

/** items: [{ opportunity_item_id, unit_price, notes? }] -- one per requested item. */
export const submitSupplierBid = async (opportunityId, supplierBusinessProfileId, { items, proposal, leadTimeDays, contact }) => {
  const { data, error } = await supabase.rpc('cmms_submit_supplier_bid', {
    p_opportunity_id: opportunityId,
    p_supplier_business_profile_id: supplierBusinessProfileId,
    p_items: items,
    p_proposal: proposal?.trim() || null,
    p_lead_time_days: leadTimeDays === '' || leadTimeDays == null ? null : Number(leadTimeDays),
    p_contact: contact?.trim() || null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
};

export const withdrawSupplierBid = async (bidId) => {
  const { error } = await supabase.rpc('cmms_withdraw_supplier_bid', { p_bid_id: bidId });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

/**
 * Whether this supplier business is published in the supplier directory.
 * Itemised supply bids are only accepted from published suppliers, so the
 * portal warns about it up front instead of failing on submit.
 * Returns true / false, or null when it cannot be told.
 */
export const getSupplierPublishedState = async (supplierBusinessProfileId) => {
  const { data, error } = await supabase
    .from('supplier_directory')
    .select('is_published')
    .eq('business_profile_id', supplierBusinessProfileId)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data ? !!data.is_published : false;
};

// General (non-itemised) opportunities: a single amount + proposal. Every
// signed-in user may read open opportunities (RLS), the buyer's name comes from
// the public per-opportunity function so no extra policy is needed.
export const getOpenGeneralOpportunities = async (limit = 20) => {
  const { data, error } = await supabase
    .from('cmms_business_opportunities')
    .select('id, title, description, budget_hint, deadline, created_at')
    .eq('status', 'open')
    .eq('opportunity_kind', 'general')
    .or(`deadline.is.null,deadline.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { success: false, error: error.message, data: [] };

  const rows = await Promise.all((data || []).map(async (opp) => {
    const { data: detail } = await supabase.rpc('fn_get_public_cmms_opportunity', { p_opportunity_id: opp.id });
    const row = Array.isArray(detail) ? detail[0] : detail;
    return { ...opp, company_name: row?.company_name || 'A business', delivery_location: row?.delivery_location || null };
  }));
  return { success: true, data: rows };
};

export const getMyGeneralBids = async () => {
  const { data, error } = await supabase.rpc('fn_get_my_opportunity_bids');
  return unwrap(data, error);
};

export const submitGeneralBid = async (opportunityId, { name, email, phone, amount, proposal }) => {
  const { data, error } = await supabase.rpc('fn_submit_public_opportunity_bid', {
    p_opportunity_id: opportunityId,
    p_bidder_name: name,
    p_bidder_email: email,
    p_bidder_phone: phone || null,
    p_amount: amount === '' || amount == null ? null : Number(amount),
    p_proposal: proposal,
  });
  if (error) {
    // The bids table allows one bid per bidder per opportunity.
    const duplicate = /uq_cmms_biz_bids|duplicate key/i.test(error.message || '');
    return { success: false, error: duplicate ? 'You have already placed a bid on this request.' : error.message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { success: true, referenceCode: row?.reference_code || null };
};

export default {
  getOpenSupplyRequests, getMySupplierBids, submitSupplierBid, withdrawSupplierBid,
  getSupplierPublishedState, getOpenGeneralOpportunities, getMyGeneralBids, submitGeneralBid,
};
