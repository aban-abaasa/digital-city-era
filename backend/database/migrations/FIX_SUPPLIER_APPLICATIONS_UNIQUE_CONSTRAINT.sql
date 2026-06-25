-- FIX: Add missing unique constraint on supplier_applications for upsert ON CONFLICT

ALTER TABLE public.supplier_applications
  DROP CONSTRAINT IF EXISTS supplier_applications_supermarket_id_supplier_user_id_key;

ALTER TABLE public.supplier_applications
  ADD CONSTRAINT supplier_applications_supermarket_id_supplier_user_id_key
  UNIQUE (supermarket_id, supplier_user_id);
