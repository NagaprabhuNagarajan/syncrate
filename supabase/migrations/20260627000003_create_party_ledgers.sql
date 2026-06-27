-- =============================================================================
-- Migration: Create customer & supplier ledger entries
-- =============================================================================
-- Ledger entries record every debit/credit against a customer or supplier.
-- They are written by the Sales/Purchase/Payment domains (Sprints 4–6); this
-- migration establishes the immutable ledger tables so the CRM profile can
-- render the ledger + outstanding balance.
--
-- Financial records are immutable (CLAUDE.md): no updated_by/version churn —
-- corrections are made via reversing entries, never edits.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customer_ledger_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  customer_id      UUID NOT NULL REFERENCES public.customers(id),
  entry_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Source document
  reference_type   TEXT, -- e.g. 'invoice', 'payment', 'opening_balance', 'adjustment'
  reference_id     UUID,
  description      TEXT,
  -- Amounts (exactly one of debit/credit is non-zero per entry)
  debit            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  credit           NUMERIC(14, 2) NOT NULL DEFAULT 0,
  running_balance  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES public.users(id),
  CHECK (debit >= 0 AND credit >= 0)
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer
  ON public.customer_ledger_entries (customer_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_org
  ON public.customer_ledger_entries (organization_id);

ALTER TABLE public.customer_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_ledger_select_org_members"
  ON public.customer_ledger_entries FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

CREATE TABLE IF NOT EXISTS public.supplier_ledger_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  supplier_id      UUID NOT NULL REFERENCES public.suppliers(id),
  entry_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_type   TEXT,
  reference_id     UUID,
  description      TEXT,
  debit            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  credit           NUMERIC(14, 2) NOT NULL DEFAULT 0,
  running_balance  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES public.users(id),
  CHECK (debit >= 0 AND credit >= 0)
);

CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier
  ON public.supplier_ledger_entries (supplier_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_org
  ON public.supplier_ledger_entries (organization_id);

ALTER TABLE public.supplier_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_ledger_select_org_members"
  ON public.supplier_ledger_entries FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

COMMENT ON TABLE public.customer_ledger_entries IS
  'Immutable customer ledger entries. Written by Sales/Payment domains.';
COMMENT ON TABLE public.supplier_ledger_entries IS
  'Immutable supplier ledger entries. Written by Purchase/Payment domains.';
