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
  requesterCounterpartyRole: null,
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
      counterpartyRole: "supplier",
      linkEntityId: "sup-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("conn-1");
    }
    expect(supabase.rpc).toHaveBeenCalledWith("request_business_connection", {
      p_requester_org_id: "org-a",
      p_recipient_org_id: "org-b",
      p_message: "Hello!",
      p_counterparty_role: "supplier",
      p_link_entity_id: "sup-1",
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
      counterpartyRole: "supplier",
      linkEntityId: "sup-1",
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
      counterpartyRole: "supplier",
      linkEntityId: "sup-1",
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
      p_link_entity_id: null,
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

describe("ConnectionService.rejectConnection (edge cases)", () => {
  it("returns not_found when the connection does not exist", async () => {
    const supabase = makeSupabaseFindById(null, { data: null, error: null });
    const service = new ConnectionService(supabase);

    const result = await service.rejectConnection("missing");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("passes null reason when omitted and maps RPC errors", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: null,
      error: { message: "permission_denied: not the recipient" },
    });
    const service = new ConnectionService(supabase);

    const result = await service.rejectConnection("conn-1");

    expect(supabase.rpc).toHaveBeenCalledWith("reject_connection_request", {
      p_connection_id: "conn-1",
      p_reason: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("permission_denied");
    }
  });
});

describe("ConnectionService.acceptConnection (RPC error)", () => {
  it("maps the RPC error code", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: null,
      error: { message: "invalid_status: not pending" },
    });
    const service = new ConnectionService(supabase);

    const result = await service.acceptConnection("conn-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
  });
});

describe("ConnectionService.disconnect", () => {
  it("returns success and runs the RPC on the happy path", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: undefined,
      error: null,
    });
    const service = new ConnectionService(supabase);

    const result = await service.disconnect("conn-1", "Ended deal");

    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("disconnect_business", {
      p_connection_id: "conn-1",
      p_reason: "Ended deal",
    });
  });

  it("passes null reason when omitted", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: undefined,
      error: null,
    });
    const service = new ConnectionService(supabase);

    await service.disconnect("conn-1");

    expect(supabase.rpc).toHaveBeenCalledWith("disconnect_business", {
      p_connection_id: "conn-1",
      p_reason: null,
    });
  });

  it("returns not_found when the connection does not exist", async () => {
    const supabase = makeSupabaseFindById(null, { data: null, error: null });
    const service = new ConnectionService(supabase);

    const result = await service.disconnect("missing");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("maps the RPC error code", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: null,
      error: { message: "permission_denied: not a party" },
    });
    const service = new ConnectionService(supabase);

    const result = await service.disconnect("conn-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("permission_denied");
    }
  });
});

describe("ConnectionService.updatePermissions", () => {
  it("returns success and passes grants on the happy path", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: undefined,
      error: null,
    });
    const service = new ConnectionService(supabase);

    const result = await service.updatePermissions("conn-1", [
      "view_catalog",
      "receive_invoices",
    ]);

    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("update_connection_permissions", {
      p_connection_id: "conn-1",
      p_my_grants: ["view_catalog", "receive_invoices"],
    });
  });

  it("returns not_found when the connection does not exist", async () => {
    const supabase = makeSupabaseFindById(null, { data: null, error: null });
    const service = new ConnectionService(supabase);

    const result = await service.updatePermissions("missing", ["view_catalog"]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("maps the RPC error code", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: null,
      error: { message: "validation: unknown permission" },
    });
    const service = new ConnectionService(supabase);

    const result = await service.updatePermissions("conn-1", ["view_catalog"]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });
});

describe("ConnectionService.requestConnection (default error)", () => {
  it("maps an unrecognized error to unknown", async () => {
    const supabase = makeSupabaseFindById(makeDbRow(), {
      data: null,
      error: { message: "some weird failure" },
    });
    const service = new ConnectionService(supabase);

    const result = await service.requestConnection({
      requesterOrgId: "org-a",
      recipientOrgId: "org-b",
      counterpartyRole: "supplier",
      linkEntityId: "sup-1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// removeConnection
// ─────────────────────────────────────────────────────────────

/** Mock whose `business_connections` table supports both select and update. */
function makeSupabaseForRemove(
  row: Record<string, unknown> | null,
  updateError: { message: string } | null = null
): { supabase: AppSupabaseClient; update: ReturnType<typeof vi.fn> } {
  const single = vi
    .fn()
    .mockResolvedValue({ data: row, error: row ? null : { message: "not found" } });
  const select = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ single }) }),
  });
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue({ error: updateError }),
    }),
  });
  const auditInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: "audit-1" }, error: null }),
    }),
  });
  const from = vi.fn((table: string) =>
    table === "audit_logs" ? { insert: auditInsert } : { select, update }
  );
  return {
    supabase: { from, rpc: vi.fn() } as unknown as AppSupabaseClient,
    update,
  };
}

describe("ConnectionService.removeConnection", () => {
  it("soft-deletes a rejected connection", async () => {
    const { supabase, update } = makeSupabaseForRemove(
      makeDbRow({ status: "rejected" })
    );

    const result = await new ConnectionService(supabase).removeConnection(
      "conn-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch.deleted_at).toEqual(expect.any(String));
    expect(patch.deleted_by).toBe("user-1");
  });

  it("soft-deletes a disconnected connection", async () => {
    const { supabase } = makeSupabaseForRemove(
      makeDbRow({ status: "disconnected" })
    );
    const result = await new ConnectionService(supabase).removeConnection(
      "conn-1",
      "user-1"
    );
    expect(result.success).toBe(true);
  });

  it("refuses to remove a live connection", async () => {
    const { supabase, update } = makeSupabaseForRemove(
      makeDbRow({ status: "accepted" })
    );

    const result = await new ConnectionService(supabase).removeConnection(
      "conn-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses to remove a pending request", async () => {
    const { supabase, update } = makeSupabaseForRemove(makeDbRow());
    const result = await new ConnectionService(supabase).removeConnection(
      "conn-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns not_found for a missing connection", async () => {
    const { supabase } = makeSupabaseForRemove(null);
    const result = await new ConnectionService(supabase).removeConnection(
      "conn-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("reports a failure when the update errors", async () => {
    const { supabase } = makeSupabaseForRemove(makeDbRow({ status: "rejected" }), {
      message: "rls denied",
    });
    const result = await new ConnectionService(supabase).removeConnection(
      "conn-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
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
