-- =============================================================================
-- Migration: Helper functions for RLS and application use
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- Get all organization IDs the current user is active in
-- Used in RLS policies throughout the codebase.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT ARRAY(
    SELECT organization_id
      FROM public.organization_members
     WHERE user_id = auth.uid()
       AND deleted_at IS NULL
       AND status = 'active'
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Check if current user is member of a specific org
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_org_member(p_organization_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.organization_members
     WHERE user_id = auth.uid()
       AND organization_id = p_organization_id
       AND deleted_at IS NULL
       AND status = 'active'
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Get the role name of the current user in a specific org
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role_in_org(p_organization_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT r.name
    FROM public.organization_members om
    JOIN public.roles r ON r.id = om.role_id
   WHERE om.user_id = auth.uid()
     AND om.organization_id = p_organization_id
     AND om.deleted_at IS NULL
     AND om.status = 'active'
   LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- Check if current user has a specific permission in an org
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_permission(
  p_organization_id UUID,
  p_permission_name TEXT
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.organization_members om
      JOIN public.role_permissions rp ON rp.role_id = om.role_id
      JOIN public.permissions p       ON p.id = rp.permission_id
     WHERE om.user_id = auth.uid()
       AND om.organization_id = p_organization_id
       AND om.deleted_at IS NULL
       AND om.status = 'active'
       AND rp.deleted_at IS NULL
       AND p.name = p_permission_name
       AND p.deleted_at IS NULL
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Slug generation helper: "My Company Name" → "my-company-name"
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_slug(p_name TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_slug TEXT;
  v_base TEXT;
  v_count INT := 0;
BEGIN
  -- Lowercase, replace spaces + special chars with hyphens, trim hyphens
  v_base := regexp_replace(
    regexp_replace(lower(p_name), '[^a-z0-9\s-]', '', 'g'),
    '[\s-]+', '-', 'g'
  );
  v_base := trim(BOTH '-' FROM v_base);
  v_slug := v_base;

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
    v_count := v_count + 1;
    v_slug  := v_base || '-' || v_count;
  END LOOP;

  RETURN v_slug;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Calculate the current financial year label given a start month
-- e.g. start_month=4 → "FY 2025-26" (April 2025 → March 2026)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_current_financial_year(p_start_month INTEGER)
RETURNS TABLE (
  fy_name    TEXT,
  start_date DATE,
  end_date   DATE
) LANGUAGE plpgsql AS $$
DECLARE
  v_now         DATE    := CURRENT_DATE;
  v_year        INTEGER := EXTRACT(YEAR FROM v_now);
  v_month       INTEGER := EXTRACT(MONTH FROM v_now);
  v_fy_start_year INTEGER;
  v_fy_end_year   INTEGER;
BEGIN
  IF v_month >= p_start_month THEN
    v_fy_start_year := v_year;
    v_fy_end_year   := v_year + 1;
  ELSE
    v_fy_start_year := v_year - 1;
    v_fy_end_year   := v_year;
  END IF;

  fy_name    := 'FY ' || v_fy_start_year || '-' || RIGHT(v_fy_end_year::TEXT, 2);
  start_date := MAKE_DATE(v_fy_start_year, p_start_month, 1);
  end_date   := (MAKE_DATE(v_fy_end_year, p_start_month, 1) - INTERVAL '1 day')::DATE;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.get_user_organization_ids() IS
  'Returns all active organization IDs for the current auth user. Used in RLS policies.';
COMMENT ON FUNCTION public.has_permission(UUID, TEXT) IS
  'Returns true if the current user has the given permission in the given organization.';
COMMENT ON FUNCTION public.generate_slug(TEXT) IS
  'Generates a unique URL-safe slug from an organization name.';
