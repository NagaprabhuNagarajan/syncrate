import { describe, it, expect, vi } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { fetchPurchaseReturnOptions } from "./purchase-return-options";

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

describe("fetchPurchaseReturnOptions", () => {
  it("maps suppliers, warehouses and products (coercing numeric columns)", async () => {
    const { client, fromMock } = createClient({
      suppliers: { data: [{ id: "s1", name: "Supplier One" }] },
      warehouses: { data: [{ id: "w1", name: "Main Warehouse" }] },
      products: {
        data: [
          {
            id: "p1",
            name: "Widget",
            purchase_price: "9.99",
            gst_rate: "12",
          },
        ],
      },
    });

    const options = await fetchPurchaseReturnOptions(client, "org-1");

    expect(options.suppliers).toEqual([{ id: "s1", name: "Supplier One" }]);
    expect(options.warehouses).toEqual([{ id: "w1", name: "Main Warehouse" }]);
    expect(options.products).toEqual([
      { id: "p1", name: "Widget", purchasePrice: 9.99, gstRate: 12 },
    ]);
    expect(fromMock).toHaveBeenCalledWith("suppliers");
    expect(fromMock).toHaveBeenCalledWith("warehouses");
    expect(fromMock).toHaveBeenCalledWith("products");
  });

  it("returns empty arrays when queries yield no data", async () => {
    const { client } = createClient({
      suppliers: { data: [] },
      warehouses: { data: [] },
      products: { data: [] },
    });

    const options = await fetchPurchaseReturnOptions(client, "org-1");

    expect(options).toEqual({ suppliers: [], warehouses: [], products: [] });
  });

  it("falls back to empty arrays when a query returns null data (error path)", async () => {
    const { client } = createClient({
      suppliers: { data: null },
      warehouses: { data: null },
      products: { data: null },
    });

    const options = await fetchPurchaseReturnOptions(client, "org-1");

    expect(options).toEqual({ suppliers: [], warehouses: [], products: [] });
  });
});
