-- =============================================================================
-- Migration: Create public.users
-- =============================================================================
-- Mirrors auth.users with business fields.
-- Same UUID as auth.users — no separate key.
-- Auto-populated by trigger on auth.users insert.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  -- Primary key matches auth.users.id exactly
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  full_name    TEXT,
  avatar_url   TEXT,
  phone        TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'inactive', 'suspended')),
  last_login_at TIMESTAMPTZ,
  -- Audit columns (required on every table)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id),
  deleted_by   UUID REFERENCES public.users(id),
  version      INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email     ON public.users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_status    ON public.users(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone     ON public.users(phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version    = OLD.version + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create public.users row when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Auto-update last_login_at when Supabase updates auth.users last_sign_in_at
CREATE OR REPLACE FUNCTION public.handle_auth_user_login()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE public.users
       SET last_login_at = NEW.last_sign_in_at
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_login();

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile (not status, not deleted_at)
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Org members can read profiles of members in the same org
CREATE POLICY "users_select_org_members"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT om.user_id
        FROM public.organization_members om
       WHERE om.organization_id IN (
         SELECT om2.organization_id
           FROM public.organization_members om2
          WHERE om2.user_id = auth.uid()
            AND om2.deleted_at IS NULL
       )
         AND om.deleted_at IS NULL
    )
  );

COMMENT ON TABLE public.users IS
  'Public user profiles. Mirrors auth.users. Auto-created by trigger on registration.';
