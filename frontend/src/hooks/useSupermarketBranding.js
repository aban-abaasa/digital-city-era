import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import inventoryService from '../services/inventorySupabaseService';
import { getPublicBusinessPageUrl } from '../utils/publicBusinessUrl';

const FALLBACK_NAME = 'Your Supermarket';

// Mirrors the business_type CHECK constraint on supermarkets
// (ADD_BUSINESS_TYPE_TO_SUPERMARKETS.sql) — just display info, every
// business type otherwise reuses the exact same portal/product plumbing.
const BUSINESS_TYPE_META = {
  supermarket:     { emoji: '🏪', label: 'Supermarket',        itemsLabel: 'Products' },
  pharmacy:        { emoji: '💊', label: 'Pharmacy',           itemsLabel: 'Medicines & Products' },
  hotel:           { emoji: '🏨', label: 'Hotel',               itemsLabel: 'Rooms & Services' },
  boutique:        { emoji: '👗', label: 'Boutique',            itemsLabel: 'Items' },
  restaurant_cafe: { emoji: '🍽️', label: 'Restaurant & Café',   itemsLabel: 'Menu' },
  wholesale:       { emoji: '📦', label: 'Wholesale',             itemsLabel: 'Wholesale Products' },
  hardware:        { emoji: '🔧', label: 'Hardware',              itemsLabel: 'Hardware Products' },
  factory:         { emoji: '🏭', label: 'Factory / Manufacturing', itemsLabel: 'Manufactured Products' },
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
  const [publicWebsiteUrl, setPublicWebsiteUrl] = useState('');
  const [businessProfile, setBusinessProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSupermarket(null);
        setPublicWebsiteUrl(window.location.origin);
        return;
      }

      // supermarket_id lives directly on users — rows link to auth either
      // via auth_id (older trigger) or by using auth.users.id as users.id
      // directly (newer trigger), so match either.
      const supermarketId = await inventoryService.getCurrentSupermarketId();

      if (!supermarketId) {
        setSupermarket(null);
        setPublicWebsiteUrl(window.location.origin);
        return;
      }

      const { data: supermarketRow, error } = await supabase
        .from('supermarkets')
        .select('*')
        .eq('id', supermarketId)
        .maybeSingle();

      if (error) throw error;
      setSupermarket(supermarketRow || null);
      setBusinessProfile(null);

      // A linked CMMS public board is the store's website for jobs,
      // announcements and business information. Reuse the same public URL
      // on receipts so scans land on the store's real public presence.
      if (supermarketRow?.pichin_business_profile_id) {
        try {
          const { data: cmmsProfile } = await supabase
            .from('cmms_company_profiles')
            .select('*')
            .eq('pichin_business_profile_id', supermarketRow.pichin_business_profile_id)
            .maybeSingle();
          setBusinessProfile(cmmsProfile || null);
          setPublicWebsiteUrl(cmmsProfile?.id ? getPublicBusinessPageUrl(cmmsProfile.id) : (supermarketRow.website_url || supermarketRow.website || window.location.origin));
        } catch (error) {
          console.warn('Could not resolve the store public CMMS website:', error);
          setPublicWebsiteUrl(window.location.origin);
        }
      } else {
        setPublicWebsiteUrl(supermarketRow?.website_url || supermarketRow?.website || window.location.origin);
      }
    } catch (error) {
      console.error('Error loading supermarket branding:', error);
      setSupermarket(null);
      setPublicWebsiteUrl(window.location.origin);
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
    email: businessProfile?.contact_email || businessProfile?.email || supermarket?.support_email || supermarket?.email || '',
    phone: businessProfile?.contact_phone || businessProfile?.phone || supermarket?.phone || '',
    address: businessProfile?.address || businessProfile?.location || supermarket?.address || '',
    website: businessProfile?.website || businessProfile?.website_url || supermarket?.website_url || supermarket?.website || '',
    publicWebsiteUrl: publicWebsiteUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
    backgroundUrl: supermarket?.background_image_url || null,
    logoUrl: supermarket?.logo_url || null,
    supermarketId: supermarket?.id || null,
    pichinBusinessProfileId: supermarket?.pichin_business_profile_id || null,
    supportsSupplyOrders: Boolean(supermarket?.supports_supply_orders),
    canReceiveSupplierOrders: Boolean(supermarket?.can_receive_supplier_orders),
    canDispatchSupplierOrders: Boolean(supermarket?.can_dispatch_supplier_orders),
    businessType,
    typeEmoji: typeMeta.emoji,
    typeLabel: typeMeta.label,
    itemsLabel: typeMeta.itemsLabel,
    loading,
    refresh: load
  };
};

export default useSupermarketBranding;
