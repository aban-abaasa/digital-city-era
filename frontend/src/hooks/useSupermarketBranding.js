import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

const FALLBACK_NAME = 'Your Supermarket';

// Mirrors the business_type CHECK constraint on supermarkets
// (ADD_BUSINESS_TYPE_TO_SUPERMARKETS.sql) — just display info, every
// business type otherwise reuses the exact same portal/product plumbing.
const BUSINESS_TYPE_META = {
  supermarket:     { emoji: '🏪', label: 'Supermarket',        itemsLabel: 'Products' },
  hotel:           { emoji: '🏨', label: 'Hotel',               itemsLabel: 'Rooms & Services' },
  boutique:        { emoji: '👗', label: 'Boutique',            itemsLabel: 'Items' },
  restaurant_cafe: { emoji: '🍽️', label: 'Restaurant & Café',   itemsLabel: 'Menu' },
};

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
        .select('id, name, background_image_url, business_type')
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

  const businessType = supermarket?.business_type || 'supermarket';
  const typeMeta = BUSINESS_TYPE_META[businessType] || BUSINESS_TYPE_META.supermarket;

  return {
    name: supermarket?.name || FALLBACK_NAME,
    backgroundUrl: supermarket?.background_image_url || null,
    supermarketId: supermarket?.id || null,
    businessType,
    typeEmoji: typeMeta.emoji,
    typeLabel: typeMeta.label,
    itemsLabel: typeMeta.itemsLabel,
    loading,
    refresh: load
  };
};

export default useSupermarketBranding;
