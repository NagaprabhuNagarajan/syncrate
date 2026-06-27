-- =============================================================================
-- Migration: Create organization_members
-- =============================================================================
-- Maps users to organizations with their assigned role.
-- One user can belong to multiple organizations.
-- branch_id = NULL means access to all branches.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organization_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  user_id          UUID NOT NULL REFERENCES public.users(id),
  role_id          UUID NOT NULL REFERENCES public.roles(id),
  -- Branch restriction: NULL = all branches, set = restricted to this branch
  branch_id        UUID REFERENCES public.branches(id),
  -- Membership state
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'inactive', 'invited', 'suspended')),
  invited_at       TIMESTAMPTZ,
  joined_at        TIMESTAMPTZ,
  invited_by       UUID REFERENCES public.users(id),
  -- Audit columns
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1,
  -- Each user is a member of an org once
  UNIQUE NULLS NOT DISTINCT (organization_id, user_id, deleted_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user     ON public.organization_members(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_members_org      ON public.organization_members(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_members_role     ON public.organization_members(role_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_members_branch   ON public.organization_members(branch_id) WHERE branch_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_members_status   ON public.organization_members(organization_id, status) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- NOTE: organization_members RLS policies are defined in 20260627000011.
-- They rely on the SECURITY DEFINER helpers (get_user_organization_ids,
-- get_user_role_in_org) created in 20260626000008 — which in turn require this
-- table to exist — so they must be created after both. RLS is enabled here;
-- until the policies are added, only the table owner / SECURITY DEFINER triggers
-- (e.g. the org-setup trigger) can access the table, which is correct during
-- migration.

COMMENT ON TABLE public.organization_members IS
  'Maps users to organizations. One user can belong to multiple organizations.';
COMMENT ON COLUMN public.organization_members.branch_id IS
  'NULL = access to all branches. Non-null = restricted to a single branch.';
