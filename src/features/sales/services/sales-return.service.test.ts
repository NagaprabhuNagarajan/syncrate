/**
 * Unit tests for SalesReturnService.
 *
 * The repository is fully mocked so no Supabase connection is needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SalesReturnService } from "@/features/sales/services/sales-return.service";
import type {
  SalesReturn,
  SalesReturnWithItems,
} from "@/features/sales/types/sales-return.types";

// ─────────────────────────────────────────────────────────────
// Mock repository setup
// ─────────────────────────────────────────────────────────────

const mockFindById = vi.fn();
const mockFindWithItems = vi.fn();
const mockCreateHeader = vi.fn();
const mockInsertItems = vi.fn();
const mockReplaceItems = vi.fn();
const mockUpdateHeader = vi.fn();
const mockUpdateStatus = vi.fn();
const mockCompleteReturnRpc = vi.fn();
const mockSoftDelete = vi.fn();
const mockList = vi.fn();

vi.mock("@/features/sales/repositories/sales-return.repository", () => ({
  SalesReturnRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    findWithItems: mockFindWithItems,
    createHeader: mockCreateHeader,
    insertItems: mockInsertItems,
    replaceItems: mockReplaceItems,
    updateHeader: mockUpdateHeader,
    updateStatus: mockUpdateStatus,
    completeReturnRpc: mockCompleteReturnRpc,
    softDelete: mockSoftDelete,
    list: mockList,
  })),
}));

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const ORG_ID = "org-111";
const USER_ID = "user-222";
const RETURN_ID = "ret-333";

function makeReturn(overrides: Partial<SalesReturn> = {}): SalesReturn {
  return {
    id: RETURN_ID,
    organizationId: ORG_ID,
    returnNumber: "SR-00001",
    invoiceId: null,
    customerId: "cust-1",
    warehouseId: "wh-1",
    status: "draft",
    returnDate: new Date("2026-01-20"),
    reason: "damaged",
    subtotal: 500,
    taxAmount: 45,
    totalAmount: 545,
    notes: null,
    createdAt: new Date("2026-01-20"),
    updatedAt: new Date("2026-01-20"),
    createdBy: USER_ID,
    version: 1,
    ...overrides,
  };
}

function makeReturnWithItems(ret: SalesReturn): SalesReturnWithItems {
  return {
    ...ret,
    items: [
      {
        id: "item-1",
        organizationId: ORG_ID,
        salesReturnId: RETURN_ID,
        productId: "prod-1",
        quantity: 5,
        unitPrice: 100,
        taxRate: 9,
        taxAmount: 45,
        lineTotal: 545,
        batchId: null,
        createdAt: new Date("2026-01-20"),
        createdBy: USER_ID,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SalesReturnService", () => {
  let service: SalesReturnService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    service = new SalesReturnService({} as never);
  });

  // ── createSalesReturn ──────────────────────────────────────

  describe("createSalesReturn", () => {
    it("creates a draft sales return with correct totals", async () => {
      const ret = makeReturn();
      const retWithItems = makeReturnWithItems(ret);

      mockCreateHeader.mockResolvedValue(ret);
      mockInsertItems.mockResolvedValue(true);
      mockFindWithItems.mockResolvedValue(retWithItems);

      const result = await service.createSalesReturn(
        {
          customerId: "cust-1",
          warehouseId: "wh-1",
          reason: "damaged",
          items: [{ productId: "prod-1", quantity: 5, unitPrice: 100, taxRate: 9 }],
        },
        ORG_ID,
        USER_ID
      );

      expect(result.success).toBe(true);

      const headerCall = mockCreateHeader.mock.calls[0][0];
      expect(headerCall.subtotal).toBe(500); // 5 * 100
      expect(headerCall.tax_amount).toBe(45); // 500 * 9%
      expect(headerCall.total_amount).toBe(545);
      expect(headerCall.status).toBe("draft");
    });

    it("generates sequential return number SR-#####", async () => {
      mockList.mockResolvedValue({ items: [], total: 2, page: 1, pageSize: 1 });
      mockCreateHeader.mockResolvedValue(makeReturn({ returnNumber: "SR-00003" }));
      mockInsertItems.mockResolvedValue(true);
      mockFindWithItems.mockResolvedValue(makeReturnWithItems(makeReturn()));

      await service.createSalesReturn(
        {
          customerId: "cust-1",
          reason: "wrong_product",
          items: [{ productId: "p", quantity: 1, unitPrice: 10 }],
        },
        ORG_ID,
        USER_ID
      );

      const headerCall = mockCreateHeader.mock.calls[0][0];
      expect(headerCall.return_number).toBe("SR-00003");
    });

    it("uses provided returnNumber instead of auto-generating", async () => {
      mockCreateHeader.mockResolvedValue(makeReturn({ returnNumber: "SR-CUSTOM" }));
      mockInsertItems.mockResolvedValue(true);
      mockFindWithItems.mockResolvedValue(makeReturnWithItems(makeReturn()));

      await service.createSalesReturn(
        {
          returnNumber: "SR-CUSTOM",
          customerId: "cust-1",
          reason: "expired",
          items: [{ productId: "p", quantity: 1, unitPrice: 10 }],
        },
        ORG_ID,
        USER_ID
      );

      const headerCall = mockCreateHeader.mock.calls[0][0];
      expect(headerCall.return_number).toBe("SR-CUSTOM");
    });

    it("rolls back the header if items insert fails", async () => {
      mockCreateHeader.mockResolvedValue(makeReturn());
      mockInsertItems.mockResolvedValue(false);
      mockSoftDelete.mockResolvedValue(true);

      const result = await service.createSalesReturn(
        {
          customerId: "cust-1",
          reason: "damaged",
          items: [{ productId: "p", quantity: 1, unitPrice: 10 }],
        },
        ORG_ID,
        USER_ID
      );

      expect(result.success).toBe(false);
      expect(mockSoftDelete).toHaveBeenCalledWith(RETURN_ID, USER_ID);
    });
  });

  // ── updateSalesReturn ──────────────────────────────────────

  describe("updateSalesReturn", () => {
    it("returns conflict when optimistic lock fails", async () => {
      mockFindById.mockResolvedValue(makeReturn({ status: "draft" }));
      mockUpdateHeader.mockResolvedValue(null); // lock conflict

      const result = await service.updateSalesReturn(
        RETURN_ID,
        {
          customerId: "cust-1",
          reason: "damaged",
          items: [{ productId: "p", quantity: 1, unitPrice: 10 }],
        },
        ORG_ID,
        USER_ID,
        99 // stale version
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("conflict");
      }
    });

    it("returns invalid_status for non-draft returns", async () => {
      mockFindById.mockResolvedValue(makeReturn({ status: "completed" }));

      const result = await service.updateSalesReturn(
        RETURN_ID,
        {
          customerId: "cust-1",
          reason: "damaged",
          items: [{ productId: "p", quantity: 1, unitPrice: 10 }],
        },
        ORG_ID,
        USER_ID,
        1
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("invalid_status");
      }
    });
  });

  // ── completeSalesReturn ────────────────────────────────────

  describe("completeSalesReturn", () => {
    it("delegates to RPC and re-fetches the completed return", async () => {
      mockCompleteReturnRpc.mockResolvedValue({ data: null, error: null });
      const completed = makeReturn({ status: "completed" });
      mockFindById.mockResolvedValue(completed);

      const result = await service.completeSalesReturn(RETURN_ID, ORG_ID, USER_ID);

      expect(result.success).toBe(true);
      expect(mockCompleteReturnRpc).toHaveBeenCalledWith(RETURN_ID);
      if (result.success) {
        expect(result.data.status).toBe("completed");
      }
    });

    it("maps RPC insufficient_stock error to domain code", async () => {
      mockCompleteReturnRpc.mockResolvedValue({
        data: null,
        error: { message: "insufficient_stock: product prod-1" },
      });

      const result = await service.completeSalesReturn(RETURN_ID, ORG_ID, USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("insufficient_stock");
      }
    });

    it("maps RPC invalid_status error to domain code", async () => {
      mockCompleteReturnRpc.mockResolvedValue({
        data: null,
        error: { message: "invalid_status: return is already completed" },
      });

      const result = await service.completeSalesReturn(RETURN_ID, ORG_ID, USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("invalid_status");
      }
    });
  });

  // ── cancelSalesReturn ──────────────────────────────────────

  describe("cancelSalesReturn", () => {
    it("cancels a draft return", async () => {
      mockFindById.mockResolvedValue(makeReturn({ status: "draft" }));
      mockUpdateStatus.mockResolvedValue(makeReturn({ status: "cancelled" }));

      const result = await service.cancelSalesReturn(RETURN_ID, ORG_ID, USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("cancelled");
      }
    });

    it("rejects cancelling a completed return", async () => {
      mockFindById.mockResolvedValue(makeReturn({ status: "completed" }));

      const result = await service.cancelSalesReturn(RETURN_ID, ORG_ID, USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("invalid_status");
      }
    });

    it("returns not_found when return belongs to another org", async () => {
      mockFindById.mockResolvedValue(makeReturn({ organizationId: "other-org" }));

      const result = await service.cancelSalesReturn(RETURN_ID, ORG_ID, USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("not_found");
      }
    });
  });

  // ── listSalesReturns ───────────────────────────────────────

  describe("listSalesReturns", () => {
    it("delegates to repository list", async () => {
      const listResult = { items: [], total: 0, page: 1, pageSize: 20 };
      mockList.mockResolvedValue(listResult);

      const result = await service.listSalesReturns(ORG_ID, { status: "draft" });

      expect(mockList).toHaveBeenCalledWith(ORG_ID, { status: "draft" });
      expect(result).toEqual(listResult);
    });
  });

  // ── getSalesReturn ─────────────────────────────────────────

  describe("getSalesReturn", () => {
    it("returns not_found when return does not exist", async () => {
      mockFindWithItems.mockResolvedValue(null);

      const result = await service.getSalesReturn("nonexistent-id");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("not_found");
      }
    });

    it("returns the return with items on success", async () => {
      const ret = makeReturn();
      const retWithItems = makeReturnWithItems(ret);
      mockFindWithItems.mockResolvedValue(retWithItems);

      const result = await service.getSalesReturn(RETURN_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(1);
      }
    });
  });
});
