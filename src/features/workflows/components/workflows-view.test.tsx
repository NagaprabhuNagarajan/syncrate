import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { WorkflowsView } from "./workflows-view";
import type {
  Workflow,
  WorkflowRun,
} from "@/features/workflows/types/workflow.types";

const { mockRefresh, deleteMock, runMock } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  deleteMock: vi.fn(),
  runMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

vi.mock("@/features/workflows/actions/workflow.actions", () => ({
  deleteWorkflowAction: deleteMock,
  runWorkflowAction: runMock,
  createWorkflowAction: vi.fn(),
  updateWorkflowAction: vi.fn(),
  resumeWorkflowInstanceAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    organizationId: "org-1",
    name: "Notify on invoices",
    description: "Sends a webhook",
    triggerEvent: "invoice.created",
    steps: [{ id: "s1", name: "Hook", type: "webhook", config: { eventType: "invoice.created" } }],
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    version: 1,
    ...overrides,
  };
}

function makeRun(): WorkflowRun {
  return {
    instance: {
      id: "inst-1",
      organizationId: "org-1",
      workflowId: "wf-1",
      entityType: null,
      entityId: null,
      status: "completed",
      currentStepIndex: 1,
      context: {},
      error: null,
      startedAt: new Date("2026-01-02"),
      completedAt: new Date("2026-01-02"),
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
      version: 2,
    },
    steps: [
      {
        id: "se-0",
        organizationId: "org-1",
        instanceId: "inst-1",
        stepId: "s1",
        stepIndex: 0,
        stepType: "webhook",
        status: "completed",
        output: {},
        error: null,
        startedAt: new Date("2026-01-02"),
        completedAt: new Date("2026-01-02"),
        createdAt: new Date("2026-01-02"),
      },
    ],
  };
}

describe("WorkflowsView", () => {
  it("renders the workflows tab with a workflow row", () => {
    render(
      <WorkflowsView
        organizationId="org-1"
        workflows={[makeWorkflow()]}
        runs={[]}
        canManage
      />
    );

    expect(
      screen.getByRole("heading", { name: /workflows/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Notify on invoices")).toBeInTheDocument();
    expect(screen.getByText("invoice.created")).toBeInTheDocument();
  });

  it("shows the New workflow button only when the user can manage", () => {
    const { rerender } = render(
      <WorkflowsView
        organizationId="org-1"
        workflows={[makeWorkflow()]}
        runs={[]}
        canManage
      />
    );
    expect(
      screen.getByRole("button", { name: /new workflow/i })
    ).toBeInTheDocument();

    rerender(
      <WorkflowsView
        organizationId="org-1"
        workflows={[makeWorkflow()]}
        runs={[]}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /new workflow/i })
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no workflows", () => {
    render(
      <WorkflowsView
        organizationId="org-1"
        workflows={[]}
        runs={[]}
        canManage
      />
    );
    expect(screen.getByText(/no workflows yet/i)).toBeInTheDocument();
  });

  it("opens the create form when New workflow is clicked", async () => {
    const user = userEvent.setup();
    render(
      <WorkflowsView
        organizationId="org-1"
        workflows={[makeWorkflow()]}
        runs={[]}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /new workflow/i }));
    expect(
      screen.getByRole("form", { name: /create workflow/i })
    ).toBeInTheDocument();
  });

  it("runs a workflow via the run action", async () => {
    const user = userEvent.setup();
    runMock.mockResolvedValue({
      success: true,
      data: makeRun().instance,
    });
    render(
      <WorkflowsView
        organizationId="org-1"
        workflows={[makeWorkflow()]}
        runs={[]}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /run notify on invoices/i }));
    expect(runMock).toHaveBeenCalledWith("org-1", "wf-1");
  });

  it("shows run history and expands per-step executions", async () => {
    const user = userEvent.setup();
    render(
      <WorkflowsView
        organizationId="org-1"
        workflows={[makeWorkflow()]}
        runs={[makeRun()]}
        canManage
      />
    );
    await user.click(screen.getByRole("tab", { name: /run history/i }));
    // Instance summary visible.
    const toggle = screen.getByRole("button", { name: /notify on invoices/i });
    expect(toggle).toBeInTheDocument();
    // Expand to reveal the step execution.
    await user.click(toggle);
    expect(screen.getByText(/1\. webhook/i)).toBeInTheDocument();
  });
});
