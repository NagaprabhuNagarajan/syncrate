import { describe, it, expect, vi } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { fetchPurchaseOrderOptions } from "./purchase-order-options";

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

describe("fetchPurchaseOrderOptions", () => {
  it("maps suppliers, branches and products with numeric coercion", async () => {
    const { client, fromMock } = createClient({
      suppliers: { data: [{ id: "s1", name: "Acme Supply" }] },
      branches: { data: [{ id: "w1", name: "Main WH" }] },
      products: {
        data: [
          { id: "p1", name: "Widget", purchase_price: "100", gst_rate: "18" },
        ],
      },
    });

    const options = await fetchPurchaseOrderOptions(client, "org-1");

    expect(options.suppliers).toEqual([{ id: "s1", name: "Acme Supply" }]);
    expect(options.branches).toEqual([{ id: "w1", name: "Main WH" }]);
    expect(options.products).toEqual([
      { id: "p1", name: "Widget", purchasePrice: 100, gstRate: 18 },
    ]);
    expect(fromMock).toHaveBeenCalledWith("suppliers");
    expect(fromMock).toHaveBeenCalledWith("branches");
    expect(fromMock).toHaveBeenCalledWith("products");
  });

  it("returns empty arrays when queries yield no data", async () => {
    const { client } = createClient({
      suppliers: { data: null },
      branches: { data: null },
      products: { data: null },
    });

    const options = await fetchPurchaseOrderOptions(client, "org-1");
    expect(options).toEqual({ suppliers: [], branches: [], products: [] });
  });
});
