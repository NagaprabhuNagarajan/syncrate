-- =============================================================================
-- Migration: Sales Invoices + Invoice Items + Sales Returns + Credit Notes
-- =============================================================================
-- Invoice workflow: draft → posted (immutable) | cancelled
-- Posting is atomic (via RPC in next migration):
--   1. Stamp invoice posted
--   2. Deduct inventory per line (adjust_stock with 'sale' event)
--   3. Debit customer ledger (customer_ledger_entries)
-- Invoice numbers are immutable after posting. Posted invoices cannot be deleted.
-- Sales returns reverse inventory and credit the customer ledger.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id),
  invoice_number     TEXT NOT NULL,
  invoice_type       TEXT NOT NULL DEFAULT 'tax_invoice'
                       CHECK (invoice_type IN ('tax_invoice', 'retail_invoice',
                                               'proforma_invoice', 'commercial_invoice',
                                               'export_invoice')),
  customer_id        UUID NOT NULL REFERENCES public.customers(id),
  sales_order_id     UUID REFERENCES public.sales_orders(id),
  quotation_id       UUID REFERENCES public.quotations(id),
  branch_id          UUID REFERENCES public.branches(id),
  warehouse_id       UUID REFERENCES public.warehouses(id),
  salesperson_id     UUID REFERENCES public.users(id),
  reference_number   TEXT,
  invoice_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date           DATE,
  payment_terms_days INTEGER NOT NULL DEFAULT 0,
  -- GST fields
  supply_state       TEXT,              -- customer delivery / billing state
  is_interstate      BOOLEAN NOT NULL DEFAULT false,
  -- Financials
  subtotal           NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cgst_amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sgst_amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  igst_amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  round_off          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  amount_paid        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_status     TEXT NOT NULL DEFAULT 'unpaid'
                       CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue')),
  -- Status
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'posted', 'cancelled')),
  notes              TEXT,
  terms              TEXT,
  -- Posting
  posted_at          TIMESTAMPTZ,
  posted_by          UUID REFERENCES public.users(id),
  -- Audit
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ,
  created_by         UUID REFERENCES public.users(id),
  updated_by         UUID REFERENCES public.users(id),
  deleted_by         UUID REFERENCES public.users(id),
  version            INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_org        ON public.invoices (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_customer   ON public.invoices (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON public.invoices (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_date       ON public.invoices (organization_id, invoice_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_payment    ON public.invoices (organization_id, payment_status) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  invoice_id       UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES public.products(id),
  description      TEXT,
  hsn_code         TEXT,
  quantity         NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_percent NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  taxable_amount   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  gst_rate         NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  cgst_rate        NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  sgst_rate        NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  igst_rate        NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  cgst_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sgst_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  igst_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sort_order       INTEGER        NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items (invoice_id);

-- ── Sales Returns ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sales_returns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  return_number    TEXT NOT NULL,
  invoice_id       UUID REFERENCES public.invoices(id),
  customer_id      UUID NOT NULL REFERENCES public.customers(id),
  warehouse_id     UUID REFERENCES public.warehouses(id),
  return_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  reason           TEXT NOT NULL DEFAULT 'other'
                     CHECK (reason IN ('damaged', 'wrong_product', 'expired',
                                       'customer_rejection', 'warranty', 'other')),
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'completed', 'cancelled')),
  subtotal         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, return_number)
);

CREATE INDEX IF NOT EXISTS idx_sreturn_org      ON public.sales_returns (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sreturn_customer ON public.sales_returns (customer_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER sales_returns_updated_at
  BEFORE UPDATE ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.sales_return_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  sales_return_id  UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES public.products(id),
  quantity         NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_rate         NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  batch_id         UUID REFERENCES public.batches(id),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_sreturn_items_return ON public.sales_return_items (sales_return_id);

-- ── Credit Notes ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  credit_note_number TEXT NOT NULL,
  customer_id      UUID NOT NULL REFERENCES public.customers(id),
  invoice_id       UUID REFERENCES public.invoices(id),
  sales_return_id  UUID REFERENCES public.sales_returns(id),
  issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  reason           TEXT,
  amount           NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount > 0),
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'applied', 'cancelled')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, credit_note_number)
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_org      ON public.credit_notes (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer ON public.credit_notes (customer_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER credit_notes_updated_at
  BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoices', 'invoice_items',
                            'sales_returns', 'sales_return_items',
                            'credit_notes']
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

COMMENT ON TABLE public.invoices IS 'Sales invoices; posting is atomic (inventory deduction + customer ledger debit). Immutable once posted.';
COMMENT ON TABLE public.invoice_items IS 'Line items with full GST breakdown per line (CGST/SGST/IGST).';
COMMENT ON TABLE public.sales_returns IS 'Customer returns; completing is atomic (inventory addition + customer ledger credit).';
COMMENT ON TABLE public.credit_notes IS 'Credit notes issued to customers; reduce customer outstanding.';
