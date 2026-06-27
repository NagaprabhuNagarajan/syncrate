import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CreateQuotationInput,
  Quotation,
  QuotationWithItems,
  UpdateQuotationInput,
} from "@/features/sales/types/quotation.types";
import { QuotationService } from "./quotation.service";

// ─────────────────────────────────────────────────────────────
// Mock repository
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    findWithItems: vi.fn(),
    findItems: vi.fn(),
    createHeader: vi.fn(),
    insertItems: vi.fn(),
    replaceItems: vi.fn(),
    updateHeader: vi.fn(),
    updateStatus: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/features/sales/repositories/quotation.repository", () => ({
  QuotationRepository: vi.fn(() => mockRepo),
}));

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function buildQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: "qt-1",
    organizationId: "org-1",
    quotationNumber: "QT-00001",
    customerId: "cust-1",
    branchId: null,
    salespersonId: null,
    referenceNumber: null,
    quotationDate: new Date("2026-06-01"),
    expiryDate: null,
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
    convertedSoId: null,
    convertedInvId: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version: 1,
    ...overrides,
  };
}

function buildWithItems(
  overrides: Partial<Quotation> = {}
): QuotationWithItems {
  return { ...buildQuotation(overrides), items: [] };
}

const VALID_CREATE_INPUT: CreateQuotationInput = {
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

describe("QuotationService", () => {
  let service: QuotationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QuotationService(supabaseMock);
  });

  // ── listQuotations ─────────────────────────────────────────

  describe("listQuotations", () => {
    it("delegates to repo.list with the given orgId and params", async () => {
      const mockResult = { items: [], total: 0, page: 1, pageSize: 20 };
      mockRepo.list.mockResolvedValueOnce(mockResult);

      const result = await service.listQuotations("org-1", { page: 2 });
      expect(mockRepo.list).toHaveBeenCalledWith("org-1", { page: 2 });
      expect(result).toBe(mockResult);
    });
  });

  // ── getQuotation ───────────────────────────────────────────

  describe("getQuotation", () => {
    it("returns not_found when quotation does not exist", async () => {
      mockRepo.findWithItems.mockResolvedValueOnce(null);
      const result = await service.getQuotation("nonexistent");
      expect(result).toMatchObject({ success: false, error: { code: "not_found" } });
    });

    it("returns the quotation on success", async () => {
      const qt = buildWithItems();
      mockRepo.findWithItems.mockResolvedValueOnce(qt);
      const result = await service.getQuotation("qt-1");
      expect(result).toMatchObject({ success: true, data: qt });
    });
  });

  // ── createQuotation ────────────────────────────────────────

  describe("createQuotation", () => {
    it("creates quotation with correct GST computation for intra-state", async () => {
      mockRepo.list.mockResolvedValueOnce({ total: 0 });
      const header = buildQuotation();
      mockRepo.createHeader.mockResolvedValueOnce(header);
      mockRepo.insertItems.mockResolvedValueOnce(true);
      mockRepo.findWithItems.mockResolvedValueOnce(buildWithItems());

      const result = await service.createQuotation(
        VALID_CREATE_INPUT,
        "org-1",
        "user-1",
        "Maharashtra" // org state same as supply state → intra
      );

      expect(result.success).toBe(true);
      const callArgs = mockRepo.createHeader.mock.calls[0][0];
      // intra-state 18% on 1000 → CGST 90, SGST 90
      expect(callArgs.cgst_amount).toBe(90);
      expect(callArgs.sgst_amount).toBe(90);
      expect(callArgs.igst_amount).toBe(0);
      expect(callArgs.is_interstate).toBe(false);
    });

    it("creates quotation with IGST for inter-state supply", async () => {
      mockRepo.list.mockResolvedValueOnce({ total: 5 });
      const header = buildQuotation({ isInterstate: true, igstAmount: 180, cgstAmount: 0, sgstAmount: 0 });
      mockRepo.createHeader.mockResolvedValueOnce(header);
      mockRepo.insertItems.mockResolvedValueOnce(true);
      mockRepo.findWithItems.mockResolvedValueOnce(buildWithItems());

      const result = await service.createQuotation(
        { ...VALID_CREATE_INPUT, supplyState: "Karnataka" },
        "org-1",
        "user-1",
        "Maharashtra" // org state differs → inter-state
      );

      expect(result.success).toBe(true);
      const callArgs = mockRepo.createHeader.mock.calls[0][0];
      expect(callArgs.igst_amount).toBe(180);
      expect(callArgs.cgst_amount).toBe(0);
      expect(callArgs.is_interstate).toBe(true);
    });

    it("generates sequential quotation number QT-00006 when total is 5", async () => {
      mockRepo.list.mockResolvedValueOnce({ total: 5 });
      mockRepo.createHeader.mockResolvedValueOnce(buildQuotation());
      mockRepo.insertItems.mockResolvedValueOnce(true);
      mockRepo.findWithItems.mockResolvedValueOnce(buildWithItems());

      await service.createQuotation(VALID_CREATE_INPUT, "org-1", "user-1");
      expect(mockRepo.createHeader.mock.calls[0][0].quotation_number).toBe("QT-00006");
    });

    it("rolls back orphaned header when insertItems fails", async () => {
      mockRepo.list.mockResolvedValueOnce({ total: 0 });
      mockRepo.createHeader.mockResolvedValueOnce(buildQuotation());
      mockRepo.insertItems.mockResolvedValueOnce(false);
      mockRepo.softDelete.mockResolvedValueOnce(true);

      const result = await service.createQuotation(
        VALID_CREATE_INPUT,
        "org-1",
        "user-1"
      );
      expect(result).toMatchObject({ success: false, error: { code: "unknown" } });
      expect(mockRepo.softDelete).toHaveBeenCalledWith("qt-1", "user-1");
    });

    it("fails with unknown when createHeader returns null", async () => {
      mockRepo.list.mockResolvedValueOnce({ total: 0 });
      mockRepo.createHeader.mockResolvedValueOnce(null);

      const result = await service.createQuotation(
        VALID_CREATE_INPUT,
        "org-1",
        "user-1"
      );
      expect(result).toMatchObject({ success: false, error: { code: "unknown" } });
    });
  });

  // ── updateQuotation ────────────────────────────────────────

  describe("updateQuotation", () => {
    const UPDATE_INPUT: UpdateQuotationInput = {
      ...VALID_CREATE_INPUT,
      version: 1,
    };

    it("returns not_found when quotation does not exist", async () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      const result = await service.updateQuotation(
        "qt-x",
        UPDATE_INPUT,
        "org-1",
        "user-1"
      );
      expect(result).toMatchObject({ success: false, error: { code: "not_found" } });
    });

    it("returns not_found when org does not match", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ organizationId: "org-2" }));
      const result = await service.updateQuotation(
        "qt-1",
        UPDATE_INPUT,
        "org-1",
        "user-1"
      );
      expect(result).toMatchObject({ success: false, error: { code: "not_found" } });
    });

    it("returns invalid_status when quotation is not draft", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "sent" }));
      const result = await service.updateQuotation(
        "qt-1",
        UPDATE_INPUT,
        "org-1",
        "user-1"
      );
      expect(result).toMatchObject({ success: false, error: { code: "invalid_status" } });
    });

    it("returns conflict when optimistic lock fails", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation());
      mockRepo.updateHeader.mockResolvedValueOnce({ status: "conflict" });

      const result = await service.updateQuotation(
        "qt-1",
        UPDATE_INPUT,
        "org-1",
        "user-1"
      );
      expect(result).toMatchObject({ success: false, error: { code: "conflict" } });
    });

    it("succeeds and replaces items for a valid draft quotation", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation());
      const updatedHeader = buildQuotation({ subtotal: 2000 });
      mockRepo.updateHeader.mockResolvedValueOnce({
        status: "ok",
        quotation: updatedHeader,
      });
      mockRepo.replaceItems.mockResolvedValueOnce(true);
      mockRepo.findWithItems.mockResolvedValueOnce(buildWithItems({ subtotal: 2000 }));

      const result = await service.updateQuotation(
        "qt-1",
        { ...UPDATE_INPUT, items: [{ productId: "prod-2", quantity: 20, unitPrice: 100 }] },
        "org-1",
        "user-1"
      );
      expect(result.success).toBe(true);
    });
  });

  // ── Status transitions ─────────────────────────────────────

  describe("submitQuotation", () => {
    it("transitions draft → sent", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "draft" }));
      mockRepo.updateStatus.mockResolvedValueOnce(buildQuotation({ status: "sent" }));

      const result = await service.submitQuotation("qt-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: true });
    });

    it("rejects if already sent", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "sent" }));
      const result = await service.submitQuotation("qt-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: false, error: { code: "invalid_status" } });
    });
  });

  describe("markViewedQuotation", () => {
    it("transitions sent → viewed", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "sent" }));
      mockRepo.updateStatus.mockResolvedValueOnce(buildQuotation({ status: "viewed" }));

      const result = await service.markViewedQuotation("qt-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: true });
    });

    it("rejects if not sent", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "draft" }));
      const result = await service.markViewedQuotation("qt-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: false, error: { code: "invalid_status" } });
    });
  });

  describe("acceptQuotation", () => {
    it("accepts from sent status", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "sent" }));
      mockRepo.updateStatus.mockResolvedValueOnce(buildQuotation({ status: "accepted" }));

      const result = await service.acceptQuotation("qt-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: true });
    });

    it("accepts from viewed status", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "viewed" }));
      mockRepo.updateStatus.mockResolvedValueOnce(buildQuotation({ status: "accepted" }));

      const result = await service.acceptQuotation("qt-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: true });
    });

    it("rejects from draft status", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "draft" }));
      const result = await service.acceptQuotation("qt-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: false, error: { code: "invalid_status" } });
    });
  });

  describe("rejectQuotation", () => {
    it("rejects from viewed status", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "viewed" }));
      mockRepo.updateStatus.mockResolvedValueOnce(buildQuotation({ status: "rejected" }));

      const result = await service.rejectQuotation("qt-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: true });
    });
  });

  describe("cancelQuotation", () => {
    it("cancels a draft quotation", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "draft" }));
      mockRepo.updateStatus.mockResolvedValueOnce(buildQuotation({ status: "rejected" }));

      const result = await service.cancelQuotation("qt-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: true });
    });

    it("rejects if already sent", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "sent" }));
      const result = await service.cancelQuotation("qt-1", "org-1", "user-1");
      expect(result).toMatchObject({ success: false, error: { code: "invalid_status" } });
    });
  });

  describe("convertToSalesOrder", () => {
    it("marks accepted quotation as converted", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "accepted" }));
      mockRepo.updateStatus.mockResolvedValueOnce(buildQuotation({ status: "converted" }));

      const result = await service.convertToSalesOrder("qt-1", "org-1", "user-1", "so-1");
      expect(result).toMatchObject({ success: true });
      expect(mockRepo.updateStatus).toHaveBeenCalledWith("qt-1", "converted", "user-1", "so-1");
    });

    it("rejects draft quotation from conversion", async () => {
      mockRepo.findById.mockResolvedValueOnce(buildQuotation({ status: "draft" }));
      const result = await service.convertToSalesOrder("qt-1", "org-1", "user-1", "so-1");
      expect(result).toMatchObject({ success: false, error: { code: "invalid_status" } });
    });
  });
});
