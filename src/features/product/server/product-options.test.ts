import { describe, it, expect, vi } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { fetchProductOptions } from "./product-options";

interface BuilderResult {
  data: Array<{ id: string; name: string }> | null;
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
  return { client: { from: fromMock } as unknown as AppSupabaseClient, fromMock };
}

describe("fetchProductOptions", () => {
  it("maps rows into {id,name} options for every catalog table", async () => {
    const { client, fromMock } = createClient({
      categories: { data: [{ id: "c1", name: "Hardware" }] },
      brands: { data: [{ id: "b1", name: "Acme" }] },
      units: { data: [{ id: "u1", name: "Piece" }] },
      suppliers: { data: [{ id: "s1", name: "Supplier One" }] },
    });

    const options = await fetchProductOptions(client, "org-1");

    expect(options.categories).toEqual([{ id: "c1", name: "Hardware" }]);
    expect(options.brands).toEqual([{ id: "b1", name: "Acme" }]);
    expect(options.units).toEqual([{ id: "u1", name: "Piece" }]);
    expect(options.suppliers).toEqual([{ id: "s1", name: "Supplier One" }]);
    expect(fromMock).toHaveBeenCalledWith("categories");
    expect(fromMock).toHaveBeenCalledWith("suppliers");
  });

  it("returns empty arrays when a query yields no data", async () => {
    const { client } = createClient({
      categories: { data: null },
      brands: { data: null },
      units: { data: null },
      suppliers: { data: null },
    });

    const options = await fetchProductOptions(client, "org-1");
    expect(options).toEqual({
      categories: [],
      brands: [],
      units: [],
      suppliers: [],
    });
  });
});
