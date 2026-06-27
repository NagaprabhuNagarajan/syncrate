import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { BrandRepository } from "./brand.repository";

type DbBrand = Database["public"]["Tables"]["brands"]["Row"];

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

function buildDbBrand(overrides: Partial<DbBrand> = {}): DbBrand {
  return {
    id: "brand-1",
    organization_id: "org-1",
    name: "Samsung",
    description: "Consumer electronics",
    status: "active",
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

describe("BrandRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB brand row to the domain Brand", async () => {
      const row = buildDbBrand();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new BrandRepository(client);

      const brand = await repo.findById("brand-1");

      expect(brand).toEqual({
        id: "brand-1",
        organizationId: "org-1",
        name: "Samsung",
        description: "Consumer electronics",
        status: "active",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: "user-1",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("id", "brand-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new BrandRepository(client);
      expect(await repo.findById("brand-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new BrandRepository(client);
      expect(await repo.findById("brand-1")).toBeNull();
    });
  });

  describe("findByName", () => {
    it("trims the name and maps the brand", async () => {
      const row = buildDbBrand();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new BrandRepository(client);

      const brand = await repo.findByName("org-1", "  Samsung  ");
      expect(brand?.id).toBe("brand-1");
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].eq).toHaveBeenCalledWith("name", "Samsung");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new BrandRepository(client);
      expect(await repo.findByName("org-1", "Samsung")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new BrandRepository(client);
      expect(await repo.findByName("org-1", "Samsung")).toBeNull();
    });
  });

  describe("list", () => {
    it("maps items, returns count as total, and applies default pagination/sort", async () => {
      const rows = [
        buildDbBrand({ id: "brand-1" }),
        buildDbBrand({ id: "brand-2" }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 42 },
      ]);
      const repo = new BrandRepository(client);

      const result = await repo.list("org-1");

      expect(result.items.map((b) => b.id)).toEqual(["brand-1", "brand-2"]);
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

    it("applies a status filter, search and pagination range", async () => {
      const { client, builders } = createMockClient([
        { data: [buildDbBrand()], error: null, count: 1 },
      ]);
      const repo = new BrandRepository(client);

      const result = await repo.list("org-1", {
        status: "active",
        search: "sam",
        page: 3,
        pageSize: 10,
      });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(builders[0].eq).toHaveBeenCalledWith("status", "active");
      expect(builders[0].or).toHaveBeenCalledWith(
        "name.ilike.%sam%,description.ilike.%sam%"
      );
      expect(builders[0].range).toHaveBeenCalledWith(20, 29);
    });

    it("skips the search filter when the sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new BrandRepository(client);

      await repo.list("org-1", { search: "()," });
      expect(builders[0].or).not.toHaveBeenCalled();
    });

    it("returns an empty result with page/pageSize on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const repo = new BrandRepository(client);

      const result = await repo.list("org-1", { page: 2, pageSize: 5 });
      expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 5 });
    });

    it("defaults total to 0 when count is null", async () => {
      const { client } = createMockClient([
        { data: [buildDbBrand()], error: null, count: null },
      ]);
      const repo = new BrandRepository(client);

      const result = await repo.list("org-1");
      expect(result.total).toBe(0);
    });

    it("clamps page and pageSize to safe bounds", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new BrandRepository(client);

      await repo.list("org-1", { page: 0, pageSize: 1000 });
      expect(builders[0].range).toHaveBeenCalledWith(0, 99);
    });
  });

  describe("create", () => {
    it("inserts the row and maps the created brand", async () => {
      const row = buildDbBrand();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new BrandRepository(client);

      const brand = await repo.create({
        organization_id: "org-1",
        name: "Samsung",
      });

      expect(brand?.id).toBe("brand-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.organization_id).toBe("org-1");
      expect(insertArg.name).toBe("Samsung");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "dup" } },
      ]);
      const repo = new BrandRepository(client);
      expect(
        await repo.create({ organization_id: "org-1", name: "X" })
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new BrandRepository(client);
      expect(
        await repo.create({ organization_id: "org-1", name: "X" })
      ).toBeNull();
    });
  });

  describe("update", () => {
    it("applies the patch, sets updated_by/updated_at, and maps the result", async () => {
      const row = buildDbBrand({ name: "Renamed" });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new BrandRepository(client);

      const brand = await repo.update("brand-1", { name: "Renamed" }, "user-9");

      expect(brand?.name).toBe("Renamed");
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.name).toBe("Renamed");
      expect(patchArg.updated_by).toBe("user-9");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "brand-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new BrandRepository(client);
      expect(await repo.update("brand-1", { name: "x" }, "user-9")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new BrandRepository(client);
      expect(await repo.update("brand-1", { name: "x" }, "user-9")).toBeNull();
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at/deleted_by/status and returns true on success", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const repo = new BrandRepository(client);

      const result = await repo.softDelete("brand-1", "user-9");
      expect(result).toBe(true);
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(typeof patchArg.deleted_at).toBe("string");
      expect(patchArg.deleted_by).toBe("user-9");
      expect(patchArg.status).toBe("archived");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "brand-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns false when the update errors", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new BrandRepository(client);
      expect(await repo.softDelete("brand-1", "user-9")).toBe(false);
    });
  });
});
