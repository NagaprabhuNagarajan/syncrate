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

const { mockGrnRepo, mockPoRepo, mockInventoryRepo } = vi.hoisted(() => ({
  mockGrnRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    findItems: vi.fn(),
    findWithItems: vi.fn(),
    createHeader: vi.fn(),
    insertItems: vi.fn(),
    bumpPoItemReceived: vi.fn(),
    setPoStatus: vi.fn(),
  },
  mockPoRepo: {
    findWithItems: vi.fn(),
    findItems: vi.fn(),
  },
  mockInventoryRepo: {
    adjustStockRpc: vi.fn(),
  },
}));

vi.mock("@/features/purchase/repositories/goods-receipt.repository", () => ({
  GoodsReceiptRepository: vi.fn(() => mockGrnRepo),
}));
vi.mock("@/features/purchase/repositories/purchase-order.repository", () => ({
  PurchaseOrderRepository: vi.fn(() => mockPoRepo),
}));
vi.mock("@/features/inventory/repositories/inventory.repository", () => ({
  InventoryRepository: vi.fn(() => mockInventoryRepo),
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
    warehouseId: "wh-1",
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
    warehouseId: "wh-1",
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
  warehouseId: "wh-1",
  items: [
    { purchaseOrderItemId: "poi-a", productId: "prod-a", receivedQuantity: 4, rejectedQuantity: 0 },
    { purchaseOrderItemId: "poi-b", productId: "prod-b", receivedQuantity: 10, rejectedQuantity: 0 },
  ],
};

const FULL_INPUT: CreateGoodsReceiptInput = {
  purchaseOrderId: "po-1",
  warehouseId: "wh-1",
  items: [
    { purchaseOrderItemId: "poi-a", productId: "prod-a", receivedQuantity: 10, rejectedQuantity: 0 },
    { purchaseOrderItemId: "poi-b", productId: "prod-b", receivedQuantity: 10, rejectedQuantity: 0 },
  ],
};

let service: GoodsReceiptService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new GoodsReceiptService({} as unknown as AppSupabaseClient);
  // Defaults that the happy path relies on.
  mockGrnRepo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
  mockGrnRepo.createHeader.mockResolvedValue(buildReceipt());
  mockGrnRepo.insertItems.mockResolvedValue(true);
  mockGrnRepo.findWithItems.mockResolvedValue(fullReceipt());
  mockGrnRepo.bumpPoItemReceived.mockResolvedValue(true);
  mockGrnRepo.setPoStatus.mockResolvedValue(true);
  mockInventoryRepo.adjustStockRpc.mockResolvedValue({ data: 1, error: null });
});

// ─────────────────────────────────────────────────────────────
// createGoodsReceipt — inventory integration
// ─────────────────────────────────────────────────────────────

