import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { CatalogRepository } from "./catalog.repository";

type DbRow = Database["public"]["Tables"]["supplier_catalog_items"]["Row"];
type DbSearchRow =
  Database["public"]["Functions"]["search_supplier_catalog"]["Returns"][number];

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface MockBuilder {
  select: Mock;
  eq: Mock;
  is: Mock;
  order: Mock;
  update: Mock;
  upsert: Mock;
  single: Mock;
}

interface MockClient {
  client: AppSupabaseClient;
  from: Mock;
  rpc: Mock;
  builders: MockBuilder[];
}

function createMockClient(
  fromResults: QueryResult[],
  rpcResult: QueryResult = { data: null, error: null }
): MockClient {
  const builders: MockBuilder[] = [];
  let index = 0;

  const from = vi.fn(() => {
    const result = fromResults[index] ?? { data: null, error: null };
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
      order: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };

    builders.push(builder);
    return builder;
  });

  const rpc = vi.fn(() => Promise.resolve(rpcResult));
  const client = { from, rpc } as unknown as AppSupabaseClient;
  return { client, from, rpc, builders };
}

function buildRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    id: "cat-1",
    organization_id: "org-1",
    product_id: "prod-1",
    catalog_price: 99.5,
    currency: "INR",
    moq: 10,
    lead_time_days: 7,
    stock_availability: "available",
    is_published: true,
    catalog_notes: "fresh stock",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    deleted_at: null,
    created_by: "user-1",
    updated_by: null,
    deleted_by: null,
    version: 1,
    ...overrides,
  };
}

function buildSearchRow(overrides: Partial<DbSearchRow> = {}): DbSearchRow {
  return {
    id: "cat-1",
    product_id: "prod-1",
    product_name: "Widget",
    product_sku: "WIDGET-01",
    catalog_price: 99.5,
    currency: "INR",
    moq: 10,
    lead_time_days: 7,
    stock_availability: "available",
    catalog_notes: "fresh stock",
    ...overrides,
  };
}

