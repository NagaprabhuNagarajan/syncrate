import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { AuditLog } from "@/features/audit/types/audit.types";
import type { AiInteraction } from "@/features/ai/types/ai.types";
import type { CbnEvent } from "@/features/cbn/types/cbn.types";
import { AuditCenterService } from "./audit-center.service";

// ─────────────────────────────────────────────────────────────
// Mock the three underlying trails the service composes
// ─────────────────────────────────────────────────────────────

const { mockAuditList, mockAiList, mockCbnList } = vi.hoisted(() => ({
  mockAuditList: vi.fn(),
  mockAiList: vi.fn(),
  mockCbnList: vi.fn(),
}));

vi.mock("@/features/audit/services/audit.service", () => ({
  AuditService: vi.fn(() => ({ list: mockAuditList })),
}));

vi.mock("@/features/ai/services/ai-interaction.service", () => ({
  AiInteractionService: vi.fn(() => ({ list: mockAiList })),
}));

vi.mock("@/features/cbn/repositories/cbn-events.repository", () => ({
  CbnEventsRepository: vi.fn(() => ({ listByOrg: mockCbnList })),
}));

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

const ORG_ID = "org-1";

function buildAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "log-1",
    organizationId: ORG_ID,
    actorUserId: "user-1",
    action: "customer.create",
    entityType: "customer",
    entityId: "cust-1",
    summary: 'Created customer "Acme"',
    metadata: { foo: "bar" },
    createdAt: new Date("2026-01-02T10:00:00.000Z"),
    ...overrides,
  };
}

function buildAiInteraction(
  overrides: Partial<AiInteraction> = {}
): AiInteraction {
  return {
    id: "ai-1",
    organizationId: ORG_ID,
    actorUserId: "user-2",
    capability: "assistant",
    model: "claude",
    promptSummary: "Summarize invoices",
    responseSummary: "Done",
    confidence: 0.9,
    inputTokens: 100,
    outputTokens: 50,
    executionMs: 1200,
    approvalStatus: "not_required",
    status: "success",
    errorMessage: null,
    metadata: {},
    createdAt: "2026-01-03T10:00:00.000Z",
    ...overrides,
  };
}

