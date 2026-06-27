import { describe, it, expect, vi } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { fetchPurchaseRequestOptions } from "./purchase-request-options";

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

describe("fetchPurchaseRequestOptions", () => {
  it("maps warehouses, products and suppliers with numeric coercion", async () => {
    const { client, fromMock } = createClient({
      warehouses: { data: [{ id: "w1", name: "Main WH" }] },
      products: {
        data: [{ id: "p1", name: "Widget", purchase_price: "100" }],
      },
      suppliers: { data: [{ id: "s1", name: "Acme Supply" }] },
    });

    const options = await fetchPurchaseRequestOptions(client, "org-1");

    expect(options.warehouses).toEqual([{ id: "w1", name: "Main WH" }]);
    expect(options.products).toEqual([
      { id: "p1", name: "Widget", purchasePrice: 100 },
    ]);
    expect(options.suppliers).toEqual([{ id: "s1", name: "Acme Supply" }]);
    expect(fromMock).toHaveBeenCalledWith("warehouses");
    expect(fromMock).toHaveBeenCalledWith("products");
    expect(fromMock).toHaveBeenCalledWith("suppliers");
  });

  it("returns empty arrays when queries yield no data", async () => {
    const { client } = createClient({
      warehouses: { data: null },
      products: { data: null },
      suppliers: { data: null },
    });

    const options = await fetchPurchaseRequestOptions(client, "org-1");
    expect(options).toEqual({ warehouses: [], products: [], suppliers: [] });
  });
});
