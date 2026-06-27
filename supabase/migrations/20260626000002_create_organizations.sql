-- =============================================================================
-- Migration: Create organizations
-- =============================================================================
-- Core multi-tenant entity. Every business record belongs to one organization.
-- Organizations cannot be permanently deleted (soft-delete only).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE, -- URL-safe unique identifier
  display_name        TEXT,
  -- Business details
  business_type       TEXT,
  gst_number          TEXT,
  pan_number          TEXT,
  cin_number          TEXT, -- Company Identification Number
  -- Contact
  phone               TEXT,
  email               TEXT,
  website             TEXT,
  -- Address
  address_line1       TEXT,
  address_line2       TEXT,
  city                TEXT,
  state               TEXT,
  country             TEXT NOT NULL DEFAULT 'IN',
  pincode             TEXT,
  -- Branding
  logo_url            TEXT,
  -- Verification
  verification_status TEXT NOT NULL DEFAULT 'unverified'
                        CHECK (verification_status IN ('unverified', 'email_verified', 'mobile_verified', 'gst_verified', 'document_verified', 'trusted')),
  -- Status
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'inactive')),
  -- Subscription (populated in future billing sprint)
  plan                TEXT NOT NULL DEFAULT 'free'
                        CHECK (plan IN ('free', 'starter', 'professional', 'enterprise')),
  plan_expires_at     TIMESTAMPTZ,
  -- Audit columns
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES public.users(id),
  updated_by          UUID REFERENCES public.users(id),
  deleted_by          UUID REFERENCES public.users(id),
  version             INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug    ON public.organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_gst     ON public.organizations(gst_number) WHERE gst_number IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_status  ON public.organizations(status) WHERE deleted_at IS NULL;

-- Updated-at trigger
CREATE OR REPLACE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- NOTE: "organizations_select_members" and "organizations_update_admin" depend
-- on public.organization_members + public.roles (created in 000004/000005) and
-- are therefore defined in 20260627000011 (after those tables exist).

-- Any authenticated user can create an organization
CREATE POLICY "organizations_insert_authenticated"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE public.organizations IS
  'Core multi-tenant entity. Every business record is scoped to an organization.';
COMMENT ON COLUMN public.organizations.slug IS
  'URL-safe unique identifier. Auto-generated from org name on creation.';
