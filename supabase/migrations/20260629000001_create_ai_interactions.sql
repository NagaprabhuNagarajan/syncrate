-- =============================================================================
-- Migration: Create ai_interactions (immutable AI audit trail)
-- =============================================================================
-- Spec §20 — every AI interaction records: user, organization, capability,
-- prompt summary, model, response summary, confidence, execution time,
-- approval status, timestamp. These records are NEVER modified or deleted —
-- they are the permanent, auditable record of all AI activity.
--
-- Distinct from the main audit_logs table: ai_interactions captures the LLM
-- request/response lifecycle (model, tokens, latency, confidence, approval),
-- which audit_logs does not model. Mutating business actions taken *as a
-- result* of AI (e.g. an invoice the assistant created after approval) still
-- generate a normal audit_logs entry via the relevant domain service.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id),
  actor_user_id       UUID REFERENCES public.users(id),
  -- Which AI capability produced this interaction.
  capability          TEXT NOT NULL
                        CHECK (capability IN (
                          'assistant', 'ocr', 'forecast', 'recommendation',
                          'insight', 'search', 'report'
                        )),
  -- The LLM model that served the request (provider-independent string).
  model               TEXT NOT NULL,
  -- Redacted/summarized prompt and response — never the full raw payload, to
  -- avoid persisting confidential business data verbatim in the audit log.
  prompt_summary      TEXT,
  response_summary    TEXT,
  -- 0..1 confidence in the AI output, when the capability reports one.
  confidence          NUMERIC(4, 3)
                        CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  -- Token accounting for cost attribution.
  input_tokens        INTEGER NOT NULL DEFAULT 0,
  output_tokens       INTEGER NOT NULL DEFAULT 0,
  -- Wall-clock latency of the AI call in milliseconds.
  execution_ms        INTEGER NOT NULL DEFAULT 0,
  -- Human-in-the-loop governance: critical actions require approval.
  approval_status     TEXT NOT NULL DEFAULT 'not_required'
                        CHECK (approval_status IN (
                          'not_required', 'pending', 'approved', 'rejected'
                        )),
  -- Result of the AI call itself.
  status              TEXT NOT NULL DEFAULT 'success'
                        CHECK (status IN ('success', 'failed', 'refused')),
  error_message       TEXT,
  -- Structured context/metadata (reference entity, branch, etc.).
  metadata            JSONB NOT NULL DEFAULT '{}',
  -- Immutable timestamp — no updated_at, no deleted_at, no soft delete.
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_interactions_org
  ON public.ai_interactions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_capability
  ON public.ai_interactions(organization_id, capability, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_actor
  ON public.ai_interactions(actor_user_id, created_at DESC)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_interactions_approval
  ON public.ai_interactions(organization_id, approval_status, created_at DESC)
  WHERE approval_status IN ('pending', 'approved', 'rejected');

-- RLS
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

-- Members of the owning org can read their AI audit trail.
CREATE POLICY "ai_interactions_select"
  ON public.ai_interactions FOR SELECT
  TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));

-- INSERT only — no UPDATE, no DELETE (immutable).
CREATE POLICY "ai_interactions_insert"
  ON public.ai_interactions FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

COMMENT ON TABLE public.ai_interactions IS
  'Immutable AI audit trail (spec §20). One row per LLM interaction. No updates or deletes.';
COMMENT ON COLUMN public.ai_interactions.confidence IS
  '0..1 confidence reported by the capability; NULL when not applicable.';
COMMENT ON COLUMN public.ai_interactions.approval_status IS
  'Human-in-the-loop governance: not_required | pending | approved | rejected.';
