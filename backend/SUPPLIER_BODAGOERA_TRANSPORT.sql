-- Keep BodaGoera available for every supplier order, including wholesale and
-- factory businesses that publish their own catalogues.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS transport_provider TEXT DEFAULT 'bodagoera',
  ADD COLUMN IF NOT EXISTS transport_status TEXT DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS transport_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bodago_delivery_request_id UUID,
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS pickup_longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS pickup_country TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS dropoff_longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS dropoff_country TEXT;

UPDATE public.purchase_orders
   SET transport_provider = COALESCE(transport_provider, 'bodagoera'),
       transport_status = COALESCE(transport_status, 'not_requested')
 WHERE transport_provider IS NULL OR transport_status IS NULL;

COMMENT ON COLUMN public.purchase_orders.transport_provider IS 'BodaGoera is the default transport provider for supplier cargo.';
