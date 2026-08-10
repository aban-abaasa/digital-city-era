-- CMMS/Pichin supplier discovery is global. Wholesalers and hardware/material
-- businesses do not need a supermarket-by-supermarket approval application.
-- Run after ICAN's UNIFIED_BUSINESS_MANAGEMENT_AND_SUPPLIER_MARKETPLACE.sql.

INSERT INTO public.supplier_directory
  (business_profile_id, supplier_user_id, supplier_type, is_published, transport_enabled, transport_provider)
SELECT bp.id, bp.user_id,
  CASE
    WHEN lower(COALESCE(bp.business_type, '')) LIKE '%wholesale%' THEN 'wholesaler'
    WHEN lower(COALESCE(bp.business_type, '')) LIKE '%hardware%' THEN 'hardware'
    ELSE 'supplier'
  END,
  TRUE, TRUE, 'bodagoera'
FROM public.business_profiles bp
WHERE bp.user_id IS NOT NULL
  AND COALESCE(bp.status, 'active') = 'active'
  AND (
    lower(COALESCE(bp.business_type, '')) LIKE '%wholesale%'
    OR lower(COALESCE(bp.business_type, '')) LIKE '%supplier%'
    OR lower(COALESCE(bp.business_type, '')) LIKE '%factory%'
    OR lower(COALESCE(bp.business_type, '')) LIKE '%hardware%'
    OR lower(COALESCE(bp.business_type, '')) LIKE '%raw material%'
  )
ON CONFLICT (business_profile_id) DO UPDATE SET
  supplier_user_id = EXCLUDED.supplier_user_id,
  supplier_type = EXCLUDED.supplier_type,
  is_published = TRUE,
  transport_enabled = TRUE,
  transport_provider = 'bodagoera',
  updated_at = now();

CREATE OR REPLACE FUNCTION public.auto_publish_supplier_business_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_type TEXT := lower(COALESCE(NEW.business_type, ''));
BEGIN
  IF NEW.user_id IS NOT NULL AND COALESCE(NEW.status, 'active') = 'active'
     AND (v_type LIKE '%wholesale%' OR v_type LIKE '%supplier%' OR v_type LIKE '%factory%'
          OR v_type LIKE '%hardware%' OR v_type LIKE '%raw material%') THEN
    INSERT INTO public.supplier_directory
      (business_profile_id, supplier_user_id, supplier_type, is_published, transport_enabled, transport_provider)
    VALUES (NEW.id, NEW.user_id,
      CASE WHEN v_type LIKE '%wholesale%' THEN 'wholesaler' WHEN v_type LIKE '%hardware%' THEN 'hardware' ELSE 'supplier' END,
      TRUE, TRUE, 'bodagoera')
    ON CONFLICT (business_profile_id) DO UPDATE SET
      supplier_user_id = EXCLUDED.supplier_user_id,
      supplier_type = EXCLUDED.supplier_type,
      is_published = TRUE,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_publish_supplier_business_profile_trigger ON public.business_profiles;
CREATE TRIGGER auto_publish_supplier_business_profile_trigger
AFTER INSERT OR UPDATE OF business_type, status, user_id ON public.business_profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_publish_supplier_business_profile();
