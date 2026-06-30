import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { PurchaseReturnRepository } from "./purchase-return.repository";

type DbPurchaseReturn =
  Database["public"]["Tables"]["purchase_returns"]["Row"];
type DbPurchaseReturnItem =
  Database["public"]["Tables"]["purchase_return_items"]["Row"];

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
      is: vi.fn(() => builder),
      or: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      limit: vi.fn(() => builder),
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

function buildDbReturn(
  overrides: Partial<DbPurchaseReturn> = {}
): DbPurchaseReturn {
  return {
    id: "pret-1",
    organization_id: "org-1",
    return_number: "PRET-00001",
    purchase_order_id: "po-1",
    supplier_id: "sup-1",
    branch_id: "wh-1",
    status: "draft",
    return_date: "2026-06-01",
    reason: "damaged",
    subtotal: 1000,
    tax_amount: 180,
    total_amount: 1180,
    notes: "note",
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
  overrides: Partial<DbPurchaseReturnItem> = {}
): DbPurchaseReturnItem {
  return {
    id: "item-1",
    organization_id: "org-1",
    purchase_return_id: "pret-1",
    product_id: "prod-1",
    quantity: 10,
    unit_price: 100,
    tax_rate: 18,
    tax_amount: 180,
    line_total: 1180,
    batch_id: null,
    created_at: "2026-06-01T00:00:00.000Z",
    created_by: "user-1",
    ...overrides,
  };
}

describe("PurchaseReturnRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB row to the domain purchase return", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbReturn(), error: null },
      ]);
      const repo = new PurchaseReturnRepository(client);

      const entry = await repo.findById("pret-1");

      expect(entry?.id).toBe("pret-1");
      expect(entry?.returnNumber).toBe("PRET-00001");
      expect(entry?.returnDate).toBeInstanceOf(Date);
      expect(entry?.totalAmount).toBe(1180);
      expect(entry?.reason).toBe("damaged");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "pret-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      expect(
        await new PurchaseReturnRepository(client).findById("pret-1")
      ).toBeNull();
    });
  });

  describe("findByNumber", () => {
    it("uppercases/trims the return number", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbReturn(), error: null },
      ]);
      const entry = await new PurchaseReturnRepository(client).findByNumber(
        "org-1",
        "  pret-00001 "
      );
      expect(entry?.id).toBe("pret-1");
      expect(builders[0].eq).toHaveBeenCalledWith("return_number", "PRET-00001");
    });

    it("returns null when not found", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      expect(
        await new PurchaseReturnRepository(client).findByNumber("org-1", "PRET-1")
      ).toBeNull();
    });
  });

  describe("findItems", () => {
    it("maps items ordered by created_at", async () => {
      const { client, builders } = createMockClient([
        { data: [buildDbItem(), buildDbItem({ id: "item-2" })], error: null },
      ]);
      const items = await new PurchaseReturnRepository(client).findItems("pret-1");
      expect(items.map((i) => i.id)).toEqual(["item-1", "item-2"]);
      expect(items[0].lineTotal).toBe(1180);
      expect(builders[0].eq).toHaveBeenCalledWith("purchase_return_id", "pret-1");
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: true,
      });
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseReturnRepository(client).findItems("pret-1")
      ).toEqual([]);
    });
  });

  describe("findWithItems", () => {
    it("combines the header and its items", async () => {
      const { client } = createMockClient([
        { data: buildDbReturn(), error: null },
        { data: [buildDbItem()], error: null },
      ]);
      const entry = await new PurchaseReturnRepository(client).findWithItems(
        "pret-1"
      );
      expect(entry?.id).toBe("pret-1");
      expect(entry?.items).toHaveLength(1);
    });

    it("returns null when the header is missing", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      expect(
        await new PurchaseReturnRepository(client).findWithItems("pret-1")
      ).toBeNull();
    });
  });

  describe("list", () => {
    it("maps rows, reads the joined supplier name, and applies defaults", async () => {
      const rows = [
        { ...buildDbReturn(), suppliers: { name: "Acme Supply" } },
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 5 },
      ]);
      const result = await new PurchaseReturnRepository(client).list("org-1");

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
      const rows = [{ ...buildDbReturn(), suppliers: [{ name: "Beta" }] }];
      const { client } = createMockClient([
        { data: rows, error: null, count: 1 },
      ]);
      const result = await new PurchaseReturnRepository(client).list("org-1");
      expect(result.items[0].supplierName).toBe("Beta");
    });

    it("defaults supplier name to null when the join is empty", async () => {
      const rows = [{ ...buildDbReturn(), suppliers: null }];
      const { client } = createMockClient([
        { data: rows, error: null, count: 1 },
      ]);
      const result = await new PurchaseReturnRepository(client).list("org-1");
      expect(result.items[0].supplierName).toBeNull();
    });

    it("applies status filter, search, custom sort and pagination", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new PurchaseReturnRepository(client).list("org-1", {
        status: "completed",
        search: "pret-001",
        page: 2,
        pageSize: 10,
        sortBy: "total_amount",
        sortDir: "asc",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("status", "completed");
      expect(builders[0].ilike).toHaveBeenCalledWith(
        "return_number",
        "%pret-001%"
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
      await new PurchaseReturnRepository(client).list("org-1", {
        search: "(),",
      });
      expect(builders[0].ilike).not.toHaveBeenCalled();
    });

    it("returns an empty result on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const result = await new PurchaseReturnRepository(client).list("org-1", {
        page: 3,
        pageSize: 5,
      });
      expect(result).toEqual({ items: [], total: 0, page: 3, pageSize: 5 });
    });

    it("clamps page and pageSize", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new PurchaseReturnRepository(client).list("org-1", {
        page: 0,
        pageSize: 1000,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 99);
    });
  });

  describe("createHeader", () => {
    it("inserts and maps the created header", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbReturn(), error: null },
      ]);
      const entry = await new PurchaseReturnRepository(client).createHeader({
        organization_id: "org-1",
        return_number: "PRET-00001",
        supplier_id: "sup-1",
        reason: "damaged",
      });
      expect(entry?.id).toBe("pret-1");
      expect(builders[0].insert).toHaveBeenCalled();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseReturnRepository(client).createHeader({
          organization_id: "org-1",
          return_number: "PRET-1",
          supplier_id: "sup-1",
          reason: "other",
        })
      ).toBeNull();
    });
  });

  describe("insertItems", () => {
    it("returns true without querying when there are no items", async () => {
      const { client, from } = createMockClient([]);
      expect(await new PurchaseReturnRepository(client).insertItems([])).toBe(
        true
      );
      expect(from).not.toHaveBeenCalled();
    });

    it("inserts items and returns true on success", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const result = await new PurchaseReturnRepository(client).insertItems([
        {
          organization_id: "org-1",
          purchase_return_id: "pret-1",
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
        await new PurchaseReturnRepository(client).insertItems([
          {
            organization_id: "org-1",
            purchase_return_id: "pret-1",
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
      const result = await new PurchaseReturnRepository(client).replaceItems(
        "pret-1",
        [
          {
            organization_id: "org-1",
            purchase_return_id: "pret-1",
            product_id: "prod-1",
            quantity: 1,
          },
        ]
      );
      expect(result).toBe(true);
      expect(builders[0].delete).toHaveBeenCalled();
      expect(builders[0].eq).toHaveBeenCalledWith("purchase_return_id", "pret-1");
      expect(builders[1].insert).toHaveBeenCalled();
    });

    it("returns false when the delete fails and does not insert", async () => {
      const { client, from } = createMockClient([
        { data: null, error: { message: "x" } }, // delete fails
      ]);
      const result = await new PurchaseReturnRepository(client).replaceItems(
        "pret-1",
        [
          {
            organization_id: "org-1",
            purchase_return_id: "pret-1",
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
        { data: buildDbReturn({ notes: "updated" }), error: null },
      ]);
      const entry = await new PurchaseReturnRepository(client).updateHeader(
        "pret-1",
        { notes: "updated" },
        "user-9",
        4
      );
      expect(entry?.notes).toBe("updated");
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.notes).toBe("updated");
      expect(patch.updated_by).toBe("user-9");
      expect(typeof patch.updated_at).toBe("string");
      // Optimistic lock: the update is scoped to the expected version.
      expect(builders[0].eq).toHaveBeenCalledWith("id", "pret-1");
      expect(builders[0].eq).toHaveBeenCalledWith("version", 4);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseReturnRepository(client).updateHeader(
          "pret-1",
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
        await new PurchaseReturnRepository(client).updateHeader(
          "pret-1",
          { notes: "stale" },
          "user-9",
          1
        )
      ).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("sets the status with updated_by/updated_at", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbReturn({ status: "completed" }), error: null },
      ]);
      const entry = await new PurchaseReturnRepository(client).updateStatus(
        "pret-1",
        "completed",
        "user-9"
      );
      expect(entry?.status).toBe("completed");
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.status).toBe("completed");
      expect(patch.updated_by).toBe("user-9");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new PurchaseReturnRepository(client).updateStatus(
          "pret-1",
          "cancelled",
          "user-9"
        )
      ).toBeNull();
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at/deleted_by and returns true", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const result = await new PurchaseReturnRepository(client).softDelete(
        "pret-1",
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
        await new PurchaseReturnRepository(client).softDelete("pret-1", "user-9")
      ).toBe(false);
    });
  });

  // ── Atomic completion RPC ────────────────────────────────────

  describe("completeReturnRpc", () => {
    it("calls the complete_purchase_return RPC with the return id", async () => {
      const { client, rpc } = createMockClient([], { data: null, error: null });
      const result = await new PurchaseReturnRepository(client).completeReturnRpc(
        "pret-1"
      );
      expect(rpc).toHaveBeenCalledWith("complete_purchase_return", {
        p_return_id: "pret-1",
      });
      expect(result.error).toBeNull();
    });

    it("passes through a raised RPC error", async () => {
      const { client } = createMockClient([], {
        data: null,
        error: { message: "insufficient_stock" },
      });
      const result = await new PurchaseReturnRepository(client).completeReturnRpc(
        "pret-1"
      );
      expect(result.error?.message).toBe("insufficient_stock");
    });
  });
});
