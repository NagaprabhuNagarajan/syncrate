-- =============================================================================
-- Migration: Customer & Supplier Payments
-- =============================================================================
-- Sprint 6: Payment Collection
--
-- customer_payments      — a payment received from a customer (reduces A/R)
-- customer_payment_allocations — allocates a payment across one or many invoices
-- supplier_payments      — a payment made to a supplier (reduces A/P)
-- supplier_payment_allocations — allocates a payment across one or many purchase invoices
--
-- Also adds missing INSERT policies on ledger tables so the payment RPCs
-- (and pre-existing post_sales_invoice / post_purchase_invoice) can write
-- ledger entries under SECURITY INVOKER.
--
-- Accounting direction recap:
--   Customer ledger DEBIT  = A/R increases (invoice posted)
--   Customer ledger CREDIT = A/R decreases (payment received)
--   Supplier ledger CREDIT = A/P increases (purchase invoice posted)
--   Supplier ledger DEBIT  = A/P decreases (payment made to supplier)
-- =============================================================================

-- ── Fix missing ledger INSERT policies (needed by existing + new RPCs) ────────
CREATE POLICY "customer_ledger_insert_org_members"
  ON public.customer_ledger_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = ANY (public.get_user_organization_ids())
  );

CREATE POLICY "supplier_ledger_insert_org_members"
  ON public.supplier_ledger_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = ANY (public.get_user_organization_ids())
  );

-- ── Customer Payments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  payment_number   TEXT NOT NULL,
  customer_id      UUID NOT NULL REFERENCES public.customers(id),
  payment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  amount           NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  payment_method   TEXT NOT NULL DEFAULT 'cash'
                     CHECK (payment_method IN (
                       'cash', 'upi', 'bank_transfer', 'cheque',
                       'credit_card', 'debit_card', 'wallet', 'other')),
  reference_number TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'completed'
                     CHECK (status IN ('completed', 'voided')),
  voided_at        TIMESTAMPTZ,
  voided_by        UUID REFERENCES public.users(id),
  void_reason      TEXT,
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_cpay_org      ON public.customer_payments (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cpay_customer ON public.customer_payments (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cpay_date     ON public.customer_payments (organization_id, payment_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cpay_status   ON public.customer_payments (organization_id, status) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER customer_payments_updated_at
  BEFORE UPDATE ON public.customer_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Customer Payment Allocations ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_payment_allocations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id),
  customer_payment_id   UUID NOT NULL REFERENCES public.customer_payments(id),
  invoice_id            UUID NOT NULL REFERENCES public.invoices(id),
  allocated_amount      NUMERIC(14, 2) NOT NULL CHECK (allocated_amount > 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_cpay_alloc_payment ON public.customer_payment_allocations (customer_payment_id);
CREATE INDEX IF NOT EXISTS idx_cpay_alloc_invoice ON public.customer_payment_allocations (invoice_id);

-- ── Supplier Payments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  payment_number   TEXT NOT NULL,
  supplier_id      UUID NOT NULL REFERENCES public.suppliers(id),
  payment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  amount           NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  payment_method   TEXT NOT NULL DEFAULT 'bank_transfer'
                     CHECK (payment_method IN (
                       'cash', 'upi', 'bank_transfer', 'cheque',
                       'credit_card', 'debit_card', 'wallet', 'other')),
  reference_number TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'completed'
                     CHECK (status IN ('completed', 'voided')),
  voided_at        TIMESTAMPTZ,
  voided_by        UUID REFERENCES public.users(id),
  void_reason      TEXT,
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_spay_org      ON public.supplier_payments (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spay_supplier ON public.supplier_payments (supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spay_date     ON public.supplier_payments (organization_id, payment_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spay_status   ON public.supplier_payments (organization_id, status) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER supplier_payments_updated_at
  BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Supplier Payment Allocations ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supplier_payment_allocations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id),
  supplier_payment_id   UUID NOT NULL REFERENCES public.supplier_payments(id),
  purchase_invoice_id   UUID NOT NULL REFERENCES public.purchase_invoices(id),
  allocated_amount      NUMERIC(14, 2) NOT NULL CHECK (allocated_amount > 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_spay_alloc_payment  ON public.supplier_payment_allocations (supplier_payment_id);
CREATE INDEX IF NOT EXISTS idx_spay_alloc_pinvoice ON public.supplier_payment_allocations (purchase_invoice_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customer_payments', 'customer_payment_allocations',
    'supplier_payments', 'supplier_payment_allocations']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_select" ON public.%1$I FOR SELECT TO authenticated
      USING (organization_id = ANY (public.get_user_organization_ids()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_insert" ON public.%1$I FOR INSERT TO authenticated
      WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_update" ON public.%1$I FOR UPDATE TO authenticated
      USING (organization_id = ANY (public.get_user_organization_ids()));
    $f$, t);
  END LOOP;
END $$;

COMMENT ON TABLE public.customer_payments      IS 'Payments received from customers. Recording is atomic (invoice update + ledger credit).';
COMMENT ON TABLE public.customer_payment_allocations IS 'Allocation of a customer payment across one or more sales invoices.';
COMMENT ON TABLE public.supplier_payments      IS 'Payments made to suppliers. Recording is atomic (purchase invoice update + ledger debit).';
COMMENT ON TABLE public.supplier_payment_allocations IS 'Allocation of a supplier payment across one or more purchase invoices.';
