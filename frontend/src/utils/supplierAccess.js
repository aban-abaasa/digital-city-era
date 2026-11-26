import { supabase } from '../services/supabase';

// Roles whose users rows can be used in the supplier portal. Supplier workers
// always can; admins can opt in to supplying; managers can enter when their
// store supports supply orders or supplier workers have been assigned to them.
export const SUPPLIER_CAPABLE_ROLES = ['supplier', 'admin', 'manager'];

export const SUPPLIER_PORTAL_ROUTE = '/supplier-portal';

/**
 * Resolve what the signed-in user may do with the supplier portal.
 *   canSupply       - may enter the supplier portal at all
 *   isSetUp         - already has a supplier business row (else "start supplying")
 * Returns null when nobody is signed in.
 */
export const getSupplierAccess = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: userRow } = await supabase
    .from('users')
    .select('id, auth_id, role, supermarket_id')
    .or(`auth_id.eq.${session.user.id},id.eq.${session.user.id}`)
    .maybeSingle();

  const role = userRow?.role?.toLowerCase() || null;
  let canSupply = role === 'supplier' || role === 'admin';
  let supplierMembership = null;
  let ownSupplierProfile = null;

  if (userRow?.id) {
    const [{ data: member }, { data: supplierProfile }] = await Promise.all([
      supabase.from('supplier_company_members')
        .select('id, company_supplier_id, role, manager_user_id')
        .eq('user_id', userRow.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(),
      supabase.from('suppliers').select('id')
        .in('user_id', [...new Set([userRow.id, userRow.auth_id, session.user.id].filter(Boolean))])
        .limit(1).maybeSingle()
    ]);
    supplierMembership = member;
    ownSupplierProfile = supplierProfile;
    if (supplierMembership || ownSupplierProfile) canSupply = true;
  }

  if (role === 'manager' && !canSupply) {
    if (!userRow.supermarket_id) {
      canSupply = true;
    } else {
      const { data: store } = await supabase
        .from('supermarkets')
        .select('supports_supply_orders')
        .eq('id', userRow.supermarket_id)
        .maybeSingle();
      canSupply = Boolean(store?.supports_supply_orders);
    }
  }

  let isSetUp = role === 'supplier';
  if (canSupply && !isSetUp) isSetUp = Boolean(ownSupplierProfile || supplierMembership);

  return { role, canSupply, isSetUp };
};
