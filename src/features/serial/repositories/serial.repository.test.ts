import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { SerialRepository } from "./serial.repository";

type DbSerial = Database["public"]["Tables"]["serial_numbers"]["Row"];
type DbSerialWithProduct = DbSerial & {
  products: { name: string; code: string } | null;
};

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

function buildDbSerial(
  overrides: Partial<DbSerialWithProduct> = {}
): DbSerialWithProduct {
  return {
    id: "ser-1",
    organization_id: "org-1",
    product_id: "prod-1",
    branch_id: "wh-1",
    batch_id: null,
    serial_number: "SN-0001",
    status: "in_stock",
    reference_type: null,
    reference_id: null,
    notes: "first unit",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    deleted_at: null,
    created_by: "user-1",
    updated_by: null,
    deleted_by: null,
    version: 1,
    products: { name: "Laptop", code: "LAP-1" },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SerialRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a row (with joined product) to the domain SerialNumber", async () => {
      const row = buildDbSerial();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new SerialRepository(client);

      const serial = await repo.findById("ser-1");

      expect(serial).toEqual({
        id: "ser-1",
        organizationId: "org-1",
        productId: "prod-1",
        productName: "Laptop",
        productCode: "LAP-1",
        branchId: "wh-1",
        batchId: null,
        serialNumber: "SN-0001",
        status: "in_stock",
        referenceType: null,
        referenceId: null,
        notes: "first unit",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: "user-1",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("id", "ser-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("falls back to null product fields when the join is missing", async () => {
      const row = buildDbSerial({ products: null });
      const { client } = createMockClient([{ data: row, error: null }]);
      const repo = new SerialRepository(client);

      const serial = await repo.findById("ser-1");
      expect(serial?.productName).toBeNull();
      expect(serial?.productCode).toBeNull();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new SerialRepository(client);
      expect(await repo.findById("ser-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new SerialRepository(client);
      expect(await repo.findById("ser-1")).toBeNull();
    });
  });

  describe("findBySerial", () => {
    it("trims the serial and filters by org", async () => {
      const row = buildDbSerial();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new SerialRepository(client);

      const serial = await repo.findBySerial("org-1", "  SN-0001  ");
      expect(serial?.id).toBe("ser-1");
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].eq).toHaveBeenCalledWith("serial_number", "SN-0001");
    });

    it("returns null when not found", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new SerialRepository(client);
      expect(await repo.findBySerial("org-1", "SN-X")).toBeNull();
    });
  });

  describe("list", () => {
    it("maps items, returns count and applies default pagination/sort", async () => {
      const rows = [
        buildDbSerial({ id: "ser-1" }),
        buildDbSerial({ id: "ser-2" }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 12 },
      ]);
      const repo = new SerialRepository(client);

      const result = await repo.list("org-1");

      expect(result.items.map((s) => s.id)).toEqual(["ser-1", "ser-2"]);
      expect(result.total).toBe(12);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 19);
    });

    it("applies status, product and search filters with custom pagination", async () => {
      const { client, builders } = createMockClient([
        { data: [buildDbSerial()], error: null, count: 1 },
      ]);
      const repo = new SerialRepository(client);

      await repo.list("org-1", {
        status: "sold",
        productId: "prod-9",
        search: "SN-0001",
        page: 2,
        pageSize: 5,
      });

      expect(builders[0].eq).toHaveBeenCalledWith("status", "sold");
      expect(builders[0].eq).toHaveBeenCalledWith("product_id", "prod-9");
      expect(builders[0].or).toHaveBeenCalledWith(
        "serial_number.ilike.%SN-0001%,notes.ilike.%SN-0001%"
      );
      expect(builders[0].range).toHaveBeenCalledWith(5, 9);
    });

    it("skips the search filter when the sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new SerialRepository(client);

      await repo.list("org-1", { search: "()," });
      expect(builders[0].or).not.toHaveBeenCalled();
    });

    it("clamps page and pageSize to safe bounds", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new SerialRepository(client);

      await repo.list("org-1", { page: 0, pageSize: 1000 });
      expect(builders[0].range).toHaveBeenCalledWith(0, 99);
    });

    it("returns an empty result on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const repo = new SerialRepository(client);

      const result = await repo.list("org-1", { page: 3, pageSize: 5 });
      expect(result).toEqual({ items: [], total: 0, page: 3, pageSize: 5 });
    });

    it("defaults total to 0 when count is null", async () => {
      const { client } = createMockClient([
        { data: [buildDbSerial()], error: null, count: null },
      ]);
      const repo = new SerialRepository(client);

      const result = await repo.list("org-1");
      expect(result.total).toBe(0);
    });
  });

  describe("create", () => {
    it("inserts the row and maps the created serial", async () => {
      const row = buildDbSerial();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new SerialRepository(client);

      const serial = await repo.create({
        organization_id: "org-1",
        product_id: "prod-1",
        serial_number: "SN-0001",
      });

      expect(serial?.id).toBe("ser-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.organization_id).toBe("org-1");
      expect(insertArg.serial_number).toBe("SN-0001");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "dup" } },
      ]);
      const repo = new SerialRepository(client);
      expect(
        await repo.create({
          organization_id: "org-1",
          product_id: "p",
          serial_number: "X",
        })
      ).toBeNull();
    });
  });

  describe("update", () => {
    it("applies the patch, sets updated_by/updated_at and maps the result", async () => {
      const row = buildDbSerial({ status: "sold" });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new SerialRepository(client);

      const serial = await repo.update("ser-1", { status: "sold" }, "user-9");

      expect(serial?.status).toBe("sold");
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.status).toBe("sold");
      expect(patchArg.updated_by).toBe("user-9");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "ser-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new SerialRepository(client);
      expect(
        await repo.update("ser-1", { status: "sold" }, "user-9")
      ).toBeNull();
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at/deleted_by and returns true on success", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const repo = new SerialRepository(client);

      const result = await repo.softDelete("ser-1", "user-9");
      expect(result).toBe(true);
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(typeof patchArg.deleted_at).toBe("string");
      expect(patchArg.deleted_by).toBe("user-9");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "ser-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns false when the update errors", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new SerialRepository(client);
      expect(await repo.softDelete("ser-1", "user-9")).toBe(false);
    });
  });
});
