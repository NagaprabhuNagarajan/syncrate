import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { BatchRepository } from "./batch.repository";

type DbBatch = Database["public"]["Tables"]["batches"]["Row"];

interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}

interface MockBuilder {
  select: Mock;
  eq: Mock;
  is: Mock;
  order: Mock;
  range: Mock;
  insert: Mock;
  single: Mock;
}

function createMockClient(results: QueryResult[]): {
  client: AppSupabaseClient;
  builders: MockBuilder[];
} {
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
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };

    builders.push(builder);
    return builder;
  });

  const client = { from } as unknown as AppSupabaseClient;
  return { client, builders };
}

function buildDbBatch(overrides: Partial<DbBatch> = {}): DbBatch {
  return {
    id: "batch-1",
    organization_id: "org-1",
    product_id: "prod-1",
    batch_number: "B-001",
    manufacturing_date: "2026-01-01",
    expiry_date: "2027-01-01",
    supplier_batch: "S-001",
    received_quantity: 100,
    remaining_quantity: 80,
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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("BatchRepository.findById", () => {
  it("maps a batch row", async () => {
    const { client } = createMockClient([
      { data: buildDbBatch(), error: null },
    ]);
    const repo = new BatchRepository(client);
    const batch = await repo.findById("batch-1");
    expect(batch).toMatchObject({
      id: "batch-1",
      batchNumber: "B-001",
      receivedQuantity: 100,
      remainingQuantity: 80,
      status: "active",
    });
    expect(batch?.createdAt).toBeInstanceOf(Date);
  });

  it("returns null on error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "x" } },
    ]);
    const repo = new BatchRepository(client);
    expect(await repo.findById("batch-1")).toBeNull();
  });
});

describe("BatchRepository.findByNumber", () => {
  it("trims the number and scopes by product", async () => {
    const { client, builders } = createMockClient([
      { data: buildDbBatch(), error: null },
    ]);
    const repo = new BatchRepository(client);
    const batch = await repo.findByNumber("prod-1", "  B-001  ");
    expect(batch?.id).toBe("batch-1");
    expect(builders[0].eq).toHaveBeenCalledWith("product_id", "prod-1");
    expect(builders[0].eq).toHaveBeenCalledWith("batch_number", "B-001");
  });
});

describe("BatchRepository.list", () => {
  it("maps items, returns count and filters by product", async () => {
    const { client, builders } = createMockClient([
      { data: [buildDbBatch()], error: null, count: 1 },
    ]);
    const repo = new BatchRepository(client);

    const result = await repo.list("org-1", { productId: "prod-1" });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe("batch-1");
    expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(builders[0].eq).toHaveBeenCalledWith("product_id", "prod-1");
    expect(builders[0].order).toHaveBeenCalledWith("expiry_date", {
      ascending: true,
      nullsFirst: false,
    });
  });

  it("returns empty result on error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "x" }, count: null },
    ]);
    const repo = new BatchRepository(client);
    const result = await repo.list("org-1");
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("BatchRepository.getStats", () => {
  it("returns counts for total, active, expired and depleted", async () => {
    const { client } = createMockClient([
      { data: null, error: null, count: 10 },
      { data: null, error: null, count: 6 },
      { data: null, error: null, count: 3 },
      { data: null, error: null, count: 1 },
    ]);
    const repo = new BatchRepository(client);

    const stats = await repo.getStats("org-1");

    expect(stats).toEqual({
      total: 10,
      active: 6,
      expired: 3,
      depleted: 1,
    });
  });

  it("defaults each count to 0 when null", async () => {
    const { client } = createMockClient([
      { data: null, error: null, count: null },
      { data: null, error: null, count: null },
      { data: null, error: null, count: null },
      { data: null, error: null, count: null },
    ]);
    const repo = new BatchRepository(client);

    const stats = await repo.getStats("org-1");

    expect(stats).toEqual({
      total: 0,
      active: 0,
      expired: 0,
      depleted: 0,
    });
  });
});

describe("BatchRepository.create", () => {
  it("inserts and maps the batch", async () => {
    const { client, builders } = createMockClient([
      { data: buildDbBatch(), error: null },
    ]);
    const repo = new BatchRepository(client);
    const batch = await repo.create({
      organization_id: "org-1",
      product_id: "prod-1",
      batch_number: "B-001",
    });
    expect(batch?.id).toBe("batch-1");
    expect(builders[0].insert).toHaveBeenCalled();
  });

  it("returns null on error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "dup" } },
    ]);
    const repo = new BatchRepository(client);
    expect(
      await repo.create({
        organization_id: "org-1",
        product_id: "prod-1",
        batch_number: "B-001",
      })
    ).toBeNull();
  });
});
