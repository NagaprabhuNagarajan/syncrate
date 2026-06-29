-- =============================================================================
-- Migration: Create workflows + instances + step executions (Sprint 9 — Workflow Engine)
-- =============================================================================
-- Generic, configurable automation: a WORKFLOW defines an ordered list of steps
-- triggered by a business event; starting one creates an INSTANCE that advances
-- through the steps, recording a STEP EXECUTION per step for observability. Some
-- step types are blocking (e.g. 'approval' waits for an approval decision); the
-- instance pauses at 'running'/awaiting and resumes when unblocked.
-- =============================================================================

-- ── workflows ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workflows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  name             TEXT NOT NULL,
  description      TEXT,
  -- Business event that starts the workflow, e.g. 'invoice.created'.
  trigger_event    TEXT NOT NULL,
  -- Ordered step list, e.g.
  --   [{"id":"s1","name":"Notify","type":"webhook","config":{...}},
  --    {"id":"s2","name":"Approve","type":"approval","config":{...}}]
  definition       JSONB NOT NULL DEFAULT '{"steps":[]}',
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

CREATE INDEX IF NOT EXISTS idx_workflows_org
  ON public.workflows(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_trigger
  ON public.workflows(organization_id, trigger_event)
  WHERE deleted_at IS NULL AND is_active = true;

-- ── workflow_instances ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_instances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id),
  workflow_id         UUID NOT NULL REFERENCES public.workflows(id),
  entity_type         TEXT,
  entity_id           UUID,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'running', 'awaiting', 'completed', 'failed', 'cancelled')),
  current_step_index  INTEGER NOT NULL DEFAULT 0,
  context             JSONB NOT NULL DEFAULT '{}',
  error               TEXT,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_org
  ON public.workflow_instances(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow
  ON public.workflow_instances(workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_active
  ON public.workflow_instances(organization_id, status)
  WHERE status IN ('pending', 'running', 'awaiting');

-- ── workflow_step_executions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_step_executions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  instance_id      UUID NOT NULL REFERENCES public.workflow_instances(id),
  step_id          TEXT NOT NULL,
  step_index       INTEGER NOT NULL,
  step_type        TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  output           JSONB NOT NULL DEFAULT '{}',
  error            TEXT,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_step_exec_instance
  ON public.workflow_step_executions(instance_id, step_index);
CREATE INDEX IF NOT EXISTS idx_workflow_step_exec_org
  ON public.workflow_step_executions(organization_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflows_select"
  ON public.workflows FOR SELECT TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "workflows_insert"
  ON public.workflows FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "workflows_update"
  ON public.workflows FOR UPDATE TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

CREATE POLICY "workflow_instances_select"
  ON public.workflow_instances FOR SELECT TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "workflow_instances_insert"
  ON public.workflow_instances FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "workflow_instances_update"
  ON public.workflow_instances FOR UPDATE TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

CREATE POLICY "workflow_step_executions_select"
  ON public.workflow_step_executions FOR SELECT TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "workflow_step_executions_insert"
  ON public.workflow_step_executions FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "workflow_step_executions_update"
  ON public.workflow_step_executions FOR UPDATE TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

COMMENT ON TABLE public.workflows IS
  'Configurable automation definitions: trigger_event + ordered steps in definition.';
COMMENT ON TABLE public.workflow_instances IS
  'A single run of a workflow against an entity; advances through steps, pausing on blocking ones.';
COMMENT ON TABLE public.workflow_step_executions IS
  'Per-step execution log for a workflow instance (observability).';
