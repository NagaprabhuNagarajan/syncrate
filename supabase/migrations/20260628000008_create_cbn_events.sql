-- =============================================================================
-- Migration: Create cbn_events (immutable CBN audit trail)
-- =============================================================================
-- Every synchronized CBN action creates an immutable event record.
-- These events are NEVER modified or soft-deleted — they are the permanent
-- record of all cross-org interactions.
--
-- Distinct from the main audit_logs table: CBN events capture cross-org
-- synchronization events with correlation IDs for distributed tracing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cbn_events (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The organization that owns this event record (perspective: the local org)
  organization_id           UUID NOT NULL REFERENCES public.organizations(id),
  -- Connection context
  connection_id             UUID REFERENCES public.business_connections(id),
  -- Event classification
  event_type                TEXT NOT NULL,
  -- Actors
  actor_user_id             UUID REFERENCES public.users(id),
  source_organization_id    UUID REFERENCES public.organizations(id),
  target_organization_id    UUID REFERENCES public.organizations(id),
  -- Reference to the affected entity
  reference_type            TEXT,
  reference_id              UUID,
  -- Distributed tracing
  correlation_id            UUID NOT NULL DEFAULT gen_random_uuid(),
  -- Event payload (before/after state for conflict resolution)
  metadata                  JSONB NOT NULL DEFAULT '{}',
  -- Result
  status                    TEXT NOT NULL DEFAULT 'success'
                              CHECK (status IN ('success', 'failed', 'pending')),
  error_message             TEXT,
  -- Immutable timestamp — no updated_at, no deleted_at, no soft delete
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cbn_events_org
  ON public.cbn_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbn_events_connection
  ON public.cbn_events(connection_id, created_at DESC)
  WHERE connection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_events_correlation
  ON public.cbn_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_cbn_events_reference
  ON public.cbn_events(reference_type, reference_id)
  WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_events_type
  ON public.cbn_events(event_type, created_at DESC);

-- RLS
ALTER TABLE public.cbn_events ENABLE ROW LEVEL SECURITY;

-- Both parties to the referenced connection can see events
CREATE POLICY "cbn_events_select"
  ON public.cbn_events FOR SELECT
  TO authenticated
  USING (
    organization_id = ANY(public.get_user_organization_ids())
    OR source_organization_id = ANY(public.get_user_organization_ids())
    OR target_organization_id = ANY(public.get_user_organization_ids())
  );

-- INSERT only — no UPDATE, no DELETE (immutable)
CREATE POLICY "cbn_events_insert"
  ON public.cbn_events FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = ANY(public.get_user_organization_ids())
  );

COMMENT ON TABLE public.cbn_events IS
  'Immutable CBN event log. Every cross-org sync action is recorded here. No updates or deletes.';
COMMENT ON COLUMN public.cbn_events.correlation_id IS
  'Distributed tracing ID: links the same logical event across both org event records.';
