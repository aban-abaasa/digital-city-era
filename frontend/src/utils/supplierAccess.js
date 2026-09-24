import { supabase } from '../services/supabase';

// Roles whose own users row may be used as a supplier identity. A dedicated
// 'supplier' account always can; an admin can opt in to supplying from their
// own account (their orders, catalog and payouts hang off their own ids, so
// no second account is needed); a manager can when their store is a
// supply-enabled one (wholesale/hardware/factory). Every supplier query is
// already scoped to the signed-in user's own id, so widening the role filter
// never exposes anyone else's row.
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
    .select('id, role, supermarket_id')
    .or(`auth_id.eq.${session.user.id},id.eq.${session.user.id}`)
    .maybeSingle();

  const role = userRow?.role?.toLowerCase() || null;
  let canSupply = false;

  if (role === 'supplier' || role === 'admin') {
    canSupply = true;
  } else if (role === 'manager') {
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
  if (canSupply && !isSetUp && userRow?.id) {
    const { data: supplierRow } = await supabase
      .from('suppliers')
      .select('id')
      .eq('user_id', userRow.id)
      .limit(1)
      .maybeSingle();
    isSetUp = Boolean(supplierRow);
  }

  return { role, canSupply, isSetUp };
};
