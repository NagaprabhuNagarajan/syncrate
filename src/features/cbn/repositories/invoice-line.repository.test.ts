import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { InvoiceLineRepository } from "./invoice-line.repository";

interface Builder {
  select: Mock;
  eq: Mock;
  is: Mock;
  order: Mock;
}

function createClient(result: { data: unknown; error: unknown }): {
  client: AppSupabaseClient;
  builder: Builder;
} {
  const builder = {} as Builder;
  Object.assign(builder, {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve(result)),
  });
  return {
    client: { from: vi.fn(() => builder) } as unknown as AppSupabaseClient,
    builder,
  };
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "line-1",
    cbn_invoice_id: "cbn-inv-1",
    organization_id: "org-2",
    sort_order: 0,
    supplier_product_id: "their-prod-1",
    product_name: "Coke 500ml",
    product_sku: "SKU-COKE",
    product_barcode: "8901234567890",
    hsn_code: "2202",
    description: "Coke 500ml",
    quantity: "2",
    unit_price: "300.00",
    discount_amount: "0",
    taxable_amount: "600.00",
    gst_rate: "0",
    tax_amount: "0",
    line_total: "600.00",
    created_at: "2026-07-21T00:00:00Z",
    updated_at: "2026-07-21T00:00:00Z",
    deleted_at: null,
    created_by: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InvoiceLineRepository.listByCbnInvoice", () => {
  it("maps rows and coerces numerics away from strings", async () => {
    const { client, builder } = createClient({
      data: [makeRow()],
      error: null,
    });

    const lines = await new InvoiceLineRepository(client).listByCbnInvoice(
      "cbn-inv-1"
    );

    expect(lines).not.toBeNull();
    if (lines === null) {
      throw new Error("expected rows");
    }
    expect(lines).toHaveLength(1);
    // Postgres NUMERIC arrives as a string over PostgREST; arithmetic on that
    // would concatenate rather than add.
    expect(lines[0]?.quantity).toBe(2);
    expect(lines[0]?.unitPrice).toBe(300);
    expect(lines[0]?.lineTotal).toBe(600);
    expect(lines[0]?.supplierProductId).toBe("their-prod-1");
    expect(builder.eq).toHaveBeenCalledWith("cbn_invoice_id", "cbn-inv-1");
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(builder.order).toHaveBeenCalledWith("sort_order", {
      ascending: true,
    });
  });

  it("returns null on error so a failed read is not mistaken for no lines", async () => {
    const { client } = createClient({ data: null, error: { message: "rls" } });

    const lines = await new InvoiceLineRepository(client).listByCbnInvoice(
      "cbn-inv-1"
    );

    expect(lines).toBeNull();
  });

  it("returns an empty array for an invoice that genuinely has no lines", async () => {
    const { client } = createClient({ data: [], error: null });

    const lines = await new InvoiceLineRepository(client).listByCbnInvoice(
      "cbn-inv-1"
    );

    expect(lines).toEqual([]);
  });
});
