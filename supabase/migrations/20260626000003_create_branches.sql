-- =============================================================================
-- Migration: Create branches
-- =============================================================================
-- Organizations can have multiple branches.
-- Every transaction is associated with exactly one branch.
-- A default HQ branch is auto-created when an organization is created.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.branches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  -- Identity
  name             TEXT NOT NULL,
  code             TEXT NOT NULL, -- Short code e.g. "HQ", "CHN", "MUM"
  is_headquarters  BOOLEAN NOT NULL DEFAULT false,
  -- Contact
  phone            TEXT,
  email            TEXT,
  -- Address
  address_line1    TEXT,
  address_line2    TEXT,
  city             TEXT,
  state            TEXT,
  pincode          TEXT,
  -- GST (branch may have its own GSTIN in multi-state businesses)
  gst_number       TEXT,
  -- Status
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'inactive', 'closed')),
  -- Audit columns
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1,
  -- Constraints
  UNIQUE(organization_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_branches_org        ON public.branches(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_branches_status     ON public.branches(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_branches_hq         ON public.branches(organization_id, is_headquarters) WHERE is_headquarters = true AND deleted_at IS NULL;

-- Updated-at trigger
CREATE OR REPLACE TRIGGER branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Org members can see their branches
CREATE POLICY "branches_select_org_members"
  ON public.branches FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
        FROM public.organization_members
       WHERE user_id = auth.uid()
         AND deleted_at IS NULL
         AND status = 'active'
    )
  );

-- Admin/Owner can insert branches
CREATE POLICY "branches_insert_admin"
  ON public.branches FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
        FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
       WHERE om.user_id = auth.uid()
         AND om.deleted_at IS NULL
         AND om.status = 'active'
         AND r.name IN ('Owner', 'Admin')
    )
  );

-- Admin/Owner can update branches
CREATE POLICY "branches_update_admin"
  ON public.branches FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
        FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
       WHERE om.user_id = auth.uid()
         AND om.deleted_at IS NULL
         AND om.status = 'active'
         AND r.name IN ('Owner', 'Admin')
    )
  );

COMMENT ON TABLE public.branches IS
  'Branches of an organization. One HQ branch created automatically on org creation.';
