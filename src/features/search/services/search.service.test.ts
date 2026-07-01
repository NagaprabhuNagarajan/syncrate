import { describe, it, expect, vi } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { SearchService } from "./search.service";

// ─────────────────────────────────────────────────────────────
// Chainable Supabase mock
// ─────────────────────────────────────────────────────────────

type Rows = Record<string, unknown[]>;

function buildSupabase(dataByTable: Rows) {
  const orCalls: Record<string, string> = {};
  const from = vi.fn((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      is: vi.fn(() => builder),
      or: vi.fn((filter: string) => {
        orCalls[table] = filter;
        return builder;
      }),
      limit: vi.fn(() =>
        Promise.resolve({ data: dataByTable[table] ?? [], error: null })
      ),
    };
    return builder;
  });
  return { supabase: { from } as unknown as AppSupabaseClient, from, orCalls };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SearchService", () => {
  it("returns empty results and does not hit the database for a query under 2 chars", async () => {
    const { supabase, from } = buildSupabase({});
    const service = new SearchService(supabase);

    const result = await service.search("a");

    expect(result).toEqual({
      customers: [],
      suppliers: [],
      products: [],
      invoices: [],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("maps rows to result items with entity, title, subtitle and href", async () => {
    const { supabase } = buildSupabase({
      customers: [{ id: "c1", name: "Acme Corp", code: "CUST-001", email: null }],
      suppliers: [{ id: "s1", name: "Bolt Supply", code: "SUP-9", email: null }],
      products: [{ id: "p1", name: "Widget", code: "P-1", sku: "SKU-1" }],
      invoices: [{ id: "i1", invoice_number: "INV-100", reference_number: "PO-5" }],
    });
    const service = new SearchService(supabase);

    const result = await service.search("acme");

    expect(result.customers[0]).toEqual({
      id: "c1",
      entity: "customer",
      title: "Acme Corp",
      subtitle: "CUST-001",
      href: "/customers/c1",
    });
    expect(result.products[0]).toMatchObject({
      entity: "product",
      subtitle: "SKU-1", // sku preferred over code
      href: "/products/p1",
    });
    expect(result.invoices[0]).toMatchObject({
      entity: "invoice",
      title: "INV-100",
      subtitle: "PO-5",
      href: "/invoices/i1",
    });
  });

  it("sanitizes wildcard/grammar characters before building the ilike filter", async () => {
    const { supabase, orCalls } = buildSupabase({ customers: [] });
    const service = new SearchService(supabase);

    await service.search("ac%me,(x)*");

    // User input has %, parens and * stripped; wrapped with * wildcards.
    // (Commas remain — they are the or() clause separators, not user input.)
    expect(orCalls.customers).toContain("name.ilike.*acmex*");
    expect(orCalls.customers).not.toMatch(/[%()]/);
  });

  it("falls back to empty arrays when a table returns no data", async () => {
    const { supabase } = buildSupabase({});
    const service = new SearchService(supabase);

    const result = await service.search("something");

    expect(result.customers).toEqual([]);
    expect(result.invoices).toEqual([]);
  });
});
