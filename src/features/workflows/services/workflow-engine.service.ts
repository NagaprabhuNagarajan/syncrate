import "server-only";

import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Json } from "@/types/database.types";
import { WorkflowRepository } from "@/features/workflows/repositories/workflow.repository";
import { WorkflowInstanceRepository } from "@/features/workflows/repositories/workflow-instance.repository";
import { WorkflowStepExecutionRepository } from "@/features/workflows/repositories/workflow-step-execution.repository";
import { WebhookDispatchService } from "@/features/webhooks/services/webhook-dispatch.service";
import { ApprovalService } from "@/features/approvals/services/approval.service";
import {
  BLOCKING_STEP_TYPES,
  type ResumeInstanceInput,
  type StartWorkflowInput,
  type Workflow,
  type WorkflowInstance,
  type WorkflowResult,
  type WorkflowStep,
} from "@/features/workflows/types/workflow.types";

/** Reserved context key used to carry the run's actor across a resume. */
const ACTOR_CONTEXT_KEY = "_actorUserId";

/**
 * The collaborators the engine drives. Exposed so unit tests can inject mocks
 * directly without module mocking; in production the constructor builds the
 * real implementations from a Supabase client.
 */
export interface WorkflowEngineDeps {
  readonly workflows: WorkflowRepository;
  readonly instances: WorkflowInstanceRepository;
  readonly stepExecutions: WorkflowStepExecutionRepository;
  readonly webhookDispatch: WebhookDispatchService;
  readonly approvals: ApprovalService;
}

function ok<T>(data: T): WorkflowResult<T> {
  return { success: true, data };
}

function isBlocking(step: WorkflowStep): boolean {
  return BLOCKING_STEP_TYPES.includes(step.type);
}

/**
 * Drives a workflow run step-by-step.
 *
 * SECURITY: `server-only` — it calls the webhook delivery engine and the
 * approval engine and must never be imported into a client component.
 *
 * Lifecycle: `startWorkflow` creates a `running` instance and advances through
 * the steps. Non-blocking steps (`log`/`noop`/`webhook`) execute immediately,
 * each writing a completed/failed `workflow_step_executions` row. A blocking
 * step (`approval`) writes a `running` step execution, flips the instance to
 * `awaiting` (recording `current_step_index`) and stops. `resumeInstance`
 * continues after the approval decision. All instance writes use optimistic
 * locking (version).
 */
export class WorkflowEngineService {
  private readonly workflows: WorkflowRepository;
  private readonly instances: WorkflowInstanceRepository;
  private readonly stepExecutions: WorkflowStepExecutionRepository;
  private readonly webhookDispatch: WebhookDispatchService;
  private readonly approvals: ApprovalService;

  constructor(
    supabase: AppSupabaseClient,
    deps?: Partial<WorkflowEngineDeps>
  ) {
    this.workflows = deps?.workflows ?? new WorkflowRepository(supabase);
    this.instances =
      deps?.instances ?? new WorkflowInstanceRepository(supabase);
    this.stepExecutions =
      deps?.stepExecutions ?? new WorkflowStepExecutionRepository(supabase);
    this.webhookDispatch =
      deps?.webhookDispatch ?? new WebhookDispatchService(supabase);
    this.approvals = deps?.approvals ?? new ApprovalService(supabase);
  }

  // ── Start ──────────────────────────────────────────────────

  async startWorkflow(
    input: StartWorkflowInput
  ): Promise<WorkflowResult<WorkflowInstance>> {
    const workflow = await this.workflows.findById(input.workflowId);
    if (!workflow) {
      return { success: false, error: { code: "not_found", message: "Workflow not found" } };
    }
    if (workflow.organizationId !== input.organizationId) {
      return { success: false, error: { code: "forbidden", message: "Workflow belongs to another organization" } };
    }
    if (!workflow.isActive) {
      return { success: false, error: { code: "invalid_state", message: "Workflow is not active" } };
    }

    // Persist the actor inside the context so a later resume (which has no
    // actor) can still attribute approval requests it raises.
    const context: Record<string, unknown> = {
      ...(input.context ?? {}),
      [ACTOR_CONTEXT_KEY]: input.actorUserId,
    };

    const instance = await this.instances.create({
      organization_id: input.organizationId,
      workflow_id: workflow.id,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      status: "running",
      current_step_index: 0,
      context: context as Json,
      started_at: new Date().toISOString(),
    });

    if (!instance) {
      return { success: false, error: { code: "unknown", message: "Failed to start workflow. Please try again." } };
    }

    return this.runFrom(workflow, instance, 0);
  }

