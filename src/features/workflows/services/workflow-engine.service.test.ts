import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { WorkflowEngineService } from "./workflow-engine.service";
import type { WorkflowEngineDeps } from "./workflow-engine.service";
import type {
  Workflow,
  WorkflowInstance,
  WorkflowStep,
  WorkflowStepExecution,
} from "@/features/workflows/types/workflow.types";

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeWorkflow(steps: WorkflowStep[], overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    organizationId: "org-1",
    name: "Test workflow",
    description: null,
    triggerEvent: "invoice.created",
    steps,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    version: 1,
    ...overrides,
  };
}

function makeInstance(overrides: Partial<WorkflowInstance> = {}): WorkflowInstance {
  return {
    id: "inst-1",
    organizationId: "org-1",
    workflowId: "wf-1",
    entityType: null,
    entityId: null,
    status: "running",
    currentStepIndex: 0,
    context: { _actorUserId: "user-1" },
    error: null,
    startedAt: new Date("2026-01-02"),
    completedAt: null,
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02"),
    version: 1,
    ...overrides,
  };
}

function makeStepExecution(
  overrides: Partial<WorkflowStepExecution> = {}
): WorkflowStepExecution {
  return {
    id: "se-1",
    organizationId: "org-1",
    instanceId: "inst-1",
    stepId: "s1",
    stepIndex: 0,
    stepType: "approval",
    status: "running",
    output: {},
    error: null,
    startedAt: new Date("2026-01-02"),
    completedAt: null,
    createdAt: new Date("2026-01-02"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Mock harness — builds an engine with injected, controllable deps
// ─────────────────────────────────────────────────────────────

interface Harness {
  engine: WorkflowEngineService;
  workflows: { findById: ReturnType<typeof vi.fn> };
  instances: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  stepExecutions: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    listByInstance: ReturnType<typeof vi.fn>;
  };
  webhookDispatch: { dispatch: ReturnType<typeof vi.fn> };
  approvals: { evaluateAndRaise: ReturnType<typeof vi.fn> };
}

function buildHarness(): Harness {
  const workflows = { findById: vi.fn() };
  const instances = {
    create: vi.fn(),
    findById: vi.fn(),
    // Default: echo the patch back, bumping version optimistically.
    update: vi.fn((id: string, patch: Record<string, unknown>, v: number) =>
      Promise.resolve(
        makeInstance({ id, ...(patch as Partial<WorkflowInstance>), version: v + 1 })
      )
    ),
  };
  const stepExecutions = {
    create: vi.fn((input: { step_id: string; step_index: number }) =>
      Promise.resolve(
        makeStepExecution({
          id: `se-${input.step_index}`,
          stepId: input.step_id,
          stepIndex: input.step_index,
        })
      )
    ),
    update: vi.fn(() => Promise.resolve(makeStepExecution())),
    listByInstance: vi.fn(() => Promise.resolve([])),
  };
  const webhookDispatch = {
    dispatch: vi.fn(() =>
      Promise.resolve({ dispatched: 1, deliveries: [{}] })
    ),
  };
  const approvals = {
    evaluateAndRaise: vi.fn(() =>
      Promise.resolve({ success: true, data: [{ id: "req-1" }] })
    ),
  };

  const deps = {
    workflows,
    instances,
    stepExecutions,
    webhookDispatch,
    approvals,
  } as unknown as Partial<WorkflowEngineDeps>;

  const engine = new WorkflowEngineService({} as AppSupabaseClient, deps);
  return { engine, workflows, instances, stepExecutions, webhookDispatch, approvals };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// startWorkflow — guards
// ─────────────────────────────────────────────────────────────

describe("WorkflowEngineService.startWorkflow guards", () => {
  it("returns not_found when the workflow does not exist", async () => {
    const h = buildHarness();
    h.workflows.findById.mockResolvedValue(null);

    const result = await h.engine.startWorkflow({
      organizationId: "org-1",
      workflowId: "missing",
      actorUserId: "user-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("returns forbidden when the workflow belongs to another org", async () => {
    const h = buildHarness();
    h.workflows.findById.mockResolvedValue(
      makeWorkflow([], { organizationId: "org-2" })
    );

    const result = await h.engine.startWorkflow({
      organizationId: "org-1",
      workflowId: "wf-1",
      actorUserId: "user-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns invalid_state when the workflow is inactive", async () => {
    const h = buildHarness();
    h.workflows.findById.mockResolvedValue(
      makeWorkflow([], { isActive: false })
    );

    const result = await h.engine.startWorkflow({
      organizationId: "org-1",
      workflowId: "wf-1",
      actorUserId: "user-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_state");
    }
  });

  it("returns unknown when the instance cannot be created", async () => {
    const h = buildHarness();
    h.workflows.findById.mockResolvedValue(makeWorkflow([]));
    h.instances.create.mockResolvedValue(null);

    const result = await h.engine.startWorkflow({
      organizationId: "org-1",
      workflowId: "wf-1",
      actorUserId: "user-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// startWorkflow — execution
// ─────────────────────────────────────────────────────────────

describe("WorkflowEngineService.startWorkflow execution", () => {
  it("completes a log-only workflow, recording a completed step execution", async () => {
    const h = buildHarness();
    const steps: WorkflowStep[] = [
      { id: "s1", name: "Log it", type: "log", config: { message: "hi" } },
    ];
    h.workflows.findById.mockResolvedValue(makeWorkflow(steps));
    h.instances.create.mockResolvedValue(makeInstance());

    const result = await h.engine.startWorkflow({
      organizationId: "org-1",
      workflowId: "wf-1",
      actorUserId: "user-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("completed");
    }
    // Step execution created (running) then updated (completed).
    expect(h.stepExecutions.create).toHaveBeenCalledTimes(1);
    expect(h.stepExecutions.update).toHaveBeenCalledWith(
      "se-0",
      expect.objectContaining({ status: "completed" })
    );
    // Instance moved to completed.
    expect(h.instances.update).toHaveBeenLastCalledWith(
      "inst-1",
      expect.objectContaining({ status: "completed" }),
      1
    );
    expect(h.webhookDispatch.dispatch).not.toHaveBeenCalled();
  });

  it("treats a noop step like a log step and completes", async () => {
    const h = buildHarness();
    const steps: WorkflowStep[] = [
      { id: "s1", name: "Noop", type: "noop", config: {} },
    ];
    h.workflows.findById.mockResolvedValue(makeWorkflow(steps));
    h.instances.create.mockResolvedValue(makeInstance());

    const result = await h.engine.startWorkflow({
      organizationId: "org-1",
      workflowId: "wf-1",
      actorUserId: "user-1",
    });

    expect(result.success && result.data.status).toBe("completed");
    expect(h.stepExecutions.update).toHaveBeenCalledWith(
      "se-0",
      expect.objectContaining({ status: "completed" })
    );
  });

  it("executes a webhook step via WebhookDispatchService and records its output", async () => {
    const h = buildHarness();
    const steps: WorkflowStep[] = [
      { id: "s1", name: "Hook", type: "webhook", config: { eventType: "invoice.paid" } },
    ];
    h.workflows.findById.mockResolvedValue(makeWorkflow(steps));
    h.instances.create.mockResolvedValue(
      makeInstance({ context: { _actorUserId: "user-1", foo: "bar" } })
    );

    const result = await h.engine.startWorkflow({
      organizationId: "org-1",
      workflowId: "wf-1",
      actorUserId: "user-1",
    });

    expect(result.success && result.data.status).toBe("completed");
    expect(h.webhookDispatch.dispatch).toHaveBeenCalledWith({
      organizationId: "org-1",
      eventType: "invoice.paid",
      payload: { _actorUserId: "user-1", foo: "bar" },
    });
    const outputCall = h.stepExecutions.update.mock.calls.find(
      (call) => call[0] === "se-0"
    );
    expect(outputCall?.[1]).toMatchObject({
      status: "completed",
      output: expect.objectContaining({
        type: "webhook",
        eventType: "invoice.paid",
        dispatched: 1,
        deliveries: 1,
      }),
    });
  });

  it("completes an empty-steps workflow immediately", async () => {
    const h = buildHarness();
    h.workflows.findById.mockResolvedValue(makeWorkflow([]));
    h.instances.create.mockResolvedValue(makeInstance());

    const result = await h.engine.startWorkflow({
      organizationId: "org-1",
      workflowId: "wf-1",
      actorUserId: "user-1",
    });

    expect(result.success && result.data.status).toBe("completed");
    expect(h.stepExecutions.create).not.toHaveBeenCalled();
    expect(h.instances.update).toHaveBeenCalledTimes(1);
  });

  it("suspends on an approval step: instance awaiting, step running, dispatch not called", async () => {
    const h = buildHarness();
    const steps: WorkflowStep[] = [
      { id: "s1", name: "Log", type: "log", config: {} },
      { id: "s2", name: "Approve", type: "approval", config: { entityType: "purchase_invoice" } },
      { id: "s3", name: "After", type: "log", config: {} },
    ];
    h.workflows.findById.mockResolvedValue(makeWorkflow(steps));
    h.instances.create.mockResolvedValue(makeInstance());

    const result = await h.engine.startWorkflow({
      organizationId: "org-1",
      workflowId: "wf-1",
      entityId: "inv-9",
      actorUserId: "user-1",
    });

    expect(result.success && result.data.status).toBe("awaiting");
    // Raised an approval through the approval engine.
    expect(h.approvals.evaluateAndRaise).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        entityType: "purchase_invoice",
        requestedBy: "user-1",
      })
    );
    // A running step execution was written for the approval (index 1).
    expect(h.stepExecutions.create).toHaveBeenCalledWith(
      expect.objectContaining({ step_index: 1, step_type: "approval", status: "running" })
    );
    // Instance flipped to awaiting at index 1.
    expect(h.instances.update).toHaveBeenLastCalledWith(
      "inst-1",
      { status: "awaiting", current_step_index: 1 },
      1
    );
    // The step AFTER the approval did not run.
    expect(h.stepExecutions.create).toHaveBeenCalledTimes(2);
  });

  it("marks the instance failed when a step throws", async () => {
    const h = buildHarness();
    const steps: WorkflowStep[] = [
      { id: "s1", name: "Hook", type: "webhook", config: { eventType: "invoice.paid" } },
    ];
    h.workflows.findById.mockResolvedValue(makeWorkflow(steps));
    h.instances.create.mockResolvedValue(makeInstance());
    h.webhookDispatch.dispatch.mockRejectedValue(new Error("boom"));

    const result = await h.engine.startWorkflow({
      organizationId: "org-1",
      workflowId: "wf-1",
      actorUserId: "user-1",
    });

    expect(result.success && result.data.status).toBe("failed");
    expect(h.stepExecutions.update).toHaveBeenCalledWith(
      "se-0",
      expect.objectContaining({ status: "failed", error: "boom" })
    );
    expect(h.instances.update).toHaveBeenLastCalledWith(
      "inst-1",
      expect.objectContaining({ status: "failed", error: "boom" }),
      1
    );
  });

  it("returns a conflict when the terminal instance update is stale", async () => {
    const h = buildHarness();
    h.workflows.findById.mockResolvedValue(makeWorkflow([]));
    h.instances.create.mockResolvedValue(makeInstance());
    h.instances.update.mockResolvedValue(null);

    const result = await h.engine.startWorkflow({
      organizationId: "org-1",
      workflowId: "wf-1",
      actorUserId: "user-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// resumeInstance
// ─────────────────────────────────────────────────────────────

describe("WorkflowEngineService.resumeInstance", () => {
  const approvalThenLog: WorkflowStep[] = [
    { id: "s1", name: "Approve", type: "approval", config: { entityType: "purchase_invoice" } },
    { id: "s2", name: "After", type: "log", config: {} },
  ];

  it("returns not_found when the instance is missing", async () => {
    const h = buildHarness();
    h.instances.findById.mockResolvedValue(null);

    const result = await h.engine.resumeInstance({
      instanceId: "missing",
      approved: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("returns invalid_state when the instance is not awaiting", async () => {
    const h = buildHarness();
    h.instances.findById.mockResolvedValue(
      makeInstance({ status: "completed" })
    );

    const result = await h.engine.resumeInstance({
      instanceId: "inst-1",
      approved: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_state");
    }
  });

  it("advances past the approval on approve and completes the rest", async () => {
    const h = buildHarness();
    h.instances.findById.mockResolvedValue(
      makeInstance({ status: "awaiting", currentStepIndex: 0, version: 2 })
    );
    h.workflows.findById.mockResolvedValue(makeWorkflow(approvalThenLog));
    h.stepExecutions.listByInstance.mockResolvedValue([
      makeStepExecution({ id: "se-0", stepIndex: 0, status: "running" }),
    ]);

    const result = await h.engine.resumeInstance({
      instanceId: "inst-1",
      approved: true,
    });

    expect(result.success && result.data.status).toBe("completed");
    // Closed out the suspended approval step as completed.
    expect(h.stepExecutions.update).toHaveBeenCalledWith(
      "se-0",
      expect.objectContaining({ status: "completed" })
    );
    // Re-armed instance to running (optimistic lock on the awaiting version).
    expect(h.instances.update).toHaveBeenCalledWith(
      "inst-1",
      { status: "running" },
      2
    );
    // Ran the trailing log step (index 1).
    expect(h.stepExecutions.create).toHaveBeenCalledWith(
      expect.objectContaining({ step_index: 1, step_type: "log" })
    );
  });

  it("cancels the instance and fails the step on reject", async () => {
    const h = buildHarness();
    h.instances.findById.mockResolvedValue(
      makeInstance({ status: "awaiting", currentStepIndex: 0, version: 2 })
    );
    h.workflows.findById.mockResolvedValue(makeWorkflow(approvalThenLog));
    h.stepExecutions.listByInstance.mockResolvedValue([
      makeStepExecution({ id: "se-0", stepIndex: 0, status: "running" }),
    ]);

    const result = await h.engine.resumeInstance({
      instanceId: "inst-1",
      approved: false,
    });

    expect(result.success && result.data.status).toBe("cancelled");
    expect(h.stepExecutions.update).toHaveBeenCalledWith(
      "se-0",
      expect.objectContaining({ status: "failed", error: "Approval rejected" })
    );
    expect(h.instances.update).toHaveBeenCalledWith(
      "inst-1",
      expect.objectContaining({ status: "cancelled", error: "Approval rejected" }),
      2
    );
    // Did not advance to the next step.
    expect(h.stepExecutions.create).not.toHaveBeenCalled();
  });

  it("returns a conflict when re-arming the instance is stale", async () => {
    const h = buildHarness();
    h.instances.findById.mockResolvedValue(
      makeInstance({ status: "awaiting", currentStepIndex: 0, version: 2 })
    );
    h.workflows.findById.mockResolvedValue(makeWorkflow(approvalThenLog));
    h.stepExecutions.listByInstance.mockResolvedValue([]);
    h.instances.update.mockResolvedValue(null);

    const result = await h.engine.resumeInstance({
      instanceId: "inst-1",
      approved: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });
});
