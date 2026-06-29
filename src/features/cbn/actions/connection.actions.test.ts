import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  disconnectBusiness,
  updateConnectionPermissions,
} from "./connection.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const { mockOrgService, revalidateMock, getUserMock, createClientMock, rpcMock } =
  vi.hoisted(() => ({
    mockOrgService: {
      getOrganizationContext: vi.fn(),
    },
    revalidateMock: vi.fn(),
    getUserMock: vi.fn(),
    createClientMock: vi.fn(),
    rpcMock: vi.fn(),
  }));

vi.mock("next/cache", () => ({
  revalidatePath: revalidateMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createClientMock,
}));

vi.mock("@/features/organization/services/organization.service", () => ({
  OrganizationService: vi.fn(() => mockOrgService),
}));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }
  return form;
}

const fakeSupabase = {
  auth: { getUser: getUserMock },
  rpc: rpcMock,
} as unknown as AppSupabaseClient;

function authedAs(userId: string): void {
  getUserMock.mockResolvedValue({ data: { user: { id: userId } } });
}

function unauthenticated(): void {
  getUserMock.mockResolvedValue({ data: { user: null } });
}

function contextWith(permissions: readonly string[]): OrganizationContext {
  return { permissions } as unknown as OrganizationContext;
}

function grantPermission(permission: string): void {
  authedAs("user-1");
  mockOrgService.getOrganizationContext.mockResolvedValue(
    contextWith([permission])
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
});

// ─────────────────────────────────────────────────────────────
// sendConnectionRequest
// ─────────────────────────────────────────────────────────────

