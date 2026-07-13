import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CreateBillInput,
  Bill,
  BillWithItems,
} from "@/features/purchase/types/bill.types";
import { BillService } from "./bill.service";

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    getStats: vi.fn(),
    findByPurchaseOrder: vi.fn(),
    findById: vi.fn(),
    findByNumber: vi.fn(),
    findItems: vi.fn(),
    findWithItems: vi.fn(),
    createHeader: vi.fn(),
    insertItems: vi.fn(),
    replaceItems: vi.fn(),
    updateHeader: vi.fn(),
    updateStatus: vi.fn(),
    postInvoiceRpc: vi.fn(),
    softDelete: vi.fn(),
    listOutstandingBySupplier: vi.fn(),
  },
}));

vi.mock("@/features/purchase/repositories/bill.repository", () => ({
  BillRepository: vi.fn(() => mockRepo),
}));

function buildInvoice(
  overrides: Partial<Bill> = {}
): Bill {
  return {
    id: "pinv-1",
    organizationId: "org-1",
    invoiceNumber: "PINV-00001",
    supplierInvoiceNumber: null,
    purchaseOrderId: null,
    supplierId: "sup-1",
    status: "draft",
    invoiceDate: new Date("2026-06-01"),
    dueDate: null,
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    amountPaid: 0,
    notes: null,
    postedAt: null,
    postedBy: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    ...overrides,
  };
}

function withItems(invoice: Bill): BillWithItems {
  return { ...invoice, items: [] };
}

const MULTI_ITEM_INPUT: CreateBillInput = {
  supplierId: "sup-1",
  items: [
    { productId: "p-a", quantity: 10, unitPrice: 100, taxRate: 18 },
    { productId: "p-b", quantity: 5, unitPrice: 50, taxRate: 5 },
  ],
};

let service: BillService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new BillService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// createBill — totals math + numbering
// ─────────────────────────────────────────────────────────────

describe("BillService.createBill", () => {
  it("computes per-item and header totals (no per-line discount)", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 2, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(buildInvoice({ id: "pinv-9" }));
    mockRepo.insertItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildInvoice({ id: "pinv-9" }))
    );

    const result = await service.createBill(
      MULTI_ITEM_INPUT,
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);

    const header = mockRepo.createHeader.mock.calls[0][0] as Record<
      string,
      number | string
    >;
    // Item A: net 1000, tax 180, line 1180
    // Item B: net 250, tax 12.5, line 262.5
    expect(header.subtotal).toBe(1250);
    expect(header.discount_amount).toBe(0);
    expect(header.tax_amount).toBe(192.5);
    expect(header.total_amount).toBe(1442.5);
    expect(header.invoice_number).toBe("PINV-00003"); // count 2 + 1
    expect(header.status).toBe("draft");

    const items = mockRepo.insertItems.mock.calls[0][0] as Array<
      Record<string, number>
    >;
    expect(items[0].tax_amount).toBe(180);
    expect(items[0].line_total).toBe(1180);
    expect(items[1].tax_amount).toBe(12.5);
    expect(items[1].line_total).toBe(262.5);
  });

  it("uses a supplied invoice number (uppercased) instead of auto-numbering", async () => {
    mockRepo.createHeader.mockResolvedValue(buildInvoice());
    mockRepo.insertItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildInvoice()));

    await service.createBill(
      { ...MULTI_ITEM_INPUT, invoiceNumber: "  my-bill-1 " },
      "org-1",
      "user-1"
    );

    const header = mockRepo.createHeader.mock.calls[0][0] as Record<
      string,
      string
    >;
    expect(header.invoice_number).toBe("MY-BILL-1");
    expect(mockRepo.list).not.toHaveBeenCalled();
  });

  it("defaults missing tax to zero", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(buildInvoice());
    mockRepo.insertItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildInvoice()));

    await service.createBill(
      { supplierId: "sup-1", items: [{ productId: "p", quantity: 3, unitPrice: 10 }] },
      "org-1",
      "user-1"
    );

    const header = mockRepo.createHeader.mock.calls[0][0] as Record<
      string,
      number
    >;
    expect(header.subtotal).toBe(30);
    expect(header.tax_amount).toBe(0);
    expect(header.total_amount).toBe(30);
  });

  it("fails when the header insert fails", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(null);

    const result = await service.createBill(
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
    mockRepo.createHeader.mockResolvedValue(buildInvoice({ id: "pinv-9" }));
    mockRepo.insertItems.mockResolvedValue(false);

    const result = await service.createBill(
      MULTI_ITEM_INPUT,
      "org-1",
      "u"
    );
    expect(result.success).toBe(false);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("pinv-9", "u");
  });
});

// ─────────────────────────────────────────────────────────────
// updateBill — draft only
// ─────────────────────────────────────────────────────────────

