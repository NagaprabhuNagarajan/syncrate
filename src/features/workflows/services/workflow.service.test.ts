import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { WorkflowService } from "./workflow.service";
import type {
  Workflow,
  WorkflowInstance,
  WorkflowStepExecution,
} from "@/features/workflows/types/workflow.types";

// ─────────────────────────────────────────────────────────────
// Mock the repositories the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { repo, instanceRepo, stepRepo } = vi.hoisted(() => ({
  repo: {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
  instanceRepo: {
    listByOrg: vi.fn(),
  },
  stepRepo: {
    listByOrg: vi.fn(),
  },
}));

vi.mock("@/features/workflows/repositories/workflow.repository", () => ({
  WorkflowRepository: vi.fn(() => repo),
}));
vi.mock(
  "@/features/workflows/repositories/workflow-instance.repository",
  () => ({ WorkflowInstanceRepository: vi.fn(() => instanceRepo) })
);
vi.mock(
  "@/features/workflows/repositories/workflow-step-execution.repository",
  () => ({ WorkflowStepExecutionRepository: vi.fn(() => stepRepo) })
);

const supabase = {} as AppSupabaseClient;

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    organizationId: "org-1",
    name: "Flow",
    description: null,
    triggerEvent: "invoice.created",
    steps: [],
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WorkflowService CRUD", () => {
  it("creates a workflow with a definition built from steps", async () => {
    repo.create.mockResolvedValue(makeWorkflow());
    const service = new WorkflowService(supabase);

    const result = await service.createWorkflow(
      {
        name: "  Flow  ",
        triggerEvent: "invoice.created",
        steps: [{ id: "s1", name: "Log", type: "log", config: {} }],
      },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    const insert = repo.create.mock.calls[0]?.[0];
    expect(insert.name).toBe("Flow");
    expect(insert.organization_id).toBe("org-1");
    expect(insert.created_by).toBe("user-1");
    expect(insert.definition).toEqual({
      steps: [{ id: "s1", name: "Log", type: "log", config: {} }],
    });
  });

  it("returns unknown when create fails", async () => {
    repo.create.mockResolvedValue(null);
    const service = new WorkflowService(supabase);

    const result = await service.createWorkflow(
      { name: "Flow", triggerEvent: "invoice.created", steps: [] },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("returns not_found when updating a missing workflow", async () => {
    repo.findById.mockResolvedValue(null);
    const service = new WorkflowService(supabase);

    const result = await service.updateWorkflow(
      "wf-1",
      { version: 1 },
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("returns conflict when the version does not match", async () => {
    repo.findById.mockResolvedValue(makeWorkflow({ version: 5 }));
    const service = new WorkflowService(supabase);

    const result = await service.updateWorkflow(
      "wf-1",
      { version: 1, name: "X" },
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("updates only provided fields and persists steps as a definition", async () => {
    repo.findById.mockResolvedValue(makeWorkflow({ version: 2 }));
    repo.update.mockResolvedValue(makeWorkflow({ version: 3, name: "Renamed" }));
    const service = new WorkflowService(supabase);

    const result = await service.updateWorkflow(
      "wf-1",
      {
        version: 2,
        name: "Renamed",
        steps: [{ id: "s1", name: "Hook", type: "webhook", config: { eventType: "x" } }],
      },
      "user-1"
    );

    expect(result.success).toBe(true);
    const [, patch, userId, expectedVersion] = repo.update.mock.calls[0] ?? [];
    expect(patch.name).toBe("Renamed");
    expect(patch.definition).toEqual({
      steps: [{ id: "s1", name: "Hook", type: "webhook", config: { eventType: "x" } }],
    });
    expect(userId).toBe("user-1");
    expect(expectedVersion).toBe(2);
  });

  it("returns conflict when the optimistic update returns null", async () => {
    repo.findById.mockResolvedValue(makeWorkflow({ version: 2 }));
    repo.update.mockResolvedValue(null);
    const service = new WorkflowService(supabase);

    const result = await service.updateWorkflow(
      "wf-1",
      { version: 2, name: "Renamed" },
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });

  it("soft-deletes an existing workflow", async () => {
    repo.findById.mockResolvedValue(makeWorkflow());
    repo.softDelete.mockResolvedValue(true);
    const service = new WorkflowService(supabase);

    const result = await service.deleteWorkflow("wf-1", "user-1");

    expect(result.success).toBe(true);
    expect(repo.softDelete).toHaveBeenCalledWith("wf-1", "user-1");
  });

  it("returns not_found when deleting a missing workflow", async () => {
    repo.findById.mockResolvedValue(null);
    const service = new WorkflowService(supabase);

    const result = await service.deleteWorkflow("wf-1", "user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("returns unknown when soft delete fails", async () => {
    repo.findById.mockResolvedValue(makeWorkflow());
    repo.softDelete.mockResolvedValue(false);
    const service = new WorkflowService(supabase);

    const result = await service.deleteWorkflow("wf-1", "user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("WorkflowService reads", () => {
  it("lists workflows for an org", async () => {
    repo.list.mockResolvedValue([makeWorkflow()]);
    const service = new WorkflowService(supabase);

    const workflows = await service.listWorkflows("org-1");

    expect(workflows).toHaveLength(1);
    expect(repo.list).toHaveBeenCalledWith("org-1");
  });

  it("gets a workflow by id", async () => {
    repo.findById.mockResolvedValue(makeWorkflow());
    const service = new WorkflowService(supabase);

    const result = await service.getWorkflow("wf-1");

    expect(result.success).toBe(true);
  });

  it("returns not_found when the workflow is missing", async () => {
    repo.findById.mockResolvedValue(null);
    const service = new WorkflowService(supabase);

    const result = await service.getWorkflow("wf-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("trims description and leaves null when blank on update", async () => {
    repo.findById.mockResolvedValue(makeWorkflow({ version: 1 }));
    repo.update.mockResolvedValue(makeWorkflow({ version: 2 }));
    const service = new WorkflowService(supabase);

    const result = await service.updateWorkflow(
      "wf-1",
      { version: 1, description: "  ", triggerEvent: "invoice.paid", isActive: false },
      "user-1"
    );

    expect(result.success).toBe(true);
    const patch = repo.update.mock.calls[0]?.[1];
    expect(patch.description).toBeNull();
    expect(patch.trigger_event).toBe("invoice.paid");
    expect(patch.is_active).toBe(false);
  });
});

describe("WorkflowService.listRuns", () => {
  it("groups step executions under their instance, ordered by step index", async () => {
    const instance: WorkflowInstance = {
      id: "inst-1",
      organizationId: "org-1",
      workflowId: "wf-1",
      entityType: null,
      entityId: null,
      status: "completed",
      currentStepIndex: 2,
      context: {},
      error: null,
      startedAt: new Date("2026-01-02"),
      completedAt: new Date("2026-01-02"),
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
      version: 1,
    };
    const step = (index: number): WorkflowStepExecution => ({
      id: `se-${index}`,
      organizationId: "org-1",
      instanceId: "inst-1",
      stepId: `s${index}`,
      stepIndex: index,
      stepType: "log",
      status: "completed",
      output: {},
      error: null,
      startedAt: new Date("2026-01-02"),
      completedAt: new Date("2026-01-02"),
      createdAt: new Date("2026-01-02"),
    });

    instanceRepo.listByOrg.mockResolvedValue([instance]);
    stepRepo.listByOrg.mockResolvedValue([step(1), step(0)]);
    const service = new WorkflowService(supabase);

    const runs = await service.listRuns("org-1");

    expect(runs).toHaveLength(1);
    expect(runs[0]?.instance.id).toBe("inst-1");
    expect(runs[0]?.steps.map((s) => s.stepIndex)).toEqual([0, 1]);
  });
});