function buildCbnEvent(overrides: Partial<CbnEvent> = {}): CbnEvent {
  return {
    id: "evt-1",
    organizationId: ORG_ID,
    connectionId: "conn-1",
    eventType: "invoice.synced",
    actorUserId: null,
    sourceOrganizationId: "org-1",
    targetOrganizationId: "org-2",
    referenceType: "invoice",
    referenceId: "inv-1",
    correlationId: "corr-1",
    metadata: {},
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

function makeService(): AuditCenterService {
  return new AuditCenterService({} as AppSupabaseClient);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuditList.mockResolvedValue([]);
  mockAiList.mockResolvedValue([]);
  mockCbnList.mockResolvedValue([]);
});

// ─────────────────────────────────────────────────────────────
// Aggregation & normalization
// ─────────────────────────────────────────────────────────────

describe("AuditCenterService.list — aggregation & normalization", () => {
  it("aggregates and normalizes entries from all three trails", async () => {
    mockAuditList.mockResolvedValue([buildAuditLog()]);
    mockAiList.mockResolvedValue([buildAiInteraction()]);
    mockCbnList.mockResolvedValue([buildCbnEvent()]);

    const result = await makeService().list(ORG_ID);

    expect(result.total).toBe(3);
    expect(result.entries).toHaveLength(3);

    const business = result.entries.find((e) => e.source === "business");
    const ai = result.entries.find((e) => e.source === "ai");
    const network = result.entries.find((e) => e.source === "network");

    expect(business).toMatchObject({
      id: "business:log-1",
      action: "customer.create",
      actor: "user-1",
      summary: 'Created customer "Acme"',
      timestamp: "2026-01-02T10:00:00.000Z",
      status: null,
    });
    expect(business?.details).toMatchObject({
      entityType: "customer",
      entityId: "cust-1",
    });

    expect(ai).toMatchObject({
      id: "ai:ai-1",
      action: "assistant",
      actor: "user-2",
      summary: "Summarize invoices",
      timestamp: "2026-01-03T10:00:00.000Z",
      status: "success",
    });

    expect(network).toMatchObject({
      id: "network:evt-1",
      action: "invoice.synced",
      actor: null,
      summary: "invoice.synced (invoice)",
      timestamp: "2026-01-01T10:00:00.000Z",
      status: "success",
    });
  });

  it("represents a null actor as null on the entry", async () => {
    mockCbnList.mockResolvedValue([buildCbnEvent({ actorUserId: null })]);

    const result = await makeService().list(ORG_ID);
    expect(result.entries[0]?.actor).toBeNull();
  });

  it("falls back to the action when no summary exists", async () => {
    mockAuditList.mockResolvedValue([buildAuditLog({ summary: null })]);

    const result = await makeService().list(ORG_ID);
    expect(result.entries[0]?.summary).toBe("customer.create");
  });

  it("uses the AI response summary then capability when prompt summary is absent", async () => {
    mockAiList.mockResolvedValue([
      buildAiInteraction({ promptSummary: null, responseSummary: "Reply" }),
    ]);
    const withResponse = await makeService().list(ORG_ID);
    expect(withResponse.entries[0]?.summary).toBe("Reply");

    mockAiList.mockResolvedValue([
      buildAiInteraction({ promptSummary: null, responseSummary: null }),
    ]);
    const withCapability = await makeService().list(ORG_ID);
    expect(withCapability.entries[0]?.summary).toBe("assistant");
  });

  it("uses the bare event type as the network summary when no reference type", async () => {
    mockCbnList.mockResolvedValue([buildCbnEvent({ referenceType: null })]);

    const result = await makeService().list(ORG_ID);
    expect(result.entries[0]?.summary).toBe("invoice.synced");
  });
});

// ─────────────────────────────────────────────────────────────
// Source filtering
// ─────────────────────────────────────────────────────────────

describe("AuditCenterService.list — source filtering", () => {
  it("only queries and returns the business trail when source=business", async () => {
    mockAuditList.mockResolvedValue([buildAuditLog()]);
    mockAiList.mockResolvedValue([buildAiInteraction()]);
    mockCbnList.mockResolvedValue([buildCbnEvent()]);

    const result = await makeService().list(ORG_ID, { source: "business" });

    expect(mockAuditList).toHaveBeenCalledTimes(1);
    expect(mockAiList).not.toHaveBeenCalled();
    expect(mockCbnList).not.toHaveBeenCalled();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.source).toBe("business");
  });

  it("only queries the ai trail when source=ai", async () => {
    mockAiList.mockResolvedValue([buildAiInteraction()]);

    const result = await makeService().list(ORG_ID, { source: "ai" });

    expect(mockAuditList).not.toHaveBeenCalled();
    expect(mockAiList).toHaveBeenCalledTimes(1);
    expect(mockCbnList).not.toHaveBeenCalled();
    expect(result.entries[0]?.source).toBe("ai");
  });

  it("only queries the network trail when source=network", async () => {
    mockCbnList.mockResolvedValue([buildCbnEvent()]);

    const result = await makeService().list(ORG_ID, { source: "network" });

    expect(mockAuditList).not.toHaveBeenCalled();
    expect(mockAiList).not.toHaveBeenCalled();
    expect(mockCbnList).toHaveBeenCalledTimes(1);
    expect(result.entries[0]?.source).toBe("network");
  });

  it("queries all trails when source=all (default)", async () => {
    await makeService().list(ORG_ID, { source: "all" });
    expect(mockAuditList).toHaveBeenCalledTimes(1);
    expect(mockAiList).toHaveBeenCalledTimes(1);
    expect(mockCbnList).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────
// Ordering, search, date filters
// ─────────────────────────────────────────────────────────────

describe("AuditCenterService.list — ordering & filters", () => {
  it("merges and orders entries by timestamp, newest first", async () => {
    mockAuditList.mockResolvedValue([buildAuditLog()]); // 2026-01-02
    mockAiList.mockResolvedValue([buildAiInteraction()]); // 2026-01-03 (newest)
    mockCbnList.mockResolvedValue([buildCbnEvent()]); // 2026-01-01 (oldest)

    const result = await makeService().list(ORG_ID);

    expect(result.entries.map((e) => e.source)).toEqual([
      "ai",
      "business",
      "network",
    ]);
  });

  it("filters by free-text search across action and summary", async () => {
    mockAuditList.mockResolvedValue([
      buildAuditLog({ id: "a", summary: "Created customer Acme" }),
      buildAuditLog({ id: "b", action: "invoice.update", summary: "Updated" }),
    ]);

    const result = await makeService().list(ORG_ID, { search: "invoice" });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.id).toBe("business:b");
  });

  it("filters by actor substring", async () => {
    mockAuditList.mockResolvedValue([
      buildAuditLog({ id: "a", actorUserId: "alice-123" }),
      buildAuditLog({ id: "b", actorUserId: "bob-456" }),
    ]);

    const result = await makeService().list(ORG_ID, { actor: "alice" });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.actor).toBe("alice-123");
  });

  it("filters by date range (inclusive bounds)", async () => {
    mockAuditList.mockResolvedValue([
      buildAuditLog({ id: "a", createdAt: new Date("2026-01-01T00:00:00Z") }),
      buildAuditLog({ id: "b", createdAt: new Date("2026-01-05T00:00:00Z") }),
      buildAuditLog({ id: "c", createdAt: new Date("2026-01-10T00:00:00Z") }),
    ]);

    const result = await makeService().list(ORG_ID, {
      from: "2026-01-02T00:00:00Z",
      to: "2026-01-06T00:00:00Z",
    });

    expect(result.entries.map((e) => e.id)).toEqual(["business:b"]);
  });
});

// ─────────────────────────────────────────────────────────────
// Pagination & empty case
// ─────────────────────────────────────────────────────────────

describe("AuditCenterService.list — pagination & empty", () => {
  it("returns an empty page when no trail has rows", async () => {
    const result = await makeService().list(ORG_ID);
    expect(result.entries).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
  });

  it("paginates the merged result set", async () => {
    const logs = Array.from({ length: 5 }, (_, i) =>
      buildAuditLog({
        id: `log-${i}`,
        createdAt: new Date(`2026-01-${String(10 - i).padStart(2, "0")}T00:00:00Z`),
      })
    );
    mockAuditList.mockResolvedValue(logs);

    const page1 = await makeService().list(ORG_ID, { page: 1, pageSize: 2 });
    expect(page1.entries).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.entries[0]?.id).toBe("business:log-0"); // newest

    const page3 = await makeService().list(ORG_ID, { page: 3, pageSize: 2 });
    expect(page3.entries).toHaveLength(1);
    expect(page3.entries[0]?.id).toBe("business:log-4"); // oldest
  });
});

// ─────────────────────────────────────────────────────────────
// CSV export
// ─────────────────────────────────────────────────────────────

describe("AuditCenterService.exportCsv", () => {
  it("exports every matching entry (ignoring pagination)", async () => {
    mockAuditList.mockResolvedValue([buildAuditLog()]);
    mockAiList.mockResolvedValue([buildAiInteraction()]);

    const csv = await makeService().exportCsv(ORG_ID, { pageSize: 1 });
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe(
      "timestamp,source,action,actor,status,summary,details"
    );
    // header + 2 data rows (pagination must not limit the export)
    expect(lines).toHaveLength(3);
  });
});
