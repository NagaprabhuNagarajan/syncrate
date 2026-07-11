import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CreateSalesOrderInput,
  SalesOrder,
  SalesOrderItem,
  SalesOrderWithItems,
  UpdateSalesOrderInput,
} from "@/features/sales/types/sales-order.types";
import { SalesOrderService } from "./sales-order.service";

// ─────────────────────────────────────────────────────────────
// Mock repositories
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    getStats: vi.fn(),
    findById: vi.fn(),
    findWithItems: vi.fn(),
    findItems: vi.fn(),
    createHeader: vi.fn(),
    insertItems: vi.fn(),
    replaceItems: vi.fn(),
    updateHeader: vi.fn(),
    updateStatus: vi.fn(),
    recordItemDeliveries: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/features/sales/repositories/sales-order.repository", () => ({
  SalesOrderRepository: vi.fn(() => mockRepo),
}));

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function buildSalesOrder(overrides: Partial<SalesOrder> = {}): SalesOrder {
  return {
    id: "so-1",
    organizationId: "org-1",
    soNumber: "SO-00001",
    customerId: "cust-1",
    branchId: null,
    salespersonId: null,
    referenceNumber: null,
    orderDate: new Date("2026-06-01"),
    deliveryDate: null,
    paymentTermsDays: 30,
    supplyState: "Maharashtra",
    isInterstate: false,
    status: "draft",
    subtotal: 1000,
    discountAmount: 0,
    cgstAmount: 90,
    sgstAmount: 90,
    igstAmount: 0,
    taxAmount: 180,
    roundOff: 0,
    totalAmount: 1180,
    notes: null,
    terms: null,
    approvedBy: null,
    approvedAt: null,
    convertedInvId: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version: 1,
    ...overrides,
  };
}

function buildWithItems(
  overrides: Partial<SalesOrder> = {}
): SalesOrderWithItems {
  return { ...buildSalesOrder(overrides), items: [] };
}

function buildItem(overrides: Partial<SalesOrderItem> = {}): SalesOrderItem {
  return {
    id: "item-1",
    organizationId: "org-1",
    salesOrderId: "so-1",
    productId: "prod-1",
    description: "Widget",
    hsnCode: null,
    quantity: 10,
    deliveredQty: 0,
    unitPrice: 100,
    discountPercent: 0,
    discountAmount: 0,
    taxableAmount: 1000,
    gstRate: 18,
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 0,
    cgstAmount: 90,
    sgstAmount: 90,
    igstAmount: 0,
    taxAmount: 180,
    lineTotal: 1180,
    sortOrder: 0,
    createdAt: new Date("2026-06-01"),
    createdBy: "user-1",
    ...overrides,
  };
}

function buildFulfilling(
  items: SalesOrderItem[],
  overrides: Partial<SalesOrder> = {}
): SalesOrderWithItems {
  return {
    ...buildSalesOrder({ status: "processing", ...overrides }),
    items,
  };
}

const VALID_CREATE_INPUT: CreateSalesOrderInput = {
  customerId: "cust-1",
  supplyState: "Maharashtra",
  items: [
    {
      productId: "prod-1",
      quantity: 10,
      unitPrice: 100,
      discountPercent: 0,
      gstRate: 18,
    },
  ],
};