  // ── Resume (after an approval decision) ────────────────────

  async resumeInstance(
    input: ResumeInstanceInput
  ): Promise<WorkflowResult<WorkflowInstance>> {
    const instance = await this.instances.findById(input.instanceId);
    if (!instance) {
      return { success: false, error: { code: "not_found", message: "Workflow instance not found" } };
    }
    if (instance.status !== "awaiting") {
      return {
        success: false,
        error: {
          code: "invalid_state",
          message: `Instance is ${instance.status}, not awaiting a decision.`,
        },
      };
    }

    const workflow = await this.workflows.findById(instance.workflowId);
    if (!workflow) {
      return { success: false, error: { code: "not_found", message: "Workflow not found" } };
    }

    const index = instance.currentStepIndex;
    const step = workflow.steps[index];

    // Close out the suspended (running) step execution for this index.
    const running = (
      await this.stepExecutions.listByInstance(instance.id)
    ).find((s) => s.stepIndex === index && s.status === "running");

    if (input.approved) {
      if (running) {
        await this.stepExecutions.update(running.id, {
          status: "completed",
          output: { decision: "approved", stepId: step?.id ?? null } as Json,
          completed_at: new Date().toISOString(),
        });
      }
      // Re-arm the instance to running, then continue past the approval step.
      const resumed = await this.instances.update(
        instance.id,
        { status: "running" },
        instance.version
      );
      if (!resumed) {
        return { success: false, error: { code: "conflict", message: "Instance was modified concurrently. Reload and try again." } };
      }
      return this.runFrom(workflow, resumed, index + 1);
    }

    // Rejected: fail the step, cancel the instance.
    if (running) {
      await this.stepExecutions.update(running.id, {
        status: "failed",
        error: "Approval rejected",
        output: { decision: "rejected", stepId: step?.id ?? null } as Json,
        completed_at: new Date().toISOString(),
      });
    }
    const cancelled = await this.instances.update(
      instance.id,
      {
        status: "cancelled",
        error: "Approval rejected",
        completed_at: new Date().toISOString(),
      },
      instance.version
    );
    if (!cancelled) {
      return { success: false, error: { code: "conflict", message: "Instance was modified concurrently. Reload and try again." } };
    }
    return ok(cancelled);
  }

  // ── Core step loop ─────────────────────────────────────────

  /**
   * Advances `instance` from `startIndex`. Returns the latest instance state:
   * `completed` on reaching the end, `awaiting` when it hits a blocking step,
   * or `failed` when a step throws.
   */
  private async runFrom(
    workflow: Workflow,
    instance: WorkflowInstance,
    startIndex: number
  ): Promise<WorkflowResult<WorkflowInstance>> {
    const steps = workflow.steps;
    // The instance version is stable across this run: non-blocking steps only
    // write step-execution rows; the instance row is updated exactly once at a
    // terminal/awaiting transition, guarded by this version.
    const version = instance.version;

    for (let index = startIndex; index < steps.length; index += 1) {
      const step = steps[index];
      if (!step) {
        continue;
      }

      if (isBlocking(step)) {
        return this.suspendForApproval(instance, step, index, version);
      }

      const failure = await this.runNonBlockingStep(instance, step, index);
      if (failure) {
        const failed = await this.instances.update(
          instance.id,
          {
            status: "failed",
            error: failure,
            current_step_index: index,
            completed_at: new Date().toISOString(),
          },
          version
        );
        if (!failed) {
          return { success: false, error: { code: "conflict", message: "Instance was modified concurrently. Reload and try again." } };
        }
        return ok(failed);
      }
    }

    const completed = await this.instances.update(
      instance.id,
      {
        status: "completed",
        current_step_index: steps.length,
        completed_at: new Date().toISOString(),
      },
      version
    );
    if (!completed) {
      return { success: false, error: { code: "conflict", message: "Instance was modified concurrently. Reload and try again." } };
    }
    return ok(completed);
  }

