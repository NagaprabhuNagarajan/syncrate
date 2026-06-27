-- =============================================================================
-- Migration: Create suppliers
-- =============================================================================
-- Suppliers belong to an organization. Core entity for the Purchase domain.
-- Business rules (docs/PRD/3.md, docs/PRD/10.md):
--   * Supplier code is unique within an organization.
--   * Supplier GST is unique within an organization.
--   * Supplier deletion is prohibited if transactions exist (app layer);
--     historical supplier records remain available (soft delete → archived).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.suppliers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id),
  -- Identity
  code                 TEXT NOT NULL,
  name                 TEXT NOT NULL, -- business name
  contact_person       TEXT,
  -- Tax identifiers
  gst_number           TEXT,
  pan_number           TEXT,
  -- Contact
  mobile               TEXT,
  email                TEXT,
  website              TEXT,
  -- Address
  address_line1        TEXT,
  address_line2        TEXT,
  city                 TEXT,
  state                TEXT,
  pincode              TEXT,
  country              TEXT NOT NULL DEFAULT 'IN',
  -- Banking
  bank_account_name    TEXT,
  bank_account_number  TEXT,
  bank_ifsc            TEXT,
  bank_name            TEXT,
  upi_id               TEXT,
  -- Commercial terms
  payment_terms_days   INTEGER NOT NULL DEFAULT 0,
  opening_balance      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  -- Performance
  rating               NUMERIC(2, 1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  -- Classification
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'inactive', 'archived')),
  tags                 TEXT[] NOT NULL DEFAULT '{}',
  notes                TEXT,
  -- Audit columns
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,
  created_by           UUID REFERENCES public.users(id),
  updated_by           UUID REFERENCES public.users(id),
  deleted_by           UUID REFERENCES public.users(id),
  version              INTEGER NOT NULL DEFAULT 1,
  -- Constraints
  UNIQUE (organization_id, code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_org_gst
  ON public.suppliers (organization_id, gst_number)
  WHERE gst_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_org    ON public.suppliers (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_mobile ON public.suppliers (organization_id, mobile) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_name   ON public.suppliers (organization_id, name) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_name_search
  ON public.suppliers USING gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(contact_person, '')))
  WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select_org_members"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

CREATE POLICY "suppliers_insert_org_members"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

CREATE POLICY "suppliers_update_org_members"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

COMMENT ON TABLE public.suppliers IS
  'Suppliers (Purchase domain). Soft-deleted to archived; code + GST unique per organization.';
