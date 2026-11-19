import { supabase, supabaseConfig } from './supabase';

let localStoreNamePromise = null;

export async function getLocalStoreName() {
  if (!supabaseConfig.localBusinessServer) return null;
  if (localStoreNamePromise) return localStoreNamePromise;

  localStoreNamePromise = supabase.rpc('business_local_get_store_profile').then(({ data, error }) => {
    if (error) throw new Error(error.message || 'Could not load this local server store name.');
    if (!data?.success) throw new Error(data?.error || 'Could not load this local server store name.');
    return String(data.storeName || '').trim() || 'Your Store';
  }).catch((error) => {
    localStoreNamePromise = null;
    throw error;
  });
  return localStoreNamePromise;
}
