-- =============================================================================
-- Migration: Create cbn_purchase_orders (cross-org synchronized POs)
-- =============================================================================
-- When a buyer creates a purchase order and pushes it to a connected supplier,
-- a cbn_purchase_order record is created that both parties can read.
--
-- organization_id          = the BUYER's org (data owner / sender)
-- counterparty_organization_id = the SUPPLIER's org (receiver)
--
-- Same cross-org RLS pattern as cbn_invoices.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cbn_purchase_orders (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Tenant isolation: buyer's org is the data owner
  organization_id              UUID NOT NULL REFERENCES public.organizations(id),
  -- The connected supplier organization receiving this PO
  counterparty_organization_id UUID NOT NULL REFERENCES public.organizations(id),
  -- Link to the accepted connection
  connection_id                UUID NOT NULL REFERENCES public.business_connections(id),
  -- Link to the original PO in the buyer's system
  source_purchase_order_id     UUID NOT NULL REFERENCES public.purchase_orders(id),
  -- Denormalized snapshot fields
  po_number                    TEXT NOT NULL,
  po_date                      DATE NOT NULL,
  expected_delivery_date       DATE,
  subtotal                     NUMERIC(15,4) NOT NULL DEFAULT 0,
  tax_amount                   NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_amount                 NUMERIC(15,4) NOT NULL DEFAULT 0,
  currency                     TEXT NOT NULL DEFAULT 'INR',
  -- Sync status
  status                       TEXT NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'fulfilled')),
  -- Supplier's action
  accepted_at                  TIMESTAMPTZ,
  accepted_by                  UUID REFERENCES public.users(id),
  rejected_at                  TIMESTAMPTZ,
  rejected_by                  UUID REFERENCES public.users(id),
  rejection_reason             TEXT,
  -- Link to the sales order created in the supplier's system on accept
  supplier_sales_order_id      UUID,   -- FK to sales_orders — no FK constraint (cross-org)
  -- Audit columns
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                   TIMESTAMPTZ,
  created_by                   UUID REFERENCES public.users(id),
  updated_by                   UUID REFERENCES public.users(id),
  deleted_by                   UUID REFERENCES public.users(id),
  version                      INTEGER NOT NULL DEFAULT 1,
  -- Prevent duplicate sends
  CONSTRAINT uq_cbn_po_source_conn UNIQUE (source_purchase_order_id, connection_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cbn_pos_org
  ON public.cbn_purchase_orders(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_pos_counterparty
  ON public.cbn_purchase_orders(counterparty_organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_pos_status
  ON public.cbn_purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_pos_connection
  ON public.cbn_purchase_orders(connection_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_pos_source
  ON public.cbn_purchase_orders(source_purchase_order_id) WHERE deleted_at IS NULL;

-- Updated-at trigger
CREATE OR REPLACE TRIGGER cbn_purchase_orders_updated_at
  BEFORE UPDATE ON public.cbn_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.cbn_purchase_orders ENABLE ROW LEVEL SECURITY;

-- Both buyer and supplier can read synced POs
CREATE POLICY "cbn_pos_select"
  ON public.cbn_purchase_orders FOR SELECT
  TO authenticated
  USING (
    organization_id = ANY(public.get_user_organization_ids())
    OR counterparty_organization_id = ANY(public.get_user_organization_ids())
  );

CREATE POLICY "cbn_pos_insert"
  ON public.cbn_purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = ANY(public.get_user_organization_ids())
  );

CREATE POLICY "cbn_pos_update"
  ON public.cbn_purchase_orders FOR UPDATE
  TO authenticated
  USING (
    organization_id = ANY(public.get_user_organization_ids())
    OR counterparty_organization_id = ANY(public.get_user_organization_ids())
  );

COMMENT ON TABLE public.cbn_purchase_orders IS
  'Cross-org synchronized purchase orders. Buyer pushes, supplier accepts/rejects.';
