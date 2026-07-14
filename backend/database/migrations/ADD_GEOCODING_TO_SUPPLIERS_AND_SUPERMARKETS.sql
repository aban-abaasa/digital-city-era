-- ============================================================================
-- ADD GEOCODING: suppliers/supermarkets have addresses but no lat/lng today,
-- which the new BodaGo vehicle-matching engine (mbg_find_available_vehicles)
-- needs to compute pickup/dropoff distance for automatic supplier-approval
-- -> truck dispatch (see mybodaguy/backend/database/CREATE_JOURNEY_BOOKING_ENGINE.sql
-- and frontend/src/services/deliveryDispatchService.js).
--
-- Nullable and additive only — stores without a geocoded address simply
-- can't be auto-dispatched yet (deliveryDispatchService.js skips them with
-- a clear message) rather than the whole approval flow being blocked.
-- ============================================================================

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

ALTER TABLE public.supermarkets
  ADD COLUMN IF NOT EXISTS latitude  DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

DO $$
BEGIN
  RAISE NOTICE '✅ suppliers/supermarkets now have optional latitude/longitude columns for auto-dispatch.';
END $$;
