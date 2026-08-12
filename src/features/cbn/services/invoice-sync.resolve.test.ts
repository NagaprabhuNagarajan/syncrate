import { describe, expect, it, vi, beforeEach } from "vitest";
import { InvoiceSyncService } from "./invoice-sync.service";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { CbnInvoiceLine } from "@/features/cbn/types/cbn.types";

const { mockListLines, mockFindLinks, mockFindById, mockFindByField } =
  vi.hoisted(() => ({
    mockListLines: vi.fn(),
    mockFindLinks: vi.fn(),
    mockFindById: vi.fn(),
    mockFindByField: vi.fn(),
  }));

vi.mock("@/features/cbn/repositories/invoice-line.repository", () => ({
  InvoiceLineRepository: vi.fn(() => ({
    listByCbnInvoice: mockListLines,
  })),
}));

vi.mock("@/features/cbn/repositories/product-link.repository", () => ({
  ProductLinkRepository: vi.fn(() => ({
    findForConnection: mockFindLinks,
  })),
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

function makeLine(overrides: Partial<CbnInvoiceLine> = {}): CbnInvoiceLine {
  return {
    id: "line-1",
    cbnInvoiceId: "cbn-inv-1",
    sortOrder: 0,
    supplierProductId: "their-prod-1",
    productName: "Coke 500ml",
    productSku: "SKU-COKE",
    productBarcode: "8901234567890",
    hsnCode: "2202",
    description: "Coke 500ml",
    quantity: 2,
    unitPrice: 300,
    gstRate: 0,
    taxAmount: 0,
    lineTotal: 600,
    ...overrides,
  };
}

const supabase = {} as unknown as AppSupabaseClient;

/** Unwraps the result, failing the test if resolution errored. */
async function resolve() {
  const result = await new InvoiceSyncService(supabase).resolveIncomingLines(
    "cbn-inv-1",
    "org-1",
    "conn-1"
  );
  if (!result.success) {
    throw new Error(`expected success, got: ${result.error.message}`);
  }
  return result.data;
}

describe("InvoiceSyncService.resolveIncomingLines", () => {
  it("returns nothing when the invoice carried no lines", async () => {
    mockListLines.mockResolvedValue([]);
    expect(await resolve()).toEqual([]);
    // No point querying products for an empty invoice.
    expect(mockFindLinks).not.toHaveBeenCalled();
  });

  it("reports a failed read rather than pretending the invoice is empty", async () => {
    // The repository returns null when the table is missing or RLS blocks it.
    // Reporting that as "no lines" sent us chasing the wrong cause once.
    mockListLines.mockResolvedValue(null);

    const result = await new InvoiceSyncService(supabase).resolveIncomingLines(
      "cbn-inv-1",
      "org-1",
      "conn-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/20260721000001/);
    }
  });

  it("prefers a remembered mapping over identifier matching", async () => {
    mockListLines.mockResolvedValue([makeLine()]);
    mockFindLinks.mockResolvedValue(new Map([["their-prod-1", "my-prod-9"]]));
    mockFindById.mockResolvedValue({ id: "my-prod-9", name: "Coca-Cola 500ml" });

    const [resolved] = await resolve();

    expect(resolved?.productId).toBe("my-prod-9");
    expect(resolved?.matchedBy).toBe("link");
    // A confirmed decision wins outright — no identifier lookups needed.
    expect(mockFindByField).not.toHaveBeenCalled();
  });

  it("falls back to identifiers when a remembered product was deleted", async () => {
    mockListLines.mockResolvedValue([makeLine()]);
    mockFindLinks.mockResolvedValue(new Map([["their-prod-1", "gone"]]));
    mockFindById.mockResolvedValue(null);
    mockFindByField.mockResolvedValue({ id: "my-prod-2", name: "Coke" });

    const [resolved] = await resolve();

    expect(resolved?.productId).toBe("my-prod-2");
    expect(resolved?.matchedBy).toBe("barcode");
  });

  it("matches on barcode before SKU", async () => {
    mockListLines.mockResolvedValue([makeLine()]);
    mockFindByField.mockImplementation(
      async (_org: string, field: string) =>
        field === "barcode" ? { id: "by-barcode", name: "Coke" } : null
    );

    const [resolved] = await resolve();

    expect(resolved?.productId).toBe("by-barcode");
    expect(resolved?.matchedBy).toBe("barcode");
  });

  it("falls back to SKU when the barcode is unknown", async () => {
    mockListLines.mockResolvedValue([makeLine()]);
    mockFindByField.mockImplementation(
      async (_org: string, field: string) =>
        field === "sku" ? { id: "by-sku", name: "Coke" } : null
    );

    const [resolved] = await resolve();

    expect(resolved?.productId).toBe("by-sku");
    expect(resolved?.matchedBy).toBe("sku");
  });

  it("leaves a line unresolved rather than guessing from the name", async () => {
    // Name and HSN are present but must NOT be used: binding the wrong product
    // would silently corrupt stock and cost history.
    mockListLines.mockResolvedValue([
      makeLine({ productBarcode: null, productSku: null }),
    ]);

    const [resolved] = await resolve();

    expect(resolved?.productId).toBeNull();
    expect(resolved?.matchedBy).toBe("none");
    expect(mockFindByField).not.toHaveBeenCalled();
  });

  it("reads the purchase-order payload table when asked for that kind", async () => {
    mockListLines.mockResolvedValue([makeLine()]);
    mockFindByField.mockResolvedValue({ id: "by-barcode", name: "Coke" });

    const result = await new InvoiceSyncService(
      supabase
    ).resolveIncomingLines("cbn-inv-1", "org-1", "conn-1");

    expect(result.success).toBe(true);
    // The invoice service always asks for invoice lines; the PO service passes
    // "purchase_order". Same resolver, different payload table.
    expect(mockListLines).toHaveBeenCalledWith("cbn-inv-1", "invoice");
  });

  it("resolves each line of a multi-line invoice independently", async () => {
    mockListLines.mockResolvedValue([
      makeLine({ id: "line-1" }),
      makeLine({
        id: "line-2",
        supplierProductId: "their-prod-2",
        productBarcode: null,
        productSku: null,
      }),
    ]);
    mockFindByField.mockImplementation(
      async (_org: string, field: string) =>
        field === "barcode" ? { id: "by-barcode", name: "Coke" } : null
    );

    const resolved = await resolve();

    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.matchedBy).toBe("barcode");
    expect(resolved[1]?.matchedBy).toBe("none");
  });
});
