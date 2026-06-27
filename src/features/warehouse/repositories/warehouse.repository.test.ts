import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { WarehouseRepository } from "./warehouse.repository";

type DbWarehouse = Database["public"]["Tables"]["warehouses"]["Row"];

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
      neq: vi.fn(() => builder),
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

function buildDbWarehouse(overrides: Partial<DbWarehouse> = {}): DbWarehouse {
  return {
    id: "wh-1",
    organization_id: "org-1",
    branch_id: null,
    code: "WH-01",
    name: "Chennai Central",
    address_line1: "10 Mount Road",
    city: "Chennai",
    state: "TN",
    pincode: "600001",
    capacity: 1000,
    is_default: true,
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

describe("WarehouseRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB warehouse row to the domain Warehouse", async () => {
      const row = buildDbWarehouse();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new WarehouseRepository(client);

      const warehouse = await repo.findById("wh-1");

      expect(warehouse).toEqual({
        id: "wh-1",
        organizationId: "org-1",
        branchId: null,
        code: "WH-01",
        name: "Chennai Central",
        addressLine1: "10 Mount Road",
        city: "Chennai",
        state: "TN",
        pincode: "600001",
        capacity: 1000,
        isDefault: true,
        status: "active",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: "user-1",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("id", "wh-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("maps a null capacity to null", async () => {
      const { client } = createMockClient([
        { data: buildDbWarehouse({ capacity: null }), error: null },
      ]);
      const repo = new WarehouseRepository(client);
      const warehouse = await repo.findById("wh-1");
      expect(warehouse?.capacity).toBeNull();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new WarehouseRepository(client);
      expect(await repo.findById("wh-1")).toBeNull();
    });
  });

  describe("findByCode", () => {
    it("uppercases/trims the code", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbWarehouse(), error: null },
      ]);
      const repo = new WarehouseRepository(client);

      const warehouse = await repo.findByCode("org-1", "  wh-01  ");
      expect(warehouse?.id).toBe("wh-1");
      expect(builders[0].eq).toHaveBeenCalledWith("code", "WH-01");
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new WarehouseRepository(client);
      expect(await repo.findByCode("org-1", "WH-01")).toBeNull();
    });
  });

  describe("list", () => {
    it("maps items, returns count, and applies defaults", async () => {
      const rows = [
        buildDbWarehouse({ id: "wh-1" }),
        buildDbWarehouse({ id: "wh-2" }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 5 },
      ]);
      const repo = new WarehouseRepository(client);

      const result = await repo.list("org-1");

      expect(result.items.map((w) => w.id)).toEqual(["wh-1", "wh-2"]);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(builders[0].order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 19);
    });

    it("applies status filter, search and custom pagination", async () => {
      const { client, builders } = createMockClient([
        { data: [buildDbWarehouse()], error: null, count: 1 },
      ]);
      const repo = new WarehouseRepository(client);

      await repo.list("org-1", {
        status: "active",
        search: "chennai",
        page: 2,
        pageSize: 10,
        sortBy: "code",
        sortDir: "desc",
      });

      expect(builders[0].eq).toHaveBeenCalledWith("status", "active");
      expect(builders[0].or).toHaveBeenCalledWith(
        "name.ilike.%chennai%,code.ilike.%chennai%,city.ilike.%chennai%"
      );
      expect(builders[0].order).toHaveBeenCalledWith("code", {
        ascending: false,
      });
      expect(builders[0].range).toHaveBeenCalledWith(10, 19);
    });

    it("skips search when sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new WarehouseRepository(client);
      await repo.list("org-1", { search: "()," });
      expect(builders[0].or).not.toHaveBeenCalled();
    });

    it("returns empty result on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" }, count: null },
      ]);
      const repo = new WarehouseRepository(client);
      const result = await repo.list("org-1", { page: 3, pageSize: 5 });
      expect(result).toEqual({ items: [], total: 0, page: 3, pageSize: 5 });
    });
  });

  describe("listOptions", () => {
    it("returns lightweight options excluding archived", async () => {
      const { client, builders } = createMockClient([
        {
          data: [{ id: "wh-1", code: "WH-01", name: "Main" }],
          error: null,
        },
      ]);
      const repo = new WarehouseRepository(client);

      const options = await repo.listOptions("org-1");
      expect(options).toEqual([{ id: "wh-1", code: "WH-01", name: "Main" }]);
      expect(builders[0].neq).toHaveBeenCalledWith("status", "archived");
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new WarehouseRepository(client);
      expect(await repo.listOptions("org-1")).toEqual([]);
    });
  });

  describe("create", () => {
    it("inserts and maps the warehouse", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbWarehouse(), error: null },
      ]);
      const repo = new WarehouseRepository(client);

      const warehouse = await repo.create({
        organization_id: "org-1",
        code: "WH-01",
        name: "Chennai Central",
      });

      expect(warehouse?.id).toBe("wh-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.code).toBe("WH-01");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "dup" } },
      ]);
      const repo = new WarehouseRepository(client);
      expect(
        await repo.create({
          organization_id: "org-1",
          code: "X",
          name: "X",
        })
      ).toBeNull();
    });
  });

  describe("update", () => {
    it("applies the patch and sets updated_by/updated_at", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbWarehouse({ name: "Renamed" }), error: null },
      ]);
      const repo = new WarehouseRepository(client);

      const warehouse = await repo.update("wh-1", { name: "Renamed" }, "user-9");

      expect(warehouse?.name).toBe("Renamed");
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.name).toBe("Renamed");
      expect(patchArg.updated_by).toBe("user-9");
      expect(typeof patchArg.updated_at).toBe("string");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new WarehouseRepository(client);
      expect(await repo.update("wh-1", { name: "x" }, "user-9")).toBeNull();
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at/status archived and returns true", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const repo = new WarehouseRepository(client);

      const result = await repo.softDelete("wh-1", "user-9");
      expect(result).toBe(true);
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.status).toBe("archived");
      expect(patchArg.deleted_by).toBe("user-9");
      expect(typeof patchArg.deleted_at).toBe("string");
    });

    it("returns false on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new WarehouseRepository(client);
      expect(await repo.softDelete("wh-1", "user-9")).toBe(false);
    });
  });
});
