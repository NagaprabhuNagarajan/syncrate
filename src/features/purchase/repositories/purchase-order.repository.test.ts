import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { PurchaseOrderRepository } from "./purchase-order.repository";

type DbPurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
type DbPurchaseOrderItem =
  Database["public"]["Tables"]["purchase_order_items"]["Row"];

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
  is: Mock;
  or: Mock;
  ilike: Mock;
  in: Mock;
  order: Mock;
  range: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  single: Mock;
  maybeSingle: Mock;
}

interface MockClient {
  client: AppSupabaseClient;
  from: Mock;
  builders: MockBuilder[];
}

function createMockClient(results: QueryResult[]): MockClient {
  const builders: MockBuilder[] = [];
  let index = 0;

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
      is: vi.fn(() => builder),
      or: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };

    builders.push(builder);
    return builder;
  });

  const client = { from } as unknown as AppSupabaseClient;
  return { client, from, builders };
}

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function buildDbOrder(overrides: Partial<DbPurchaseOrder> = {}): DbPurchaseOrder {
  return {
    id: "po-1",
    organization_id: "org-1",
    po_number: "PO-00001",
    supplier_id: "sup-1",
    branch_id: "wh-1",
    status: "draft",
    order_date: "2026-06-01",
    expected_delivery_date: "2026-06-10",
    currency: "INR",
    notes: "note",
    terms: "net 30",
    subtotal: 1000,
    discount_amount: 100,
    tax_amount: 162,
    total_amount: 1062,
    approved_by: null,
    approved_at: null,
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
  overrides: Partial<DbPurchaseOrderItem> = {}
): DbPurchaseOrderItem {
  return {
    id: "item-1",
    organization_id: "org-1",
    purchase_order_id: "po-1",
    product_id: "prod-1",
    description: "Widget",
    quantity: 10,
    received_quantity: 0,
    unit_price: 100,
    discount_percent: 10,
    tax_rate: 18,
    tax_amount: 162,
    line_total: 1062,
    created_at: "2026-06-01T00:00:00.000Z",
    created_by: "user-1",
    ...overrides,
  };
}

describe("PurchaseOrderRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB row to the domain purchase order", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbOrder(), error: null },
      ]);
      const repo = new PurchaseOrderRepository(client);

      const order = await repo.findById("po-1");

      expect(order?.id).toBe("po-1");
      expect(order?.poNumber).toBe("PO-00001");
      expect(order?.orderDate).toBeInstanceOf(Date);
      expect(order?.expectedDeliveryDate).toBeInstanceOf(Date);
      expect(order?.totalAmount).toBe(1062);
      expect(order?.approvedAt).toBeNull();
      expect(builders[0].eq).toHaveBeenCalledWith("id", "po-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      expect(await new PurchaseOrderRepository(client).findById("po-1")).toBeNull();
    });

    it("maps null expected delivery date", async () => {
      const { client } = createMockClient([
        { data: buildDbOrder({ expected_delivery_date: null }), error: null },
      ]);
      const order = await new PurchaseOrderRepository(client).findById("po-1");
      expect(order?.expectedDeliveryDate).toBeNull();
    });
  });

  describe("findByNumber", () => {
    it("uppercases/trims the PO number", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbOrder(), error: null },
      ]);
      const order = await new PurchaseOrderRepository(client).findByNumber(
        "org-1",
        "  po-00001 "
      );
      expect(order?.id).toBe("po-1");
      expect(builders[0].eq).toHaveBeenCalledWith("po_number", "PO-00001");
    });

    it("returns null when not found", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      expect(
        await new PurchaseOrderRepository(client).findByNumber("org-1", "PO-1")
      ).toBeNull();
    });
  });

  describe("findItems", () => {
    it("maps items ordered by created_at", async () => {
      const { client, builders } = createMockClient([
        { data: [buildDbItem(), buildDbItem({ id: "item-2" })], error: null },
      ]);
      const items = await new PurchaseOrderRepository(client).findItems("po-1");
      expect(items.map((i) => i.id)).toEqual(["item-1", "item-2"]);
      expect(items[0].lineTotal).toBe(1062);
      expect(builders[0].eq).toHaveBeenCalledWith("purchase_order_id", "po-1");
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: true,
      });
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(await new PurchaseOrderRepository(client).findItems("po-1")).toEqual(
        []
      );
    });
  });

  describe("findWithItems", () => {
    it("combines the header and its items", async () => {
      const { client } = createMockClient([
        { data: buildDbOrder(), error: null },
        { data: [buildDbItem()], error: null },
      ]);
      const order = await new PurchaseOrderRepository(client).findWithItems("po-1");
      expect(order?.id).toBe("po-1");
      expect(order?.items).toHaveLength(1);
    });

    it("returns null when the header is missing", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      expect(
        await new PurchaseOrderRepository(client).findWithItems("po-1")
      ).toBeNull();
    });
  });

  describe("list", () => {
    it("maps rows, reads the joined supplier name, and applies defaults", async () => {
      const rows = [
        { ...buildDbOrder({ id: "po-1" }), suppliers: { name: "Acme Supply" } },
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 5 },
      ]);
      const result = await new PurchaseOrderRepository(client).list("org-1");

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
      const rows = [
        { ...buildDbOrder(), suppliers: [{ name: "Beta Traders" }] },
      ];
      const { client } = createMockClient([
        { data: rows, error: null, count: 1 },
      ]);
      const result = await new PurchaseOrderRepository(client).list("org-1");
      expect(result.items[0].supplierName).toBe("Beta Traders");
    });

    it("defaults supplier name to null when the join is empty", async () => {
      const rows = [{ ...buildDbOrder(), suppliers: null }];
      const { client } = createMockClient([
        { data: rows, error: null, count: 1 },
      ]);
      const result = await new PurchaseOrderRepository(client).list("org-1");
      expect(result.items[0].supplierName).toBeNull();
    });

    it("applies status filter, search, custom sort and pagination", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new PurchaseOrderRepository(client).list("org-1", {
        status: "approved",
        search: "po-001",
        page: 2,
        pageSize: 10,
        sortBy: "total_amount",
        sortDir: "asc",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("status", "approved");
      expect(builders[0].ilike).toHaveBeenCalledWith("po_number", "%po-001%");
      expect(builders[0].order).toHaveBeenCalledWith("total_amount", {
        ascending: true,
      });
      expect(builders[0].range).toHaveBeenCalledWith(10, 19);
    });

    it("skips search when the sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new PurchaseOrderRepository(client).list("org-1", { search: "()," });
      expect(builders[0].ilike).not.toHaveBeenCalled();
    });

    it("returns an empty result on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const result = await new PurchaseOrderRepository(client).list("org-1", {
        page: 3,
        pageSize: 5,
      });
      expect(result).toEqual({ items: [], total: 0, page: 3, pageSize: 5 });
    });

    it("defaults total to 0 when count is null", async () => {
      const rows = [{ ...buildDbOrder(), suppliers: { name: "X" } }];
      const { client } = createMockClient([
        { data: rows, error: null, count: null },
      ]);
      const result = await new PurchaseOrderRepository(client).list("org-1");
      expect(result.total).toBe(0);
    });

    it("clamps page and pageSize", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new PurchaseOrderRepository(client).list("org-1", {
        page: 0,
        pageSize: 1000,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 99);
    });
  });

  describe("getStats", () => {
    it("aggregates status counts and sums total_amount for non-cancelled orders", async () => {
      const { client } = createMockClient([
        { data: null, error: null, count: 3 }, // draft
        { data: null, error: null, count: 2 }, // submitted (awaitingApproval)
        { data: null, error: null, count: 4 }, // approved
        { data: null, error: null, count: 1 }, // ordered
        { data: null, error: null, count: 5 }, // partially_received
        {
          data: [{ total_amount: 100 }, { total_amount: 250.5 }],
          error: null,
        }, // value rows
      ]);
      const stats = await new PurchaseOrderRepository(client).getStats(
        "org-1"
      );
      expect(stats).toEqual({
        totalValue: 350.5,
        draft: 3,
        awaitingApproval: 2,
        open: 10, // approved + ordered + partially_received
      });
    });

    it("defaults counts to 0 and totalValue to 0 when data is missing", async () => {
      const { client } = createMockClient([
        { data: null, error: null, count: null },
        { data: null, error: null, count: undefined },
        { data: null, error: null, count: null },
        { data: null, error: null, count: null },
        { data: null, error: null, count: null },
        { data: null, error: null },
      ]);
      const stats = await new PurchaseOrderRepository(client).getStats(
        "org-1"
      );
      expect(stats).toEqual({
        totalValue: 0,
        draft: 0,
        awaitingApproval: 0,
        open: 0,
      });
    });
  });

  describe("createHeader", () => {
    it("inserts and maps the created header", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbOrder(), error: null },
      ]);
      const order = await new PurchaseOrderRepository(client).createHeader({
        organization_id: "org-1",
        po_number: "PO-00001",
        supplier_id: "sup-1",
      });
      expect(order?.id).toBe("po-1");
      expect(builders[0].insert).toHaveBeenCalled();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseOrderRepository(client).createHeader({
          organization_id: "org-1",
          po_number: "PO-1",
          supplier_id: "sup-1",
        })
      ).toBeNull();
    });
  });

  describe("insertItems", () => {
    it("returns true without querying when there are no items", async () => {
      const { client, from } = createMockClient([]);
      expect(await new PurchaseOrderRepository(client).insertItems([])).toBe(true);
      expect(from).not.toHaveBeenCalled();
    });

    it("inserts items and returns true on success", async () => {
      const { client, builders } = createMockClient([{ data: null, error: null }]);
      const result = await new PurchaseOrderRepository(client).insertItems([
        {
          organization_id: "org-1",
          purchase_order_id: "po-1",
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
        await new PurchaseOrderRepository(client).insertItems([
          {
            organization_id: "org-1",
            purchase_order_id: "po-1",
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
      const result = await new PurchaseOrderRepository(client).replaceItems(
        "po-1",
        [
          {
            organization_id: "org-1",
            purchase_order_id: "po-1",
            product_id: "prod-1",
            quantity: 1,
          },
        ]
      );
      expect(result).toBe(true);
      expect(builders[0].delete).toHaveBeenCalled();
      expect(builders[0].eq).toHaveBeenCalledWith("purchase_order_id", "po-1");
      expect(builders[1].insert).toHaveBeenCalled();
    });

    it("returns false when the delete fails and does not insert", async () => {
      const { client, from } = createMockClient([
        { data: null, error: { message: "x" } }, // delete fails
      ]);
      const result = await new PurchaseOrderRepository(client).replaceItems(
        "po-1",
        [
          {
            organization_id: "org-1",
            purchase_order_id: "po-1",
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
    it("applies the patch, version-gates the write, and returns ok", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbOrder({ notes: "updated", version: 3 }), error: null },
      ]);
      const result = await new PurchaseOrderRepository(client).updateHeader(
        "po-1",
        { notes: "updated" },
        "user-9",
        2
      );
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.order.notes).toBe("updated");
        expect(result.order.version).toBe(3);
      }
      const patch = builders[0].update.mock.calls[0][0] as Record<string, unknown>;
      expect(patch.notes).toBe("updated");
      expect(patch.updated_by).toBe("user-9");
      expect(typeof patch.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "po-1");
      expect(builders[0].eq).toHaveBeenCalledWith("version", 2);
      expect(builders[0].maybeSingle).toHaveBeenCalled();
    });

    it("reports a conflict when no row matches the expected version", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const result = await new PurchaseOrderRepository(client).updateHeader(
        "po-1",
        { notes: "x" },
        "user-9",
        9
      );
      expect(result.status).toBe("conflict");
    });

    it("reports an error when the write fails", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const result = await new PurchaseOrderRepository(client).updateHeader(
        "po-1",
        {},
        "user-9",
        1
      );
      expect(result.status).toBe("error");
    });
  });

  describe("updateStatus", () => {
    it("sets the status without approval fields by default", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbOrder({ status: "submitted" }), error: null },
      ]);
      const order = await new PurchaseOrderRepository(client).updateStatus(
        "po-1",
        "submitted",
        "user-9"
      );
      expect(order?.status).toBe("submitted");
      const patch = builders[0].update.mock.calls[0][0] as Record<string, unknown>;
      expect(patch.status).toBe("submitted");
      expect(patch.approved_by).toBeUndefined();
      expect(patch.approved_at).toBeUndefined();
    });

    it("stamps the approver when approving", async () => {
      const { client, builders } = createMockClient([
        {
          data: buildDbOrder({
            status: "approved",
            approved_by: "user-9",
            approved_at: "2026-06-02T00:00:00.000Z",
          }),
          error: null,
        },
      ]);
      const order = await new PurchaseOrderRepository(client).updateStatus(
        "po-1",
        "approved",
        "user-9",
        true
      );
      expect(order?.approvedBy).toBe("user-9");
      expect(order?.approvedAt).toBeInstanceOf(Date);
      const patch = builders[0].update.mock.calls[0][0] as Record<string, unknown>;
      expect(patch.approved_by).toBe("user-9");
      expect(typeof patch.approved_at).toBe("string");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseOrderRepository(client).updateStatus(
          "po-1",
          "submitted",
          "user-9"
        )
      ).toBeNull();
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at/deleted_by and returns true", async () => {
      const { client, builders } = createMockClient([{ data: null, error: null }]);
      const result = await new PurchaseOrderRepository(client).softDelete(
        "po-1",
        "user-9"
      );
      expect(result).toBe(true);
      const patch = builders[0].update.mock.calls[0][0] as Record<string, unknown>;
      expect(typeof patch.deleted_at).toBe("string");
      expect(patch.deleted_by).toBe("user-9");
    });

    it("returns false on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseOrderRepository(client).softDelete("po-1", "user-9")
      ).toBe(false);
    });
  });
});
