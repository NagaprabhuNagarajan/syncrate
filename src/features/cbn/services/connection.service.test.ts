import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConnectionService } from "./connection.service";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { BusinessConnection } from "@/features/cbn/types/cbn.types";

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const MOCK_CONNECTION: BusinessConnection = {
  id: "conn-1",
  organizationId: "org-a",
  requesterOrganizationId: "org-a",
  recipientOrganizationId: "org-b",
  status: "pending",
  connectionMessage: null,
  requesterGrants: [],
  recipientGrants: [],
  requestedAt: new Date("2026-01-01"),
  acceptedAt: null,
  rejectedAt: null,
  disconnectedAt: null,
  rejectionReason: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  createdBy: null,
};

// ─────────────────────────────────────────────────────────────
// Factory helpers
// ─────────────────────────────────────────────────────────────

function makeSupabaseFindById(
  row: Record<string, unknown> | null,
  rpcResult: { data: unknown; error: null | { message: string } }
): AppSupabaseClient {
  const single = vi.fn().mockResolvedValue({ data: row, error: row ? null : { message: "not found" } });
  const is = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ is });
  const select = vi.fn().mockReturnValue({ eq });
  const _from = vi.fn().mockReturnValue({ select });
  void _from; // constructed but not used — fromSpy is used instead
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  // audit log insert
  const auditInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "audit-1" }, error: null }) }) });
  const fromSpy = vi.fn((table: string) => {
    if (table === "audit_logs") {return { insert: auditInsert };}
    return { select };
  });
  return { from: fromSpy, rpc } as unknown as AppSupabaseClient;
}

function makeDbRow(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    id: "conn-1",
    organization_id: "org-a",
    requester_organization_id: "org-a",
    recipient_organization_id: "org-b",
    status: "pending",
    connection_message: null,
    requester_grants: [],
    recipient_grants: [],
    requested_at: "2026-01-01T00:00:00Z",
    accepted_at: null,
    rejected_at: null,
    disconnected_at: null,
    rejection_reason: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
    deleted_at: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// requestConnection
// ─────────────────────────────────────────────────────────────

describe("ConnectionService.requestConnection", () => {
  it("returns the connection ID on success", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: "conn-1",
      error: null,
    });
    const service = new ConnectionService(supabase);

    const result = await service.requestConnection({
      requesterOrgId: "org-a",
      recipientOrgId: "org-b",
      message: "Hello!",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("conn-1");
    }
    expect(supabase.rpc).toHaveBeenCalledWith("request_business_connection", {
      p_requester_org_id: "org-a",
      p_recipient_org_id: "org-b",
      p_message: "Hello!",
    });
  });

  it("maps permission_denied RPC error to the correct code", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: null,
      error: { message: "permission_denied: cbn.connect permission required" },
    });
    const service = new ConnectionService(supabase);

    const result = await service.requestConnection({
      requesterOrgId: "org-a",
      recipientOrgId: "org-b",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("permission_denied");
    }
  });

  it("maps duplicate RPC error to the correct code", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: null,
      error: { message: "duplicate: connection already exists" },
    });
    const service = new ConnectionService(supabase);

    const result = await service.requestConnection({
      requesterOrgId: "org-a",
      recipientOrgId: "org-b",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// acceptConnection
// ─────────────────────────────────────────────────────────────

describe("ConnectionService.acceptConnection", () => {
  it("returns success on happy path", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: undefined,
      error: null,
    });
    const service = new ConnectionService(supabase);

    const result = await service.acceptConnection("conn-1");

    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("accept_connection_request", {
      p_connection_id: "conn-1",
    });
  });

  it("returns not_found when connection does not exist", async () => {
    const supabase = makeSupabaseFindById(null, { data: null, error: null });
    const service = new ConnectionService(supabase);

    const result = await service.acceptConnection("missing-conn");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// rejectConnection
// ─────────────────────────────────────────────────────────────

describe("ConnectionService.rejectConnection", () => {
  it("returns success on happy path", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: undefined,
      error: null,
    });
    const service = new ConnectionService(supabase);

    const result = await service.rejectConnection("conn-1", "Not interested");

    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("reject_connection_request", {
      p_connection_id: "conn-1",
      p_reason: "Not interested",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// listConnections
// ─────────────────────────────────────────────────────────────

describe("ConnectionService.listConnections", () => {
  it("returns mapped BusinessConnection array", async () => {
    const dbRows = [makeDbRow(), makeDbRow({ id: "conn-2" })];
    const order = vi.fn().mockResolvedValue({ data: dbRows, error: null });
    const is = vi.fn().mockReturnValue({ order });
    const or = vi.fn().mockReturnValue({ is });
    const select = vi.fn().mockReturnValue({ or });
    const from = vi.fn().mockReturnValue({ select });

    const supabase = {
      from,
      rpc: vi.fn(),
    } as unknown as AppSupabaseClient;

    const service = new ConnectionService(supabase);
    const connections = await service.listConnections("org-a");

    expect(connections).toHaveLength(2);
    expect(connections[0].id).toBe("conn-1");
    expect(connections[1].id).toBe("conn-2");
  });
});

// ─────────────────────────────────────────────────────────────
// getConnection
// ─────────────────────────────────────────────────────────────

describe("ConnectionService.getConnection", () => {
  it("returns connection when found", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: null,
      error: null,
    });
    const service = new ConnectionService(supabase);

    const result = await service.getConnection("conn-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("conn-1");
    }
  });

  it("returns not_found for missing connection", async () => {
    const supabase = makeSupabaseFindById(null, { data: null, error: null });
    const service = new ConnectionService(supabase);

    const result = await service.getConnection("missing");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// suppress unused variable warning
void MOCK_CONNECTION;

// ─────────────────────────────────────────────────────────────
// beforeEach reset
// ─────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});
