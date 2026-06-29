-- =============================================================================
-- Migration: Allow org admins to assign/revoke permissions on custom roles
-- =============================================================================
-- role_permissions previously had only a SELECT policy (USING true), so RLS
-- denied all writes — blocking the Advanced Permissions feature from editing a
-- custom role's permission set. This adds a write policy mirroring
-- roles_manage_admin: Owner/Admin may manage rows for their org's NON-system
-- roles only. System roles (organization_id IS NULL) remain immutable.
--
-- Safe from recursion: this policy is ON role_permissions and only subqueries
-- the roles table (a different table). get_user_role_in_org() is SECURITY
-- DEFINER and bypasses RLS, so it resolves the caller's role without recursing.
-- =============================================================================

CREATE POLICY "role_permissions_manage_admin"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.roles r
       WHERE r.id = role_permissions.role_id
         AND r.organization_id IS NOT NULL
         AND r.is_system = false
         AND public.get_user_role_in_org(r.organization_id) IN ('Owner', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.roles r
       WHERE r.id = role_permissions.role_id
         AND r.organization_id IS NOT NULL
         AND r.is_system = false
         AND public.get_user_role_in_org(r.organization_id) IN ('Owner', 'Admin')
    )
  );
