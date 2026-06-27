-- =============================================================================
-- Migration: Purchase Requests + ledger INSERT policies + supplier_recall reason
-- =============================================================================
-- Purchase Request (requisition) → approval → convert to Purchase Order
-- (docs/PRD/4.md). Also:
--  * Adds INSERT RLS policies to the party ledger tables (they were SELECT-only,
--    so ledger writes from the Sales/Purchase domains would be denied by RLS).
--  * Adds 'supplier_recall' to the purchase_returns reason check (PRD).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id),
  request_number     TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'submitted', 'approved',
                              'rejected', 'converted', 'cancelled')),
  warehouse_id       UUID REFERENCES public.warehouses(id),
  required_date      DATE,
  notes              TEXT,
  -- Approval / conversion
  approved_by        UUID REFERENCES public.users(id),
  approved_at        TIMESTAMPTZ,
  rejected_reason    TEXT,
  converted_po_id    UUID REFERENCES public.purchase_orders(id),
  -- Audit
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ,
  created_by         UUID REFERENCES public.users(id),
  updated_by         UUID REFERENCES public.users(id),
  deleted_by         UUID REFERENCES public.users(id),
  version            INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, request_number)
);
CREATE INDEX IF NOT EXISTS idx_preq_org    ON public.purchase_requests (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_preq_status ON public.purchase_requests (organization_id, status) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER purchase_requests_updated_at
  BEFORE UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.purchase_request_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id),
  purchase_request_id  UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  product_id           UUID NOT NULL REFERENCES public.products(id),
  description          TEXT,
  quantity             NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
  estimated_price      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           UUID REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_preq_items_req ON public.purchase_request_items (purchase_request_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_requests', 'purchase_request_items']
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

-- ── Ledger INSERT policies (were SELECT-only — writes were silently RLS-denied) ─
CREATE POLICY "customer_ledger_insert_org_members"
  ON public.customer_ledger_entries FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

CREATE POLICY "supplier_ledger_insert_org_members"
  ON public.supplier_ledger_entries FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

-- ── Add supplier_recall to purchase return reasons ───────────────────────────
ALTER TABLE public.purchase_returns
  DROP CONSTRAINT IF EXISTS purchase_returns_reason_check;
ALTER TABLE public.purchase_returns
  ADD CONSTRAINT purchase_returns_reason_check
  CHECK (reason IN ('damaged', 'wrong_item', 'expired', 'quality_issue', 'supplier_recall', 'other'));

COMMENT ON TABLE public.purchase_requests IS
  'Purchase requisitions: draft → submitted → approved → converted to a PO.';
