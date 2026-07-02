-- ============================================================================
-- ADD SUPERMARKET BRANDING: name is already on supermarkets.name — this adds
-- a background image so each admin's portal (and their manager/cashier/
-- customer portals) can show their own look instead of generic branding.
-- ============================================================================

ALTER TABLE public.supermarkets
  ADD COLUMN IF NOT EXISTS background_image_url TEXT;

DO $$
BEGIN
  RAISE NOTICE '✅ supermarkets.background_image_url ready — admins can upload a portal background from their profile.';
END $$;
