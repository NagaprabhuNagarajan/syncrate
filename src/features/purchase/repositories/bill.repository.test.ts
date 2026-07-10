import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { BillRepository } from "./bill.repository";

type DbBill =
  Database["public"]["Tables"]["purchase_invoices"]["Row"];
type DbBillItem =
  Database["public"]["Tables"]["purchase_invoice_items"]["Row"];

// ─────────────────────────────────────────────────────────────
// Chainable + thenable Supabase mock
// ─────────────────────────────────────────────────────────────

interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}

interface MockBuilder {
  select: Mock;
  eq: Mock;
  neq: Mock;
  lt: Mock;
  is: Mock;
  or: Mock;
  ilike: Mock;
  in: Mock;
  order: Mock;
  range: Mock;
  limit: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  single: Mock;
}

interface MockClient {
  client: AppSupabaseClient;
  from: Mock;
  rpc: Mock;
  builders: MockBuilder[];
}

function createMockClient(
  results: QueryResult[],
  rpcResult: { data: unknown; error: unknown } = { data: null, error: null }
): MockClient {
  const builders: MockBuilder[] = [];
  let index = 0;
  const rpc = vi.fn(() => Promise.resolve(rpcResult));

  const from = vi.fn(() => {
    const result = results[index] ?? { data: null, error: null };
    index += 1;

    const builder: MockBuilder & {
      then: (
        onFulfilled?: ((value: QueryResult) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => Promise<unknown>;
    } = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      is: vi.fn(() => builder),
      or: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve(result)),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };

    builders.push(builder);
    return builder;
  });

  const client = { from, rpc } as unknown as AppSupabaseClient;
  return { client, from, rpc, builders };
}

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function buildDbInvoice(
  overrides: Partial<DbBill> = {}
): DbBill {
  return {
    id: "pinv-1",
    organization_id: "org-1",
    invoice_number: "PINV-00001",
    supplier_invoice_number: "SUP-9",
    purchase_order_id: "po-1",
    supplier_id: "sup-1",
    status: "draft",
    invoice_date: "2026-06-01",
    due_date: "2026-07-01",
    subtotal: 1000,
    discount_amount: 0,
    tax_amount: 180,
    total_amount: 1180,
    amount_paid: 0,
    notes: "note",
    posted_at: null,
    posted_by: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    deleted_at: null,
    created_by: "user-1",
    updated_by: null,
    deleted_by: null,
    version: 1,
    ...overrides,
  };
}

function buildDbItem(
  overrides: Partial<DbBillItem> = {}
): DbBillItem {
  return {
    id: "item-1",
    organization_id: "org-1",
    purchase_invoice_id: "pinv-1",
    product_id: "prod-1",
    description: "Widget",
    quantity: 10,
    unit_price: 100,
    tax_rate: 18,
    tax_amount: 180,
    line_total: 1180,
    created_at: "2026-06-01T00:00:00.000Z",
    created_by: "user-1",
    ...overrides,
  };
}

