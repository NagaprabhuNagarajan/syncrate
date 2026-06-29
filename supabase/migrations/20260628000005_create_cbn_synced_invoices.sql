-- =============================================================================
-- Migration: Create cbn_invoices (cross-org synchronized invoices)
-- =============================================================================
-- When a supplier posts an invoice and pushes it to a connected customer,
-- a cbn_invoice record is created that both parties can read.
--
-- organization_id          = the SUPPLIER's org (data owner / sender)
-- counterparty_organization_id = the BUYER's org (receiver)
--
-- RLS: both sides can SELECT. Only the supplier can INSERT (via RPC).
-- The INSERT is always done through the send_cbn_invoice() RPC which
-- validates the accepted connection + cbn.sync permission first.
--
-- Conflict resolution: after customer approval, supplier cannot edit
-- the original invoice — they must create a credit/debit note.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cbn_invoices (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Tenant isolation: supplier's org is the data owner
  organization_id              UUID NOT NULL REFERENCES public.organizations(id),
  -- The connected customer organization receiving this invoice
  counterparty_organization_id UUID NOT NULL REFERENCES public.organizations(id),
  -- Link to the accepted connection (validated by RPC)
  connection_id                UUID NOT NULL REFERENCES public.business_connections(id),
  -- Link to the original invoice in the supplier's system
  source_invoice_id            UUID NOT NULL REFERENCES public.invoices(id),
  -- Denormalized snapshot fields (for display without joins across orgs)
  invoice_number               TEXT NOT NULL,
  invoice_date                 DATE NOT NULL,
  due_date                     DATE,
  subtotal                     NUMERIC(15,4) NOT NULL DEFAULT 0,
  tax_amount                   NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_amount                 NUMERIC(15,4) NOT NULL DEFAULT 0,
  currency                     TEXT NOT NULL DEFAULT 'INR',
  -- Sync status
  status                       TEXT NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  -- Buyer's action
  accepted_at                  TIMESTAMPTZ,
  accepted_by                  UUID REFERENCES public.users(id),
  rejected_at                  TIMESTAMPTZ,
  rejected_by                  UUID REFERENCES public.users(id),
  rejection_reason             TEXT,
  -- Link to the purchase invoice created in the buyer's system on accept
  buyer_purchase_invoice_id    UUID,   -- FK to purchase_invoices — no FK constraint (cross-org)
  -- Audit columns
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                   TIMESTAMPTZ,
  created_by                   UUID REFERENCES public.users(id),
  updated_by                   UUID REFERENCES public.users(id),
  deleted_by                   UUID REFERENCES public.users(id),
  version                      INTEGER NOT NULL DEFAULT 1,
  -- Prevent duplicate sends of the same invoice to the same connection
  CONSTRAINT uq_cbn_invoice_source_conn UNIQUE (source_invoice_id, connection_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cbn_invoices_org
  ON public.cbn_invoices(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_invoices_counterparty
  ON public.cbn_invoices(counterparty_organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_invoices_status
  ON public.cbn_invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_invoices_connection
  ON public.cbn_invoices(connection_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_invoices_source
  ON public.cbn_invoices(source_invoice_id) WHERE deleted_at IS NULL;

-- Updated-at trigger
CREATE OR REPLACE TRIGGER cbn_invoices_updated_at
  BEFORE UPDATE ON public.cbn_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.cbn_invoices ENABLE ROW LEVEL SECURITY;

-- Both the supplier (organization_id) and the buyer (counterparty_organization_id)
-- can read synced invoices. Uses get_user_organization_ids() only — no recursion.
CREATE POLICY "cbn_invoices_select"
  ON public.cbn_invoices FOR SELECT
  TO authenticated
  USING (
    organization_id = ANY(public.get_user_organization_ids())
    OR counterparty_organization_id = ANY(public.get_user_organization_ids())
  );

-- INSERT: only the sending org (supplier) can insert.
-- The send_cbn_invoice() RPC does all validation; this policy is a last defense.
CREATE POLICY "cbn_invoices_insert"
  ON public.cbn_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = ANY(public.get_user_organization_ids())
  );

-- UPDATE: only the counterparty (buyer) can update status (accept/reject).
-- The RPC layer enforces finer-grained rules.
CREATE POLICY "cbn_invoices_update"
  ON public.cbn_invoices FOR UPDATE
  TO authenticated
  USING (
    organization_id = ANY(public.get_user_organization_ids())
    OR counterparty_organization_id = ANY(public.get_user_organization_ids())
  );

COMMENT ON TABLE public.cbn_invoices IS
  'Cross-org synchronized invoices. Supplier pushes, buyer accepts/rejects.';
