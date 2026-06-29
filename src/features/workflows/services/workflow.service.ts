import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Json } from "@/types/database.types";
import { WorkflowRepository } from "@/features/workflows/repositories/workflow.repository";
import type { WorkflowUpdatePatch } from "@/features/workflows/repositories/workflow.repository";
import { WorkflowInstanceRepository } from "@/features/workflows/repositories/workflow-instance.repository";
import { WorkflowStepExecutionRepository } from "@/features/workflows/repositories/workflow-step-execution.repository";
import type {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  Workflow,
  WorkflowErrorCode,
  WorkflowResult,
  WorkflowRun,
} from "@/features/workflows/types/workflow.types";

function ok<T>(data: T): WorkflowResult<T> {
  return { success: true, data };
}

function fail(code: WorkflowErrorCode, message: string): WorkflowResult<never> {
  return { success: false, error: { code, message } };
}

/** Normalizes an optional string: trims and converts "" → null. */
function nz(value: string | undefined | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * CRUD + read service for workflow definitions and their run history. The
 * execution engine lives separately in `workflow-engine.service.ts` because it
 * is `server-only` (it drives webhook delivery and the approval engine).
 */
export class WorkflowService {
  private readonly repo: WorkflowRepository;
  private readonly instances: WorkflowInstanceRepository;
  private readonly stepExecutions: WorkflowStepExecutionRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new WorkflowRepository(supabase);
    this.instances = new WorkflowInstanceRepository(supabase);
    this.stepExecutions = new WorkflowStepExecutionRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listWorkflows(organizationId: string): Promise<Workflow[]> {
    return this.repo.list(organizationId);
  }

  async getWorkflow(id: string): Promise<WorkflowResult<Workflow>> {
    const workflow = await this.repo.findById(id);
    if (!workflow) {
      return fail("not_found", "Workflow not found");
    }
    return ok(workflow);
  }

  /**
   * Returns the run history for every workflow in the org, grouped by instance.
   * Each run pairs an instance with its ordered step executions.
   */
  async listRuns(organizationId: string): Promise<WorkflowRun[]> {
    const [instances, steps] = await Promise.all([
      this.instances.listByOrg(organizationId),
      this.stepExecutions.listByOrg(organizationId),
    ]);

    const stepsByInstance = new Map<string, typeof steps>();
    for (const step of steps) {
      const bucket = stepsByInstance.get(step.instanceId) ?? [];
      bucket.push(step);
      stepsByInstance.set(step.instanceId, bucket);
    }

    return instances.map((instance) => ({
      instance,
      steps: (stepsByInstance.get(instance.id) ?? []).sort(
        (a, b) => a.stepIndex - b.stepIndex
      ),
    }));
  }

  // ── Create ─────────────────────────────────────────────────

  async createWorkflow(
    input: CreateWorkflowInput,
    organizationId: string,
    userId: string
  ): Promise<WorkflowResult<Workflow>> {
    const workflow = await this.repo.create({
      organization_id: organizationId,
      name: input.name.trim(),
      description: nz(input.description),
      trigger_event: input.triggerEvent.trim(),
      definition: { steps: input.steps } as unknown as Json,
      is_active: input.isActive ?? true,
      created_by: userId,
    });

    if (!workflow) {
      return fail("unknown", "Failed to create workflow. Please try again.");
    }
    return ok(workflow);
  }

  // ── Update ─────────────────────────────────────────────────

  async updateWorkflow(
    id: string,
    input: UpdateWorkflowInput,
    userId: string
  ): Promise<WorkflowResult<Workflow>> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return fail("not_found", "Workflow not found");
    }
    if (existing.version !== input.version) {
      return fail(
        "conflict",
        "This workflow was modified by someone else. Reload and try again."
      );
    }

    const patch: WorkflowUpdatePatch = {};
    if (input.name !== undefined) {
      patch.name = input.name.trim();
    }
    if (input.description !== undefined) {
      patch.description = nz(input.description);
    }
    if (input.triggerEvent !== undefined) {
      patch.trigger_event = input.triggerEvent.trim();
    }
    if (input.steps !== undefined) {
      patch.definition = { steps: input.steps } as unknown as Json;
    }
    if (input.isActive !== undefined) {
      patch.is_active = input.isActive;
    }

    const updated = await this.repo.update(id, patch, userId, input.version);
    if (!updated) {
      return fail(
        "conflict",
        "This workflow was modified by someone else. Reload and try again."
      );
    }
    return ok(updated);
  }

  // ── Delete (soft) ──────────────────────────────────────────

  async deleteWorkflow(
    id: string,
    userId: string
  ): Promise<WorkflowResult<void>> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return fail("not_found", "Workflow not found");
    }
    const deleted = await this.repo.softDelete(id, userId);
    if (!deleted) {
      return fail("unknown", "Failed to delete workflow. Please try again.");
    }
    return ok(undefined);
  }
}