describe("GoodsReceiptService.createGoodsReceipt", () => {
  it("writes a purchase inventory event per received line with the correct positive quantity", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockPoRepo.findItems.mockResolvedValue([
      buildPoItem({ id: "poi-a", quantity: 10, receivedQuantity: 4 }),
      buildPoItem({ id: "poi-b", quantity: 10, receivedQuantity: 10 }),
    ]);

    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");

    expect(result.success).toBe(true);
    expect(mockInventoryRepo.adjustStockRpc).toHaveBeenCalledTimes(2);
    expect(mockInventoryRepo.adjustStockRpc).toHaveBeenNthCalledWith(1, {
      p_organization_id: "org-1",
      p_product_id: "prod-a",
      p_warehouse_id: "wh-1",
      p_quantity: 4,
      p_type: "purchase",
      p_reference_type: "goods_receipt",
      p_reference_id: "grn-1",
      p_batch_id: null,
    });
    expect(mockInventoryRepo.adjustStockRpc).toHaveBeenNthCalledWith(2, {
      p_organization_id: "org-1",
      p_product_id: "prod-b",
      p_warehouse_id: "wh-1",
      p_quantity: 10,
      p_type: "purchase",
      p_reference_type: "goods_receipt",
      p_reference_id: "grn-1",
      p_batch_id: null,
    });
  });

  it("bumps each received PO line by the received quantity", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockPoRepo.findItems.mockResolvedValue([
      buildPoItem({ id: "poi-a", quantity: 10, receivedQuantity: 4 }),
      buildPoItem({ id: "poi-b", quantity: 10, receivedQuantity: 10 }),
    ]);

    await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");

    expect(mockGrnRepo.bumpPoItemReceived).toHaveBeenCalledWith("poi-a", 4);
    expect(mockGrnRepo.bumpPoItemReceived).toHaveBeenCalledWith("poi-b", 10);
  });

  it("advances the PO to partially_received when not every line is fully received", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockPoRepo.findItems.mockResolvedValue([
      buildPoItem({ id: "poi-a", quantity: 10, receivedQuantity: 4 }),
      buildPoItem({ id: "poi-b", quantity: 10, receivedQuantity: 10 }),
    ]);

    await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");

    expect(mockGrnRepo.setPoStatus).toHaveBeenCalledWith(
      "po-1",
      "partially_received",
      "user-1"
    );
  });

  it("advances the PO to completed when every line is fully received", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockPoRepo.findItems.mockResolvedValue([
      buildPoItem({ id: "poi-a", quantity: 10, receivedQuantity: 10 }),
      buildPoItem({ id: "poi-b", quantity: 10, receivedQuantity: 10 }),
    ]);

    await service.createGoodsReceipt(FULL_INPUT, "org-1", "user-1");

    expect(mockGrnRepo.setPoStatus).toHaveBeenCalledWith(
      "po-1",
      "completed",
      "user-1"
    );
  });

  it("does not change PO status when the computed status is unchanged", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo({ status: "partially_received" }));
    mockPoRepo.findItems.mockResolvedValue([
      buildPoItem({ id: "poi-a", quantity: 10, receivedQuantity: 4 }),
      buildPoItem({ id: "poi-b", quantity: 10, receivedQuantity: 10 }),
    ]);

    await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");

    expect(mockGrnRepo.setPoStatus).not.toHaveBeenCalled();
  });

  it("rejects when the PO is in draft (not receivable)", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo({ status: "draft" }));

    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(mockInventoryRepo.adjustStockRpc).not.toHaveBeenCalled();
    expect(mockGrnRepo.createHeader).not.toHaveBeenCalled();
  });

  it("rejects when the PO is cancelled", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo({ status: "cancelled" }));
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
  });

  it("returns not_found when the PO does not exist", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(null);
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
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
        warehouseId: "wh-1",
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
    expect(mockGrnRepo.createHeader).not.toHaveBeenCalled();
  });

  it("records a rejected-only line without a stock event or PO bump", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockPoRepo.findItems.mockResolvedValue([
      buildPoItem({ id: "poi-a", quantity: 10, receivedQuantity: 0 }),
      buildPoItem({ id: "poi-b", quantity: 10, receivedQuantity: 10 }),
    ]);

    await service.createGoodsReceipt(
      {
        purchaseOrderId: "po-1",
        warehouseId: "wh-1",
        items: [
          { purchaseOrderItemId: "poi-a", productId: "prod-a", receivedQuantity: 0, rejectedQuantity: 3 },
          { purchaseOrderItemId: "poi-b", productId: "prod-b", receivedQuantity: 10, rejectedQuantity: 0 },
        ],
      },
      "org-1",
      "user-1"
    );

    // Only the received line triggers a stock event + bump.
    expect(mockInventoryRepo.adjustStockRpc).toHaveBeenCalledTimes(1);
    expect(mockInventoryRepo.adjustStockRpc).toHaveBeenCalledWith(
      expect.objectContaining({ p_product_id: "prod-b", p_quantity: 10 })
    );
    expect(mockGrnRepo.bumpPoItemReceived).toHaveBeenCalledTimes(1);
    expect(mockGrnRepo.bumpPoItemReceived).toHaveBeenCalledWith("poi-b", 10);
  });

  it("persists ordered_quantity, received and rejected on each GRN line", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockPoRepo.findItems.mockResolvedValue(buildPo().items);

    await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");

    const rows = mockGrnRepo.insertItems.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(rows[0]).toMatchObject({
      purchase_order_item_id: "poi-a",
      product_id: "prod-a",
      ordered_quantity: 10,
      received_quantity: 4,
      rejected_quantity: 0,
    });
  });

  it("generates a sequential GRN number from the existing total", async () => {
    mockGrnRepo.list.mockResolvedValue({ items: [], total: 7, page: 1, pageSize: 1 });
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockPoRepo.findItems.mockResolvedValue(buildPo().items);

    await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");

    const header = mockGrnRepo.createHeader.mock.calls[0][0] as Record<string, unknown>;
    expect(header.grn_number).toBe("GRN-00008");
    expect(header.status).toBe("completed");
  });

  it("returns unknown when header creation fails", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockGrnRepo.createHeader.mockResolvedValue(null);
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(mockInventoryRepo.adjustStockRpc).not.toHaveBeenCalled();
  });

  it("returns unknown when item insertion fails", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockGrnRepo.insertItems.mockResolvedValue(false);
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(mockInventoryRepo.adjustStockRpc).not.toHaveBeenCalled();
  });

  it("returns unknown when the inventory RPC fails", async () => {
    mockPoRepo.findWithItems.mockResolvedValue(buildPo());
    mockInventoryRepo.adjustStockRpc.mockResolvedValue({
      data: null,
      error: { message: "negative_stock" },
    });
    const result = await service.createGoodsReceipt(PARTIAL_INPUT, "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
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
});
