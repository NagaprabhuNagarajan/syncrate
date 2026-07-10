import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CreateGoodsReceiptInput,
  GoodsReceipt,
  GoodsReceiptWithItems,
} from "@/features/purchase/types/goods-receipt.types";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseOrderWithItems,
} from "@/features/purchase/types/purchase-order.types";
import { GoodsReceiptService } from "./goods-receipt.service";

const { mockGrnRepo, mockPoRepo } = vi.hoisted(() => ({
  mockGrnRepo: {
    list: vi.fn(),
    findByPurchaseOrder: vi.fn(),
    findById: vi.fn(),
    findItems: vi.fn(),
    findWithItems: vi.fn(),
    receiveGoodsRpc: vi.fn(),
    getStats: vi.fn(),
  },
  mockPoRepo: {
    findWithItems: vi.fn(),
    findItems: vi.fn(),
  },
}));

vi.mock("@/features/purchase/repositories/goods-receipt.repository", () => ({
  GoodsReceiptRepository: vi.fn(() => mockGrnRepo),
}));
vi.mock("@/features/purchase/repositories/purchase-order.repository", () => ({
  PurchaseOrderRepository: vi.fn(() => mockPoRepo),
}));

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function buildPoItem(overrides: Partial<PurchaseOrderItem> = {}): PurchaseOrderItem {
  return {
    id: "poi-a",
    organizationId: "org-1",
    purchaseOrderId: "po-1",
    productId: "prod-a",
    description: null,
    quantity: 10,
    receivedQuantity: 0,
    unitPrice: 100,
    discountPercent: 0,
    taxRate: 18,
    taxAmount: 180,
    lineTotal: 1180,
    createdAt: new Date("2026-06-01"),
    createdBy: "user-1",
    ...overrides,
  };
}

function buildPo(
  overrides: Partial<PurchaseOrderWithItems> = {}
): PurchaseOrderWithItems {
  const base: PurchaseOrder = {
    id: "po-1",
    organizationId: "org-1",
    poNumber: "PO-00001",
    supplierId: "sup-1",
    branchId: "wh-1",
    status: "approved" as PurchaseOrderStatus,
    orderDate: new Date("2026-06-01"),
    expectedDeliveryDate: null,
    currency: "INR",
    notes: null,
    terms: null,
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    approvedBy: "user-1",
    approvedAt: new Date("2026-06-01"),
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version: 1,
  };
  return {
    ...base,
    items: [
      buildPoItem({ id: "poi-a", productId: "prod-a", quantity: 10 }),
      buildPoItem({ id: "poi-b", productId: "prod-b", quantity: 10 }),
    ],
    ...overrides,
  };
}

function buildReceipt(): GoodsReceipt {
  return {
    id: "grn-1",
    organizationId: "org-1",
    grnNumber: "GRN-00001",
    purchaseOrderId: "po-1",
    branchId: "wh-1",
    receivedDate: new Date("2026-06-26"),
    status: "completed",
    notes: null,
    createdAt: new Date("2026-06-26"),
    updatedAt: new Date("2026-06-26"),
    createdBy: "user-1",
  };
}

function fullReceipt(): GoodsReceiptWithItems {
  return { ...buildReceipt(), items: [] };
}

const PARTIAL_INPUT: CreateGoodsReceiptInput = {
  purchaseOrderId: "po-1",
  branchId: "wh-1",
  items: [
    { purchaseOrderItemId: "poi-a", productId: "prod-a", receivedQuantity: 4, rejectedQuantity: 0 },
    { purchaseOrderItemId: "poi-b", productId: "prod-b", receivedQuantity: 10, rejectedQuantity: 0 },
  ],
};

let service: GoodsReceiptService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new GoodsReceiptService({} as unknown as AppSupabaseClient);
  // Defaults that the happy path relies on.
  mockGrnRepo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
  mockGrnRepo.receiveGoodsRpc.mockResolvedValue({ data: "grn-1", error: null });
  mockGrnRepo.findWithItems.mockResolvedValue(fullReceipt());
});

// ─────────────────────────────────────────────────────────────
// createGoodsReceipt — atomic RPC integration
// ─────────────────────────────────────────────────────────────

