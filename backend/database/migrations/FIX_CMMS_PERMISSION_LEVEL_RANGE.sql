-- CMMS Pichin authority creates company-local roles at levels 100 (business
-- administrator) and 50 (imported business roles). Older CMMS setup scripts
-- constrained cmms_roles.permission_level to 1..10, which prevented the
-- first CMMS tenant from being provisioned for a Pichin business.
--
-- Keep legacy viewer roles at level 0 valid while allowing the current
-- business-authority hierarchy.

ALTER TABLE IF EXISTS public.cmms_roles
  DROP CONSTRAINT IF EXISTS valid_permission_level;

ALTER TABLE IF EXISTS public.cmms_roles
  ADD CONSTRAINT valid_permission_level
  CHECK (permission_level BETWEEN 0 AND 100);

NOTIFY pgrst, 'reload schema';
