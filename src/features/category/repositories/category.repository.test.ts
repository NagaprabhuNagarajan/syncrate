import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { CategoryRepository } from "./category.repository";

type DbCategory = Database["public"]["Tables"]["categories"]["Row"];

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

function buildDbCategory(overrides: Partial<DbCategory> = {}): DbCategory {
  return {
    id: "cat-1",
    organization_id: "org-1",
    parent_id: null,
    name: "Electronics",
    description: "Electronic goods",
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

describe("CategoryRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB category row to the domain Category", async () => {
      const row = buildDbCategory();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new CategoryRepository(client);

      const category = await repo.findById("cat-1");

      expect(category).toEqual({
        id: "cat-1",
        organizationId: "org-1",
        parentId: null,
        name: "Electronics",
        description: "Electronic goods",
        status: "active",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: "user-1",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("id", "cat-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new CategoryRepository(client);
      expect(await repo.findById("cat-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new CategoryRepository(client);
      expect(await repo.findById("cat-1")).toBeNull();
    });
  });

  describe("findByName", () => {
    it("scopes to root categories when parentId is null", async () => {
      const row = buildDbCategory();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new CategoryRepository(client);

      const category = await repo.findByName("org-1", "  Electronics  ");
      expect(category?.id).toBe("cat-1");
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].eq).toHaveBeenCalledWith("name", "Electronics");
      expect(builders[0].is).toHaveBeenCalledWith("parent_id", null);
    });

    it("scopes to a parent when parentId is provided", async () => {
      const row = buildDbCategory({ parent_id: "cat-parent" });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new CategoryRepository(client);

      const category = await repo.findByName("org-1", "Phones", "cat-parent");
      expect(category?.id).toBe("cat-1");
      expect(builders[0].eq).toHaveBeenCalledWith("parent_id", "cat-parent");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CategoryRepository(client);
      expect(await repo.findByName("org-1", "Phones")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new CategoryRepository(client);
      expect(await repo.findByName("org-1", "Phones")).toBeNull();
    });
  });

  describe("list", () => {
    it("maps items, returns count as total, and applies default pagination/sort", async () => {
      const rows = [
        buildDbCategory({ id: "cat-1" }),
        buildDbCategory({ id: "cat-2" }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 5 },
      ]);
      const repo = new CategoryRepository(client);

      const result = await repo.list("org-1");

      expect(result.items.map((c) => c.id)).toEqual(["cat-1", "cat-2"]);
      expect(result.total).toBe(5);
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
        { data: [buildDbCategory()], error: null, count: 1 },
      ]);
      const repo = new CategoryRepository(client);

      const result = await repo.list("org-1", {
        status: "active",
        search: "elec",
        page: 3,
        pageSize: 10,
      });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(builders[0].eq).toHaveBeenCalledWith("status", "active");
      expect(builders[0].or).toHaveBeenCalledWith(
        "name.ilike.%elec%,description.ilike.%elec%"
      );
      expect(builders[0].range).toHaveBeenCalledWith(20, 29);
    });

    it("skips the search filter when the sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new CategoryRepository(client);

      await repo.list("org-1", { search: "()," });
      expect(builders[0].or).not.toHaveBeenCalled();
    });

    it("returns an empty result with page/pageSize on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const repo = new CategoryRepository(client);

      const result = await repo.list("org-1", { page: 2, pageSize: 5 });
      expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 5 });
    });

    it("defaults total to 0 when count is null", async () => {
      const { client } = createMockClient([
        { data: [buildDbCategory()], error: null, count: null },
      ]);
      const repo = new CategoryRepository(client);

      const result = await repo.list("org-1");
      expect(result.total).toBe(0);
    });

    it("clamps page and pageSize to safe bounds", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new CategoryRepository(client);

      await repo.list("org-1", { page: 0, pageSize: 1000 });
      expect(builders[0].range).toHaveBeenCalledWith(0, 99);
    });
  });

  describe("listAll", () => {
    it("maps every row and orders by name ascending", async () => {
      const rows = [
        buildDbCategory({ id: "cat-1", name: "Apparel" }),
        buildDbCategory({ id: "cat-2", name: "Books" }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null },
      ]);
      const repo = new CategoryRepository(client);

      const categories = await repo.listAll("org-1");

      expect(categories.map((c) => c.id)).toEqual(["cat-1", "cat-2"]);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
    });

    it("returns an empty array on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new CategoryRepository(client);
      expect(await repo.listAll("org-1")).toEqual([]);
    });
  });

  describe("create", () => {
    it("inserts the row and maps the created category", async () => {
      const row = buildDbCategory();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new CategoryRepository(client);

      const category = await repo.create({
        organization_id: "org-1",
        name: "Electronics",
      });

      expect(category?.id).toBe("cat-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.organization_id).toBe("org-1");
      expect(insertArg.name).toBe("Electronics");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "dup" } },
      ]);
      const repo = new CategoryRepository(client);
      expect(
        await repo.create({ organization_id: "org-1", name: "X" })
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new CategoryRepository(client);
      expect(
        await repo.create({ organization_id: "org-1", name: "X" })
      ).toBeNull();
    });
  });

  describe("update", () => {
    it("applies the patch, sets updated_by/updated_at, and maps the result", async () => {
      const row = buildDbCategory({ name: "Renamed" });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new CategoryRepository(client);

      const category = await repo.update("cat-1", { name: "Renamed" }, "user-9");

      expect(category?.name).toBe("Renamed");
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.name).toBe("Renamed");
      expect(patchArg.updated_by).toBe("user-9");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "cat-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CategoryRepository(client);
      expect(await repo.update("cat-1", { name: "x" }, "user-9")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new CategoryRepository(client);
      expect(await repo.update("cat-1", { name: "x" }, "user-9")).toBeNull();
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at/deleted_by/status and returns true on success", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const repo = new CategoryRepository(client);

      const result = await repo.softDelete("cat-1", "user-9");
      expect(result).toBe(true);
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(typeof patchArg.deleted_at).toBe("string");
      expect(patchArg.deleted_by).toBe("user-9");
      expect(patchArg.status).toBe("archived");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "cat-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns false when the update errors", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new CategoryRepository(client);
      expect(await repo.softDelete("cat-1", "user-9")).toBe(false);
    });
  });
});