describe("GoodsReceiptService.createGoodsReceipt", () => {
  it("calls receive_goods with the generated GRN number, header args and JSON items", async () => {
    mockGrnRepo.list.mockResolvedValue({ items: [], total: 7, page: 1, pageSize: 1 });
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());

    const result = await service.createGoodsReceipt(
      { ...PARTIAL_INPUT, notes: "  delivered  " },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    expect(mockGrnRepo.receiveGoodsRpc).toHaveBeenCalledTimes(1);

    const args = mockGrnRepo.receiveGoodsRpc.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(args.p_organization_id).toBe("org-1");
    expect(args.p_purchase_order_id).toBe("po-1");
    expect(args.p_branch_id).toBe("wh-1");
    expect(args.p_grn_number).toBe("GRN-00008"); // total 7 + 1
    expect(args.p_notes).toBe("delivered");

    const items = args.p_items as Array<Record<string, unknown>>;
    expect(items).toEqual([
      {
        purchase_order_item_id: "poi-a",
        product_id: "prod-a",
        ordered_quantity: 10,
        received_quantity: 4,
        rejected_quantity: 0,
        batch_id: null,
      },
      {
        purchase_order_item_id: "poi-b",
        product_id: "prod-b",
        ordered_quantity: 10,
        received_quantity: 10,
        rejected_quantity: 0,
        batch_id: null,
      },
    ]);
  });

  it("returns the created GRN (via findWithItems) on success", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockGrnRepo.receiveGoodsRpc.mockResolvedValue({ data: "grn-99", error: null });
    mockGrnRepo.findWithItems.mockResolvedValue({
      ...fullReceipt(),
      id: "grn-99",
    });

    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("grn-99");
    }
    expect(mockGrnRepo.findWithItems).toHaveBeenCalledWith("grn-99");
  });

  it("includes a rejected-only line in the JSON items array", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());

    await service.createGoodsReceipt(
      {
        purchaseOrderId: "po-1",
        branchId: "wh-1",
        items: [
          { purchaseOrderItemId: "poi-a", productId: "prod-a", receivedQuantity: 0, rejectedQuantity: 3 },
          { purchaseOrderItemId: "poi-b", productId: "prod-b", receivedQuantity: 10, rejectedQuantity: 0 },
        ],
      },
      "org-1",
      "user-1"
    );

    const items = mockGrnRepo.receiveGoodsRpc.mock.calls[0][0]
      .p_items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      purchase_order_item_id: "poi-a",
      received_quantity: 0,
      rejected_quantity: 3,
    });
  });

  // ── RPC error mapping ──────────────────────────────────────

  it("maps a not_found RPC error to not_found", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockGrnRepo.receiveGoodsRpc.mockResolvedValue({
      data: null,
      error: { message: 'purchase order not_found: po-1' },
    });
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("maps an invalid_status RPC error to invalid_status", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockGrnRepo.receiveGoodsRpc.mockResolvedValue({
      data: null,
      error: { message: 'invalid_status: cancelled' },
    });
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
  });

  it("maps an insufficient_stock RPC error to insufficient_stock", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockGrnRepo.receiveGoodsRpc.mockResolvedValue({
      data: null,
      error: { message: 'insufficient_stock for product prod-a' },
    });
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("insufficient_stock");
    }
  });

  it("maps a negative_stock RPC error to insufficient_stock", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockGrnRepo.receiveGoodsRpc.mockResolvedValue({
      data: null,
      error: { message: 'negative_stock would result' },
    });
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("insufficient_stock");
    }
  });

  it("maps an unrecognized RPC error to unknown", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockGrnRepo.receiveGoodsRpc.mockResolvedValue({
      data: null,
      error: { message: "deadlock detected" },
    });
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("returns unknown when the RPC returns no id", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockGrnRepo.receiveGoodsRpc.mockResolvedValue({ data: null, error: null });
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  // ── Pre-RPC validation (does not reach the RPC) ────────────

  it("rejects when the PO is in draft (not receivable)", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo({ status: "draft" }));
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(mockGrnRepo.receiveGoodsRpc).not.toHaveBeenCalled();
  });

  it("rejects when the PO is cancelled", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo({ status: "cancelled" }));
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(mockGrnRepo.receiveGoodsRpc).not.toHaveBeenCalled();
  });

  it("returns not_found when the PO does not exist", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(null);
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockGrnRepo.receiveGoodsRpc).not.toHaveBeenCalled();
  });

  it("returns not_found when the PO belongs to another organization", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo({ organizationId: "other" }));
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("rejects when a received line does not belong to the PO", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    const result = await service.createGoodsReceipt(
      {
        purchaseOrderId: "po-1",
        branchId: "wh-1",
        items: [
          { purchaseOrderItemId: "ghost", productId: "prod-x", receivedQuantity: 5 },
        ],
      },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockGrnRepo.receiveGoodsRpc).not.toHaveBeenCalled();
  });

  it("rejects when no line records a received or rejected quantity", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    const result = await service.createGoodsReceipt(
      {
        purchaseOrderId: "po-1",
        branchId: "wh-1",
        items: [
          { purchaseOrderItemId: "poi-a", productId: "prod-a", receivedQuantity: 0, rejectedQuantity: 0 },
        ],
      },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockGrnRepo.receiveGoodsRpc).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("GoodsReceiptService reads", () => {
  it("getGoodsReceipt returns the receipt when found", async () => {
    mockGrnRepo.findWithItems.mockResolvedValue(fullReceipt());
    const result = await service.getGoodsReceipt("grn-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("grn-1");
    }
  });

  it("getGoodsReceipt returns not_found when missing", async () => {
    mockGrnRepo.findWithItems.mockResolvedValue(null);
    const result = await service.getGoodsReceipt("grn-x");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("listGoodsReceipts delegates to the repository", async () => {
    const listResult = { items: [], total: 0, page: 1, pageSize: 20 };
    mockGrnRepo.list.mockResolvedValue(listResult);
    const result = await service.listGoodsReceipts("org-1", { search: "g" });
    expect(result).toBe(listResult);
    expect(mockGrnRepo.list).toHaveBeenCalledWith("org-1", { search: "g" });
  });

  it("getGoodsReceiptStats delegates to the repository", async () => {
    const stats = { total: 12, thisMonth: 3, completed: 9, draft: 2 };
    mockGrnRepo.getStats.mockResolvedValue(stats);
    const result = await service.getGoodsReceiptStats("org-1");
    expect(result).toBe(stats);
    expect(mockGrnRepo.getStats).toHaveBeenCalledWith("org-1");
  });

  it("listReceiptsForPurchaseOrder delegates to the repository", async () => {
    const receipts = [{ id: "grn-1" }];
    mockGrnRepo.findByPurchaseOrder.mockResolvedValue(receipts);
    const result = await service.listReceiptsForPurchaseOrder("po-1");
    expect(result).toBe(receipts);
    expect(mockGrnRepo.findByPurchaseOrder).toHaveBeenCalledWith("po-1");
  });
});
