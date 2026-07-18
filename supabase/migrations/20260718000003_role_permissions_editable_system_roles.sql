-- =============================================================================
-- Migration: Allow editing permissions on org-scoped system roles (except Owner)
-- =============================================================================
-- Now that every organization owns its copies of the system roles
-- (organization_id = org, is_system = true), Owner/Admin should be able to tune
-- their permission sets — EXCEPT the Owner role, which must retain full access
-- to avoid an org locking itself out.
--
-- This replaces role_permissions_manage_admin so it permits managing rows for
-- ANY of the org's roles (system or custom) EXCEPT the org's system Owner role.
-- The roles table itself stays locked for system roles (roles_manage_admin still
-- requires is_system = false), so system roles can't be renamed or deleted —
-- only their permission assignments change.
--
-- Safe from recursion: this policy is ON role_permissions and only subqueries
-- the roles table. get_user_role_in_org() is SECURITY DEFINER and bypasses RLS.
-- =============================================================================

DROP POLICY IF EXISTS "role_permissions_manage_admin" ON public.role_permissions;

CREATE POLICY "role_permissions_manage_admin"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.roles r
       WHERE r.id = role_permissions.role_id
         AND r.organization_id IS NOT NULL
         AND NOT (r.is_system = true AND r.name = 'Owner')
         AND public.get_user_role_in_org(r.organization_id) IN ('Owner', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.roles r
       WHERE r.id = role_permissions.role_id
         AND r.organization_id IS NOT NULL
         AND NOT (r.is_system = true AND r.name = 'Owner')
         AND public.get_user_role_in_org(r.organization_id) IN ('Owner', 'Admin')
    )
  );
