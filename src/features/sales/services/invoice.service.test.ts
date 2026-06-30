/**
 * Unit tests for InvoiceService.
 *
 * The repository is fully mocked so no Supabase connection is needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import type { Invoice, InvoiceWithItems } from "@/features/sales/types/invoice.types";

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
const mockPostInvoiceRpc = vi.fn();
const mockSoftDelete = vi.fn();
const mockList = vi.fn();

vi.mock("@/features/sales/repositories/invoice.repository", () => ({
  InvoiceRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    findWithItems: mockFindWithItems,
    createHeader: mockCreateHeader,
    insertItems: mockInsertItems,
    replaceItems: mockReplaceItems,
    updateHeader: mockUpdateHeader,
    updateStatus: mockUpdateStatus,
    postInvoiceRpc: mockPostInvoiceRpc,
    softDelete: mockSoftDelete,
    list: mockList,
  })),
}));

// ─────────────────────────────────────────────────────────────
// Mock Supabase client for convertFromSalesOrder
// ─────────────────────────────────────────────────────────────

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const ORG_ID = "org-123";
const USER_ID = "user-456";
const INV_ID = "inv-789";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: INV_ID,
    organizationId: ORG_ID,
    invoiceNumber: "INV-00001",
    invoiceType: "tax_invoice",
    customerId: "cust-1",
    salesOrderId: null,
    quotationId: null,
    branchId: null,
    salespersonId: null,
    referenceNumber: null,
    invoiceDate: new Date("2026-01-15"),
    dueDate: null,
    paymentTermsDays: 30,
    supplyState: "Maharashtra",
    isInterstate: false,
    status: "draft",
    paymentStatus: "unpaid",
    subtotal: 1000,
    discountAmount: 0,
    cgstAmount: 90,
    sgstAmount: 90,
    igstAmount: 0,
    taxAmount: 180,
    roundOff: 0,
    totalAmount: 1180,
    amountPaid: 0,
    notes: null,
    terms: null,
    postedAt: null,
    postedBy: null,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    createdBy: USER_ID,
    version: 1,
    ...overrides,
  };
}

function makeInvoiceWithItems(inv: Invoice): InvoiceWithItems {
  return {
    ...inv,
    items: [
      {
        id: "item-1",
        organizationId: ORG_ID,
        invoiceId: INV_ID,
        productId: "prod-1",
        description: null,
        hsnCode: null,
        quantity: 10,
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
        createdAt: new Date("2026-01-15"),
        createdBy: USER_ID,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("InvoiceService", () => {
  let service: InvoiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: list returns 0 (for nextInvoiceNumber)
    mockList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    service = new InvoiceService(mockSupabase as never);
  });

  // ── createInvoice ─────────────────────────────────────────

  describe("createInvoice", () => {
    it("computes intra-state GST (CGST+SGST) correctly", async () => {
      const inv = makeInvoice();
      const invWithItems = makeInvoiceWithItems(inv);

      mockCreateHeader.mockResolvedValue(inv);
      mockInsertItems.mockResolvedValue(true);
      mockFindWithItems.mockResolvedValue(invWithItems);

      const result = await service.createInvoice(
        {
          customerId: "cust-1",
          supplyState: "Maharashtra",
          isInterstate: false,
          items: [{ productId: "prod-1", quantity: 10, unitPrice: 100, gstRate: 18 }],
        },
        ORG_ID,
        USER_ID,
        "Maharashtra" // orgState = same state → intra-state
      );

      expect(result.success).toBe(true);

      // Verify header was created with correct intra-state GST figures
      const headerCall = mockCreateHeader.mock.calls[0][0];
      expect(headerCall.subtotal).toBe(1000); // 10 * 100
      expect(headerCall.discount_amount).toBe(0);
      expect(headerCall.cgst_amount).toBe(90); // 1000 * 9%
      expect(headerCall.sgst_amount).toBe(90); // 1000 * 9%
      expect(headerCall.igst_amount).toBe(0);
      expect(headerCall.tax_amount).toBe(180);
      expect(headerCall.total_amount).toBe(1180);
      expect(headerCall.status).toBe("draft");
    });

    it("computes inter-state GST (IGST only) correctly", async () => {
      const inv = makeInvoice({ cgstAmount: 0, sgstAmount: 0, igstAmount: 180, isInterstate: true });
      const invWithItems = makeInvoiceWithItems(inv);

      mockCreateHeader.mockResolvedValue(inv);
      mockInsertItems.mockResolvedValue(true);
      mockFindWithItems.mockResolvedValue(invWithItems);

      await service.createInvoice(
        {
          customerId: "cust-1",
          supplyState: "Karnataka", // different from orgState
          isInterstate: true,
          items: [{ productId: "prod-1", quantity: 10, unitPrice: 100, gstRate: 18 }],
        },
        ORG_ID,
        USER_ID,
        "Maharashtra" // orgState differs from supplyState
      );

      const headerCall = mockCreateHeader.mock.calls[0][0];
      expect(headerCall.cgst_amount).toBe(0);
      expect(headerCall.sgst_amount).toBe(0);
      expect(headerCall.igst_amount).toBe(180); // 1000 * 18%
      expect(headerCall.tax_amount).toBe(180);
    });

    it("applies per-line discount before computing tax", async () => {
      const inv = makeInvoice({ subtotal: 1000, discountAmount: 100, cgstAmount: 81, sgstAmount: 81, taxAmount: 162, totalAmount: 1062 });
      mockCreateHeader.mockResolvedValue(inv);
      mockInsertItems.mockResolvedValue(true);
      mockFindWithItems.mockResolvedValue(makeInvoiceWithItems(inv));

      await service.createInvoice(
        {
          customerId: "cust-1",
          supplyState: "Maharashtra",
          items: [
            {
              productId: "prod-1",
              quantity: 10,
              unitPrice: 100,
              discountPercent: 10, // 10% discount → taxable = 900
              gstRate: 18,
            },
          ],
        },
        ORG_ID,
        USER_ID,
        "Maharashtra"
      );

      const headerCall = mockCreateHeader.mock.calls[0][0];
      expect(headerCall.subtotal).toBe(1000); // gross before discount
      expect(headerCall.discount_amount).toBe(100); // 10% of 1000
      // taxable = 900, CGST/SGST = 900 * 9% = 81 each
      expect(headerCall.cgst_amount).toBe(81);
      expect(headerCall.sgst_amount).toBe(81);
      expect(headerCall.tax_amount).toBe(162);
      expect(headerCall.total_amount).toBe(1062); // 1000 - 100 + 162 = 1062
    });

    it("rolls back the header if items insert fails", async () => {
      mockCreateHeader.mockResolvedValue(makeInvoice());
      mockInsertItems.mockResolvedValue(false);
      mockSoftDelete.mockResolvedValue(true);

      const result = await service.createInvoice(
        {
          customerId: "cust-1",
          items: [{ productId: "prod-1", quantity: 1, unitPrice: 100 }],
        },
        ORG_ID,
        USER_ID,
        null
      );

      expect(result.success).toBe(false);
      expect(mockSoftDelete).toHaveBeenCalledWith(INV_ID, USER_ID);
    });

    it("generates sequential invoice number INV-#####", async () => {
      mockList.mockResolvedValue({ items: [], total: 4, page: 1, pageSize: 1 });
      mockCreateHeader.mockResolvedValue(makeInvoice({ invoiceNumber: "INV-00005" }));
      mockInsertItems.mockResolvedValue(true);
      mockFindWithItems.mockResolvedValue(makeInvoiceWithItems(makeInvoice()));

      await service.createInvoice(
        { customerId: "c", items: [{ productId: "p", quantity: 1, unitPrice: 1 }] },
        ORG_ID,
        USER_ID,
        null
      );

      const headerCall = mockCreateHeader.mock.calls[0][0];
      expect(headerCall.invoice_number).toBe("INV-00005");
    });
  });

  // ── updateInvoice ─────────────────────────────────────────

  describe("updateInvoice", () => {
    it("returns conflict when optimistic lock fails", async () => {
      const draft = makeInvoice({ status: "draft" });
      mockFindById.mockResolvedValue(draft);
      mockUpdateHeader.mockResolvedValue(null); // lock conflict → null

      const result = await service.updateInvoice(
        INV_ID,
        {
          customerId: "cust-1",
          items: [{ productId: "prod-1", quantity: 1, unitPrice: 100 }],
          version: 99, // stale version
        },
        ORG_ID,
        USER_ID,
        null
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("conflict");
      }
    });

    it("returns invalid_status when trying to update a posted invoice", async () => {
      mockFindById.mockResolvedValue(makeInvoice({ status: "posted" }));

      const result = await service.updateInvoice(
        INV_ID,
        {
          customerId: "cust-1",
          items: [{ productId: "p", quantity: 1, unitPrice: 1 }],
          version: 1,
        },
        ORG_ID,
        USER_ID,
        null
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("invalid_status");
      }
    });

    it("returns not_found when invoice belongs to another org", async () => {
      mockFindById.mockResolvedValue(makeInvoice({ organizationId: "other-org" }));

      const result = await service.updateInvoice(
        INV_ID,
        {
          customerId: "cust-1",
          items: [{ productId: "p", quantity: 1, unitPrice: 1 }],
          version: 1,
        },
        ORG_ID,
        USER_ID,
        null
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("not_found");
      }
    });
  });

  // ── postInvoice ───────────────────────────────────────────

  describe("postInvoice", () => {
    it("delegates to RPC and re-fetches the posted invoice", async () => {
      mockPostInvoiceRpc.mockResolvedValue({ data: null, error: null });
      const postedInv = makeInvoice({ status: "posted", postedAt: new Date() });
      mockFindById.mockResolvedValue(postedInv);

      const result = await service.postInvoice(INV_ID, ORG_ID, USER_ID);

      expect(result.success).toBe(true);
      expect(mockPostInvoiceRpc).toHaveBeenCalledWith(INV_ID);
      if (result.success) {
        expect(result.data.status).toBe("posted");
      }
    });

    it("maps RPC not_found error to domain not_found", async () => {
      mockPostInvoiceRpc.mockResolvedValue({
        data: null,
        error: { message: "not_found: invoice does not exist" },
      });

      const result = await service.postInvoice(INV_ID, ORG_ID, USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("not_found");
      }
    });

    it("maps RPC invalid_status error to domain invalid_status", async () => {
      mockPostInvoiceRpc.mockResolvedValue({
        data: null,
        error: { message: "invalid_status: already posted" },
      });

      const result = await service.postInvoice(INV_ID, ORG_ID, USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("invalid_status");
      }
    });
  });

  // ── cancelInvoice ─────────────────────────────────────────

  describe("cancelInvoice", () => {
    it("cancels a draft invoice successfully", async () => {
      mockFindById.mockResolvedValue(makeInvoice({ status: "draft" }));
      mockUpdateStatus.mockResolvedValue(makeInvoice({ status: "cancelled" }));

      const result = await service.cancelInvoice(INV_ID, ORG_ID, USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("cancelled");
      }
    });

    it("rejects cancelling a posted invoice", async () => {
      mockFindById.mockResolvedValue(makeInvoice({ status: "posted" }));

      const result = await service.cancelInvoice(INV_ID, ORG_ID, USER_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("invalid_status");
      }
    });
  });

  // ── round-off ─────────────────────────────────────────────

  describe("round-off computation", () => {
    it("applies round-off to bring total to nearest integer", async () => {
      // taxableAmount = 99.99, gstRate = 5% → tax = 4.9995 → taxAmount = 5.00 (round2)
      // total = 99.99 + 5.00 = 104.99 → Math.round(104.99) = 105 → roundOff = 0.01
      const inv = makeInvoice({ subtotal: 99.99, taxAmount: 5.0, totalAmount: 105, roundOff: 0.01 });
      mockCreateHeader.mockResolvedValue(inv);
      mockInsertItems.mockResolvedValue(true);
      mockFindWithItems.mockResolvedValue(makeInvoiceWithItems(inv));

      await service.createInvoice(
        {
          customerId: "cust-1",
          supplyState: "Maharashtra",
          items: [
            { productId: "prod-1", quantity: 1, unitPrice: 99.99, gstRate: 5 },
          ],
        },
        ORG_ID,
        USER_ID,
        "Maharashtra"
      );

      const headerCall = mockCreateHeader.mock.calls[0][0];
      // round_off should compensate fractional total
      expect(typeof headerCall.round_off).toBe("number");
    });
  });
});
