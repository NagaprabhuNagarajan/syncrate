import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CreatePurchaseInvoiceInput,
  PurchaseInvoice,
  PurchaseInvoiceWithItems,
} from "@/features/purchase/types/purchase-invoice.types";
import { PurchaseInvoiceService } from "./purchase-invoice.service";

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
    setPosted: vi.fn(),
    softDelete: vi.fn(),
    getLastLedgerBalance: vi.fn(),
    insertLedgerEntry: vi.fn(),
  },
}));

vi.mock("@/features/purchase/repositories/purchase-invoice.repository", () => ({
  PurchaseInvoiceRepository: vi.fn(() => mockRepo),
}));

function buildInvoice(
  overrides: Partial<PurchaseInvoice> = {}
): PurchaseInvoice {
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

function withItems(invoice: PurchaseInvoice): PurchaseInvoiceWithItems {
  return { ...invoice, items: [] };
}

const MULTI_ITEM_INPUT: CreatePurchaseInvoiceInput = {
  supplierId: "sup-1",
  items: [
    { productId: "p-a", quantity: 10, unitPrice: 100, taxRate: 18 },
    { productId: "p-b", quantity: 5, unitPrice: 50, taxRate: 5 },
  ],
};

let service: PurchaseInvoiceService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new PurchaseInvoiceService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// createPurchaseInvoice — totals math + numbering
// ─────────────────────────────────────────────────────────────

describe("PurchaseInvoiceService.createPurchaseInvoice", () => {
  it("computes per-item and header totals (no per-line discount)", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 2, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(buildInvoice({ id: "pinv-9" }));
    mockRepo.insertItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildInvoice({ id: "pinv-9" }))
    );

    const result = await service.createPurchaseInvoice(
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

    await service.createPurchaseInvoice(
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

    await service.createPurchaseInvoice(
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

    const result = await service.createPurchaseInvoice(
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

    const result = await service.createPurchaseInvoice(
      MULTI_ITEM_INPUT,
      "org-1",
      "u"
    );
    expect(result.success).toBe(false);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("pinv-9", "u");
  });
});

// ─────────────────────────────────────────────────────────────
// updatePurchaseInvoice — draft only
// ─────────────────────────────────────────────────────────────

describe("PurchaseInvoiceService.updatePurchaseInvoice", () => {
  it("recomputes totals and replaces items for a draft", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue(buildInvoice());
    mockRepo.replaceItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildInvoice()));

    const result = await service.updatePurchaseInvoice(
      "pinv-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    const patch = mockRepo.updateHeader.mock.calls[0][1] as Record<
      string,
      number
    >;
    expect(patch.subtotal).toBe(1250);
    expect(patch.total_amount).toBe(1442.5);
    expect(mockRepo.replaceItems).toHaveBeenCalled();
  });

  it("returns not_found when the invoice does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.updatePurchaseInvoice(
      "pinv-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "u"
    );
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("returns not_found when the invoice belongs to another org", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ organizationId: "org-1" }));
    const result = await service.updatePurchaseInvoice(
      "pinv-1",
      MULTI_ITEM_INPUT,
      "org-2",
      "u"
    );
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("rejects editing a posted invoice (immutable)", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "posted" }));
    const result = await service.updatePurchaseInvoice(
      "pinv-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "u"
    );
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(mockRepo.updateHeader).not.toHaveBeenCalled();
  });

  it("fails when the header update fails", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue(null);
    const result = await service.updatePurchaseInvoice(
      "pinv-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "u"
    );
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("fails when replacing items fails", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue(buildInvoice());
    mockRepo.replaceItems.mockResolvedValue(false);
    const result = await service.updatePurchaseInvoice(
      "pinv-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "u"
    );
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// postPurchaseInvoice — writes the supplier ledger (CREDIT)
// ─────────────────────────────────────────────────────────────

describe("PurchaseInvoiceService.postPurchaseInvoice", () => {
  it("posts a draft and CREDITS the supplier ledger with running_balance = last + total", async () => {
    mockRepo.findById.mockResolvedValue(
      buildInvoice({ status: "draft", supplierId: "sup-1" })
    );
    mockRepo.setPosted.mockResolvedValue(
      buildInvoice({
        status: "posted",
        totalAmount: 1180,
        invoiceNumber: "PINV-00001",
        invoiceDate: new Date("2026-06-01"),
      })
    );
    mockRepo.getLastLedgerBalance.mockResolvedValue(5000);
    mockRepo.insertLedgerEntry.mockResolvedValue(true);

    const result = await service.postPurchaseInvoice("pinv-1", "org-1", "user-1");

    expect(result.success).toBe(true);
    expect(mockRepo.setPosted).toHaveBeenCalledWith("pinv-1", "user-1");
    expect(mockRepo.getLastLedgerBalance).toHaveBeenCalledWith("sup-1");

    const entry = mockRepo.insertLedgerEntry.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(entry.organization_id).toBe("org-1");
    expect(entry.supplier_id).toBe("sup-1");
    expect(entry.reference_type).toBe("purchase_invoice");
    expect(entry.reference_id).toBe("pinv-1");
    // A purchase invoice INCREASES the payable → CREDIT the supplier.
    expect(entry.debit).toBe(0);
    expect(entry.credit).toBe(1180);
    expect(entry.running_balance).toBe(6180); // 5000 + 1180
    expect(entry.entry_date).toBe("2026-06-01");
    expect(entry.created_by).toBe("user-1");
  });

  it("starts the running balance from 0 when the supplier has no history", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.setPosted.mockResolvedValue(
      buildInvoice({ status: "posted", totalAmount: 500 })
    );
    mockRepo.getLastLedgerBalance.mockResolvedValue(0);
    mockRepo.insertLedgerEntry.mockResolvedValue(true);

    await service.postPurchaseInvoice("pinv-1", "org-1", "user-1");

    const entry = mockRepo.insertLedgerEntry.mock.calls[0][0] as Record<
      string,
      number
    >;
    expect(entry.credit).toBe(500);
    expect(entry.running_balance).toBe(500);
  });

  it("returns not_found when the invoice is missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.postPurchaseInvoice("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.setPosted).not.toHaveBeenCalled();
  });

  it("rejects posting a non-draft invoice", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "posted" }));
    const result = await service.postPurchaseInvoice("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(mockRepo.setPosted).not.toHaveBeenCalled();
  });

  it("fails when posting the header fails (no ledger written)", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.setPosted.mockResolvedValue(null);
    const result = await service.postPurchaseInvoice("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(mockRepo.insertLedgerEntry).not.toHaveBeenCalled();
  });

  it("fails when the ledger write fails", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.setPosted.mockResolvedValue(
      buildInvoice({ status: "posted", totalAmount: 100 })
    );
    mockRepo.getLastLedgerBalance.mockResolvedValue(0);
    mockRepo.insertLedgerEntry.mockResolvedValue(false);
    const result = await service.postPurchaseInvoice("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// cancelPurchaseInvoice — draft only
// ─────────────────────────────────────────────────────────────

describe("PurchaseInvoiceService.cancelPurchaseInvoice", () => {
  it("cancels a draft invoice", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.updateStatus.mockResolvedValue(buildInvoice({ status: "cancelled" }));
    const result = await service.cancelPurchaseInvoice(
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
    const result = await service.cancelPurchaseInvoice("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("returns not_found for a missing/other-org invoice", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.cancelPurchaseInvoice("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("fails when the status update fails", async () => {
    mockRepo.findById.mockResolvedValue(buildInvoice({ status: "draft" }));
    mockRepo.updateStatus.mockResolvedValue(null);
    const result = await service.cancelPurchaseInvoice("pinv-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("PurchaseInvoiceService reads", () => {
  it("getPurchaseInvoice returns the invoice with items", async () => {
    mockRepo.findWithItems.mockResolvedValue(withItems(buildInvoice()));
    const result = await service.getPurchaseInvoice("pinv-1");
    expect(result.success).toBe(true);
  });

  it("getPurchaseInvoice returns not_found when missing", async () => {
    mockRepo.findWithItems.mockResolvedValue(null);
    const result = await service.getPurchaseInvoice("pinv-1");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("listPurchaseInvoices delegates to the repository", async () => {
    const listResult = { items: [], total: 0, page: 1, pageSize: 20 };
    mockRepo.list.mockResolvedValue(listResult);
    const result = await service.listPurchaseInvoices("org-1", {
      status: "draft",
    });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { status: "draft" });
  });
});
