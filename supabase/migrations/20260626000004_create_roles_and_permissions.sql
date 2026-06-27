-- =============================================================================
-- Migration: Create roles, permissions, role_permissions
-- =============================================================================
-- RBAC: Permissions are granted to roles. Roles are assigned to org members.
-- System roles (organization_id = NULL) are pre-seeded and cannot be deleted.
-- Organization-specific custom roles have organization_id set.
-- Permission format: module.action (e.g. "customer.create", "invoice.post")
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- Roles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES public.organizations(id), -- NULL = system role
  name             TEXT NOT NULL,
  description      TEXT,
  is_system        BOOLEAN NOT NULL DEFAULT false,
  -- Audit columns
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1,
  -- System roles are unique globally; org roles unique within org
  UNIQUE NULLS NOT DISTINCT (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_org       ON public.roles(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_roles_system    ON public.roles(is_system) WHERE is_system = true AND deleted_at IS NULL;

CREATE OR REPLACE TRIGGER roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- NOTE: "roles_select_org_members" and "roles_manage_admin" depend on
-- public.organization_members (created in 000005) and are defined in
-- 20260627000011, after that table exists.

-- ─────────────────────────────────────────────────────────────
-- Permissions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module       TEXT NOT NULL, -- e.g. "customer", "invoice", "inventory"
  action       TEXT NOT NULL, -- e.g. "create", "view", "update", "delete", "export"
  name         TEXT NOT NULL UNIQUE, -- "module.action" — computed on insert
  description  TEXT,
  -- Audit columns
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id),
  deleted_by   UUID REFERENCES public.users(id),
  version      INTEGER NOT NULL DEFAULT 1,
  UNIQUE(module, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_permissions_name   ON public.permissions(name) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER permissions_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read permissions
CREATE POLICY "permissions_select_authenticated"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────
-- Role Permissions (junction)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id        UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id  UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  -- Audit columns
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  created_by     UUID REFERENCES public.users(id),
  updated_by     UUID REFERENCES public.users(id),
  deleted_by     UUID REFERENCES public.users(id),
  version        INTEGER NOT NULL DEFAULT 1,
  UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role   ON public.role_permissions(role_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm   ON public.role_permissions(permission_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read role_permissions
CREATE POLICY "role_permissions_select_authenticated"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.roles IS
  'System and custom roles. System roles have organization_id = NULL.';
COMMENT ON TABLE public.permissions IS
  'All available permissions in module.action format (e.g. customer.create).';
COMMENT ON TABLE public.role_permissions IS
  'Junction table mapping roles to permissions.';
