-- ============================================================================
-- ADD SUPERMARKET LOGO: a dedicated logo/brand mark, separate from
-- background_image_url (see ADD_SUPERMARKET_BRANDING.sql). Shown in the
-- admin header next to the store name and printed on receipts (PDF/email),
-- shared across every portal for that supermarket via useSupermarketBranding.
-- ============================================================================

ALTER TABLE public.supermarkets
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

DO $$
BEGIN
  RAISE NOTICE '✅ supermarkets.logo_url ready — admins can upload a store logo from the Admin Portal header.';
END $$;
