-- =============================================================================
-- Migration: Purchase Invoices + Purchase Returns
-- =============================================================================
-- Purchase invoices post to the supplier ledger (immutable once posted; posted
-- invoices cannot be deleted — enforced in app layer). Purchase returns reverse
-- received goods (purchase_return inventory event) and credit the supplier.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES public.organizations(id),
  invoice_number           TEXT NOT NULL,            -- our internal reference
  supplier_invoice_number  TEXT,                     -- the supplier's bill no.
  purchase_order_id        UUID REFERENCES public.purchase_orders(id),
  supplier_id              UUID NOT NULL REFERENCES public.suppliers(id),
  invoice_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date                 DATE,
  status                   TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'posted', 'cancelled')),
  subtotal                 NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_amount               NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  amount_paid              NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes                    TEXT,
  posted_at                TIMESTAMPTZ,
  posted_by                UUID REFERENCES public.users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ,
  created_by               UUID REFERENCES public.users(id),
  updated_by               UUID REFERENCES public.users(id),
  deleted_by               UUID REFERENCES public.users(id),
  version                  INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_pinv_org      ON public.purchase_invoices (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pinv_supplier ON public.purchase_invoices (supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pinv_status   ON public.purchase_invoices (organization_id, status) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER purchase_invoices_updated_at
  BEFORE UPDATE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.purchase_invoice_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id),
  purchase_invoice_id  UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  product_id           UUID NOT NULL REFERENCES public.products(id),
  description          TEXT,
  quantity             NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
  unit_price           NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_rate             NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_amount           NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total           NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           UUID REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_pinv_items_invoice ON public.purchase_invoice_items (purchase_invoice_id);

CREATE TABLE IF NOT EXISTS public.purchase_returns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id),
  return_number      TEXT NOT NULL,
  purchase_order_id  UUID REFERENCES public.purchase_orders(id),
  supplier_id        UUID NOT NULL REFERENCES public.suppliers(id),
  warehouse_id       UUID REFERENCES public.warehouses(id),
  return_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  reason             TEXT NOT NULL DEFAULT 'other'
                       CHECK (reason IN ('damaged', 'wrong_item', 'expired', 'quality_issue', 'other')),
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'completed', 'cancelled')),
  subtotal           NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ,
  created_by         UUID REFERENCES public.users(id),
  updated_by         UUID REFERENCES public.users(id),
  deleted_by         UUID REFERENCES public.users(id),
  version            INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, return_number)
);
CREATE INDEX IF NOT EXISTS idx_preturn_org      ON public.purchase_returns (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_preturn_supplier ON public.purchase_returns (supplier_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER purchase_returns_updated_at
  BEFORE UPDATE ON public.purchase_returns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.purchase_return_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id),
  purchase_return_id UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES public.products(id),
  quantity           NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
  unit_price         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_rate           NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  batch_id           UUID REFERENCES public.batches(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_preturn_items_return ON public.purchase_return_items (purchase_return_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_invoices', 'purchase_invoice_items',
                           'purchase_returns', 'purchase_return_items']
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

COMMENT ON TABLE public.purchase_invoices IS 'Supplier bills; posting writes the supplier ledger. Immutable once posted.';
COMMENT ON TABLE public.purchase_returns IS 'Goods returned to suppliers; reverse inventory + credit supplier.';
