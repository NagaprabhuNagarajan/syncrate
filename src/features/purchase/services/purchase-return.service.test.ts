import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CreatePurchaseReturnInput,
  PurchaseReturn,
  PurchaseReturnWithItems,
} from "@/features/purchase/types/purchase-return.types";
import { PurchaseReturnService } from "./purchase-return.service";

const { mockRepo, mockInventoryRepo } = vi.hoisted(() => ({
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
    getLastLedgerBalance: vi.fn(),
    insertLedgerEntry: vi.fn(),
  },
  mockInventoryRepo: {
    adjustStockRpc: vi.fn(),
  },
}));

vi.mock("@/features/purchase/repositories/purchase-return.repository", () => ({
  PurchaseReturnRepository: vi.fn(() => mockRepo),
}));

vi.mock("@/features/inventory/repositories/inventory.repository", () => ({
  InventoryRepository: vi.fn(() => mockInventoryRepo),
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

const TWO_LINES: PurchaseReturnWithItems["items"] = [
  {
    id: "i-1",
    organizationId: "org-1",
    purchaseReturnId: "pret-1",
    productId: "p-a",
    quantity: 4,
    unitPrice: 100,
    taxRate: 18,
    taxAmount: 72,
    lineTotal: 472,
    batchId: "batch-9",
    createdAt: new Date("2026-06-01"),
    createdBy: "user-1",
  },
  {
    id: "i-2",
    organizationId: "org-1",
    purchaseReturnId: "pret-1",
    productId: "p-b",
    quantity: 2,
    unitPrice: 50,
    taxRate: 5,
    taxAmount: 5,
    lineTotal: 105,
    batchId: null,
    createdAt: new Date("2026-06-01"),
    createdBy: "user-1",
  },
];

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
  it("recomputes totals and replaces items for a draft", async () => {
    mockRepo.findById.mockResolvedValue(buildReturn({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue(buildReturn());
    mockRepo.replaceItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildReturn()));

    const result = await service.updatePurchaseReturn(
      "pret-1",
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

  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.updatePurchaseReturn(
      "pret-1",
      MULTI_ITEM_INPUT,
      "org-1",
      "u"
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
      "u"
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
      "u"
    );
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(mockRepo.updateHeader).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// completePurchaseReturn — inventory reversal + ledger debit
// ─────────────────────────────────────────────────────────────

describe("PurchaseReturnService.completePurchaseReturn", () => {
  it("decreases stock per line with NEGATIVE qty and type purchase_return, then debits the ledger", async () => {
    mockRepo.findWithItems.mockResolvedValue(
      withItems(
        buildReturn({ status: "draft", totalAmount: 577, supplierId: "sup-1" }),
        TWO_LINES
      )
    );
    mockInventoryRepo.adjustStockRpc.mockResolvedValue({ data: 1, error: null });
    mockRepo.getLastLedgerBalance.mockResolvedValue(5000);
    mockRepo.insertLedgerEntry.mockResolvedValue(true);
    mockRepo.updateStatus.mockResolvedValue(buildReturn({ status: "completed" }));

    const result = await service.completePurchaseReturn(
      "pret-1",
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);

    // One RPC call per line, each with NEGATIVE quantity.
    expect(mockInventoryRepo.adjustStockRpc).toHaveBeenCalledTimes(2);
    expect(mockInventoryRepo.adjustStockRpc).toHaveBeenNthCalledWith(1, {
      p_organization_id: "org-1",
      p_product_id: "p-a",
      p_warehouse_id: "wh-1",
      p_quantity: -4,
      p_type: "purchase_return",
      p_reference_type: "purchase_return",
      p_reference_id: "pret-1",
      p_batch_id: "batch-9",
    });
    expect(mockInventoryRepo.adjustStockRpc).toHaveBeenNthCalledWith(2, {
      p_organization_id: "org-1",
      p_product_id: "p-b",
      p_warehouse_id: "wh-1",
      p_quantity: -2,
      p_type: "purchase_return",
      p_reference_type: "purchase_return",
      p_reference_id: "pret-1",
      p_batch_id: undefined,
    });

    // Ledger reversal: a return REDUCES the payable → DEBIT the supplier.
    const ledger = mockRepo.insertLedgerEntry.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(ledger.reference_type).toBe("purchase_return");
    expect(ledger.reference_id).toBe("pret-1");
    expect(ledger.debit).toBe(577);
    expect(ledger.credit).toBe(0);
    expect(ledger.running_balance).toBe(5000 - 577); // lastBalance − total
    expect(ledger.supplier_id).toBe("sup-1");

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      "pret-1",
      "completed",
      "user-1"
    );
  });

  it("returns not_found when missing or cross-org", async () => {
    mockRepo.findWithItems.mockResolvedValue(null);
    const result = await service.completePurchaseReturn("pret-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("rejects completing a non-draft return", async () => {
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildReturn({ status: "completed" }), TWO_LINES)
    );
    const result = await service.completePurchaseReturn("pret-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(mockInventoryRepo.adjustStockRpc).not.toHaveBeenCalled();
  });

  it("maps a negative_stock RPC error to insufficient_stock and skips the ledger", async () => {
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildReturn({ status: "draft" }), TWO_LINES)
    );
    mockInventoryRepo.adjustStockRpc.mockResolvedValue({
      data: null,
      error: { message: "negative_stock" },
    });

    const result = await service.completePurchaseReturn("pret-1", "org-1", "u");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("insufficient_stock");
    }
    expect(mockRepo.insertLedgerEntry).not.toHaveBeenCalled();
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("maps an unexpected RPC error to unknown", async () => {
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildReturn({ status: "draft" }), TWO_LINES)
    );
    mockInventoryRepo.adjustStockRpc.mockResolvedValue({
      data: null,
      error: { message: "deadlock detected" },
    });

    const result = await service.completePurchaseReturn("pret-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("fails when the ledger insert fails", async () => {
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildReturn({ status: "draft", totalAmount: 100 }), TWO_LINES)
    );
    mockInventoryRepo.adjustStockRpc.mockResolvedValue({ data: 1, error: null });
    mockRepo.getLastLedgerBalance.mockResolvedValue(0);
    mockRepo.insertLedgerEntry.mockResolvedValue(false);

    const result = await service.completePurchaseReturn("pret-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
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
