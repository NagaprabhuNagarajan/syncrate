-- =============================================================================
-- Migration: Fork system roles into per-organization copies
-- =============================================================================
-- Previously the 9 built-in system roles were GLOBAL (organization_id IS NULL)
-- and shared by every organization. That made them impossible to customise:
-- editing a role's permissions would have changed it for every tenant.
--
-- This migration gives each organization its OWN copy of the system roles
-- (organization_id = org, is_system = true) with the same permissions, then
-- repoints all member + invitation assignments from the global template to the
-- org's copy. The global rows (organization_id IS NULL) are kept ONLY as
-- templates for cloning into future organizations (see the org-setup trigger);
-- they are no longer assigned to anyone and no longer listed in the UI.
--
-- Idempotent: re-running is a no-op thanks to ON CONFLICT / matched repoints.
-- Runs with the migration role, which bypasses RLS.
-- =============================================================================

-- 1. Clone each global system-role template into every organization.
INSERT INTO public.roles (
  organization_id, name, description, is_system, created_by, updated_by
)
SELECT o.id, t.name, t.description, true, o.created_by, o.created_by
  FROM public.organizations o
 CROSS JOIN public.roles t
 WHERE o.deleted_at IS NULL
   AND t.organization_id IS NULL
   AND t.is_system = true
   AND t.deleted_at IS NULL
ON CONFLICT (organization_id, name) DO NOTHING;

-- 2. Copy each template's permissions onto the matching org-scoped copy.
INSERT INTO public.role_permissions (role_id, permission_id, created_by)
SELECT copy.id, rp.permission_id, copy.created_by
  FROM public.roles copy
  JOIN public.roles t
    ON t.organization_id IS NULL
   AND t.is_system = true
   AND t.deleted_at IS NULL
   AND t.name = copy.name
  JOIN public.role_permissions rp
    ON rp.role_id = t.id
   AND rp.deleted_at IS NULL
 WHERE copy.organization_id IS NOT NULL
   AND copy.is_system = true
   AND copy.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Repoint member assignments from the global template to the org's copy.
UPDATE public.organization_members m
   SET role_id = copy.id,
       updated_at = NOW()
  FROM public.roles t, public.roles copy
 WHERE m.role_id = t.id
   AND t.organization_id IS NULL
   AND t.is_system = true
   AND copy.organization_id = m.organization_id
   AND copy.is_system = true
   AND copy.name = t.name
   AND copy.deleted_at IS NULL;

-- 4. Repoint invitation assignments from the global template to the org's copy.
UPDATE public.organization_invitations i
   SET role_id = copy.id,
       updated_at = NOW()
  FROM public.roles t, public.roles copy
 WHERE i.role_id = t.id
   AND t.organization_id IS NULL
   AND t.is_system = true
   AND copy.organization_id = i.organization_id
   AND copy.is_system = true
   AND copy.name = t.name
   AND copy.deleted_at IS NULL;
