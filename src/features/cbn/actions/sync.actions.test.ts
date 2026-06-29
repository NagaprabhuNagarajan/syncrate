import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  sendCbnInvoice,
  acceptCbnInvoice,
  rejectCbnInvoice,
  sendCbnPurchaseOrder,
  acceptCbnPurchaseOrder,
  rejectCbnPurchaseOrder,
} from "./sync.actions";

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
// sendCbnInvoice
// ─────────────────────────────────────────────────────────────

describe("sendCbnInvoice", () => {
  it("returns validation when required args are missing", async () => {
    const result = await sendCbnInvoice("", "conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "validation",
        message: "Invoice ID, connection ID, and organization ID are required",
      },
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns permission_denied when unauthenticated", async () => {
    unauthenticated();

    const result = await sendCbnInvoice("inv-1", "conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Not authenticated" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns permission_denied when org context is missing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await sendCbnInvoice("inv-1", "conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Organization not found" },
    });
  });

  it("returns permission_denied when caller lacks invoice.create", async () => {
    grantPermission("invoice.view");

    const result = await sendCbnInvoice("inv-1", "conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls the RPC and revalidates on success", async () => {
    grantPermission("invoice.create");
    rpcMock.mockResolvedValue({ data: "cbn-inv-1", error: null });

    const result = await sendCbnInvoice("inv-1", "conn-1", "org-1");

    expect(rpcMock).toHaveBeenCalledWith("send_cbn_invoice", {
      p_invoice_id: "inv-1",
      p_connection_id: "conn-1",
    });
    expect(result).toEqual({ success: true, data: "cbn-inv-1" });
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/synced-invoices");
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/connections/conn-1");
  });

  it("returns unknown when the RPC errors", async () => {
    grantPermission("invoice.create");
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const result = await sendCbnInvoice("inv-1", "conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: "rpc failed" },
    });
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// acceptCbnInvoice
// ─────────────────────────────────────────────────────────────

describe("acceptCbnInvoice", () => {
  it("returns validation when required args are missing", async () => {
    const result = await acceptCbnInvoice("", "buyer-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "validation",
        message: "CBN invoice ID and buyer org ID are required",
      },
    });
  });

  it("returns permission_denied when caller lacks invoice.create", async () => {
    grantPermission("invoice.view");

    const result = await acceptCbnInvoice("cbn-inv-1", "buyer-1");

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
  });

  it("passes the provided notes and revalidates on success", async () => {
    grantPermission("invoice.create");
    rpcMock.mockResolvedValue({ data: "pur-inv-1", error: null });

    const result = await acceptCbnInvoice("cbn-inv-1", "buyer-1", "Looks good");

    expect(rpcMock).toHaveBeenCalledWith("accept_cbn_invoice", {
      p_cbn_invoice_id: "cbn-inv-1",
      p_buyer_org_id: "buyer-1",
      p_notes: "Looks good",
    });
    expect(result).toEqual({ success: true, data: "pur-inv-1" });
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/synced-invoices");
    expect(revalidateMock).toHaveBeenCalledWith("/cbn");
  });

  it("passes null notes when omitted", async () => {
    grantPermission("invoice.create");
    rpcMock.mockResolvedValue({ data: "pur-inv-1", error: null });

    await acceptCbnInvoice("cbn-inv-1", "buyer-1");

    expect(rpcMock).toHaveBeenCalledWith("accept_cbn_invoice", {
      p_cbn_invoice_id: "cbn-inv-1",
      p_buyer_org_id: "buyer-1",
      p_notes: null,
    });
  });

  it("returns unknown when the RPC errors", async () => {
    grantPermission("invoice.create");
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const result = await acceptCbnInvoice("cbn-inv-1", "buyer-1");

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: "rpc failed" },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// rejectCbnInvoice
// ─────────────────────────────────────────────────────────────

describe("rejectCbnInvoice", () => {
  it("returns validation when reason is missing", async () => {
    const result = await rejectCbnInvoice("cbn-inv-1", "buyer-1", "");

    expect(result).toEqual({
      success: false,
      error: {
        code: "validation",
        message: "CBN invoice ID, buyer org ID, and reason are required",
      },
    });
  });

  it("returns permission_denied when caller lacks invoice.create", async () => {
    grantPermission("invoice.view");

    const result = await rejectCbnInvoice("cbn-inv-1", "buyer-1", "Wrong amount");

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
  });

  it("calls the RPC and revalidates on success", async () => {
    grantPermission("invoice.create");
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await rejectCbnInvoice("cbn-inv-1", "buyer-1", "Wrong amount");

    expect(rpcMock).toHaveBeenCalledWith("reject_cbn_invoice", {
      p_cbn_invoice_id: "cbn-inv-1",
      p_buyer_org_id: "buyer-1",
      p_reason: "Wrong amount",
    });
    expect(result).toEqual({ success: true, data: undefined });
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/synced-invoices");
  });

  it("returns unknown when the RPC errors", async () => {
    grantPermission("invoice.create");
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const result = await rejectCbnInvoice("cbn-inv-1", "buyer-1", "reason");

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: "rpc failed" },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// sendCbnPurchaseOrder
// ─────────────────────────────────────────────────────────────

describe("sendCbnPurchaseOrder", () => {
  it("returns validation when required args are missing", async () => {
    const result = await sendCbnPurchaseOrder("", "conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "validation",
        message: "PO ID, connection ID, and organization ID are required",
      },
    });
  });

  it("returns permission_denied when caller lacks purchase_order.create", async () => {
    grantPermission("purchase_order.view");

    const result = await sendCbnPurchaseOrder("po-1", "conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
  });

  it("calls the RPC and revalidates on success", async () => {
    grantPermission("purchase_order.create");
    rpcMock.mockResolvedValue({ data: "cbn-po-1", error: null });

    const result = await sendCbnPurchaseOrder("po-1", "conn-1", "org-1");

    expect(rpcMock).toHaveBeenCalledWith("send_cbn_purchase_order", {
      p_po_id: "po-1",
      p_connection_id: "conn-1",
    });
    expect(result).toEqual({ success: true, data: "cbn-po-1" });
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/synced-orders");
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/connections/conn-1");
  });

  it("returns unknown when the RPC errors", async () => {
    grantPermission("purchase_order.create");
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const result = await sendCbnPurchaseOrder("po-1", "conn-1", "org-1");

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: "rpc failed" },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// acceptCbnPurchaseOrder
// ─────────────────────────────────────────────────────────────

describe("acceptCbnPurchaseOrder", () => {
  it("returns validation when required args are missing", async () => {
    const result = await acceptCbnPurchaseOrder("", "supplier-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "validation",
        message: "CBN PO ID and supplier org ID are required",
      },
    });
  });

  it("returns permission_denied when caller lacks purchase_order.update", async () => {
    grantPermission("purchase_order.view");

    const result = await acceptCbnPurchaseOrder("cbn-po-1", "supplier-1");

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
  });

  it("passes provided notes and revalidates on success", async () => {
    grantPermission("purchase_order.update");
    rpcMock.mockResolvedValue({ data: "so-1", error: null });

    const result = await acceptCbnPurchaseOrder("cbn-po-1", "supplier-1", "ok");

    expect(rpcMock).toHaveBeenCalledWith("accept_cbn_purchase_order", {
      p_cbn_po_id: "cbn-po-1",
      p_supplier_org_id: "supplier-1",
      p_notes: "ok",
    });
    expect(result).toEqual({ success: true, data: "so-1" });
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/synced-orders");
  });

  it("passes null notes when omitted", async () => {
    grantPermission("purchase_order.update");
    rpcMock.mockResolvedValue({ data: "so-1", error: null });

    await acceptCbnPurchaseOrder("cbn-po-1", "supplier-1");

    expect(rpcMock).toHaveBeenCalledWith("accept_cbn_purchase_order", {
      p_cbn_po_id: "cbn-po-1",
      p_supplier_org_id: "supplier-1",
      p_notes: null,
    });
  });

  it("returns unknown when the RPC errors", async () => {
    grantPermission("purchase_order.update");
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const result = await acceptCbnPurchaseOrder("cbn-po-1", "supplier-1");

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: "rpc failed" },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// rejectCbnPurchaseOrder
// ─────────────────────────────────────────────────────────────

describe("rejectCbnPurchaseOrder", () => {
  it("returns validation when reason is missing", async () => {
    const result = await rejectCbnPurchaseOrder("cbn-po-1", "supplier-1", "");

    expect(result).toEqual({
      success: false,
      error: {
        code: "validation",
        message: "CBN PO ID, supplier org ID, and reason are required",
      },
    });
  });

  it("returns permission_denied when caller lacks purchase_order.update", async () => {
    grantPermission("purchase_order.view");

    const result = await rejectCbnPurchaseOrder("cbn-po-1", "supplier-1", "no");

    expect(result).toEqual({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
  });

  it("calls the RPC and revalidates on success", async () => {
    grantPermission("purchase_order.update");
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await rejectCbnPurchaseOrder(
      "cbn-po-1",
      "supplier-1",
      "Out of stock"
    );

    expect(rpcMock).toHaveBeenCalledWith("reject_cbn_purchase_order", {
      p_cbn_po_id: "cbn-po-1",
      p_supplier_org_id: "supplier-1",
      p_reason: "Out of stock",
    });
    expect(result).toEqual({ success: true, data: undefined });
    expect(revalidateMock).toHaveBeenCalledWith("/cbn/synced-orders");
  });

  it("returns unknown when the RPC errors", async () => {
    grantPermission("purchase_order.update");
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const result = await rejectCbnPurchaseOrder("cbn-po-1", "supplier-1", "reason");

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: "rpc failed" },
    });
  });
});
