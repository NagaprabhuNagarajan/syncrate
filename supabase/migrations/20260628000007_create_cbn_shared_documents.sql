-- =============================================================================
-- Migration: Create cbn_shared_documents
-- =============================================================================
-- Generic shared documents between connected organizations.
-- Covers: Purchase Orders, Invoices, Credit Notes, Debit Notes,
--         Delivery Challans, Payment Receipts, GRNs, Return Requests.
--
-- organization_id          = the SHARING org (sender)
-- counterparty_organization_id = the RECEIVING org
--
-- Only participating businesses can access shared documents.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cbn_shared_documents (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Tenant isolation: sharing org is the data owner
  organization_id              UUID NOT NULL REFERENCES public.organizations(id),
  counterparty_organization_id UUID NOT NULL REFERENCES public.organizations(id),
  connection_id                UUID NOT NULL REFERENCES public.business_connections(id),
  -- Document classification
  document_type                TEXT NOT NULL
                                 CHECK (document_type IN (
                                   'purchase_order', 'quotation', 'sales_order',
                                   'tax_invoice', 'delivery_challan', 'grn',
                                   'credit_note', 'debit_note', 'payment_receipt',
                                   'return_request', 'other'
                                 )),
  -- Reference to the source entity (in sharing org's system)
  document_reference_type      TEXT,
  document_reference_id        UUID,
  -- Human-readable identifier
  document_number              TEXT,
  document_date                DATE,
  amount                       NUMERIC(15,4),
  currency                     TEXT NOT NULL DEFAULT 'INR',
  -- Optional file attachment
  file_url                     TEXT,
  file_name                    TEXT,
  -- Visibility status
  status                       TEXT NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'revoked', 'superseded')),
  notes                        TEXT,
  -- Audit columns
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                   TIMESTAMPTZ,
  created_by                   UUID REFERENCES public.users(id),
  updated_by                   UUID REFERENCES public.users(id),
  deleted_by                   UUID REFERENCES public.users(id),
  version                      INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cbn_docs_org
  ON public.cbn_shared_documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_docs_counterparty
  ON public.cbn_shared_documents(counterparty_organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_docs_connection
  ON public.cbn_shared_documents(connection_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_docs_type
  ON public.cbn_shared_documents(document_type) WHERE deleted_at IS NULL;

-- Updated-at trigger
CREATE OR REPLACE TRIGGER cbn_shared_documents_updated_at
  BEFORE UPDATE ON public.cbn_shared_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.cbn_shared_documents ENABLE ROW LEVEL SECURITY;

-- Both parties can see the shared document
CREATE POLICY "cbn_docs_select"
  ON public.cbn_shared_documents FOR SELECT
  TO authenticated
  USING (
    organization_id = ANY(public.get_user_organization_ids())
    OR counterparty_organization_id = ANY(public.get_user_organization_ids())
  );

-- Only the sharing org can create shared documents
CREATE POLICY "cbn_docs_insert"
  ON public.cbn_shared_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = ANY(public.get_user_organization_ids())
  );

-- Only the sharing org can update (e.g., revoke)
CREATE POLICY "cbn_docs_update"
  ON public.cbn_shared_documents FOR UPDATE
  TO authenticated
  USING (organization_id = ANY(public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY(public.get_user_organization_ids()));

COMMENT ON TABLE public.cbn_shared_documents IS
  'Generic documents shared between connected organizations via the CBN.';
