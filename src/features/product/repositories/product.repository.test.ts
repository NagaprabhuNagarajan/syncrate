import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { ProductRepository } from "./product.repository";

type DbProduct = Database["public"]["Tables"]["products"]["Row"];

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
      or: vi.fn(() => builder),
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

function buildDbProduct(overrides: Partial<DbProduct> = {}): DbProduct {
  return {
    id: "prod-1",
    organization_id: "org-1",
    code: "PROD-00001",
    name: "Premium Widget",
    description: "A widget",
    type: "inventory",
    status: "active",
    category_id: "cat-1",
    brand_id: "brand-1",
    unit_id: "unit-1",
    manufacturer: "Acme",
    hsn_code: "3402",
    gst_rate: 18,
    tax_inclusive: false,
    purchase_price: 100,
    selling_price: 199.5,
    dealer_price: 150,
    wholesale_price: 160,
    retail_price: 250,
    min_selling_price: 120,
    sku: "SKU-001",
    barcode: "8901234567890",
    qr_code: null,
    track_inventory: true,
    reorder_level: 10,
    max_stock: 500,
    opening_stock: 50,
    preferred_supplier_id: "sup-1",
    is_seasonal: false,
    is_fast_moving: false,
    is_slow_moving: false,
    ai_tags: [],
    tags: ["featured"],
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

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ProductRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB product row to the domain Product", async () => {
      const row = buildDbProduct();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new ProductRepository(client);

      const product = await repo.findById("prod-1");

      expect(product).toEqual({
        id: "prod-1",
        organizationId: "org-1",
        code: "PROD-00001",
        name: "Premium Widget",
        description: "A widget",
        type: "inventory",
        status: "active",
        categoryId: "cat-1",
        brandId: "brand-1",
        unitId: "unit-1",
        manufacturer: "Acme",
        hsnCode: "3402",
        gstRate: 18,
        taxInclusive: false,
        purchasePrice: 100,
        sellingPrice: 199.5,
        dealerPrice: 150,
        wholesalePrice: 160,
        retailPrice: 250,
        minSellingPrice: 120,
        sku: "SKU-001",
        barcode: "8901234567890",
        qrCode: null,
        trackInventory: true,
        reorderLevel: 10,
        maxStock: 500,
        openingStock: 50,
        preferredSupplierId: "sup-1",
        isSeasonal: false,
        isFastMoving: false,
        isSlowMoving: false,
        aiTags: [],
        tags: ["featured"],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: "user-1",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("id", "prod-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("converts numeric strings via Number()", async () => {
      const row = buildDbProduct({
        selling_price: "299.99" as unknown as number,
        reorder_level: "25" as unknown as number,
      });
      const { client } = createMockClient([{ data: row, error: null }]);
      const repo = new ProductRepository(client);

      const product = await repo.findById("prod-1");
      expect(product?.sellingPrice).toBe(299.99);
      expect(product?.reorderLevel).toBe(25);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new ProductRepository(client);
      expect(await repo.findById("prod-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new ProductRepository(client);
      expect(await repo.findById("prod-1")).toBeNull();
    });
  });

  describe("findByField", () => {
    it("trims the value and maps the product (code)", async () => {
      const row = buildDbProduct();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new ProductRepository(client);

      const product = await repo.findByField("org-1", "code", "  PROD-00001  ");
      expect(product?.id).toBe("prod-1");
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].eq).toHaveBeenCalledWith("code", "PROD-00001");
    });

    it("queries by sku", async () => {
      const row = buildDbProduct();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new ProductRepository(client);

      await repo.findByField("org-1", "sku", "SKU-001");
      expect(builders[0].eq).toHaveBeenCalledWith("sku", "SKU-001");
    });

    it("queries by barcode", async () => {
      const row = buildDbProduct();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new ProductRepository(client);

      await repo.findByField("org-1", "barcode", "8901234567890");
      expect(builders[0].eq).toHaveBeenCalledWith("barcode", "8901234567890");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new ProductRepository(client);
      expect(await repo.findByField("org-1", "code", "X")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new ProductRepository(client);
      expect(await repo.findByField("org-1", "code", "X")).toBeNull();
    });
  });

  describe("list", () => {
    it("maps items, returns count as total, and applies default pagination/sort", async () => {
      const rows = [
        buildDbProduct({ id: "prod-1" }),
        buildDbProduct({ id: "prod-2" }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 42 },
      ]);
      const repo = new ProductRepository(client);

      const result = await repo.list("org-1");

      expect(result.items.map((p) => p.id)).toEqual(["prod-1", "prod-2"]);
      expect(result.total).toBe(42);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 19);
    });

    it("applies status, type, search, custom sort and pagination range", async () => {
      const { client, builders } = createMockClient([
        { data: [buildDbProduct()], error: null, count: 1 },
      ]);
      const repo = new ProductRepository(client);

      const result = await repo.list("org-1", {
        status: "active",
        type: "service",
        search: "widget",
        page: 3,
        pageSize: 10,
        sortBy: "created_at",
        sortDir: "desc",
      });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(builders[0].eq).toHaveBeenCalledWith("status", "active");
      expect(builders[0].eq).toHaveBeenCalledWith("type", "service");
      expect(builders[0].or).toHaveBeenCalledWith(
        "name.ilike.%widget%,code.ilike.%widget%,sku.ilike.%widget%,barcode.ilike.%widget%"
      );
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(builders[0].range).toHaveBeenCalledWith(20, 29);
    });

    it("applies category and brand filters", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new ProductRepository(client);

      await repo.list("org-1", { categoryId: "cat-1", brandId: "brand-1" });
      expect(builders[0].eq).toHaveBeenCalledWith("category_id", "cat-1");
      expect(builders[0].eq).toHaveBeenCalledWith("brand_id", "brand-1");
    });

    it("skips the search filter when the sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new ProductRepository(client);

      await repo.list("org-1", { search: "()," });
      expect(builders[0].or).not.toHaveBeenCalled();
    });

    it("returns an empty result with page/pageSize on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const repo = new ProductRepository(client);

      const result = await repo.list("org-1", { page: 2, pageSize: 5 });
      expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 5 });
    });

    it("defaults total to 0 when count is null", async () => {
      const { client } = createMockClient([
        { data: [buildDbProduct()], error: null, count: null },
      ]);
      const repo = new ProductRepository(client);

      const result = await repo.list("org-1");
      expect(result.total).toBe(0);
    });

    it("clamps page and pageSize to safe bounds", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new ProductRepository(client);

      await repo.list("org-1", { page: 0, pageSize: 1000 });
      expect(builders[0].range).toHaveBeenCalledWith(0, 99);
    });
  });

  describe("findAllForExport", () => {
    it("maps every row and orders by name ascending", async () => {
      const rows = [
        buildDbProduct({ id: "prod-1", name: "Alpha" }),
        buildDbProduct({ id: "prod-2", name: "Beta" }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null },
      ]);
      const repo = new ProductRepository(client);

      const products = await repo.findAllForExport("org-1");

      expect(products.map((p) => p.id)).toEqual(["prod-1", "prod-2"]);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 999);
    });

    it("returns an empty array on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new ProductRepository(client);
      expect(await repo.findAllForExport("org-1")).toEqual([]);
    });

    it("returns an empty array when there are no rows", async () => {
      const { client } = createMockClient([{ data: [], error: null }]);
      const repo = new ProductRepository(client);
      expect(await repo.findAllForExport("org-1")).toEqual([]);
    });
  });

  describe("create", () => {
    it("inserts the row and maps the created product", async () => {
      const row = buildDbProduct();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new ProductRepository(client);

      const product = await repo.create({
        organization_id: "org-1",
        code: "PROD-00001",
        name: "Premium Widget",
      });

      expect(product?.id).toBe("prod-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.organization_id).toBe("org-1");
      expect(insertArg.code).toBe("PROD-00001");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "dup" } },
      ]);
      const repo = new ProductRepository(client);
      expect(
        await repo.create({ organization_id: "org-1", code: "X", name: "X" })
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new ProductRepository(client);
      expect(
        await repo.create({ organization_id: "org-1", code: "X", name: "X" })
      ).toBeNull();
    });
  });

  describe("update", () => {
    it("applies the patch, sets updated_by/updated_at, and maps the result", async () => {
      const row = buildDbProduct({ name: "Renamed" });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new ProductRepository(client);

      const product = await repo.update("prod-1", { name: "Renamed" }, "user-9");

      expect(product?.name).toBe("Renamed");
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.name).toBe("Renamed");
      expect(patchArg.updated_by).toBe("user-9");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "prod-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new ProductRepository(client);
      expect(await repo.update("prod-1", { name: "x" }, "user-9")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new ProductRepository(client);
      expect(await repo.update("prod-1", { name: "x" }, "user-9")).toBeNull();
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at/deleted_by/status and returns true on success", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const repo = new ProductRepository(client);

      const result = await repo.softDelete("prod-1", "user-9");
      expect(result).toBe(true);
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(typeof patchArg.deleted_at).toBe("string");
      expect(patchArg.deleted_by).toBe("user-9");
      expect(patchArg.status).toBe("archived");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "prod-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns false when the update errors", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new ProductRepository(client);
      expect(await repo.softDelete("prod-1", "user-9")).toBe(false);
    });
  });
});
