-- =============================================================================
-- Migration: Create audit_logs
-- =============================================================================
-- Append-only audit trail. Every mutating action records an entry (CLAUDE.md
-- security rules: "Every mutating action must generate an audit log").
-- Audit records are IMMUTABLE — no update/delete; no updated_at/version.
-- Viewing is gated by the `settings.audit_logs` permission at the app layer.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  actor_user_id    UUID REFERENCES public.users(id),
  -- What happened
  action           TEXT NOT NULL,            -- e.g. 'customer.create'
  entity_type      TEXT NOT NULL,            -- e.g. 'customer'
  entity_id        UUID,                     -- affected record (nullable for bulk)
  summary          TEXT,                     -- human-readable one-liner
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Request context (optional)
  ip_address       TEXT,
  user_agent       TEXT,
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org
  ON public.audit_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (organization_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs (organization_id, actor_user_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Org members may read their org's audit trail (fine-grained settings.audit_logs
-- permission is enforced at the application layer).
CREATE POLICY "audit_logs_select_org_members"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

-- Authenticated org members may append audit entries for their org.
-- No UPDATE or DELETE policies exist — the table is append-only by design.
CREATE POLICY "audit_logs_insert_org_members"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
  );

COMMENT ON TABLE public.audit_logs IS
  'Immutable, append-only audit trail of mutating actions per organization.';
