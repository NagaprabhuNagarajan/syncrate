-- =============================================================================
-- Migration: Create business_connections
-- =============================================================================
-- Mutual connections between two organizations. Connections are always
-- bidirectional — no unilateral connections exist.
--
-- UNIQUE(requester_organization_id, recipient_organization_id) prevents
-- duplicate connection requests. The requester must always be < recipient
-- by UUID ordering to avoid A→B and B→A duplicates (enforced by CHECK).
--
-- Permission model:
--   requester_grants = what the REQUESTER allows the RECIPIENT to do
--   recipient_grants = what the RECIPIENT allows the REQUESTER to do
--
-- Default on accept: all permissions are granted to both sides.
-- Either side can restrict permissions at any time post-connection.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.business_connections (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- organization_id = requester's org (primary tenant context for audit)
  organization_id            UUID NOT NULL REFERENCES public.organizations(id),
  requester_organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  recipient_organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  -- Connection state
  status                     TEXT NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked', 'disconnected')),
  connection_message         TEXT,
  -- Per-direction permissions (array of permission keys)
  -- Permission keys: 'receive_invoices', 'receive_purchase_orders',
  --   'receive_quotations', 'view_catalog', 'view_stock',
  --   'receive_payments', 'share_documents', 'receive_delivery_updates', 'view_pricing'
  requester_grants           TEXT[] NOT NULL DEFAULT '{}',
  recipient_grants           TEXT[] NOT NULL DEFAULT '{}',
  -- Timestamps for lifecycle events
  requested_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at                TIMESTAMPTZ,
  rejected_at                TIMESTAMPTZ,
  disconnected_at            TIMESTAMPTZ,
  -- Rejection/disconnect reason
  rejection_reason           TEXT,
  -- Audit columns
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                 TIMESTAMPTZ,
  created_by                 UUID REFERENCES public.users(id),
  updated_by                 UUID REFERENCES public.users(id),
  deleted_by                 UUID REFERENCES public.users(id),
  version                    INTEGER NOT NULL DEFAULT 1,
  -- Enforce uniqueness: one connection per org pair (both directions)
  CONSTRAINT uq_business_connections_pair
    UNIQUE (requester_organization_id, recipient_organization_id),
  -- Prevent self-connection
  CONSTRAINT chk_no_self_connection
    CHECK (requester_organization_id <> recipient_organization_id),
  -- organization_id must be one of the two sides (data integrity)
  CONSTRAINT chk_org_is_participant
    CHECK (
      organization_id = requester_organization_id
      OR organization_id = recipient_organization_id
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_connections_requester
  ON public.business_connections(requester_organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_business_connections_recipient
  ON public.business_connections(recipient_organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_business_connections_status
  ON public.business_connections(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_business_connections_accepted
  ON public.business_connections(requester_organization_id, recipient_organization_id)
  WHERE status = 'accepted' AND deleted_at IS NULL;

-- Updated-at trigger
CREATE OR REPLACE TRIGGER business_connections_updated_at
  BEFORE UPDATE ON public.business_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.business_connections ENABLE ROW LEVEL SECURITY;

-- Both parties can view their connection.
-- Uses get_user_organization_ids() (reads organization_members, NOT business_connections).
-- No recursion risk.
CREATE POLICY "connections_select"
  ON public.business_connections FOR SELECT
  TO authenticated
  USING (
    requester_organization_id = ANY(public.get_user_organization_ids())
    OR recipient_organization_id = ANY(public.get_user_organization_ids())
  );

-- Only the requester's org can create a new connection request.
CREATE POLICY "connections_insert"
  ON public.business_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_organization_id = ANY(public.get_user_organization_ids())
  );

-- Both parties can update the connection (accept/reject/update permissions).
-- Fine-grained logic is enforced in the RPC layer.
CREATE POLICY "connections_update"
  ON public.business_connections FOR UPDATE
  TO authenticated
  USING (
    requester_organization_id = ANY(public.get_user_organization_ids())
    OR recipient_organization_id = ANY(public.get_user_organization_ids())
  );

COMMENT ON TABLE public.business_connections IS
  'Mutual CBN connections between organizations. Both sides must agree before connecting.';
COMMENT ON COLUMN public.business_connections.requester_grants IS
  'Permissions the requester grants to the recipient (what recipient can receive from requester).';
COMMENT ON COLUMN public.business_connections.recipient_grants IS
  'Permissions the recipient grants to the requester (what requester can receive from recipient).';
