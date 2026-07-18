-- =============================================================================
-- Migration: New orgs get their own copies of the system roles
-- =============================================================================
-- Extends handle_new_organization() so that every new organization is seeded
-- with its OWN copy of the built-in system roles (cloned from the global
-- templates where organization_id IS NULL), together with their permissions.
-- The owner membership is then created against the org's OWN Owner role rather
-- than the shared global one.
--
-- SECURITY DEFINER, so it bypasses RLS while cloning.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_owner_role_id    UUID;
  v_default_branch   UUID;
  v_fy               RECORD;
BEGIN
  -- 1. Generate slug if not set
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_slug(NEW.name);
  END IF;

  -- 2. Clone the global system-role templates into this organization.
  INSERT INTO public.roles (
    organization_id, name, description, is_system, created_by, updated_by
  )
  SELECT NEW.id, t.name, t.description, true, NEW.created_by, NEW.created_by
    FROM public.roles t
   WHERE t.organization_id IS NULL
     AND t.is_system = true
     AND t.deleted_at IS NULL
  ON CONFLICT (organization_id, name) DO NOTHING;

  -- 2a. Copy each template's permissions onto the org's copy.
  INSERT INTO public.role_permissions (role_id, permission_id, created_by)
  SELECT copy.id, rp.permission_id, NEW.created_by
    FROM public.roles copy
    JOIN public.roles t
      ON t.organization_id IS NULL
     AND t.is_system = true
     AND t.deleted_at IS NULL
     AND t.name = copy.name
    JOIN public.role_permissions rp
      ON rp.role_id = t.id
     AND rp.deleted_at IS NULL
   WHERE copy.organization_id = NEW.id
     AND copy.is_system = true
     AND copy.deleted_at IS NULL
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- 2b. Resolve this org's OWN Owner role for the membership below.
  SELECT id INTO v_owner_role_id
    FROM public.roles
   WHERE organization_id = NEW.id
     AND name = 'Owner'
     AND is_system = true
     AND deleted_at IS NULL
   LIMIT 1;

  -- 3. Create default HQ branch
  INSERT INTO public.branches (
    organization_id, name, code, is_headquarters,
    city, state, created_by
  ) VALUES (
    NEW.id, NEW.name || ' - HQ', 'HQ', true,
    NEW.city, NEW.state, NEW.created_by
  )
  RETURNING id INTO v_default_branch;

  -- 4. Create organization settings
  INSERT INTO public.organization_settings (
    organization_id, created_by
  ) VALUES (
    NEW.id, NEW.created_by
  )
  ON CONFLICT (organization_id) DO NOTHING;

  -- 5. Create current financial year (default: April start)
  SELECT * INTO v_fy FROM public.get_current_financial_year(4);

  INSERT INTO public.financial_years (
    organization_id, name, start_date, end_date, is_current, created_by
  ) VALUES (
    NEW.id, v_fy.fy_name, v_fy.start_date, v_fy.end_date, true, NEW.created_by
  )
  ON CONFLICT (organization_id, name) DO NOTHING;

  -- 6. Create owner membership for the creating user
  IF NEW.created_by IS NOT NULL AND v_owner_role_id IS NOT NULL THEN
    INSERT INTO public.organization_members (
      organization_id, user_id, role_id, status, joined_at, created_by
    ) VALUES (
      NEW.id, NEW.created_by, v_owner_role_id, 'active', NOW(), NEW.created_by
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_organization() IS
  'Auto-creates per-org system roles, HQ branch, org settings, financial year, and owner membership on org creation.';
