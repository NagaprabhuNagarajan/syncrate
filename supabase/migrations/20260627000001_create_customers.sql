-- =============================================================================
-- Migration: Create customers
-- =============================================================================
-- Customers belong to an organization. Core CRM entity for the Sales domain.
-- Business rules (docs/PRD/3.md, docs/PRD/10.md):
--   * Customer code is unique within an organization.
--   * Duplicate GST numbers are prohibited within an organization.
--   * Inactive/blacklisted customers cannot create new transactions (app layer).
--   * Deleted customers become archived (soft delete).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES public.organizations(id),
  -- Identity
  code                     TEXT NOT NULL,
  name                     TEXT NOT NULL,
  company                  TEXT,
  -- Tax identifiers
  gst_number               TEXT,
  pan_number               TEXT,
  -- Contact
  mobile                   TEXT,
  email                    TEXT,
  website                  TEXT,
  -- Billing address
  billing_address_line1    TEXT,
  billing_address_line2    TEXT,
  billing_city             TEXT,
  billing_state            TEXT,
  billing_pincode          TEXT,
  billing_country          TEXT NOT NULL DEFAULT 'IN',
  -- Shipping address
  shipping_address_line1   TEXT,
  shipping_address_line2   TEXT,
  shipping_city            TEXT,
  shipping_state           TEXT,
  shipping_pincode         TEXT,
  shipping_country         TEXT,
  -- Commercial terms
  credit_limit             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_terms_days       INTEGER NOT NULL DEFAULT 0,
  preferred_payment_method TEXT,
  opening_balance          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  -- Classification
  status                   TEXT NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'inactive', 'blacklisted', 'archived')),
  tags                     TEXT[] NOT NULL DEFAULT '{}',
  notes                    TEXT,
  -- Audit columns
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ,
  created_by               UUID REFERENCES public.users(id),
  updated_by               UUID REFERENCES public.users(id),
  deleted_by               UUID REFERENCES public.users(id),
  version                  INTEGER NOT NULL DEFAULT 1,
  -- Constraints
  UNIQUE (organization_id, code)
);

-- Duplicate GST prohibited within an organization (only for live, GST-bearing rows)
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_org_gst
  ON public.customers (organization_id, gst_number)
  WHERE gst_number IS NOT NULL AND deleted_at IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_org    ON public.customers (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON public.customers (organization_id, mobile) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name   ON public.customers (organization_id, name) WHERE deleted_at IS NULL;

-- Trigram-friendly search index on name (fast ILIKE search; acceptance: <100ms)
CREATE INDEX IF NOT EXISTS idx_customers_name_search
  ON public.customers USING gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(company, '')))
  WHERE deleted_at IS NULL;

-- Updated-at trigger
CREATE OR REPLACE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security — tenant isolation. Fine-grained customer.* permissions
-- are enforced at the application layer.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select_org_members"
  ON public.customers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

CREATE POLICY "customers_insert_org_members"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

CREATE POLICY "customers_update_org_members"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

COMMENT ON TABLE public.customers IS
  'Customers (CRM). Soft-deleted to archived; code + GST unique per organization.';