  /**
   * Runs a non-blocking step, writing its execution row. Returns null on
   * success, or an error message string on failure.
   */
  private async runNonBlockingStep(
    instance: WorkflowInstance,
    step: WorkflowStep,
    index: number
  ): Promise<string | null> {
    const execution = await this.stepExecutions.create({
      organization_id: instance.organizationId,
      instance_id: instance.id,
      step_id: step.id,
      step_index: index,
      step_type: step.type,
      status: "running",
      started_at: new Date().toISOString(),
    });

    try {
      const output = await this.executeNonBlocking(instance, step);
      if (execution) {
        await this.stepExecutions.update(execution.id, {
          status: "completed",
          output: output as Json,
          completed_at: new Date().toISOString(),
        });
      }
      return null;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Step execution failed";
      if (execution) {
        await this.stepExecutions.update(execution.id, {
          status: "failed",
          error: message,
          completed_at: new Date().toISOString(),
        });
      }
      return message;
    }
  }

  /** Executes the side effect of a non-blocking step and returns its output. */
  private async executeNonBlocking(
    instance: WorkflowInstance,
    step: WorkflowStep
  ): Promise<Record<string, unknown>> {
    switch (step.type) {
      case "log":
      case "noop":
        return {
          type: step.type,
          message: step.config.message ?? null,
          loggedAt: new Date().toISOString(),
        };
      case "webhook": {
        const summary = await this.webhookDispatch.dispatch({
          organizationId: instance.organizationId,
          eventType: step.config.eventType,
          payload: instance.context,
        });
        return {
          type: "webhook",
          eventType: step.config.eventType,
          dispatched: summary.dispatched,
          deliveries: summary.deliveries.length,
        };
      }
      default:
        // Unreachable for non-blocking step types; defensive for new types.
        throw new Error(`Unsupported step type: ${step.type}`);
    }
  }

  /**
   * Raises the approval for a blocking step (integration point with the
   * Approval engine), writes a `running` step execution, and suspends the
   * instance as `awaiting` at this step index.
   */
  private async suspendForApproval(
    instance: WorkflowInstance,
    step: WorkflowStep,
    index: number,
    version: number
  ): Promise<WorkflowResult<WorkflowInstance>> {
    if (step.type !== "approval") {
      return { success: false, error: { code: "unknown", message: "Expected an approval step" } };
    }

    const actor =
      (instance.context[ACTOR_CONTEXT_KEY] as string | undefined) ?? "system";

    // integration point: the approval engine evaluates active rules for the
    // entity type and raises a pending request per match. The instance blocks
    // regardless; the external approval UI then drives resumeInstance().
    const raised = await this.approvals.evaluateAndRaise({
      organizationId: instance.organizationId,
      entityType: step.config.entityType,
      entityId: instance.entityId ?? instance.id,
      fields: instance.context,
      requestedBy: actor,
    });

    const raisedRequestIds = raised.success
      ? raised.data.map((request) => request.id)
      : [];

    await this.stepExecutions.create({
      organization_id: instance.organizationId,
      instance_id: instance.id,
      step_id: step.id,
      step_index: index,
      step_type: step.type,
      status: "running",
      output: {
        type: "approval",
        entityType: step.config.entityType,
        raisedRequestIds,
        raised: raisedRequestIds.length,
      } as Json,
      started_at: new Date().toISOString(),
    });

    const awaiting = await this.instances.update(
      instance.id,
      { status: "awaiting", current_step_index: index },
      version
    );
    if (!awaiting) {
      return { success: false, error: { code: "conflict", message: "Instance was modified concurrently. Reload and try again." } };
    }
    return ok(awaiting);
  }
}
