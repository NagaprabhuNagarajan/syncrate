import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CreatePurchaseReturnInput,
  PurchaseReturn,
  PurchaseReturnWithItems,
} from "@/features/purchase/types/purchase-return.types";
import { PurchaseReturnService } from "./purchase-return.service";

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    findByNumber: vi.fn(),
    findItems: vi.fn(),
    findWithItems: vi.fn(),
    createHeader: vi.fn(),
    insertItems: vi.fn(),
    replaceItems: vi.fn(),
    updateHeader: vi.fn(),
    updateStatus: vi.fn(),
    softDelete: vi.fn(),
    completeReturnRpc: vi.fn(),
  },
}));

vi.mock("@/features/purchase/repositories/purchase-return.repository", () => ({
  PurchaseReturnRepository: vi.fn(() => mockRepo),
}));

function buildReturn(overrides: Partial<PurchaseReturn> = {}): PurchaseReturn {
  return {
    id: "pret-1",
    organizationId: "org-1",
    returnNumber: "PRET-00001",
    purchaseOrderId: null,
    supplierId: "sup-1",
    warehouseId: "wh-1",
    status: "draft",
    returnDate: new Date("2026-06-01"),
    reason: "damaged",
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    notes: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    ...overrides,
  };
}

function withItems(
  entry: PurchaseReturn,
  items: PurchaseReturnWithItems["items"] = []
): PurchaseReturnWithItems {
  return { ...entry, items };
}

const MULTI_ITEM_INPUT: CreatePurchaseReturnInput = {
  supplierId: "sup-1",
  warehouseId: "wh-1",
  reason: "damaged",
  items: [
    { productId: "p-a", quantity: 10, unitPrice: 100, taxRate: 18 },
    { productId: "p-b", quantity: 5, unitPrice: 50, taxRate: 5 },
  ],
};

let service: PurchaseReturnService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new PurchaseReturnService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// createPurchaseReturn — totals math + numbering
// ─────────────────────────────────────────────────────────────

describe("PurchaseReturnService.createPurchaseReturn", () => {
  it("computes per-item and header totals and auto-numbers the return", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 2, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(buildReturn({ id: "pret-9" }));
    mockRepo.insertItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildReturn({ id: "pret-9" }))
    );

    const result = await service.createPurchaseReturn(
      MULTI_ITEM_INPUT,
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);

    const header = mockRepo.createHeader.mock.calls[0][0] as Record<
      string,
      number | string
    >;
    // Line A: net 1000, tax 180, line 1180
    // Line B: net 250, tax 12.5, line 262.5
    expect(header.subtotal).toBe(1250);
    expect(header.tax_amount).toBe(192.5);
    expect(header.total_amount).toBe(1442.5);
    expect(header.return_number).toBe("PRET-00003"); // count 2 + 1
    expect(header.status).toBe("draft");

    const items = mockRepo.insertItems.mock.calls[0][0] as Array<
      Record<string, number | string | null>
    >;
    expect(items[0].tax_amount).toBe(180);
    expect(items[0].line_total).toBe(1180);
    expect(items[1].tax_amount).toBe(12.5);
    expect(items[1].line_total).toBe(262.5);
  });

  it("uses a provided return number when supplied", async () => {
    mockRepo.createHeader.mockResolvedValue(buildReturn());
    mockRepo.insertItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildReturn()));

    await service.createPurchaseReturn(
      { ...MULTI_ITEM_INPUT, returnNumber: "PRET-CUSTOM" },
      "org-1",
      "user-1"
    );

    const header = mockRepo.createHeader.mock.calls[0][0] as Record<
      string,
      string
    >;
    expect(header.return_number).toBe("PRET-CUSTOM");
    expect(mockRepo.list).not.toHaveBeenCalled();
  });

  it("fails when the header insert fails", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(null);

    const result = await service.createPurchaseReturn(
      MULTI_ITEM_INPUT,
      "org-1",
      "u"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(mockRepo.insertItems).not.toHaveBeenCalled();
  });

  it("rolls back the header when item insert fails", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(buildReturn({ id: "pret-9" }));
    mockRepo.insertItems.mockResolvedValue(false);

    const result = await service.createPurchaseReturn(
      MULTI_ITEM_INPUT,
      "org-1",
      "u"
    );
    expect(result.success).toBe(false);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("pret-9", "u");
  });
});

// ─────────────────────────────────────────────────────────────
// updatePurchaseReturn — draft only
// ─────────────────────────────────────────────────────────────

