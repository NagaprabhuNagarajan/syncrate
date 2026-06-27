-- =============================================================================
-- Migration: Deferred RLS policies (depend on organization_members / roles)
-- =============================================================================
-- The organizations, branches and roles tables are created before
-- organization_members (FK order requires it), but several of their RLS
-- policies reference organization_members (and roles). Those policies are
-- defined here, after 20260626000005 creates organization_members, so the
-- forward references resolve.
-- =============================================================================

-- ── organization_members (recursion-safe via SECURITY DEFINER helpers) ───────
-- A policy on organization_members must NOT subquery organization_members under
-- RLS (infinite recursion, SQLSTATE 42P17). The helpers from 20260626000008 run
-- as the function owner and bypass RLS, breaking the cycle.
CREATE POLICY "org_members_select"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id = ANY (public.get_user_organization_ids())
  );

CREATE POLICY "org_members_insert_admin"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.get_user_role_in_org(organization_id) IN ('Owner', 'Admin')
  );

CREATE POLICY "org_members_update_admin"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role_in_org(organization_id) IN ('Owner', 'Admin')
  );

-- ── organizations ────────────────────────────────────────────────────────────
CREATE POLICY "organizations_select_members"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

CREATE POLICY "organizations_update_admin"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT om.organization_id FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
       WHERE om.user_id = auth.uid() AND om.deleted_at IS NULL
         AND om.status = 'active' AND r.name IN ('Owner', 'Admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT om.organization_id FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
       WHERE om.user_id = auth.uid() AND om.deleted_at IS NULL
         AND om.status = 'active' AND r.name IN ('Owner', 'Admin')
    )
  );

-- ── branches ─────────────────────────────────────────────────────────────────
CREATE POLICY "branches_select_org_members"
  ON public.branches FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

CREATE POLICY "branches_insert_admin"
  ON public.branches FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
       WHERE om.user_id = auth.uid() AND om.deleted_at IS NULL
         AND om.status = 'active' AND r.name IN ('Owner', 'Admin')
    )
  );

CREATE POLICY "branches_update_admin"
  ON public.branches FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
       WHERE om.user_id = auth.uid() AND om.deleted_at IS NULL
         AND om.status = 'active' AND r.name IN ('Owner', 'Admin')
    )
  );

-- ── roles ────────────────────────────────────────────────────────────────────
CREATE POLICY "roles_select_org_members"
  ON public.roles FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

-- Must NOT join public.roles here (recursion: this is a policy ON roles, and
-- FOR ALL also governs SELECT). get_user_role_in_org() is SECURITY DEFINER and
-- bypasses RLS, so it resolves the caller's role without recursing.
CREATE POLICY "roles_manage_admin"
  ON public.roles FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.get_user_role_in_org(organization_id) IN ('Owner', 'Admin')
  )
  WITH CHECK (
    organization_id IS NOT NULL AND is_system = false
  );
