-- Record which store manager approved a purchase order.
-- Apply this migration to existing databases before using final quote approval.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.purchase_orders'::regclass
      AND conname = 'purchase_orders_approved_by_fkey'
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_approved_by_fkey
      FOREIGN KEY (approved_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
