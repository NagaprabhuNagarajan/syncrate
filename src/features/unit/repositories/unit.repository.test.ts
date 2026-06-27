import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { UnitRepository } from "./unit.repository";

type DbUnit = Database["public"]["Tables"]["units"]["Row"];

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

function buildDbUnit(overrides: Partial<DbUnit> = {}): DbUnit {
  return {
    id: "unit-1",
    organization_id: "org-1",
    name: "Kilogram",
    symbol: "kg",
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

describe("UnitRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB unit row to the domain Unit", async () => {
      const row = buildDbUnit();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new UnitRepository(client);

      const unit = await repo.findById("unit-1");

      expect(unit).toEqual({
        id: "unit-1",
        organizationId: "org-1",
        name: "Kilogram",
        symbol: "kg",
        status: "active",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: "user-1",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("id", "unit-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new UnitRepository(client);
      expect(await repo.findById("unit-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new UnitRepository(client);
      expect(await repo.findById("unit-1")).toBeNull();
    });
  });

  describe("findByName", () => {
    it("trims the name and maps the unit", async () => {
      const row = buildDbUnit();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new UnitRepository(client);

      const unit = await repo.findByName("org-1", "  Kilogram  ");
      expect(unit?.id).toBe("unit-1");
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].eq).toHaveBeenCalledWith("name", "Kilogram");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new UnitRepository(client);
      expect(await repo.findByName("org-1", "Kilogram")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new UnitRepository(client);
      expect(await repo.findByName("org-1", "Kilogram")).toBeNull();
    });
  });

  describe("list", () => {
    it("maps items, returns count as total, and applies default pagination/sort", async () => {
      const rows = [
        buildDbUnit({ id: "unit-1" }),
        buildDbUnit({ id: "unit-2" }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 12 },
      ]);
      const repo = new UnitRepository(client);

      const result = await repo.list("org-1");

      expect(result.items.map((u) => u.id)).toEqual(["unit-1", "unit-2"]);
      expect(result.total).toBe(12);
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
        { data: [buildDbUnit()], error: null, count: 1 },
      ]);
      const repo = new UnitRepository(client);

      const result = await repo.list("org-1", {
        status: "active",
        search: "kg",
        page: 3,
        pageSize: 10,
      });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(builders[0].eq).toHaveBeenCalledWith("status", "active");
      expect(builders[0].or).toHaveBeenCalledWith(
        "name.ilike.%kg%,symbol.ilike.%kg%"
      );
      expect(builders[0].range).toHaveBeenCalledWith(20, 29);
    });

    it("skips the search filter when the sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new UnitRepository(client);

      await repo.list("org-1", { search: "()," });
      expect(builders[0].or).not.toHaveBeenCalled();
    });

    it("returns an empty result with page/pageSize on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const repo = new UnitRepository(client);

      const result = await repo.list("org-1", { page: 2, pageSize: 5 });
      expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 5 });
    });

    it("defaults total to 0 when count is null", async () => {
      const { client } = createMockClient([
        { data: [buildDbUnit()], error: null, count: null },
      ]);
      const repo = new UnitRepository(client);

      const result = await repo.list("org-1");
      expect(result.total).toBe(0);
    });

    it("clamps page and pageSize to safe bounds", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new UnitRepository(client);

      await repo.list("org-1", { page: 0, pageSize: 1000 });
      expect(builders[0].range).toHaveBeenCalledWith(0, 99);
    });
  });

  describe("create", () => {
    it("inserts the row and maps the created unit", async () => {
      const row = buildDbUnit();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new UnitRepository(client);

      const unit = await repo.create({
        organization_id: "org-1",
        name: "Kilogram",
        symbol: "kg",
      });

      expect(unit?.id).toBe("unit-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.organization_id).toBe("org-1");
      expect(insertArg.name).toBe("Kilogram");
      expect(insertArg.symbol).toBe("kg");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "dup" } },
      ]);
      const repo = new UnitRepository(client);
      expect(
        await repo.create({
          organization_id: "org-1",
          name: "X",
          symbol: "x",
        })
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new UnitRepository(client);
      expect(
        await repo.create({
          organization_id: "org-1",
          name: "X",
          symbol: "x",
        })
      ).toBeNull();
    });
  });

  describe("update", () => {
    it("applies the patch, sets updated_by/updated_at, and maps the result", async () => {
      const row = buildDbUnit({ name: "Gram" });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new UnitRepository(client);

      const unit = await repo.update("unit-1", { name: "Gram" }, "user-9");

      expect(unit?.name).toBe("Gram");
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.name).toBe("Gram");
      expect(patchArg.updated_by).toBe("user-9");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "unit-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new UnitRepository(client);
      expect(await repo.update("unit-1", { name: "x" }, "user-9")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new UnitRepository(client);
      expect(await repo.update("unit-1", { name: "x" }, "user-9")).toBeNull();
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at/deleted_by/status and returns true on success", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const repo = new UnitRepository(client);

      const result = await repo.softDelete("unit-1", "user-9");
      expect(result).toBe(true);
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(typeof patchArg.deleted_at).toBe("string");
      expect(patchArg.deleted_by).toBe("user-9");
      expect(patchArg.status).toBe("archived");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "unit-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns false when the update errors", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new UnitRepository(client);
      expect(await repo.softDelete("unit-1", "user-9")).toBe(false);
    });
  });
});
