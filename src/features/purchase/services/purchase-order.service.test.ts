import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CreatePurchaseOrderInput,
  PurchaseOrder,
  PurchaseOrderWithItems,
  UpdatePurchaseOrderInput,
} from "@/features/purchase/types/purchase-order.types";
import { PurchaseOrderService } from "./purchase-order.service";

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
  },
}));

vi.mock("@/features/purchase/repositories/purchase-order.repository", () => ({
  PurchaseOrderRepository: vi.fn(() => mockRepo),
}));

function buildOrder(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: "po-1",
    organizationId: "org-1",
    poNumber: "PO-00001",
    supplierId: "sup-1",
    branchId: null,
    status: "draft",
    orderDate: new Date("2026-06-01"),
    expectedDeliveryDate: null,
    currency: "INR",
    notes: null,
    terms: null,
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version: 1,
    ...overrides,
  };
}

function withItems(order: PurchaseOrder): PurchaseOrderWithItems {
  return { ...order, items: [] };
}

const CREATE_INPUT: CreatePurchaseOrderInput = {
  supplierId: "sup-1",
  items: [
    { productId: "p-a", quantity: 10, unitPrice: 100, discountPercent: 10, taxRate: 18 },
    { productId: "p-b", quantity: 5, unitPrice: 50, discountPercent: 0, taxRate: 5 },
  ],
};

const MULTI_ITEM_INPUT: UpdatePurchaseOrderInput = {
  ...CREATE_INPUT,
  version: 2,
};

let service: PurchaseOrderService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new PurchaseOrderService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// createPurchaseOrder — totals math
// ─────────────────────────────────────────────────────────────

describe("PurchaseOrderService.createPurchaseOrder", () => {
  it("computes per-item and header totals for a multi-item PO", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 2, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(buildOrder({ id: "po-9" }));
    mockRepo.insertItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildOrder({ id: "po-9" })));

    const result = await service.createPurchaseOrder(
      MULTI_ITEM_INPUT,
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);

    const header = mockRepo.createHeader.mock.calls[0][0] as Record<string, number | string>;
    // Item A: gross 1000, disc 100, net 900, tax 162, line 1062
    // Item B: gross 250, disc 0, net 250, tax 12.5, line 262.5
    expect(header.subtotal).toBe(1250);
    expect(header.discount_amount).toBe(100);
    expect(header.tax_amount).toBe(174.5);
    expect(header.total_amount).toBe(1324.5);
    expect(header.po_number).toBe("PO-00003"); // count 2 + 1
    expect(header.status).toBe("draft");

    const items = mockRepo.insertItems.mock.calls[0][0] as Array<
      Record<string, number>
    >;
    expect(items[0].tax_amount).toBe(162);
    expect(items[0].line_total).toBe(1062);
    expect(items[1].tax_amount).toBe(12.5);
    expect(items[1].line_total).toBe(262.5);
  });

  it("defaults missing discount/tax to zero", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(buildOrder());
    mockRepo.insertItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildOrder()));

    await service.createPurchaseOrder(
      { supplierId: "sup-1", items: [{ productId: "p", quantity: 3, unitPrice: 10 }] },
      "org-1",
      "user-1"
    );

    const header = mockRepo.createHeader.mock.calls[0][0] as Record<string, number>;
    expect(header.subtotal).toBe(30);
    expect(header.discount_amount).toBe(0);
    expect(header.tax_amount).toBe(0);
    expect(header.total_amount).toBe(30);
  });

  it("fails when the header insert fails", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(null);

    const result = await service.createPurchaseOrder(MULTI_ITEM_INPUT, "org-1", "u");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(mockRepo.insertItems).not.toHaveBeenCalled();
  });

  it("rolls back the header when item insert fails", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(buildOrder({ id: "po-9" }));
    mockRepo.insertItems.mockResolvedValue(false);

    const result = await service.createPurchaseOrder(MULTI_ITEM_INPUT, "org-1", "u");
    expect(result.success).toBe(false);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("po-9", "u");
  });
});

// ─────────────────────────────────────────────────────────────
// updatePurchaseOrder — draft only
// ─────────────────────────────────────────────────────────────

