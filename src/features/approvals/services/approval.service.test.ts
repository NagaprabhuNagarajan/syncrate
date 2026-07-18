import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  ApprovalRequest,
  ApprovalRule,
} from "@/features/approvals/types/approval.types";
import { ApprovalService } from "./approval.service";

// ─────────────────────────────────────────────────────────────
// Mock both repositories the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRuleRepo, mockRequestRepo } = vi.hoisted(() => ({
  mockRuleRepo: {
    list: vi.fn(),
    listActiveByEntityType: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
  mockRequestRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    listByOrg: vi.fn(),
    decide: vi.fn(),
  },
}));

vi.mock(
  "@/features/approvals/repositories/approval-rule.repository",
  () => ({ ApprovalRuleRepository: vi.fn(() => mockRuleRepo) })
);
vi.mock(
  "@/features/approvals/repositories/approval-request.repository",
  () => ({ ApprovalRequestRepository: vi.fn(() => mockRequestRepo) })
);

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildRule(overrides: Partial<ApprovalRule> = {}): ApprovalRule {
  return {
    id: "rule-1",
    organizationId: "org-1",
    name: "High value",
    description: null,
    entityType: "purchase_invoice",
    condition: { field: "total", operator: "gte", value: 1000 },
    approverRoleId: "role-1",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    ...overrides,
  };
}

function buildRequest(
  overrides: Partial<ApprovalRequest> = {}
): ApprovalRequest {
  return {
    id: "req-1",
    organizationId: "org-1",
    ruleId: "rule-1",
    entityType: "purchase_invoice",
    entityId: "inv-1",
    requestedBy: "user-1",
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
    metadata: {},
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    ...overrides,
  };
}

const supabase = {} as AppSupabaseClient;

