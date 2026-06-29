-- =============================================================================
-- Migration: Create approval_rules + approval_requests (Sprint 9 — Approval Engine)
-- =============================================================================
-- Configurable approvals: an org defines RULES (e.g. "purchase invoices over
-- ₹100,000 need Owner approval"); when a matching action occurs the app raises
-- a REQUEST that an authorized approver decides. Decisions are recorded
-- immutably-in-spirit (status + decided_by/at + reason); the request row is the
-- single source of truth for the approval lifecycle.
-- =============================================================================

-- ── approval_rules ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approval_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  name             TEXT NOT NULL,
  description      TEXT,
  -- Domain the rule applies to, e.g. 'purchase_invoice', 'sales_invoice'.
  entity_type      TEXT NOT NULL,
  -- Structured trigger condition, e.g.
  --   {"field":"total_amount","operator":"gte","value":100000}
  condition        JSONB NOT NULL DEFAULT '{}',
  -- Role whose members may decide requests raised by this rule.
  approver_role_id UUID REFERENCES public.roles(id),
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

CREATE INDEX IF NOT EXISTS idx_approval_rules_org
  ON public.approval_rules(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_approval_rules_entity
  ON public.approval_rules(organization_id, entity_type)
  WHERE deleted_at IS NULL AND is_active = true;

-- ── approval_requests ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  rule_id          UUID REFERENCES public.approval_rules(id),
  entity_type      TEXT NOT NULL,
  entity_id        UUID NOT NULL,
  requested_by     UUID REFERENCES public.users(id),
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by       UUID REFERENCES public.users(id),
  decided_at       TIMESTAMPTZ,
  decision_reason  TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version          INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_org
  ON public.approval_requests(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending
  ON public.approval_requests(organization_id, status, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approval_requests_entity
  ON public.approval_requests(organization_id, entity_type, entity_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_rules_select"
  ON public.approval_rules FOR SELECT TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "approval_rules_insert"
  ON public.approval_rules FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "approval_rules_update"
  ON public.approval_rules FOR UPDATE TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

CREATE POLICY "approval_requests_select"
  ON public.approval_requests FOR SELECT TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "approval_requests_insert"
  ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "approval_requests_update"
  ON public.approval_requests FOR UPDATE TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

COMMENT ON TABLE public.approval_rules IS
  'Configurable approval rules. condition is a JSON predicate evaluated against the entity.';
COMMENT ON TABLE public.approval_requests IS
  'Approval lifecycle records: pending → approved/rejected/cancelled.';
