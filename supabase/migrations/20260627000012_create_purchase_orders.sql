-- =============================================================================
-- Migration: Purchase Orders + Goods Receipts
-- =============================================================================
-- docs/PRD/4.md Purchase Management. PO workflow:
--   draft -> submitted -> approved -> ordered -> partially_received
--         -> completed (or cancelled). PO cannot be deleted after approval.
-- Goods Receipt (GRN) records delivered quantities and drives inventory events.
-- RLS uses the SECURITY DEFINER helper get_user_organization_ids() for tenant
-- isolation (recursion-safe, consistent with the fixed org policies).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES public.organizations(id),
  po_number              TEXT NOT NULL,
  supplier_id            UUID NOT NULL REFERENCES public.suppliers(id),
  warehouse_id           UUID REFERENCES public.warehouses(id),
  status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'submitted', 'approved',
                                  'ordered', 'partially_received', 'completed', 'cancelled')),
  order_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  currency               TEXT NOT NULL DEFAULT 'INR',
  notes                  TEXT,
  terms                  TEXT,
  -- Money (computed from items by the service layer)
  subtotal               NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_amount             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount           NUMERIC(14, 2) NOT NULL DEFAULT 0,
  -- Approval
  approved_by            UUID REFERENCES public.users(id),
  approved_at            TIMESTAMPTZ,
  -- Audit
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ,
  created_by             UUID REFERENCES public.users(id),
  updated_by             UUID REFERENCES public.users(id),
  deleted_by             UUID REFERENCES public.users(id),
  version                INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, po_number)
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org      ON public.purchase_orders (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders (supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status   ON public.purchase_orders (organization_id, status) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id),
  purchase_order_id  UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES public.products(id),
  description        TEXT,
  quantity           NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
  received_quantity  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  unit_price         NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_percent   NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_rate           NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON public.purchase_order_items (purchase_order_id);

CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id),
  grn_number         TEXT NOT NULL,
  purchase_order_id  UUID NOT NULL REFERENCES public.purchase_orders(id),
  warehouse_id       UUID NOT NULL REFERENCES public.warehouses(id),
  received_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  status             TEXT NOT NULL DEFAULT 'completed'
                       CHECK (status IN ('draft', 'completed')),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ,
  created_by         UUID REFERENCES public.users(id),
  updated_by         UUID REFERENCES public.users(id),
  deleted_by         UUID REFERENCES public.users(id),
  version            INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, grn_number)
);
CREATE INDEX IF NOT EXISTS idx_grn_org ON public.goods_receipts (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_grn_po  ON public.goods_receipts (purchase_order_id);

CREATE OR REPLACE TRIGGER goods_receipts_updated_at
  BEFORE UPDATE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.goods_receipt_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES public.organizations(id),
  goods_receipt_id       UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id UUID REFERENCES public.purchase_order_items(id),
  product_id             UUID NOT NULL REFERENCES public.products(id),
  ordered_quantity       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  received_quantity      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  rejected_quantity      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  batch_id               UUID REFERENCES public.batches(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by             UUID REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON public.goods_receipt_items (goods_receipt_id);

-- ── RLS (tenant isolation via recursion-safe helper) ─────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_orders', 'purchase_order_items',
                           'goods_receipts', 'goods_receipt_items']
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

COMMENT ON TABLE public.purchase_orders IS 'Purchase orders; cannot be deleted after approval (enforced in app layer).';
COMMENT ON TABLE public.goods_receipts IS 'Goods receipt notes; drive purchase inventory events.';
