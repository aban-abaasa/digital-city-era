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

export default { getOpenSupplyRequests, getMySupplierBids, submitSupplierBid, withdrawSupplierBid };
