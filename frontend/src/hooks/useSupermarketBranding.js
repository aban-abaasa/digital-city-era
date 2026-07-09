import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

const FALLBACK_NAME = 'Your Supermarket';

/**
 * Every portal (admin, manager, cashier, customer) for a given supermarket
 * should show that supermarket's own name and background — not a generic
 * hardcoded brand. This resolves the signed-in user's supermarket_id and
 * pulls the real record, so it auto-populates the moment an admin creates
 * their supermarket, with no manual re-typing on every portal.
 */
export const useSupermarketBranding = () => {
  const [supermarket, setSupermarket] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSupermarket(null);
        return;
      }

      // supermarket_id lives directly on users — rows link to auth either
      // via auth_id (older trigger) or by using auth.users.id as users.id
      // directly (newer trigger), so match either.
      const { data: userRow } = await supabase
        .from('users')
        .select('supermarket_id')
        .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      if (!userRow?.supermarket_id) {
        setSupermarket(null);
        return;
      }

      const { data: supermarketRow, error } = await supabase
        .from('supermarkets')
        .select('id, name, background_image_url')
        .eq('id', userRow.supermarket_id)
        .maybeSingle();

      if (error) throw error;
      setSupermarket(supermarketRow || null);
    } catch (error) {
      console.error('Error loading supermarket branding:', error);
      setSupermarket(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    name: supermarket?.name || FALLBACK_NAME,
    backgroundUrl: supermarket?.background_image_url || null,
    supermarketId: supermarket?.id || null,
    loading,
    refresh: load
  };
};

export default useSupermarketBranding;