describe("BillService.updateBill", () => {
  it("recomputes totals, forwards the expected version, and replaces items for a draft", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue(buildInvoice());
    mockRepo.replaceItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildInvoice()));

    const result = await service.updateBill(
      "pinv-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "user-1",
      3
    );

    expect(result.success).toBe(true);
    const patch = mockRepo.updateHeader.mock.calls[0][1] as Record<
      string,
      number
    >;
    expect(patch.subtotal).toBe(1250);
    expect(patch.total_amount).toBe(1442.5);
    // The expected version is forwarded to the repo for optimistic locking.
    expect(mockRepo.updateHeader.mock.calls[0][3]).toBe(3);
    expect(mockRepo.replaceItems).toHaveBeenCalled();
  });

  it("returns not_found when the invoice does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.updateBill(
      "pinv-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "u",
      1
    );
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("returns not_found when the invoice belongs to another org", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ organizationId: "org-1" }));
    const result = await service.updateBill(
      "pinv-1",
      MULTI_ITEM_INPUT,
      "org-2",
      "u",
      1
    );
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("rejects editing a posted invoice (immutable)", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "posted" }));
    const result = await service.updateBill(
      "pinv-1",
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
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue(null);
    const result = await service.updateBill(
      "pinv-1",
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

  it("fails when replacing items fails", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue(buildInvoice());
    mockRepo.replaceItems.mockResolvedValue(false);
    const result = await service.updateBill(
      "pinv-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "u",
      1
    );
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// postBill — atomic via post_purchase_invoice RPC
// ─────────────────────────────────────────────────────────────

describe("BillService.postBill", () => {
  it("delegates to the post RPC and re-fetches the posted invoice on success", async () => {
    mockRepo.postInvoiceRpc.mockResolvedValue({ data: null, error: null });
    mockRepo.findById.mockResolvedValue(
      buildInvoice({ status: "posted", totalAmount: 1180 })
    );

    const result = await service.postBill("pinv-1", "org-1", "user-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("posted");
    }
    expect(mockRepo.postInvoiceRpc).toHaveBeenCalledWith("pinv-1");
    expect(mockRepo.findById).toHaveBeenCalledWith("pinv-1");
  });

  it("maps a not_found RPC error to not_found", async () => {
    mockRepo.postInvoiceRpc.mockResolvedValue({
      data: null,
      error: { message: "bill not_found" },
    });
    const result = await service.postBill("pinv-1", "org-1", "u");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it("maps an invalid_status RPC error to invalid_status", async () => {
    mockRepo.postInvoiceRpc.mockResolvedValue({
      data: null,
      error: { message: "invalid_status: not a draft" },
    });
    const result = await service.postBill("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
  });

  it("maps an unrecognized RPC error to unknown", async () => {
    mockRepo.postInvoiceRpc.mockResolvedValue({
      data: null,
      error: { message: "deadlock detected" },
    });
    const result = await service.postBill("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("returns not_found when the re-fetch comes back empty", async () => {
    mockRepo.postInvoiceRpc.mockResolvedValue({ data: null, error: null });
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.postBill("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// cancelBill — draft only
// ─────────────────────────────────────────────────────────────

describe("BillService.cancelBill", () => {
  it("cancels a draft invoice", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.updateStatus.mockResolvedValue(buildInvoice({ status: "cancelled" }));
    const result = await service.cancelBill(
      "pinv-1",
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      "pinv-1",
      "cancelled",
      "user-1"
    );
  });

  it("rejects cancelling a posted invoice (immutable)", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "posted" }));
    const result = await service.cancelBill("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("returns not_found for a missing/other-org invoice", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.cancelBill("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("fails when the status update fails", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.updateStatus.mockResolvedValue(null);
    const result = await service.cancelBill("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("BillService reads", () => {
  it("getBill returns the invoice with items", async () => {
    mockRepo.findWithItems.mockResolvedValue(withItems(buildInvoice()));
    const result = await service.getBill("pinv-1");
    expect(result.success).toBe(true);
  });

  it("getBill returns not_found when missing", async () => {
    mockRepo.findWithItems.mockResolvedValue(null);
    const result = await service.getBill("pinv-1");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("listBills delegates to the repository", async () => {
    const listResult = { items: [], total: 0, page: 1, pageSize: 20 };
    mockRepo.list.mockResolvedValue(listResult);
    const result = await service.listBills("org-1", {
      status: "draft",
    });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { status: "draft" });
  });

  it("getBillStats delegates to the repository", async () => {
    const stats = { totalValue: 100, draft: 1, posted: 2, overdue: 1 };
    mockRepo.getStats.mockResolvedValue(stats);
    const result = await service.getBillStats("org-1");
    expect(result).toBe(stats);
    expect(mockRepo.getStats).toHaveBeenCalledWith("org-1");
  });

  it("listBillsForPurchaseOrder delegates to the repository", async () => {
    const bills = [{ id: "bill-1" }];
    mockRepo.findByPurchaseOrder.mockResolvedValue(bills);
    const result = await service.listBillsForPurchaseOrder("po-1");
    expect(result).toBe(bills);
    expect(mockRepo.findByPurchaseOrder).toHaveBeenCalledWith("po-1");
  });

  it("listOutstandingBillsForSupplier delegates to the repository", async () => {
    const rows = [
      {
        id: "pinv-1",
        invoiceNumber: "PINV-001",
        invoiceDate: "2026-06-01",
        totalAmount: 1000,
        amountPaid: 200,
        outstandingAmount: 800,
      },
    ];
    mockRepo.listOutstandingBySupplier.mockResolvedValue(rows);
    const result = await service.listOutstandingBillsForSupplier(
      "org-1",
      "sup-1"
    );
    expect(result).toBe(rows);
    expect(mockRepo.listOutstandingBySupplier).toHaveBeenCalledWith(
      "org-1",
      "sup-1"
    );
  });
});
