import { describe, it, expect, vi } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { fetchPurchaseInvoiceOptions } from "./purchase-invoice-options";

interface BuilderResult {
  data: Array<Record<string, unknown>> | null;
}

function createClient(byTable: Record<string, BuilderResult>): {
  client: AppSupabaseClient;
  fromMock: ReturnType<typeof vi.fn>;
} {
  const fromMock = vi.fn((table: string) => {
    const result = byTable[table] ?? { data: [] };
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => Promise.resolve(result)),
    };
    return builder;
  });
  return {
    client: { from: fromMock } as unknown as AppSupabaseClient,
    fromMock,
  };
}

describe("fetchPurchaseInvoiceOptions", () => {
  it("maps suppliers and products (coercing numeric columns) into options", async () => {
    const { client, fromMock } = createClient({
      suppliers: { data: [{ id: "s1", name: "Supplier One" }] },
      products: {
        data: [
          {
            id: "p1",
            name: "Widget",
            purchase_price: "12.50",
            gst_rate: "18",
          },
        ],
      },
    });

    const options = await fetchPurchaseInvoiceOptions(client, "org-1");

    expect(options.suppliers).toEqual([{ id: "s1", name: "Supplier One" }]);
    expect(options.products).toEqual([
      { id: "p1", name: "Widget", purchasePrice: 12.5, gstRate: 18 },
    ]);
    expect(fromMock).toHaveBeenCalledWith("suppliers");
    expect(fromMock).toHaveBeenCalledWith("products");
  });

  it("returns empty arrays when queries yield no data", async () => {
    const { client } = createClient({
      suppliers: { data: [] },
      products: { data: [] },
    });

    const options = await fetchPurchaseInvoiceOptions(client, "org-1");

    expect(options).toEqual({ suppliers: [], products: [] });
  });

  it("falls back to empty arrays when a query returns null data (error path)", async () => {
    const { client } = createClient({
      suppliers: { data: null },
      products: { data: null },
    });

    const options = await fetchPurchaseInvoiceOptions(client, "org-1");

    expect(options).toEqual({ suppliers: [], products: [] });
  });
});
