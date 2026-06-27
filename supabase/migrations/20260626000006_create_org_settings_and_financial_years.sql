-- =============================================================================
-- Migration: Organization settings and financial years
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- Organization Settings
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL UNIQUE REFERENCES public.organizations(id),
  -- Locale & format
  currency               TEXT NOT NULL DEFAULT 'INR',
  timezone               TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  date_format            TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  number_format          TEXT NOT NULL DEFAULT 'en-IN',
  -- Fiscal year
  fiscal_year_start_month INTEGER NOT NULL DEFAULT 4 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  -- Document numbering prefixes
  invoice_prefix         TEXT NOT NULL DEFAULT 'INV',
  purchase_order_prefix  TEXT NOT NULL DEFAULT 'PO',
  quotation_prefix       TEXT NOT NULL DEFAULT 'QT',
  payment_prefix         TEXT NOT NULL DEFAULT 'PAY',
  -- Session config
  session_timeout_hours  INTEGER NOT NULL DEFAULT 8 CHECK (session_timeout_hours BETWEEN 1 AND 720),
  -- Feature flags
  enable_gst             BOOLEAN NOT NULL DEFAULT true,
  enable_multi_currency  BOOLEAN NOT NULL DEFAULT false,
  enable_approval_workflow BOOLEAN NOT NULL DEFAULT false,
  -- Audit columns
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ,
  created_by             UUID REFERENCES public.users(id),
  updated_by             UUID REFERENCES public.users(id),
  deleted_by             UUID REFERENCES public.users(id),
  version                INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_org_settings_org ON public.organization_settings(organization_id);

CREATE OR REPLACE TRIGGER org_settings_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_settings_select_members"
  ON public.organization_settings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

CREATE POLICY "org_settings_update_admin"
  ON public.organization_settings FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
       WHERE om.user_id = auth.uid() AND om.deleted_at IS NULL AND om.status = 'active'
         AND r.name IN ('Owner', 'Admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Financial Years
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_years (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  -- e.g. "FY 2025-26"
  name             TEXT NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  is_current       BOOLEAN NOT NULL DEFAULT false,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'closed', 'locked')),
  -- Audit columns
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1,
  UNIQUE(organization_id, name),
  CONSTRAINT fy_dates_valid CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_financial_years_org      ON public.financial_years(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_financial_years_current  ON public.financial_years(organization_id, is_current) WHERE is_current = true AND deleted_at IS NULL;

CREATE OR REPLACE TRIGGER financial_years_updated_at
  BEFORE UPDATE ON public.financial_years
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.financial_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_years_select_members"
  ON public.financial_years FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

CREATE POLICY "financial_years_manage_admin"
  ON public.financial_years FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
       WHERE om.user_id = auth.uid() AND om.deleted_at IS NULL AND om.status = 'active'
         AND r.name IN ('Owner', 'Admin', 'Accountant')
    )
  );

COMMENT ON TABLE public.organization_settings IS
  'Per-organization configuration: locale, numbering, fiscal year, feature flags.';
COMMENT ON TABLE public.financial_years IS
  'Financial years for an organization. Auto-created based on fiscal_year_start_month.';
