-- =============================================================================
-- Migration: Sales Orders + Sales Order Items
-- =============================================================================
-- Sales order workflow:
--   draft → submitted → approved → processing → partially_delivered
--         → completed (or cancelled at any non-terminal state)
-- Inventory is reserved after approval (enforced in app layer).
-- Price changes after approval require re-approval (enforced in app layer).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id),
  so_number           TEXT NOT NULL,
  customer_id         UUID NOT NULL REFERENCES public.customers(id),
  quotation_id        UUID REFERENCES public.quotations(id),
  branch_id           UUID REFERENCES public.branches(id),
  warehouse_id        UUID REFERENCES public.warehouses(id),
  salesperson_id      UUID REFERENCES public.users(id),
  reference_number    TEXT,
  order_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date       DATE,
  payment_terms_days  INTEGER NOT NULL DEFAULT 0,
  supply_state        TEXT,               -- for GST determination
  is_interstate       BOOLEAN NOT NULL DEFAULT false,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'submitted', 'approved',
                                          'processing', 'partially_delivered',
                                          'completed', 'cancelled')),
  subtotal            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cgst_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sgst_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  igst_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  round_off           NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes               TEXT,
  terms               TEXT,
  -- Approval
  approved_by         UUID REFERENCES public.users(id),
  approved_at         TIMESTAMPTZ,
  -- Conversion to invoice
  converted_inv_id    UUID,
  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES public.users(id),
  updated_by          UUID REFERENCES public.users(id),
  deleted_by          UUID REFERENCES public.users(id),
  version             INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, so_number)
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_org      ON public.sales_orders (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON public.sales_orders (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_orders_status   ON public.sales_orders (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_orders_date     ON public.sales_orders (organization_id, order_date DESC) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  sales_order_id   UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES public.products(id),
  description      TEXT,
  hsn_code         TEXT,
  quantity         NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
  delivered_qty    NUMERIC(14, 2) NOT NULL DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_so_items_so ON public.sales_order_items (sales_order_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales_orders', 'sales_order_items']
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

COMMENT ON TABLE public.sales_orders IS 'Sales orders; converted to invoices. Inventory reserved after approval.';
COMMENT ON TABLE public.sales_order_items IS 'Line items for sales orders with GST breakdown.';
