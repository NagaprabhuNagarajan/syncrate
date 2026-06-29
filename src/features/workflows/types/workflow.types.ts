/**
 * Workflow engine domain types.
 *
 * Three aggregates:
 *  - Workflow              — a configurable, ordered automation definition.
 *  - WorkflowInstance      — one run of a workflow against an entity.
 *  - WorkflowStepExecution — the per-step record produced during a run.
 *
 * All application-level types use camelCase and mirror the DB schema. The
 * `steps` of a definition are a discriminated union on `type`; the raw
 * `definition` JSON is ALWAYS validated through the zod schema before it is
 * trusted as a `WorkflowStep[]` (see `workflow.schemas.ts`).
 */

// ─────────────────────────────────────────────────────────────
// Step model — discriminated union on `type`
// ─────────────────────────────────────────────────────────────

export type WorkflowStepType = "log" | "noop" | "webhook" | "approval";

/** The step types that execute immediately without blocking the run. */
export const NON_BLOCKING_STEP_TYPES: readonly WorkflowStepType[] = [
  "log",
  "noop",
  "webhook",
];

/** The step types that suspend the run until an external decision arrives. */
export const BLOCKING_STEP_TYPES: readonly WorkflowStepType[] = ["approval"];

export interface WorkflowStepBase {
  readonly id: string;
  readonly name: string;
}

/** Records an entry and always succeeds. */
export interface LogStep extends WorkflowStepBase {
  readonly type: "log";
  readonly config: { readonly message?: string };
}

/** No-op — identical execution semantics to `log`. */
export interface NoopStep extends WorkflowStepBase {
  readonly type: "noop";
  readonly config: { readonly message?: string };
}

/** Dispatches a webhook event via the WebhookDispatchService. */
export interface WebhookStep extends WorkflowStepBase {
  readonly type: "webhook";
  readonly config: { readonly eventType: string };
}

/** Raises an approval and BLOCKS the run until decided. */
export interface ApprovalStep extends WorkflowStepBase {
  readonly type: "approval";
  readonly config: {
    readonly entityType: string;
    readonly [key: string]: unknown;
  };
}

export type WorkflowStep = LogStep | NoopStep | WebhookStep | ApprovalStep;

export interface WorkflowDefinition {
  readonly steps: readonly WorkflowStep[];
}

// ─────────────────────────────────────────────────────────────
// Aggregates
// ─────────────────────────────────────────────────────────────

export interface Workflow {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly description: string | null;
  readonly triggerEvent: string;
  readonly steps: readonly WorkflowStep[];
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export type WorkflowInstanceStatus =
  | "pending"
  | "running"
  | "awaiting"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowInstance {
  readonly id: string;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly status: WorkflowInstanceStatus;
  readonly currentStepIndex: number;
  readonly context: Record<string, unknown>;
  readonly error: string | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export type WorkflowStepExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface WorkflowStepExecution {
  readonly id: string;
  readonly organizationId: string;
  readonly instanceId: string;
  readonly stepId: string;
  readonly stepIndex: number;
  readonly stepType: string;
  readonly status: WorkflowStepExecutionStatus;
  readonly output: Record<string, unknown>;
  readonly error: string | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
}

/** An instance paired with its ordered step executions — for run history. */
export interface WorkflowRun {
  readonly instance: WorkflowInstance;
  readonly steps: readonly WorkflowStepExecution[];
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateWorkflowInput {
  readonly name: string;
  readonly description?: string | null;
  readonly triggerEvent: string;
  readonly steps: readonly WorkflowStep[];
  readonly isActive?: boolean;
}

export interface UpdateWorkflowInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly triggerEvent?: string;
  readonly steps?: readonly WorkflowStep[];
  readonly isActive?: boolean;
  /** Expected version for optimistic locking. */
  readonly version: number;
}

export interface StartWorkflowInput {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
  readonly context?: Record<string, unknown>;
  readonly actorUserId: string;
}

export interface ResumeInstanceInput {
  readonly instanceId: string;
  /** Outcome of the approval that suspended the instance. */
  readonly approved: boolean;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type WorkflowErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "conflict"
  | "invalid_state"
  | "unknown";

export interface WorkflowError {
  readonly code: WorkflowErrorCode;
  readonly message: string;
}

export type WorkflowResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: WorkflowError };
