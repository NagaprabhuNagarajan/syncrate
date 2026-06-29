import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { CbnPurchaseOrder } from "@/features/cbn/types/cbn.types";
import { PurchaseSyncService } from "./purchase-sync.service";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const { mockRepo, auditLogMock, rpcMock } = vi.hoisted(() => ({
  mockRepo: {
    listBySenderOrg: vi.fn(),
    listByReceiverOrg: vi.fn(),
  },
  auditLogMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/features/cbn/repositories/purchase-sync.repository", () => ({
  PurchaseSyncRepository: vi.fn(() => mockRepo),
}));

vi.mock("@/features/audit/services/audit.service", () => ({
  AuditService: vi.fn(() => ({ log: auditLogMock })),
}));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const supabase = { rpc: rpcMock } as unknown as AppSupabaseClient;

function service(): PurchaseSyncService {
  return new PurchaseSyncService(supabase);
}

beforeEach(() => {
  vi.clearAllMocks();
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// sendPurchaseOrder
// ─────────────────────────────────────────────────────────────

describe("PurchaseSyncService.sendPurchaseOrder", () => {
  it("returns the CBN PO ID and audits on success", async () => {
    rpcMock.mockResolvedValue({ data: "cbn-po-1", error: null });

    const result = await service().sendPurchaseOrder("po-1", "conn-1");

    expect(result).toEqual({ success: true, data: "cbn-po-1" });
    expect(rpcMock).toHaveBeenCalledWith("send_cbn_purchase_order", {
      p_po_id: "po-1",
      p_connection_id: "conn-1",
    });
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cbn.purchase_order.send",
        entityId: "cbn-po-1",
      })
    );
  });

  it("maps permission_denied RPC errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "permission_denied: receive_purchase_orders not granted" },
    });

    const result = await service().sendPurchaseOrder("po-1", "conn-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("permission_denied");
    }
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("maps an unrecognized RPC error to unknown", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await service().sendPurchaseOrder("po-1", "conn-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// acceptPurchaseOrder
// ─────────────────────────────────────────────────────────────

describe("PurchaseSyncService.acceptPurchaseOrder", () => {
  it("returns the sales order ID and audits on success", async () => {
    rpcMock.mockResolvedValue({ data: "so-1", error: null });

    const result = await service().acceptPurchaseOrder("cbn-po-1", "sup-1", "ok");

    expect(result).toEqual({ success: true, data: "so-1" });
    expect(rpcMock).toHaveBeenCalledWith("accept_cbn_purchase_order", {
      p_cbn_po_id: "cbn-po-1",
      p_supplier_org_id: "sup-1",
      p_notes: "ok",
    });
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cbn.purchase_order.accept" })
    );
  });

  it("passes null notes when omitted", async () => {
    rpcMock.mockResolvedValue({ data: "so-1", error: null });

    await service().acceptPurchaseOrder("cbn-po-1", "sup-1");

    expect(rpcMock).toHaveBeenCalledWith("accept_cbn_purchase_order", {
      p_cbn_po_id: "cbn-po-1",
      p_supplier_org_id: "sup-1",
      p_notes: null,
    });
  });

  it("maps invalid_status RPC errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "invalid_status: already accepted" },
    });

    const result = await service().acceptPurchaseOrder("cbn-po-1", "sup-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// rejectPurchaseOrder
// ─────────────────────────────────────────────────────────────

describe("PurchaseSyncService.rejectPurchaseOrder", () => {
  it("returns success and audits", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await service().rejectPurchaseOrder(
      "cbn-po-1",
      "sup-1",
      "Out of stock"
    );

    expect(result).toEqual({ success: true, data: undefined });
    expect(rpcMock).toHaveBeenCalledWith("reject_cbn_purchase_order", {
      p_cbn_po_id: "cbn-po-1",
      p_supplier_org_id: "sup-1",
      p_reason: "Out of stock",
    });
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cbn.purchase_order.reject" })
    );
  });

  it("maps not_found RPC errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "not_found: PO does not exist" },
    });

    const result = await service().rejectPurchaseOrder("cbn-po-1", "sup-1", "x");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// listSent / listReceived
// ─────────────────────────────────────────────────────────────

describe("PurchaseSyncService list methods", () => {
  it("listSent delegates to the repository", async () => {
    const rows: CbnPurchaseOrder[] = [];
    mockRepo.listBySenderOrg.mockResolvedValue(rows);

    const result = await service().listSent("org-1", { status: "pending" });

    expect(result).toBe(rows);
    expect(mockRepo.listBySenderOrg).toHaveBeenCalledWith("org-1", {
      status: "pending",
    });
  });

  it("listReceived delegates to the repository", async () => {
    const rows: CbnPurchaseOrder[] = [];
    mockRepo.listByReceiverOrg.mockResolvedValue(rows);

    const result = await service().listReceived("org-1");

    expect(result).toBe(rows);
    expect(mockRepo.listByReceiverOrg).toHaveBeenCalledWith("org-1", undefined);
  });
});
