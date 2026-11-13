import { supabase } from './supabase';

export async function recordLocalCashSale(sale) {
  const { data, error } = await supabase.rpc('business_local_record_cash_sale', {
    p_sale: sale,
  });

  if (error) throw new Error(error.message || 'Could not save the cash sale on this business server.');
  if (!data?.success) throw new Error(data?.error || 'The business server did not save the sale.');
  return data;
}

export async function getLocalCashSales({ from, to, cashierId } = {}) {
  let query = supabase
    .from('business_local_cash_sales')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lt('created_at', to);
  if (cashierId) query = query.eq('cashier_id', cashierId);

  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Could not load local receipts.');
  return data || [];
}
