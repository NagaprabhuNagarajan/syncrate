-- =============================================================================
-- Migration: Trigger to auto-setup new organization
-- =============================================================================
-- When a new organization is created:
-- 1. Auto-generate slug if not provided
-- 2. Create default HQ branch
-- 3. Create organization settings with sensible defaults
-- 4. Create current financial year (Indian FY: April 1 – March 31)
-- 5. Create owner membership for the creating user
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

  -- 2. Get the system Owner role
  SELECT id INTO v_owner_role_id
    FROM public.roles
   WHERE name = 'Owner' AND is_system = true AND deleted_at IS NULL
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

CREATE OR REPLACE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

COMMENT ON FUNCTION public.handle_new_organization() IS
  'Auto-creates HQ branch, org settings, financial year, and owner membership on org creation.';