describe("PurchaseOrderService.updatePurchaseOrder", () => {
  it("recomputes totals, version-gates the write, and replaces items for a draft", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue({ status: "ok", order: buildOrder() });
    mockRepo.replaceItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildOrder()));

    const result = await service.updatePurchaseOrder(
      "po-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    const call = mockRepo.updateHeader.mock.calls[0];
    const patch = call[1] as Record<string, number>;
    expect(patch.subtotal).toBe(1250);
    expect(patch.total_amount).toBe(1324.5);
    // The expected version is forwarded as the 4th argument.
    expect(call[3]).toBe(2);
    expect(mockRepo.replaceItems).toHaveBeenCalled();
  });

  it("returns conflict when the version no longer matches", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue({ status: "conflict" });
    const result = await service.updatePurchaseOrder("po-1", MULTI_ITEM_INPUT, "org-1", "u");
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("conflict");}
    expect(mockRepo.replaceItems).not.toHaveBeenCalled();
  });

  it("returns not_found when the order does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.updatePurchaseOrder("po-1", MULTI_ITEM_INPUT, "org-1", "u");
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("not_found");}
  });

  it("returns not_found when the order belongs to another org", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ organizationId: "org-1" }));
    const result = await service.updatePurchaseOrder("po-1", MULTI_ITEM_INPUT, "org-2", "u");
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("not_found");}
  });

  it("rejects editing a non-draft order", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "submitted" }));
    const result = await service.updatePurchaseOrder("po-1", MULTI_ITEM_INPUT, "org-1", "u");
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("invalid_status");}
    expect(mockRepo.updateHeader).not.toHaveBeenCalled();
  });

  it("fails when the header update errors", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue({ status: "error" });
    const result = await service.updatePurchaseOrder("po-1", MULTI_ITEM_INPUT, "org-1", "u");
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("unknown");}
  });

  it("fails when replacing items fails", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue({ status: "ok", order: buildOrder() });
    mockRepo.replaceItems.mockResolvedValue(false);
    const result = await service.updatePurchaseOrder("po-1", MULTI_ITEM_INPUT, "org-1", "u");
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("unknown");}
  });
});

// ─────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────

describe("PurchaseOrderService.submitPurchaseOrder", () => {
  it("transitions a draft to submitted", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "draft" }));
    mockRepo.updateStatus.mockResolvedValue(buildOrder({ status: "submitted" }));
    const result = await service.submitPurchaseOrder("po-1", "org-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.updateStatus).toHaveBeenCalledWith("po-1", "submitted", "user-1", false);
  });

  it("rejects submitting a non-draft order", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "approved" }));
    const result = await service.submitPurchaseOrder("po-1", "org-1", "u");
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("invalid_status");}
  });

  it("returns not_found for a missing order", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.submitPurchaseOrder("po-1", "org-1", "u");
    if (!result.success) {expect(result.error.code).toBe("not_found");}
  });

  it("fails when the status update fails", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "draft" }));
    mockRepo.updateStatus.mockResolvedValue(null);
    const result = await service.submitPurchaseOrder("po-1", "org-1", "u");
    if (!result.success) {expect(result.error.code).toBe("unknown");}
  });
});

describe("PurchaseOrderService.approvePurchaseOrder", () => {
  it("approves a submitted order and stamps the approver", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "submitted" }));
    mockRepo.updateStatus.mockResolvedValue(buildOrder({ status: "approved" }));
    const result = await service.approvePurchaseOrder("po-1", "org-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.updateStatus).toHaveBeenCalledWith("po-1", "approved", "user-1", true);
  });

  it("rejects approving a non-submitted order", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "draft" }));
    const result = await service.approvePurchaseOrder("po-1", "org-1", "u");
    if (!result.success) {expect(result.error.code).toBe("invalid_status");}
  });
});

describe("PurchaseOrderService.cancelPurchaseOrder", () => {
  it("cancels a draft order", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "draft" }));
    mockRepo.updateStatus.mockResolvedValue(buildOrder({ status: "cancelled" }));
    const result = await service.cancelPurchaseOrder("po-1", "org-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.updateStatus).toHaveBeenCalledWith("po-1", "cancelled", "user-1", false);
  });

  it("rejects cancelling a completed order", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "completed" }));
    const result = await service.cancelPurchaseOrder("po-1", "org-1", "u");
    if (!result.success) {expect(result.error.code).toBe("invalid_status");}
  });

  it("rejects cancelling an already-cancelled order", async () => {
    mockRepo.findById.mockResolvedValue(buildOrder({ status: "cancelled" }));
    const result = await service.cancelPurchaseOrder("po-1", "org-1", "u");
    if (!result.success) {expect(result.error.code).toBe("invalid_status");}
  });
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("PurchaseOrderService reads", () => {
  it("getPurchaseOrder returns the order with items", async () => {
    mockRepo.findWithItems.mockResolvedValue(withItems(buildOrder()));
    const result = await service.getPurchaseOrder("po-1");
    expect(result.success).toBe(true);
  });

  it("getPurchaseOrder returns not_found when missing", async () => {
    mockRepo.findWithItems.mockResolvedValue(null);
    const result = await service.getPurchaseOrder("po-1");
    if (!result.success) {expect(result.error.code).toBe("not_found");}
  });

  it("listPurchaseOrders delegates to the repository", async () => {
    const listResult = { items: [], total: 0, page: 1, pageSize: 20 };
    mockRepo.list.mockResolvedValue(listResult);
    const result = await service.listPurchaseOrders("org-1", { status: "draft" });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { status: "draft" });
  });
});