function makeService(): ApprovalService {
  return new ApprovalService(supabase);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Rule CRUD
// ─────────────────────────────────────────────────────────────

describe("ApprovalService — rule CRUD", () => {
  it("lists rules for an org", async () => {
    mockRuleRepo.list.mockResolvedValue([buildRule()]);
    const result = await makeService().listRules("org-1");
    expect(result).toHaveLength(1);
    expect(mockRuleRepo.list).toHaveBeenCalledWith("org-1");
  });

  it("returns not_found for a missing rule", async () => {
    mockRuleRepo.findById.mockResolvedValue(null);
    const result = await makeService().getRule("nope");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("creates a rule", async () => {
    const created = buildRule();
    mockRuleRepo.create.mockResolvedValue(created);
    const result = await makeService().createRule(
      {
        name: "High value",
        entityType: "purchase_invoice",
        condition: { field: "total", operator: "gte", value: 1000 },
        approverRoleId: "role-1",
      },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRuleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        entity_type: "purchase_invoice",
        is_active: true,
        created_by: "user-1",
      })
    );
  });

  it("returns unknown when rule creation fails", async () => {
    mockRuleRepo.create.mockResolvedValue(null);
    const result = await makeService().createRule(
      {
        name: "x",
        entityType: "y",
        condition: { field: "f", operator: "eq", value: 1 },
      },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("updates a rule with a matching version", async () => {
    mockRuleRepo.findById.mockResolvedValue(buildRule({ version: 2 }));
    mockRuleRepo.update.mockResolvedValue(buildRule({ version: 3, name: "New" }));
    const result = await makeService().updateRule(
      "rule-1",
      { name: "New", version: 2 },
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRuleRepo.update).toHaveBeenCalledWith(
      "rule-1",
      expect.objectContaining({ name: "New" }),
      "user-1",
      2
    );
  });

  it("returns conflict when the expected version is stale (pre-check)", async () => {
    mockRuleRepo.findById.mockResolvedValue(buildRule({ version: 5 }));
    const result = await makeService().updateRule(
      "rule-1",
      { name: "New", version: 2 },
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
    expect(mockRuleRepo.update).not.toHaveBeenCalled();
  });

  it("returns conflict when the optimistic update writes zero rows", async () => {
    mockRuleRepo.findById.mockResolvedValue(buildRule({ version: 2 }));
    mockRuleRepo.update.mockResolvedValue(null);
    const result = await makeService().updateRule(
      "rule-1",
      { name: "New", version: 2 },
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });

  it("returns not_found when updating a missing rule", async () => {
    mockRuleRepo.findById.mockResolvedValue(null);
    const result = await makeService().updateRule(
      "rule-1",
      { version: 1 },
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("soft-deletes a rule", async () => {
    mockRuleRepo.findById.mockResolvedValue(buildRule());
    mockRuleRepo.softDelete.mockResolvedValue(true);
    const result = await makeService().deleteRule("rule-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRuleRepo.softDelete).toHaveBeenCalledWith("rule-1", "user-1");
  });

  it("returns not_found when deleting a missing rule", async () => {
    mockRuleRepo.findById.mockResolvedValue(null);
    const result = await makeService().deleteRule("rule-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// evaluateAndRaise
// ─────────────────────────────────────────────────────────────

describe("ApprovalService — evaluateAndRaise", () => {
  it("raises a request for a single matching rule", async () => {
    mockRuleRepo.listActiveByEntityType.mockResolvedValue([
      buildRule({ condition: { field: "total", operator: "gte", value: 1000 } }),
    ]);
    mockRequestRepo.create.mockResolvedValue(buildRequest());

    const result = await makeService().evaluateAndRaise({
      organizationId: "org-1",
      entityType: "purchase_invoice",
      entityId: "inv-1",
      fields: { total: 5000 },
      requestedBy: "user-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
    expect(mockRequestRepo.create).toHaveBeenCalledTimes(1);
    expect(mockRequestRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        rule_id: "rule-1",
        entity_id: "inv-1",
        status: "pending",
      })
    );
  });

  it("returns an empty array when no rule matches", async () => {
    mockRuleRepo.listActiveByEntityType.mockResolvedValue([
      buildRule({ condition: { field: "total", operator: "gte", value: 10000 } }),
    ]);

    const result = await makeService().evaluateAndRaise({
      organizationId: "org-1",
      entityType: "purchase_invoice",
      entityId: "inv-1",
      fields: { total: 500 },
      requestedBy: "user-1",
    });

    expect(result.success && result.data).toEqual([]);
    expect(mockRequestRepo.create).not.toHaveBeenCalled();
  });

  it("raises a request for each of multiple matching rules", async () => {
    mockRuleRepo.listActiveByEntityType.mockResolvedValue([
      buildRule({
        id: "rule-1",
        condition: { field: "total", operator: "gte", value: 1000 },
      }),
      buildRule({
        id: "rule-2",
        condition: { field: "status", operator: "eq", value: "draft" },
      }),
      buildRule({
        id: "rule-3",
        condition: { field: "total", operator: "gte", value: 999999 },
      }),
    ]);
    mockRequestRepo.create
      .mockResolvedValueOnce(buildRequest({ id: "req-1", ruleId: "rule-1" }))
      .mockResolvedValueOnce(buildRequest({ id: "req-2", ruleId: "rule-2" }));

    const result = await makeService().evaluateAndRaise({
      organizationId: "org-1",
      entityType: "purchase_invoice",
      entityId: "inv-1",
      fields: { total: 5000, status: "draft" },
      requestedBy: "user-1",
    });

    // rule-1 (total>=1000) and rule-2 (status==draft) match; rule-3 does not.
    expect(result.success && result.data).toHaveLength(2);
    expect(mockRequestRepo.create).toHaveBeenCalledTimes(2);
  });

  it("skips requests that fail to persist", async () => {
    mockRuleRepo.listActiveByEntityType.mockResolvedValue([buildRule()]);
    mockRequestRepo.create.mockResolvedValue(null);

    const result = await makeService().evaluateAndRaise({
      organizationId: "org-1",
      entityType: "purchase_invoice",
      entityId: "inv-1",
      fields: { total: 5000 },
      requestedBy: "user-1",
    });

    expect(result.success && result.data).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// Decisions
// ─────────────────────────────────────────────────────────────

describe("ApprovalService — decisions", () => {
  it("approves a pending request", async () => {
    mockRequestRepo.findById.mockResolvedValue(buildRequest({ version: 1 }));
    mockRequestRepo.decide.mockResolvedValue(
      buildRequest({ status: "approved", version: 2, decidedBy: "user-2" })
    );

    const result = await makeService().approveRequest("req-1", "user-2", "ok");
    expect(result.success).toBe(true);
    expect(mockRequestRepo.decide).toHaveBeenCalledWith(
      "req-1",
      { status: "approved", decided_by: "user-2", decision_reason: "ok" },
      1
    );
  });

  it("blocks a decider who lacks the rule's named approver role", async () => {
    mockRequestRepo.findById.mockResolvedValue(buildRequest({ version: 1 }));
    mockRuleRepo.findById.mockResolvedValue(
      buildRule({ approverRoleId: "role-1" })
    );

    const result = await makeService().approveRequest(
      "req-1",
      "user-2",
      undefined,
      { deciderRoleId: "role-2", canOverride: false }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockRequestRepo.decide).not.toHaveBeenCalled();
  });

  it("allows a decider who holds the rule's named approver role", async () => {
    mockRequestRepo.findById.mockResolvedValue(buildRequest({ version: 1 }));
    mockRuleRepo.findById.mockResolvedValue(
      buildRule({ approverRoleId: "role-1" })
    );
    mockRequestRepo.decide.mockResolvedValue(
      buildRequest({ status: "approved", version: 2 })
    );

    const result = await makeService().approveRequest(
      "req-1",
      "user-2",
      undefined,
      { deciderRoleId: "role-1", canOverride: false }
    );
    expect(result.success).toBe(true);
    expect(mockRequestRepo.decide).toHaveBeenCalled();
  });

  it("lets an override decider (admin) decide regardless of role", async () => {
    mockRequestRepo.findById.mockResolvedValue(buildRequest({ version: 1 }));
    mockRuleRepo.findById.mockResolvedValue(
      buildRule({ approverRoleId: "role-1" })
    );
    mockRequestRepo.decide.mockResolvedValue(
      buildRequest({ status: "approved", version: 2 })
    );

    const result = await makeService().approveRequest(
      "req-1",
      "user-2",
      undefined,
      { deciderRoleId: "role-9", canOverride: true }
    );
    expect(result.success).toBe(true);
    expect(mockRequestRepo.decide).toHaveBeenCalled();
  });

  it("rejects a pending request", async () => {
    mockRequestRepo.findById.mockResolvedValue(buildRequest({ version: 1 }));
    mockRequestRepo.decide.mockResolvedValue(
      buildRequest({ status: "rejected", version: 2 })
    );
    const result = await makeService().rejectRequest("req-1", "user-2");
    expect(result.success).toBe(true);
    expect(mockRequestRepo.decide).toHaveBeenCalledWith(
      "req-1",
      { status: "rejected", decided_by: "user-2", decision_reason: null },
      1
    );
  });

  it("cancels a pending request", async () => {
    mockRequestRepo.findById.mockResolvedValue(buildRequest({ version: 1 }));
    mockRequestRepo.decide.mockResolvedValue(
      buildRequest({ status: "cancelled", version: 2 })
    );
    const result = await makeService().cancelRequest("req-1", "user-1");
    expect(result.success).toBe(true);
  });

  it("returns not_found when the request does not exist", async () => {
    mockRequestRepo.findById.mockResolvedValue(null);
    const result = await makeService().approveRequest("req-1", "user-2");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRequestRepo.decide).not.toHaveBeenCalled();
  });

  it("returns conflict when the request is already decided", async () => {
    mockRequestRepo.findById.mockResolvedValue(
      buildRequest({ status: "approved" })
    );
    const result = await makeService().approveRequest("req-1", "user-2");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
    expect(mockRequestRepo.decide).not.toHaveBeenCalled();
  });

  it("returns conflict when the optimistic decide writes zero rows", async () => {
    mockRequestRepo.findById.mockResolvedValue(buildRequest({ version: 1 }));
    mockRequestRepo.decide.mockResolvedValue(null);
    const result = await makeService().rejectRequest("req-1", "user-2");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });
});
