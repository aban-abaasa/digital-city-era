-- ============================================================================
-- FIX: "Could not find a relationship between 'users' and 'user_roles'" (PGRST200)
-- ============================================================================
-- CAUSE: RoleProtectedRoute.jsx (and other code) selects users with a nested
-- `user_roles(role)` embed, which requires PostgREST to see an actual
-- FOREIGN KEY from user_roles.user_id -> users.id in its schema cache. Either
-- user_roles doesn't exist yet, or it was created (by an earlier, partial
-- migration) without that FK — the auto-signup trigger can still INSERT into
-- a user_id column with no FK, so this can silently go unnoticed until a
-- nested-select query needs the relationship.
-- ============================================================================

-- Create it if it's missing entirely (canonical shape from
-- DEPLOYMENT_READY_20M_SUPERMARKETS.sql). No-op if it already exists.
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    supermarket_id UUID,
    permissions JSONB DEFAULT '{}',
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role, supermarket_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_supermarket_id ON public.user_roles(supermarket_id);

-- If the table already existed WITHOUT the foreign key, add it now — this
-- is the actual fix if you're hitting PGRST200 (table already present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'user_roles'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added missing FK: user_roles.user_id -> users.id';
  ELSE
    RAISE NOTICE '✓ user_roles.user_id foreign key already exists';
  END IF;
END $$;

-- RLS: users need to be able to read at least their own role row for the
-- nested select (users + user_roles) to return anything for them at all.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- Force PostgREST to pick up the new relationship immediately instead of
-- waiting for its periodic auto-refresh.
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ Done. Retry the sign-in — the nested user_roles(role) select should work now.';
END $$;
