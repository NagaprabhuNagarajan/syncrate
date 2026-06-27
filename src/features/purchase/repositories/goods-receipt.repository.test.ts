import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { GoodsReceiptRepository } from "./goods-receipt.repository";

type DbGoodsReceipt = Database["public"]["Tables"]["goods_receipts"]["Row"];
type DbGoodsReceiptItem =
  Database["public"]["Tables"]["goods_receipt_items"]["Row"];

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
  ilike: Mock;
  in: Mock;
  order: Mock;
  range: Mock;
  insert: Mock;
  update: Mock;
  single: Mock;
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
      is: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
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

function buildDbReceipt(
  overrides: Partial<DbGoodsReceipt> = {}
): DbGoodsReceipt {
  return {
    id: "grn-1",
    organization_id: "org-1",
    grn_number: "GRN-00001",
    purchase_order_id: "po-1",
    warehouse_id: "wh-1",
    received_date: "2026-06-01",
    status: "completed",
    notes: "ok",
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
  overrides: Partial<DbGoodsReceiptItem> = {}
): DbGoodsReceiptItem {
  return {
    id: "gri-1",
    organization_id: "org-1",
    goods_receipt_id: "grn-1",
    purchase_order_item_id: "poi-1",
    product_id: "prod-1",
    ordered_quantity: 10,
    received_quantity: 8,
    rejected_quantity: 1,
    batch_id: null,
    created_at: "2026-06-01T00:00:00.000Z",
    created_by: "user-1",
    ...overrides,
  };
}

describe("GoodsReceiptRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB row to the domain goods receipt", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbReceipt(), error: null },
      ]);
      const receipt = await new GoodsReceiptRepository(client).findById("grn-1");
      expect(receipt?.id).toBe("grn-1");
      expect(receipt?.grnNumber).toBe("GRN-00001");
      expect(receipt?.receivedDate).toBeInstanceOf(Date);
      expect(receipt?.status).toBe("completed");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "grn-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      expect(
        await new GoodsReceiptRepository(client).findById("grn-1")
      ).toBeNull();
    });
  });

  describe("findItems", () => {
    it("maps items ordered by created_at", async () => {
      const { client, builders } = createMockClient([
        { data: [buildDbItem(), buildDbItem({ id: "gri-2" })], error: null },
      ]);
      const items = await new GoodsReceiptRepository(client).findItems("grn-1");
      expect(items.map((i) => i.id)).toEqual(["gri-1", "gri-2"]);
      expect(items[0].orderedQuantity).toBe(10);
      expect(items[0].receivedQuantity).toBe(8);
      expect(items[0].rejectedQuantity).toBe(1);
      expect(builders[0].eq).toHaveBeenCalledWith("goods_receipt_id", "grn-1");
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new GoodsReceiptRepository(client).findItems("grn-1")
      ).toEqual([]);
    });
  });

  describe("findWithItems", () => {
    it("combines header and items", async () => {
      const { client } = createMockClient([
        { data: buildDbReceipt(), error: null },
        { data: [buildDbItem()], error: null },
      ]);
      const receipt = await new GoodsReceiptRepository(client).findWithItems(
        "grn-1"
      );
      expect(receipt?.id).toBe("grn-1");
      expect(receipt?.items).toHaveLength(1);
    });

    it("returns null when the header is missing", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      expect(
        await new GoodsReceiptRepository(client).findWithItems("grn-1")
      ).toBeNull();
    });
  });

  describe("list", () => {
    it("maps rows and reads the joined PO number and supplier name (object join)", async () => {
      const rows = [
        {
          ...buildDbReceipt(),
          purchase_orders: {
            po_number: "PO-00001",
            suppliers: { name: "Acme Supply" },
          },
        },
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 3 },
      ]);
      const result = await new GoodsReceiptRepository(client).list("org-1");
      expect(result.items[0].poNumber).toBe("PO-00001");
      expect(result.items[0].supplierName).toBe("Acme Supply");
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 19);
    });

    it("reads PO/supplier from array join shapes", async () => {
      const rows = [
        {
          ...buildDbReceipt(),
          purchase_orders: [
            { po_number: "PO-9", suppliers: [{ name: "Beta Traders" }] },
          ],
        },
      ];
      const { client } = createMockClient([
        { data: rows, error: null, count: 1 },
      ]);
      const result = await new GoodsReceiptRepository(client).list("org-1");
      expect(result.items[0].poNumber).toBe("PO-9");
      expect(result.items[0].supplierName).toBe("Beta Traders");
    });

    it("defaults PO number and supplier name to null when the join is empty", async () => {
      const rows = [{ ...buildDbReceipt(), purchase_orders: null }];
      const { client } = createMockClient([
        { data: rows, error: null, count: 1 },
      ]);
      const result = await new GoodsReceiptRepository(client).list("org-1");
      expect(result.items[0].poNumber).toBeNull();
      expect(result.items[0].supplierName).toBeNull();
    });

    it("applies search and pagination", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new GoodsReceiptRepository(client).list("org-1", {
        search: "grn-001",
        page: 2,
        pageSize: 10,
      });
      expect(builders[0].ilike).toHaveBeenCalledWith("grn_number", "%grn-001%");
      expect(builders[0].range).toHaveBeenCalledWith(10, 19);
    });

    it("skips search when the sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      await new GoodsReceiptRepository(client).list("org-1", { search: "()," });
      expect(builders[0].ilike).not.toHaveBeenCalled();
    });

    it("returns an empty result on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const result = await new GoodsReceiptRepository(client).list("org-1", {
        page: 3,
        pageSize: 5,
      });
      expect(result).toEqual({ items: [], total: 0, page: 3, pageSize: 5 });
    });
  });

  describe("createHeader", () => {
    it("inserts and maps the created header", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbReceipt(), error: null },
      ]);
      const receipt = await new GoodsReceiptRepository(client).createHeader({
        organization_id: "org-1",
        grn_number: "GRN-00001",
        purchase_order_id: "po-1",
        warehouse_id: "wh-1",
      });
      expect(receipt?.id).toBe("grn-1");
      expect(builders[0].insert).toHaveBeenCalled();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new GoodsReceiptRepository(client).createHeader({
          organization_id: "org-1",
          grn_number: "GRN-1",
          purchase_order_id: "po-1",
          warehouse_id: "wh-1",
        })
      ).toBeNull();
    });
  });

  describe("insertItems", () => {
    it("returns true without querying when there are no items", async () => {
      const { client, from } = createMockClient([]);
      expect(await new GoodsReceiptRepository(client).insertItems([])).toBe(true);
      expect(from).not.toHaveBeenCalled();
    });

    it("inserts items and returns true on success", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const result = await new GoodsReceiptRepository(client).insertItems([
        {
          organization_id: "org-1",
          goods_receipt_id: "grn-1",
          product_id: "prod-1",
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
        await new GoodsReceiptRepository(client).insertItems([
          {
            organization_id: "org-1",
            goods_receipt_id: "grn-1",
            product_id: "prod-1",
          },
        ])
      ).toBe(false);
    });
  });

  describe("bumpPoItemReceived", () => {
    it("reads the current received quantity then writes the sum", async () => {
      const { client, builders } = createMockClient([
        { data: { received_quantity: 4 }, error: null }, // select
        { data: null, error: null }, // update
      ]);
      const result = await new GoodsReceiptRepository(client).bumpPoItemReceived(
        "poi-1",
        6
      );
      expect(result).toBe(true);
      expect(builders[0].eq).toHaveBeenCalledWith("id", "poi-1");
      const patch = builders[1].update.mock.calls[0][0] as Record<string, unknown>;
      expect(patch.received_quantity).toBe(10);
      expect(builders[1].eq).toHaveBeenCalledWith("id", "poi-1");
    });

    it("returns true without querying when qty is zero", async () => {
      const { client, from } = createMockClient([]);
      expect(
        await new GoodsReceiptRepository(client).bumpPoItemReceived("poi-1", 0)
      ).toBe(true);
      expect(from).not.toHaveBeenCalled();
    });

    it("returns false when the current row cannot be read", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new GoodsReceiptRepository(client).bumpPoItemReceived("poi-1", 5)
      ).toBe(false);
    });

    it("returns false when the update fails", async () => {
      const { client } = createMockClient([
        { data: { received_quantity: 1 }, error: null },
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new GoodsReceiptRepository(client).bumpPoItemReceived("poi-1", 5)
      ).toBe(false);
    });
  });

  describe("setPoStatus", () => {
    it("updates the PO status and stamps updated_by/updated_at", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const result = await new GoodsReceiptRepository(client).setPoStatus(
        "po-1",
        "completed",
        "user-9"
      );
      expect(result).toBe(true);
      const patch = builders[0].update.mock.calls[0][0] as Record<string, unknown>;
      expect(patch.status).toBe("completed");
      expect(patch.updated_by).toBe("user-9");
      expect(typeof patch.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "po-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns false on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      expect(
        await new GoodsReceiptRepository(client).setPoStatus(
          "po-1",
          "partially_received",
          "user-9"
        )
      ).toBe(false);
    });
  });
});