describe("sendConnectionRequest", () => {
  it("returns a validation error on invalid input (non-uuid)", async () => {
    const result = await sendConnectionRequest(
      fd({ requesterOrgId: "not-a-uuid", recipientOrgId: ORG_B })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns permission_denied when unauthenticated", async () => {
    unauthenticated();

    const result = await sendConnectionRequest(
      fd({ requesterOrgId: ORG_A, recipientOrgId: ORG_B })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Not authenticated" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns permission_denied when org context is missing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await sendConnectionRequest(
      fd({ requesterOrgId: ORG_A, recipientOrgId: ORG_B })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Organization not found" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns permission_denied when caller lacks cbn.connect", async () => {
    grantPermission("cbn.view");

    const result = await sendConnectionRequest(
      fd({ requesterOrgId: ORG_A, recipientOrgId: ORG_B })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls the RPC with parsed args and revalidates on success", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({ data: "conn-1", error: null });

    const result = await sendConnectionRequest(
      fd({ requesterOrgId: ORG_A, recipientOrgId: ORG_B, message: "Hello" })
    );

    expect(rpcMock).toHaveBeenCalledWith("request_business_connection", {
      p_requester_org_id: ORG_A,
      p_recipient_org_id: ORG_B,
      p_message: "Hello",
    });
    expect(result).toEqual({ success: true, data: "conn-1" });
    expect(revalidateMock).toHaveBeenCalledWith("/cbn");
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/connections");
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/discover");
  });

  it("passes null message when omitted", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({ data: "conn-1", error: null });

    await sendConnectionRequest(fd({ requesterOrgId: ORG_A, recipientOrgId: ORG_B }));

    expect(rpcMock).toHaveBeenCalledWith("request_business_connection", {
      p_requester_org_id: ORG_A,
      p_recipient_org_id: ORG_B,
      p_message: null,
    });
  });

  it("maps a duplicate RPC error to the duplicate code", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "duplicate key value violates unique constraint" },
    });

    const result = await sendConnectionRequest(
      fd({ requesterOrgId: ORG_A, recipientOrgId: ORG_B })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "duplicate", message: "Connection request already exists" },
    });
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("returns unknown for any other RPC error", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const result = await sendConnectionRequest(
      fd({ requesterOrgId: ORG_A, recipientOrgId: ORG_B })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: "boom" },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// acceptConnectionRequest
// ─────────────────────────────────────────────────────────────

describe("acceptConnectionRequest", () => {
  it("returns validation when required args are missing", async () => {
    const result = await acceptConnectionRequest("", "org-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "validation",
        message: "Connection ID and organization ID are required",
      },
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns permission_denied when caller lacks cbn.connect", async () => {
    grantPermission("cbn.view");

    const result = await acceptConnectionRequest("conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls the RPC and revalidates on success", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await acceptConnectionRequest("conn-1", "org-1");

    expect(rpcMock).toHaveBeenCalledWith("accept_connection_request", {
      p_connection_id: "conn-1",
    });
    expect(result).toEqual({ success: true, data: undefined });
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/connections/conn-1");
  });

  it("returns unknown when the RPC errors", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const result = await acceptConnectionRequest("conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: "rpc failed" },
    });
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// rejectConnectionRequest
// ─────────────────────────────────────────────────────────────

describe("rejectConnectionRequest", () => {
  it("returns validation when required args are missing", async () => {
    const result = await rejectConnectionRequest("conn-1", "");

    expect(result).toEqual({
      success: false,
      error: {
        code: "validation",
        message: "Connection ID and organization ID are required",
      },
    });
  });

  it("passes the provided reason and revalidates on success", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await rejectConnectionRequest("conn-1", "org-1", "Not now");

    expect(rpcMock).toHaveBeenCalledWith("reject_connection_request", {
      p_connection_id: "conn-1",
      p_reason: "Not now",
    });
    expect(result).toEqual({ success: true, data: undefined });
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/connections");
  });

  it("passes null reason when omitted", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({ data: null, error: null });

    await rejectConnectionRequest("conn-1", "org-1");

    expect(rpcMock).toHaveBeenCalledWith("reject_connection_request", {
      p_connection_id: "conn-1",
      p_reason: null,
    });
  });

  it("returns unknown when the RPC errors", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const result = await rejectConnectionRequest("conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: "rpc failed" },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// disconnectBusiness
// ─────────────────────────────────────────────────────────────

describe("disconnectBusiness", () => {
  it("returns validation when required args are missing", async () => {
    const result = await disconnectBusiness("", "org-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "validation",
        message: "Connection ID and organization ID are required",
      },
    });
  });

  it("returns permission_denied when caller lacks cbn.connect", async () => {
    grantPermission("cbn.view");

    const result = await disconnectBusiness("conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
  });

  it("calls the RPC and revalidates on success", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await disconnectBusiness("conn-1", "org-1", "Ended deal");

    expect(rpcMock).toHaveBeenCalledWith("disconnect_business", {
      p_connection_id: "conn-1",
      p_reason: "Ended deal",
    });
    expect(result).toEqual({ success: true, data: undefined });
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/connections/conn-1");
  });

  it("returns unknown when the RPC errors", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const result = await disconnectBusiness("conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: "rpc failed" },
    });
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updateConnectionPermissions
// ─────────────────────────────────────────────────────────────

describe("updateConnectionPermissions", () => {
  it("returns validation when required args are missing", async () => {
    const result = await updateConnectionPermissions("", "org-1", []);

    expect(result).toEqual({
      success: false,
      error: {
        code: "validation",
        message: "Connection ID and organization ID are required",
      },
    });
  });

  it("returns permission_denied when caller lacks cbn.connect", async () => {
    grantPermission("cbn.view");

    const result = await updateConnectionPermissions("conn-1", "org-1", [
      "view_catalog",
    ]);

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
  });

  it("calls the RPC and revalidates on success", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({ data: null, error: null });

    const grants = ["view_catalog", "receive_invoices"];
    const result = await updateConnectionPermissions("conn-1", "org-1", grants);

    expect(rpcMock).toHaveBeenCalledWith("update_connection_permissions", {
      p_connection_id: "conn-1",
      p_my_grants: grants,
    });
    expect(result).toEqual({ success: true, data: undefined });
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/connections/conn-1");
  });

  it("returns unknown when the RPC errors", async () => {
    grantPermission("cbn.connect");
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const result = await updateConnectionPermissions("conn-1", "org-1", []);

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: "rpc failed" },
    });
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});
