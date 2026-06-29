-- =============================================================================
-- Migration: Create webhook_endpoints + webhook_deliveries (Sprint 9 — Webhooks)
-- =============================================================================
-- Organizations register HTTPS endpoints subscribed to event types; the app
-- POSTs signed (HMAC-SHA256) payloads on those events and records every
-- delivery attempt. The signing `secret` is needed server-side to sign each
-- request, so it is stored (RLS-protected) and the repository layer must omit
-- it from any data returned to the client (shown once at creation only).
-- =============================================================================

-- ── webhook_endpoints ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  url              TEXT NOT NULL,
  description      TEXT,
  -- HMAC signing secret (whsec_...). Used server-side to sign deliveries.
  secret           TEXT NOT NULL,
  -- Subscribed event types, e.g. {'invoice.created','payment.recorded'}.
  event_types      TEXT[] NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org
  ON public.webhook_endpoints(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active
  ON public.webhook_endpoints(organization_id)
  WHERE deleted_at IS NULL AND is_active = true;

-- ── webhook_deliveries ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  endpoint_id      UUID NOT NULL REFERENCES public.webhook_endpoints(id),
  event_type       TEXT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'success', 'failed')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  response_status  INTEGER,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint
  ON public.webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org
  ON public.webhook_deliveries(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status
  ON public.webhook_deliveries(organization_id, status, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_endpoints_select"
  ON public.webhook_endpoints FOR SELECT TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "webhook_endpoints_insert"
  ON public.webhook_endpoints FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "webhook_endpoints_update"
  ON public.webhook_endpoints FOR UPDATE TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

CREATE POLICY "webhook_deliveries_select"
  ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "webhook_deliveries_insert"
  ON public.webhook_deliveries FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "webhook_deliveries_update"
  ON public.webhook_deliveries FOR UPDATE TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

COMMENT ON TABLE public.webhook_endpoints IS
  'Registered outbound webhook endpoints. secret is the HMAC signing key (never returned to clients after creation).';
COMMENT ON TABLE public.webhook_deliveries IS
  'Per-attempt delivery log for webhook events. Append-only plus status/attempt updates.';