describe("BillRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB row to the domain purchase invoice", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbInvoice(), error: null },
      ]);
      const invoice = await new BillRepository(client).findById(
        "pinv-1"
      );

      expect(invoice?.id).toBe("pinv-1");
      expect(invoice?.invoiceNumber).toBe("PINV-00001");
      expect(invoice?.invoiceDate).toBeInstanceOf(Date);
      expect(invoice?.dueDate).toBeInstanceOf(Date);
      expect(invoice?.totalAmount).toBe(1180);
      expect(invoice?.postedAt).toBeNull();
      expect(builders[0].eq).toHaveBeenCalledWith("id", "pinv-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      expect(
        await new BillRepository(client).findById("pinv-1")
      ).toBeNull();
    });

    it("maps a null due date", async () => {
      const { client } = createMockClient([
        { data: buildDbInvoice({ due_date: null }), error: null },
      ]);
      const invoice = await new BillRepository(client).findById(
        "pinv-1"
      );
      expect(invoice?.dueDate).toBeNull();
    });
  });

  describe("findByNumber", () => {
    it("uppercases/trims the invoice number", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbInvoice(), error: null },
      ]);
      const invoice = await new BillRepository(client).findByNumber(
        "org-1",
        "  pinv-00001 "
      );
      expect(invoice?.id).toBe("pinv-1");
      expect(builders[0].eq).toHaveBeenCalledWith(
        "invoice_number",
        "PINV-00001"
      );
    });

    it("returns null when not found", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      expect(
        await new BillRepository(client).findByNumber(
          "org-1",
          "PINV-1"
        )
      ).toBeNull();
    });
  });

  describe("findItems", () => {
    it("maps items ordered by created_at", async () => {
      const { client, builders } = createMockClient([
        { data: [buildDbItem(), buildDbItem({ id: "item-2" })], error: null },
      ]);
      const items = await new BillRepository(client).findItems(
        "pinv-1"
      );
      expect(items.map((i) => i.id)).toEqual(["item-1", "item-2"]);
      expect(items[0].lineTotal).toBe(1180);
      expect(builders[0].eq).toHaveBeenCalledWith(
        "purchase_invoice_id",
        "pinv-1"
      );
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: true,
      });
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new BillRepository(client).findItems("pinv-1")
      ).toEqual([]);
    });
  });

  describe("findWithItems", () => {
    it("combines the header and its items", async () => {
      const { client } = createMockClient([
        { data: buildDbInvoice(), error: null },
        { data: [buildDbItem()], error: null },
      ]);
      const invoice = await new BillRepository(client).findWithItems(
        "pinv-1"
      );
      expect(invoice?.id).toBe("pinv-1");
      expect(invoice?.items).toHaveLength(1);
    });

    it("returns null when the header is missing", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      expect(
        await new BillRepository(client).findWithItems("pinv-1")
      ).toBeNull();
    });
  });

  describe("list", () => {
    it("maps rows, reads the joined supplier name, and applies defaults", async () => {
      const rows = [
        { ...buildDbInvoice(), suppliers: { name: "Acme Supply" } },
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 5 },
      ]);
      const result = await new BillRepository(client).list("org-1");

      expect(result.items[0].supplierName).toBe("Acme Supply");
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 19);
    });

    it("reads the supplier name from an array join shape", async () => {
      const rows = [{ ...buildDbInvoice(), suppliers: [{ name: "Beta" }] }];
      const { client } = createMockClient([
        { data: rows, error: null, count: 1 },
      ]);
      const result = await new BillRepository(client).list("org-1");
      expect(result.items[0].supplierName).toBe("Beta");
    });

    it("defaults supplier name to null when the join is empty", async () => {
      const rows = [{ ...buildDbInvoice(), suppliers: null }];
      const { client } = createMockClient([
        { data: rows, error: null, count: 1 },
      ]);
      const result = await new BillRepository(client).list("org-1");
      expect(result.items[0].supplierName).toBeNull();
    });

    it("applies status filter, search, custom sort and pagination", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new BillRepository(client).list("org-1", {
        status: "posted",
        search: "pinv-001",
        page: 2,
        pageSize: 10,
        sortBy: "total_amount",
        sortDir: "asc",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("status", "posted");
      expect(builders[0].ilike).toHaveBeenCalledWith(
        "invoice_number",
        "%pinv-001%"
      );
      expect(builders[0].order).toHaveBeenCalledWith("total_amount", {
        ascending: true,
      });
      expect(builders[0].range).toHaveBeenCalledWith(10, 19);
    });

    it("skips search when the sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new BillRepository(client).list("org-1", {
        search: "(),",
      });
      expect(builders[0].ilike).not.toHaveBeenCalled();
    });

    it("returns an empty result on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const result = await new BillRepository(client).list("org-1", {
        page: 3,
        pageSize: 5,
      });
      expect(result).toEqual({ items: [], total: 0, page: 3, pageSize: 5 });
    });

    it("clamps page and pageSize", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new BillRepository(client).list("org-1", {
        page: 0,
        pageSize: 1000,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 99);
    });
  });

  describe("getStats", () => {
    it("aggregates status counts, sums total_amount and counts overdue invoices", async () => {
      const { client } = createMockClient([
        { data: null, error: null, count: 3 }, // draft
        { data: null, error: null, count: 5 }, // posted
        {
          data: [{ total_amount: 100 }, { total_amount: 250.5 }],
          error: null,
        }, // value rows (non-cancelled)
        {
          data: [
            { total_amount: 500, amount_paid: 0 }, // overdue (unpaid)
            { total_amount: 300, amount_paid: 150 }, // overdue (partial)
            { total_amount: 200, amount_paid: 200 }, // fully paid, not overdue
          ],
          error: null,
        }, // overdue rows
      ]);
      const stats = await new BillRepository(client).getStats(
        "org-1"
      );
      expect(stats).toEqual({
        totalValue: 350.5,
        draft: 3,
        posted: 5,
        overdue: 2,
      });
    });

    it("defaults counts, totalValue and overdue to 0 when data is missing", async () => {
      const { client } = createMockClient([
        { data: null, error: null, count: null },
        { data: null, error: null, count: undefined },
        { data: null, error: null },
        { data: null, error: null },
      ]);
      const stats = await new BillRepository(client).getStats(
        "org-1"
      );
      expect(stats).toEqual({
        totalValue: 0,
        draft: 0,
        posted: 0,
        overdue: 0,
      });
    });
  });

  describe("createHeader", () => {
    it("inserts and maps the created header", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbInvoice(), error: null },
      ]);
      const invoice = await new BillRepository(client).createHeader({
        organization_id: "org-1",
        invoice_number: "PINV-00001",
        supplier_id: "sup-1",
      });
      expect(invoice?.id).toBe("pinv-1");
      expect(builders[0].insert).toHaveBeenCalled();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new BillRepository(client).createHeader({
          organization_id: "org-1",
          invoice_number: "PINV-1",
          supplier_id: "sup-1",
        })
      ).toBeNull();
    });
  });

  describe("insertItems", () => {
    it("returns true without querying when there are no items", async () => {
      const { client, from } = createMockClient([]);
      expect(
        await new BillRepository(client).insertItems([])
      ).toBe(true);
      expect(from).not.toHaveBeenCalled();
    });

    it("inserts items and returns true on success", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const result = await new BillRepository(client).insertItems([
        {
          organization_id: "org-1",
          purchase_invoice_id: "pinv-1",
          product_id: "prod-1",
          quantity: 1,
        },
      ]);
      expect(result).toBe(true);
      expect(builders[0].insert).toHaveBeenCalled();
    });

    it("returns false on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new BillRepository(client).insertItems([
          {
            organization_id: "org-1",
            purchase_invoice_id: "pinv-1",
            product_id: "prod-1",
            quantity: 1,
          },
        ])
      ).toBe(false);
    });
  });

  describe("replaceItems", () => {
    it("deletes existing items then inserts the new set", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null }, // delete
        { data: null, error: null }, // insert
      ]);
      const result = await new BillRepository(client).replaceItems(
        "pinv-1",
        [
          {
            organization_id: "org-1",
            purchase_invoice_id: "pinv-1",
            product_id: "prod-1",
            quantity: 1,
          },
        ]
      );
      expect(result).toBe(true);
      expect(builders[0].delete).toHaveBeenCalled();
      expect(builders[0].eq).toHaveBeenCalledWith(
        "purchase_invoice_id",
        "pinv-1"
      );
      expect(builders[1].insert).toHaveBeenCalled();
    });

    it("returns false when the delete fails and does not insert", async () => {
      const { client, from } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const result = await new BillRepository(client).replaceItems(
        "pinv-1",
        [
          {
            organization_id: "org-1",
            purchase_invoice_id: "pinv-1",
            product_id: "prod-1",
            quantity: 1,
          },
        ]
      );
      expect(result).toBe(false);
      expect(from).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateHeader", () => {
    it("applies the patch with updated_by/updated_at and guards on version", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbInvoice({ notes: "updated" }), error: null },
      ]);
      const invoice = await new BillRepository(client).updateHeader(
        "pinv-1",
        { notes: "updated" },
        "user-9",
        3
      );
      expect(invoice?.notes).toBe("updated");
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.notes).toBe("updated");
      expect(patch.updated_by).toBe("user-9");
      expect(typeof patch.updated_at).toBe("string");
      // Optimistic lock: the update is scoped to the expected version.
      expect(builders[0].eq).toHaveBeenCalledWith("id", "pinv-1");
      expect(builders[0].eq).toHaveBeenCalledWith("version", 3);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new BillRepository(client).updateHeader(
          "pinv-1",
          {},
          "user-9",
          1
        )
      ).toBeNull();
    });

    it("returns null when the version does not match (optimistic-lock conflict)", async () => {
      // A stale version matches no row, so PostgREST returns no data.
      const { client } = createMockClient([{ data: null, error: null }]);
      expect(
        await new BillRepository(client).updateHeader(
          "pinv-1",
          { notes: "stale" },
          "user-9",
          1
        )
      ).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("sets the status", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbInvoice({ status: "cancelled" }), error: null },
      ]);
      const invoice = await new BillRepository(client).updateStatus(
        "pinv-1",
        "cancelled",
        "user-9"
      );
      expect(invoice?.status).toBe("cancelled");
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.status).toBe("cancelled");
      expect(patch.updated_by).toBe("user-9");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new BillRepository(client).updateStatus(
          "pinv-1",
          "cancelled",
          "user-9"
        )
      ).toBeNull();
    });
  });

  describe("postInvoiceRpc", () => {
    it("calls the post_purchase_invoice RPC with the invoice id", async () => {
      const { client, rpc } = createMockClient([], { data: null, error: null });
      const result = await new BillRepository(client).postInvoiceRpc(
        "pinv-1"
      );
      expect(rpc).toHaveBeenCalledWith("post_purchase_invoice", {
        p_invoice_id: "pinv-1",
      });
      expect(result.error).toBeNull();
    });

    it("passes through a raised RPC error", async () => {
      const { client } = createMockClient([], {
        data: null,
        error: { message: "invalid_status" },
      });
      const result = await new BillRepository(client).postInvoiceRpc(
        "pinv-1"
      );
      expect(result.error?.message).toBe("invalid_status");
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at/deleted_by and returns true", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const result = await new BillRepository(client).softDelete(
        "pinv-1",
        "user-9"
      );
      expect(result).toBe(true);
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(typeof patch.deleted_at).toBe("string");
      expect(patch.deleted_by).toBe("user-9");
    });

    it("returns false on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new BillRepository(client).softDelete("pinv-1", "u")
      ).toBe(false);
    });
  });

});