describe("PurchaseReturnService.updatePurchaseReturn", () => {
  it("recomputes totals, forwards the expected version, and replaces items for a draft", async () => {
    mockRepo.findById.mockResolvedValue(buildReturn({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue(buildReturn());
    mockRepo.replaceItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildReturn()));

    const result = await service.updatePurchaseReturn(
      "pret-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "user-1",
      4
    );

    expect(result.success).toBe(true);
    const patch = mockRepo.updateHeader.mock.calls[0][1] as Record<
      string,
      number
    >;
    expect(patch.subtotal).toBe(1250);
    expect(patch.total_amount).toBe(1442.5);
    // The expected version is forwarded to the repo for optimistic locking.
    expect(mockRepo.updateHeader.mock.calls[0][3]).toBe(4);
    expect(mockRepo.replaceItems).toHaveBeenCalled();
  });

  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.updatePurchaseReturn(
      "pret-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "u",
      1
    );
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("returns not_found for another org", async () => {
    mockRepo.findById.mockResolvedValue(buildReturn({ organizationId: "org-1" }));
    const result = await service.updatePurchaseReturn(
      "pret-1",
      MULTI_ITEM_INPUT,
      "org-2",
      "u",
      1
    );
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("rejects editing a non-draft return", async () => {
    mockRepo.findById.mockResolvedValue(buildReturn({ status: "completed" }));
    const result = await service.updatePurchaseReturn(
      "pret-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "u",
      1
    );
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(mockRepo.updateHeader).not.toHaveBeenCalled();
  });

  it("returns conflict when the optimistic lock fails (no row updated)", async () => {
    mockRepo.findById.mockResolvedValue(buildReturn({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue(null);
    const result = await service.updatePurchaseReturn(
      "pret-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "u",
      1
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
    expect(mockRepo.replaceItems).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// completePurchaseReturn — atomic via complete_purchase_return RPC
// ─────────────────────────────────────────────────────────────

describe("PurchaseReturnService.completePurchaseReturn", () => {
  it("delegates to the complete RPC and re-fetches the completed return on success", async () => {
    mockRepo.completeReturnRpc.mockResolvedValue({ data: null, error: null });
    mockRepo.findById.mockResolvedValue(buildReturn({ status: "completed" }));

    const result = await service.completePurchaseReturn(
      "pret-1",
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("completed");
    }
    expect(mockRepo.completeReturnRpc).toHaveBeenCalledWith("pret-1");
    expect(mockRepo.findById).toHaveBeenCalledWith("pret-1");
  });

  it("maps an insufficient_stock RPC error to insufficient_stock", async () => {
    mockRepo.completeReturnRpc.mockResolvedValue({
      data: null,
      error: { message: "insufficient_stock for product" },
    });
    const result = await service.completePurchaseReturn("pret-1", "org-1", "u");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("insufficient_stock");
    }
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it("maps an invalid_status RPC error to invalid_status", async () => {
    mockRepo.completeReturnRpc.mockResolvedValue({
      data: null,
      error: { message: "invalid_status: not a draft" },
    });
    const result = await service.completePurchaseReturn("pret-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
  });

  it("maps a not_found RPC error to not_found", async () => {
    mockRepo.completeReturnRpc.mockResolvedValue({
      data: null,
      error: { message: "purchase return not_found" },
    });
    const result = await service.completePurchaseReturn("pret-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("maps a validation RPC error to validation", async () => {
    mockRepo.completeReturnRpc.mockResolvedValue({
      data: null,
      error: { message: "validation: warehouse required" },
    });
    const result = await service.completePurchaseReturn("pret-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("maps an unexpected RPC error to unknown", async () => {
    mockRepo.completeReturnRpc.mockResolvedValue({
      data: null,
      error: { message: "deadlock detected" },
    });
    const result = await service.completePurchaseReturn("pret-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("returns not_found when the re-fetch comes back empty", async () => {
    mockRepo.completeReturnRpc.mockResolvedValue({ data: null, error: null });
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.completePurchaseReturn("pret-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// cancelPurchaseReturn — draft only
// ─────────────────────────────────────────────────────────────

describe("PurchaseReturnService.cancelPurchaseReturn", () => {
  it("cancels a draft return", async () => {
    mockRepo.findById.mockResolvedValue(buildReturn({ status: "draft" }));
    mockRepo.updateStatus.mockResolvedValue(buildReturn({ status: "cancelled" }));
    const result = await service.cancelPurchaseReturn("pret-1", "org-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      "pret-1",
      "cancelled",
      "user-1"
    );
  });

  it("rejects cancelling a completed return", async () => {
    mockRepo.findById.mockResolvedValue(buildReturn({ status: "completed" }));
    const result = await service.cancelPurchaseReturn("pret-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
  });

  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.cancelPurchaseReturn("pret-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("PurchaseReturnService reads", () => {
  it("getPurchaseReturn returns the return with items", async () => {
    mockRepo.findWithItems.mockResolvedValue(withItems(buildReturn()));
    const result = await service.getPurchaseReturn("pret-1");
    expect(result.success).toBe(true);
  });

  it("getPurchaseReturn returns not_found when missing", async () => {
    mockRepo.findWithItems.mockResolvedValue(null);
    const result = await service.getPurchaseReturn("pret-1");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("listPurchaseReturns delegates to the repository", async () => {
    const listResult = { items: [], total: 0, page: 1, pageSize: 20 };
    mockRepo.list.mockResolvedValue(listResult);
    const result = await service.listPurchaseReturns("org-1", {
      status: "draft",
    });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { status: "draft" });
  });
});
