import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { ApprovalsView } from "./approvals-view";
import type {
  ApprovalRequest,
  ApprovalRule,
} from "@/features/approvals/types/approval.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockRefresh, approveMock, rejectMock, deleteMock } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  approveMock: vi.fn(),
  rejectMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

vi.mock("@/features/approvals/actions/approval.actions", () => ({
  approveRequestAction: approveMock,
  rejectRequestAction: rejectMock,
  deleteRuleAction: deleteMock,
  createRuleAction: vi.fn(),
  updateRuleAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<ApprovalRule> = {}): ApprovalRule {
  return {
    id: "rule-1",
    organizationId: "org-1",
    name: "High value invoices",
    description: "Over 1 lakh",
    entityType: "purchase_invoice",
    condition: { field: "total", operator: "gte", value: 100000 },
    approverRoleId: "role-1",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    version: 1,
    ...overrides,
  };
}

function makeRequest(
  overrides: Partial<ApprovalRequest> = {}
): ApprovalRequest {
  return {
    id: "req-1",
    organizationId: "org-1",
    ruleId: "rule-1",
    entityType: "purchase_invoice",
    entityId: "inv-42",
    requestedBy: "user-1",
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
    metadata: {},
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02"),
    version: 1,
    ...overrides,
  };
}

const roles = [{ id: "role-1", name: "Finance Manager" }];

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ApprovalsView", () => {
  it("renders the rules tab with a rule row and condition summary", () => {
    render(
      <ApprovalsView
        organizationId="org-1"
        rules={[makeRule()]}
        pendingRequests={[]}
        roles={roles}
        canManage
        canDecide
      />
    );

    expect(
      screen.getByRole("heading", { name: /approvals/i })
    ).toBeInTheDocument();
    expect(screen.getByText("High value invoices")).toBeInTheDocument();
    expect(screen.getByText("total ≥ 100000")).toBeInTheDocument();
    expect(screen.getByText("Finance Manager")).toBeInTheDocument();
  });

  it("shows the New rule button only when the user can manage", () => {
    const { rerender } = render(
      <ApprovalsView
        organizationId="org-1"
        rules={[makeRule()]}
        pendingRequests={[]}
        roles={roles}
        canManage
        canDecide
      />
    );
    expect(
      screen.getByRole("button", { name: /new rule/i })
    ).toBeInTheDocument();

    rerender(
      <ApprovalsView
        organizationId="org-1"
        rules={[makeRule()]}
        pendingRequests={[]}
        roles={roles}
        canManage={false}
        canDecide
      />
    );
    expect(
      screen.queryByRole("button", { name: /new rule/i })
    ).not.toBeInTheDocument();
  });

  it("opens the rule form when New rule is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ApprovalsView
        organizationId="org-1"
        rules={[makeRule()]}
        pendingRequests={[]}
        roles={roles}
        canManage
        canDecide
      />
    );
    await user.click(screen.getByRole("button", { name: /new rule/i }));
    expect(
      screen.getByRole("form", { name: /create approval rule/i })
    ).toBeInTheDocument();
  });

  it("shows the rules empty state when there are no rules", () => {
    render(
      <ApprovalsView
        organizationId="org-1"
        rules={[]}
        pendingRequests={[]}
        roles={roles}
        canManage
        canDecide
      />
    );
    expect(screen.getByText(/no approval rules yet/i)).toBeInTheDocument();
  });

  it("renders pending requests and approves with a reason", async () => {
    const user = userEvent.setup();
    approveMock.mockResolvedValue({ success: true, data: makeRequest() });

    render(
      <ApprovalsView
        organizationId="org-1"
        rules={[]}
        pendingRequests={[makeRequest()]}
        roles={roles}
        canManage
        canDecide
      />
    );

    await user.click(screen.getByRole("tab", { name: /pending approvals/i }));
    expect(screen.getByText("inv-42")).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/optional reason/i),
      "Looks good"
    );
    await user.click(screen.getByRole("button", { name: /approve/i }));

    expect(approveMock).toHaveBeenCalledWith("org-1", "req-1", "Looks good");
  });

  it("hides approve/reject when the user cannot decide", async () => {
    const user = userEvent.setup();
    render(
      <ApprovalsView
        organizationId="org-1"
        rules={[]}
        pendingRequests={[makeRequest()]}
        roles={roles}
        canManage
        canDecide={false}
      />
    );
    await user.click(screen.getByRole("tab", { name: /pending approvals/i }));
    expect(
      screen.queryByRole("button", { name: /approve/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/do not have permission to decide/i)
    ).toBeInTheDocument();
  });

  it("shows the pending empty state when there are no requests", async () => {
    const user = userEvent.setup();
    render(
      <ApprovalsView
        organizationId="org-1"
        rules={[makeRule()]}
        pendingRequests={[]}
        roles={roles}
        canManage
        canDecide
      />
    );
    await user.click(screen.getByRole("tab", { name: /pending approvals/i }));
    expect(screen.getByText(/no pending approvals/i)).toBeInTheDocument();
  });
});
