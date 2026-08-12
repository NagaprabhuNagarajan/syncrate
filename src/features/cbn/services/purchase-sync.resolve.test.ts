import { describe, expect, it, vi, beforeEach } from "vitest";
import { PurchaseSyncService } from "./purchase-sync.service";
import type { AppSupabaseClient } from "@/lib/supabase/types";

const { mockListLines, mockFindLinks, mockFindById, mockFindByField } =
  vi.hoisted(() => ({
    mockListLines: vi.fn(),
    mockFindLinks: vi.fn(),
    mockFindById: vi.fn(),
    mockFindByField: vi.fn(),
  }));

vi.mock("@/features/cbn/repositories/invoice-line.repository", () => ({
  InvoiceLineRepository: vi.fn(() => ({ listByCbnInvoice: mockListLines })),
}));

vi.mock("@/features/cbn/repositories/product-link.repository", () => ({
  ProductLinkRepository: vi.fn(() => ({ findForConnection: mockFindLinks })),
}));

vi.mock("@/features/product/repositories/product.repository", () => ({
  ProductRepository: vi.fn(() => ({
    findById: mockFindById,
    findByField: mockFindByField,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFindLinks.mockResolvedValue(new Map());
  mockFindById.mockResolvedValue(null);
  mockFindByField.mockResolvedValue(null);
});

const supabase = {} as unknown as AppSupabaseClient;

const LINE = {
  id: "po-line-1",
  cbnInvoiceId: "cbn-po-1",
  sortOrder: 0,
  supplierProductId: "buyer-prod-1",
  productName: "Coke 500ml",
  productSku: null,
  productBarcode: "8901234567890",
  hsnCode: "2202",
  description: "Coke 500ml",
  quantity: 2,
  unitPrice: 300,
  gstRate: 0,
  taxAmount: 0,
  lineTotal: 600,
};

describe("PurchaseSyncService.resolveIncomingLines", () => {
  it("reads the purchase-order payload table, not the invoice one", async () => {
    mockListLines.mockResolvedValue([LINE]);

    await new PurchaseSyncService(supabase).resolveIncomingLines(
      "cbn-po-1",
      "supplier-org",
      "conn-1"
    );

    expect(mockListLines).toHaveBeenCalledWith("cbn-po-1", "purchase_order");
  });

  it("matches an incoming PO line against the supplier's own catalog", async () => {
    mockListLines.mockResolvedValue([LINE]);
    mockFindByField.mockResolvedValue({ id: "supplier-prod-9", name: "Coke" });

    const result = await new PurchaseSyncService(supabase).resolveIncomingLines(
      "cbn-po-1",
      "supplier-org",
      "conn-1"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0]?.productId).toBe("supplier-prod-9");
      expect(result.data[0]?.matchedBy).toBe("barcode");
    }
    // The receiving org is the supplier here — the direction is inverted
    // relative to the invoice path, and the lookup must follow it.
    expect(mockFindByField).toHaveBeenCalledWith(
      "supplier-org",
      "barcode",
      "8901234567890"
    );
  });

  it("reports a failed read rather than pretending the order is empty", async () => {
    mockListLines.mockResolvedValue(null);

    const result = await new PurchaseSyncService(supabase).resolveIncomingLines(
      "cbn-po-1",
      "supplier-org",
      "conn-1"
    );

    expect(result.success).toBe(false);
  });
});