const supabaseMock = {} as AppSupabaseClient;

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SalesOrderService", () => {
  let service: SalesOrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SalesOrderService(supabaseMock);
  });

  // ── listSalesOrders ────────────────────────────────────────

  describe("listSalesOrders", () => {
    it("delegates to repo.list", async () => {
      const mockResult = { items: [], total: 0, page: 1, pageSize: 20 };
      mockRepo.list.mockResolvedValueOnce(mockResult);

      const result = await service.listSalesOrders("org-1");
      expect(mockRepo.list).toHaveBeenCalledWith("org-1", undefined);
      expect(result).toBe(mockResult);
    });
  });

  // ── getSalesOrder ──────────────────────────────────────────

  describe("getSalesOrder", () => {
    it("returns not_found when SO does not exist", async () => {
      mockRepo.findWithItems.mockResolvedValueOnce(null);
      const result = await service.getSalesOrder("nonexistent");
      expect(result).toMatchObject({ success: false, error: { code: "not_found" } });
    });

    it("returns the SO on success", async () => {
      const so = buildWithItems();
      mockRepo.findWithItems.mockResolvedValueOnce(so);
      const result = await service.getSalesOrder("so-1");
      expect(result).toMatchObject({ success: true, data: so });
    });
  });

  // ── getSalesOrderStats ─────────────────────────────────────

  describe("getSalesOrderStats", () => {
    it("delegates to repo.getStats", async () => {
      const stats = {
        totalValue: 1180,
        draft: 1,
        awaitingApproval: 0,
        open: 0,
      };
      mockRepo.getStats.mockResolvedValueOnce(stats);

      const result = await service.getSalesOrderStats("org-1");
      expect(mockRepo.getStats).toHaveBeenCalledWith("org-1");
      expect(result).toBe(stats);
    });
  });

  // ── createSalesOrder ───────────────────────────────────────

  describe("createSalesOrder", () => {
    it("creates SO with correct intra-state GST", async () => {
      mockRepo.list.mockResolvedValueOnce({ total: 0 });
      mockRepo.createHeader.mockResolvedValueOnce(buildSalesOrder());
      mockRepo.insertItems.mockResolvedValueOnce(true);
      mockRepo.findWithItems.mockResolvedValueOnce(buildWithItems());

      const result = await service.createSalesOrder(
        VALID_CREATE_INPUT,
        "org-1",
        "user-1",
        "Maharashtra"
      );

      expect(result.success).toBe(true);
      const callArgs = mockRepo.createHeader.mock.calls[0][0];
      expect(callArgs.cgst_amount).toBe(90);
      expect(callArgs.sgst_amount).toBe(90);
      expect(callArgs.igst_amount).toBe(0);
    });

    it("generates sequential SO number SO-00001", async () => {
      mockRepo.list.mockResolvedValueOnce({ total: 0 });
      mockRepo.createHeader.mockResolvedValueOnce(buildSalesOrder());
      mockRepo.insertItems.mockResolvedValueOnce(true);
      mockRepo.findWithItems.mockResolvedValueOnce(buildWithItems());

      await service.createSalesOrder(VALID_CREATE_INPUT, "org-1", "user-1");
      expect(mockRepo.createHeader.mock.calls[0][0].so_number).toBe("SO-00001");
    });

    it("rolls back orphaned header when insertItems fails", async () => {
      mockRepo.list.mockResolvedValueOnce({ total: 0 });
      mockRepo.createHeader.mockResolvedValueOnce(buildSalesOrder());
      mockRepo.insertItems.mockResolvedValueOnce(false);
      mockRepo.softDelete.mockResolvedValueOnce(true);

      const result = await service.createSalesOrder(
        VALID_CREATE_INPUT,
        "org-1",
        "user-1"
      );
      expect(result).toMatchObject({ success: false, error: { code: "unknown" } });
      expect(mockRepo.softDelete).toHaveBeenCalledWith("so-1", "user-1");
    });
  });

  // ── updateSalesOrder ───────────────────────────────────────

  describe("updateSalesOrder", () => {
    const UPDATE_INPUT: UpdateSalesOrderInput = {
      ...VALID_CREATE_INPUT,
      version: 1,
    };

    it("returns not_found when SO does not exist", async () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      const result = await service.updateSalesOrder(
        "so-x",
        UPDATE_INPUT,
        "org-1",
        "user-1"
      );
      expect(result).toMatchObject({ success: false, error: { code: "not_found" } });
    });

    it("returns invalid_status when SO is not draft", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildSalesOrder({ status: "submitted" }));
      const result = await service.updateSalesOrder(
        "so-1",
        UPDATE_INPUT,
        "org-1",
        "user-1"
      );
      expect(result).toMatchObject({ success: false, error: { code: "invalid_status" } });
    });

    it("returns conflict when optimistic lock fails", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildSalesOrder());
      mockRepo.updateHeader.mockResolvedValueOnce({ status: "conflict" });

      const result = await service.updateSalesOrder(
        "so-1",
        UPDATE_INPUT,
        "org-1",
        "user-1"
      );
      expect(result).toMatchObject({ success: false, error: { code: "conflict" } });
    });

    it("succeeds for a valid draft SO", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildSalesOrder());
      mockRepo.updateHeader.mockResolvedValueOnce({
        status: "ok",
        salesOrder: buildSalesOrder({ subtotal: 2000 }),
      });
      mockRepo.replaceItems.mockResolvedValueOnce(true);
      mockRepo.findWithItems.mockResolvedValueOnce(buildWithItems());

      const result = await service.updateSalesOrder(
        "so-1",
        UPDATE_INPUT,
        "org-1",
        "user-1"
      );
      expect(result.success).toBe(true);
    });
  });

  // ── Status transitions ─────────────────────────────────────

  describe("submitSalesOrder", () => {
    it("transitions draft → submitted", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildSalesOrder());
      mockRepo.updateStatus.mockResolvedValueOnce(buildSalesOrder({ status: "submitted" }));

      const result = await service.submitSalesOrder("so-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: true });
    });

    it("rejects if already submitted", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildSalesOrder({ status: "submitted" }));
      const result = await service.submitSalesOrder("so-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: false, error: { code: "invalid_status" } });
    });
  });

  describe("approveSalesOrder", () => {
    it("approves a submitted SO", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildSalesOrder({ status: "submitted" }));
      mockRepo.updateStatus.mockResolvedValueOnce(buildSalesOrder({ status: "approved" }));

      const result = await service.approveSalesOrder("so-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: true });
      expect(mockRepo.updateStatus).toHaveBeenCalledWith("so-1", "approved", "user-1", true);
    });

    it("rejects if not submitted", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildSalesOrder({ status: "draft" }));
      const result = await service.approveSalesOrder("so-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: false, error: { code: "invalid_status" } });
    });
  });

  describe("cancelSalesOrder", () => {
    it("cancels a draft SO", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildSalesOrder({ status: "draft" }));
      mockRepo.updateStatus.mockResolvedValueOnce(buildSalesOrder({ status: "cancelled" }));

      const result = await service.cancelSalesOrder("so-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: true });
    });

    it("cannot cancel a completed SO", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildSalesOrder({ status: "completed" }));
      const result = await service.cancelSalesOrder("so-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: false, error: { code: "invalid_status" } });
    });

    it("cannot cancel an already-cancelled SO", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildSalesOrder({ status: "cancelled" }));
      const result = await service.cancelSalesOrder("so-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: false, error: { code: "invalid_status" } });
    });
  });

  // ── recordDelivery ─────────────────────────────────────────

  describe("recordDelivery", () => {
    it("moves to partially_delivered on a partial delivery", async () => {
      const items = [
        buildItem({ id: "item-1", quantity: 10, deliveredQty: 0 }),
        buildItem({ id: "item-2", quantity: 5, deliveredQty: 0 }),
      ];
      mockRepo.findWithItems
        .mockResolvedValueOnce(buildFulfilling(items))
        .mockResolvedValueOnce(buildFulfilling(items, { status: "partially_delivered" }));
      mockRepo.recordItemDeliveries.mockResolvedValueOnce(true);
      mockRepo.updateStatus.mockResolvedValueOnce(
        buildSalesOrder({ status: "partially_delivered" })
      );

      const result = await service.recordDelivery("org-1", "so-1", "user-1", [
        { itemId: "item-1", deliverQty: 4 },
      ]);

      expect(result.success).toBe(true);
      expect(mockRepo.recordItemDeliveries).toHaveBeenCalledWith(
        "org-1",
        "so-1",
        [{ itemId: "item-1", deliveredQty: 4 }]
      );
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        "so-1",
        "partially_delivered",
        "user-1",
        false
      );
    });

    it("moves to completed when every item is fully delivered", async () => {
      const items = [
        buildItem({ id: "item-1", quantity: 10, deliveredQty: 6 }),
        buildItem({ id: "item-2", quantity: 5, deliveredQty: 5 }),
      ];
      mockRepo.findWithItems
        .mockResolvedValueOnce(buildFulfilling(items))
        .mockResolvedValueOnce(buildFulfilling(items, { status: "completed" }));
      mockRepo.recordItemDeliveries.mockResolvedValueOnce(true);
      mockRepo.updateStatus.mockResolvedValueOnce(
        buildSalesOrder({ status: "completed" })
      );

      const result = await service.recordDelivery("org-1", "so-1", "user-1", [
        { itemId: "item-1", deliverQty: 4 },
      ]);

      expect(result.success).toBe(true);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        "so-1",
        "completed",
        "user-1",
        false
      );
    });

    it("rejects an over-delivery beyond the ordered quantity", async () => {
      const items = [buildItem({ id: "item-1", quantity: 10, deliveredQty: 8 })];
      mockRepo.findWithItems.mockResolvedValueOnce(buildFulfilling(items));

      const result = await service.recordDelivery("org-1", "so-1", "user-1", [
        { itemId: "item-1", deliverQty: 5 },
      ]);

      expect(result).toMatchObject({
        success: false,
        error: { code: "validation" },
      });
      expect(mockRepo.recordItemDeliveries).not.toHaveBeenCalled();
    });

    it("rejects delivery from a non-deliverable status", async () => {
      const items = [buildItem()];
      mockRepo.findWithItems.mockResolvedValueOnce(
        buildFulfilling(items, { status: "submitted" })
      );

      const result = await service.recordDelivery("org-1", "so-1", "user-1", [
        { itemId: "item-1", deliverQty: 1 },
      ]);

      expect(result).toMatchObject({
        success: false,
        error: { code: "invalid_status" },
      });
    });

    it("reports a conflict when the version is stale", async () => {
      const items = [buildItem()];
      mockRepo.findWithItems.mockResolvedValueOnce(
        buildFulfilling(items, { version: 3 })
      );

      const result = await service.recordDelivery(
        "org-1",
        "so-1",
        "user-1",
        [{ itemId: "item-1", deliverQty: 1 }],
        2
      );

      expect(result).toMatchObject({
        success: false,
        error: { code: "conflict" },
      });
    });
  });
});