describe("CatalogRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("listByOrg", () => {
    it("maps rows with numeric price conversion and ordering", async () => {
      const rows = [
        buildRow({ id: "c1", catalog_price: "150.25" as unknown as number }),
        buildRow({ id: "c2" }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null },
      ]);
      const repo = new CatalogRepository(client);

      const items = await repo.listByOrg("org-1");
      expect(items.map((c) => c.id)).toEqual(["c1", "c2"]);
      expect(items[0].catalogPrice).toBe(150.25);
      expect(items[0].stockAvailability).toBe("available");
      expect(items[0].createdAt).toBeInstanceOf(Date);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CatalogRepository(client);
      expect(await repo.listByOrg("org-1")).toEqual([]);
    });
  });

  describe("findById", () => {
    it("maps the row", async () => {
      const { client, builders } = createMockClient([
        { data: buildRow(), error: null },
      ]);
      const repo = new CatalogRepository(client);

      const item = await repo.findById("cat-1");
      expect(item?.id).toBe("cat-1");
      expect(item?.leadTimeDays).toBe(7);
      expect(builders[0].eq).toHaveBeenCalledWith("id", "cat-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CatalogRepository(client);
      expect(await repo.findById("cat-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new CatalogRepository(client);
      expect(await repo.findById("cat-1")).toBeNull();
    });
  });

  describe("upsert", () => {
    it("upserts with the org id and onConflict target", async () => {
      const { client, builders } = createMockClient([
        { data: buildRow(), error: null },
      ]);
      const repo = new CatalogRepository(client);

      const item = await repo.upsert("org-1", {
        productId: "prod-1",
        catalogPrice: 99.5,
        currency: "INR",
        moq: 10,
        leadTimeDays: 7,
        stockAvailability: "available",
        isPublished: true,
        catalogNotes: "fresh stock",
      });

      expect(item?.id).toBe("cat-1");
      const payload = builders[0].upsert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload.organization_id).toBe("org-1");
      expect(payload.product_id).toBe("prod-1");
      expect(payload.catalog_price).toBe(99.5);
      expect(payload.lead_time_days).toBe(7);
      const options = builders[0].upsert.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(options.onConflict).toBe("organization_id,product_id");
    });

    it("coerces an omitted lead time to null", async () => {
      const { client, builders } = createMockClient([
        { data: buildRow(), error: null },
      ]);
      const repo = new CatalogRepository(client);

      await repo.upsert("org-1", {
        productId: "prod-1",
        catalogPrice: 50,
        currency: "INR",
        moq: 1,
        stockAvailability: "available",
        isPublished: false,
      });
      const payload = builders[0].upsert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload.lead_time_days).toBeNull();
      expect(payload.catalog_notes).toBeNull();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CatalogRepository(client);
      expect(
        await repo.upsert("org-1", {
          productId: "prod-1",
          catalogPrice: 50,
          currency: "INR",
          moq: 1,
          stockAvailability: "available",
          isPublished: false,
        })
      ).toBeNull();
    });
  });

  describe("update", () => {
    it("builds a patch only from defined fields", async () => {
      const { client, builders } = createMockClient([
        { data: buildRow({ catalog_price: 120 }), error: null },
      ]);
      const repo = new CatalogRepository(client);

      const item = await repo.update("cat-1", {
        catalogPrice: 120,
        isPublished: false,
      });
      expect(item?.catalogPrice).toBe(120);
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch).toEqual({ catalog_price: 120, is_published: false });
      expect(builders[0].eq).toHaveBeenCalledWith("id", "cat-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("maps every updatable field including nullable coercions", async () => {
      const { client, builders } = createMockClient([
        { data: buildRow(), error: null },
      ]);
      const repo = new CatalogRepository(client);

      await repo.update("cat-1", {
        catalogPrice: 10,
        currency: "USD",
        moq: 5,
        leadTimeDays: null,
        stockAvailability: "limited",
        isPublished: true,
        catalogNotes: null,
      });
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch).toEqual({
        catalog_price: 10,
        currency: "USD",
        moq: 5,
        lead_time_days: null,
        stock_availability: "limited",
        is_published: true,
        catalog_notes: null,
      });
    });

    it("sends an empty patch when nothing is provided", async () => {
      const { client, builders } = createMockClient([
        { data: buildRow(), error: null },
      ]);
      const repo = new CatalogRepository(client);

      await repo.update("cat-1", {});
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch).toEqual({});
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CatalogRepository(client);
      expect(await repo.update("cat-1", { moq: 2 })).toBeNull();
    });
  });

  describe("setPublished", () => {
    it("updates is_published and returns true", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const repo = new CatalogRepository(client);

      const ok = await repo.setPublished("cat-1", true);
      expect(ok).toBe(true);
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.is_published).toBe(true);
      expect(builders[0].eq).toHaveBeenCalledWith("id", "cat-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns false on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CatalogRepository(client);
      expect(await repo.setPublished("cat-1", false)).toBe(false);
    });
  });

  describe("searchConnectedSupplierCatalog", () => {
    it("calls the RPC with defaults and maps results", async () => {
      const { client, rpc } = createMockClient([], {
        data: [buildSearchRow()],
        error: null,
      });
      const repo = new CatalogRepository(client);

      const results = await repo.searchConnectedSupplierCatalog("sup-1");
      expect(rpc).toHaveBeenCalledWith("search_supplier_catalog", {
        p_supplier_org_id: "sup-1",
        p_query: "",
        p_limit: 20,
        p_offset: 0,
      });
      expect(results).toEqual([
        {
          id: "cat-1",
          productId: "prod-1",
          productName: "Widget",
          productSku: "WIDGET-01",
          catalogPrice: 99.5,
          currency: "INR",
          moq: 10,
          leadTimeDays: 7,
          stockAvailability: "available",
          catalogNotes: "fresh stock",
        },
      ]);
    });

    it("forwards a provided query, limit and offset", async () => {
      const { client, rpc } = createMockClient([], { data: [], error: null });
      const repo = new CatalogRepository(client);

      await repo.searchConnectedSupplierCatalog("sup-1", "widget", 50, 5);
      expect(rpc).toHaveBeenCalledWith("search_supplier_catalog", {
        p_supplier_org_id: "sup-1",
        p_query: "widget",
        p_limit: 50,
        p_offset: 5,
      });
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([], {
        data: null,
        error: { message: "x" },
      });
      const repo = new CatalogRepository(client);
      expect(await repo.searchConnectedSupplierCatalog("sup-1")).toEqual([]);
    });

    it("returns [] when data is null", async () => {
      const { client } = createMockClient([], { data: null, error: null });
      const repo = new CatalogRepository(client);
      expect(await repo.searchConnectedSupplierCatalog("sup-1")).toEqual([]);
    });
  });
});
