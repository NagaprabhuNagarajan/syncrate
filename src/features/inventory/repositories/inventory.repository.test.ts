import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { InventoryRepository } from "./inventory.repository";

interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}

interface MockBuilder {
  select: Mock;
  eq: Mock;
  or: Mock;
  order: Mock;
  range: Mock;
  limit: Mock;
  insert: Mock;
  upsert: Mock;
  single: Mock;
  maybeSingle: Mock;
}

interface MockClient {
  client: AppSupabaseClient;
  builders: MockBuilder[];
  rpc: Mock;
}

function createMockClient(
  results: QueryResult[],
  rpcResult: QueryResult = { data: null, error: null }
): MockClient {
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
      or: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };

    builders.push(builder);
    return builder;
  });

  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const client = { from, rpc } as unknown as AppSupabaseClient;
  return { client, builders, rpc };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("InventoryRepository.getLevel", () => {
  it("maps a raw level row", async () => {
    const { client, builders } = createMockClient([
      {
        data: {
          id: "lvl-1",
          organization_id: "org-1",
          product_id: "prod-1",
          branch_id: "wh-1",
          quantity: 25,
          reserved_quantity: 3,
        },
        error: null,
      },
    ]);
    const repo = new InventoryRepository(client);

    const level = await repo.getLevel("prod-1", "wh-1");
    expect(level).toEqual({
      id: "lvl-1",
      organizationId: "org-1",
      productId: "prod-1",
      branchId: "wh-1",
      quantity: 25,
      reservedQuantity: 3,
    });
    expect(builders[0].eq).toHaveBeenCalledWith("product_id", "prod-1");
    expect(builders[0].eq).toHaveBeenCalledWith("branch_id", "wh-1");
  });

  it("returns null when there is no level", async () => {
    const { client } = createMockClient([{ data: null, error: null }]);
    const repo = new InventoryRepository(client);
    expect(await repo.getLevel("prod-1", "wh-1")).toBeNull();
  });
});

describe("InventoryRepository.listLevels", () => {
  it("maps joined product/branch fields and returns the count", async () => {
    const { client, builders } = createMockClient([
      {
        data: [
          {
            id: "lvl-1",
            organization_id: "org-1",
            product_id: "prod-1",
            branch_id: "wh-1",
            quantity: 4,
            reserved_quantity: 0,
            products: {
              name: "Cement",
              code: "CEM",
              reorder_level: 10,
              purchase_price: 50,
            },
            branches: { name: "Main", code: "WH-01" },
          },
        ],
        error: null,
        count: 1,
      },
    ]);
    const repo = new InventoryRepository(client);

    const result = await repo.listLevels("org-1");
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      productName: "Cement",
      productCode: "CEM",
      reorderLevel: 10,
      purchasePrice: 50,
      branchName: "Main",
      branchCode: "WH-01",
      quantity: 4,
    });
    expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(builders[0].order).toHaveBeenCalledWith("quantity", {
      ascending: true,
    });
  });

  it("handles embedded relations returned as arrays", async () => {
    const { client } = createMockClient([
      {
        data: [
          {
            id: "lvl-1",
            organization_id: "org-1",
            product_id: "prod-1",
            branch_id: "wh-1",
            quantity: 4,
            reserved_quantity: 0,
            products: [
              { name: "Cement", code: "CEM", reorder_level: 10, purchase_price: 50 },
            ],
            branches: [{ name: "Main", code: "WH-01" }],
          },
        ],
        error: null,
        count: 1,
      },
    ]);
    const repo = new InventoryRepository(client);
    const result = await repo.listLevels("org-1");
    expect(result.items[0].productName).toBe("Cement");
    expect(result.items[0].branchName).toBe("Main");
  });

  it("filters by branch and applies foreign-table search", async () => {
    const { client, builders } = createMockClient([
      { data: [], error: null, count: 0 },
    ]);
    const repo = new InventoryRepository(client);

    await repo.listLevels("org-1", { branchId: "wh-1", search: "cem" });
    expect(builders[0].eq).toHaveBeenCalledWith("branch_id", "wh-1");
    expect(builders[0].or).toHaveBeenCalledWith(
      "name.ilike.%cem%,code.ilike.%cem%",
      { foreignTable: "products" }
    );
  });

  it("applies the low-stock filter on the fetched page", async () => {
    const { client } = createMockClient([
      {
        data: [
          {
            id: "lvl-1",
            organization_id: "org-1",
            product_id: "prod-1",
            branch_id: "wh-1",
            quantity: 2,
            reserved_quantity: 0,
            products: { name: "Low", code: "L", reorder_level: 10, purchase_price: 1 },
            branches: { name: "Main", code: "WH-01" },
          },
          {
            id: "lvl-2",
            organization_id: "org-1",
            product_id: "prod-2",
            branch_id: "wh-1",
            quantity: 99,
            reserved_quantity: 0,
            products: { name: "High", code: "H", reorder_level: 10, purchase_price: 1 },
            branches: { name: "Main", code: "WH-01" },
          },
        ],
        error: null,
        count: 2,
      },
    ]);
    const repo = new InventoryRepository(client);

    const result = await repo.listLevels("org-1", { lowStockOnly: true });
    expect(result.items.map((i) => i.productCode)).toEqual(["L"]);
  });

  it("returns an empty result on error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "boom" }, count: null },
    ]);
    const repo = new InventoryRepository(client);
    const result = await repo.listLevels("org-1", { page: 2, pageSize: 5 });
    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 5 });
  });

  it("falls back to empty fields when relations are missing or empty arrays", async () => {
    const { client } = createMockClient([
      {
        data: [
          {
            id: "lvl-1",
            organization_id: "org-1",
            product_id: "prod-1",
            branch_id: "wh-1",
            quantity: 4,
            reserved_quantity: 0,
            products: null,
            branches: [],
          },
        ],
        error: null,
        count: null,
      },
    ]);
    const repo = new InventoryRepository(client);

    const result = await repo.listLevels("org-1");
    expect(result.total).toBe(0);
    expect(result.items[0]).toMatchObject({
      productName: "",
      productCode: "",
      reorderLevel: 0,
      purchasePrice: 0,
      branchName: "",
      branchCode: "",
    });
  });
});

describe("InventoryRepository.listTransactions", () => {
  it("maps transactions and applies filters + limit", async () => {
    const { client, builders } = createMockClient([
      {
        data: [
          {
            id: "tx-1",
            organization_id: "org-1",
            product_id: "prod-1",
            branch_id: "wh-1",
            batch_id: null,
            type: "adjustment",
            quantity: 5,
            running_balance: 15,
            reference_type: "manual",
            reference_id: null,
            note: "recount",
            created_at: "2026-01-01T00:00:00.000Z",
            created_by: "user-1",
            products: { name: "Cement", code: "CEM" },
            branches: { name: "Main", code: "WH-01" },
          },
        ],
        error: null,
      },
    ]);
    const repo = new InventoryRepository(client);

    const transactions = await repo.listTransactions("org-1", {
      productId: "prod-1",
      branchId: "wh-1",
      limit: 10,
    });

    expect(transactions[0]).toMatchObject({
      id: "tx-1",
      type: "adjustment",
      quantity: 5,
      runningBalance: 15,
      productName: "Cement",
      branchName: "Main",
    });
    expect(transactions[0].createdAt).toBeInstanceOf(Date);
    expect(builders[0].eq).toHaveBeenCalledWith("product_id", "prod-1");
    expect(builders[0].eq).toHaveBeenCalledWith("branch_id", "wh-1");
    expect(builders[0].order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(builders[0].limit).toHaveBeenCalledWith(10);
  });

  it("returns [] on error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "x" } },
    ]);
    const repo = new InventoryRepository(client);
    expect(await repo.listTransactions("org-1")).toEqual([]);
  });

  it("maps null product/branch relations to null names", async () => {
    const { client } = createMockClient([
      {
        data: [
          {
            id: "tx-1",
            organization_id: "org-1",
            product_id: "prod-1",
            branch_id: "wh-1",
            batch_id: null,
            type: "opening",
            quantity: 5,
            running_balance: 5,
            reference_type: "opening",
            reference_id: null,
            note: null,
            created_at: "2026-01-01T00:00:00.000Z",
            created_by: null,
            products: null,
            branches: null,
          },
        ],
        error: null,
      },
    ]);
    const repo = new InventoryRepository(client);

    const transactions = await repo.listTransactions("org-1");
    expect(transactions[0]).toMatchObject({
      productName: null,
      productCode: null,
      branchName: null,
    });
  });
});

describe("InventoryRepository.adjustStockRpc", () => {
  it("calls the adjust_stock RPC with the args and returns the new quantity", async () => {
    const { client, rpc } = createMockClient([], { data: 15, error: null });
    const repo = new InventoryRepository(client);

    const result = await repo.adjustStockRpc({
      p_organization_id: "org-1",
      p_product_id: "prod-1",
      p_branch_id: "wh-1",
      p_quantity: 5,
      p_type: "adjustment",
      p_note: "recount",
      p_reference_type: "manual",
    });

    expect(rpc).toHaveBeenCalledWith("adjust_stock", {
      p_organization_id: "org-1",
      p_product_id: "prod-1",
      p_branch_id: "wh-1",
      p_quantity: 5,
      p_type: "adjustment",
      p_note: "recount",
      p_reference_type: "manual",
    });
    expect(result).toEqual({ data: 15, error: null });
  });

  it("passes through the RPC error and nulls the data", async () => {
    const { client } = createMockClient([], {
      data: null,
      error: { message: "negative_stock" },
    });
    const repo = new InventoryRepository(client);

    const result = await repo.adjustStockRpc({
      p_organization_id: "org-1",
      p_product_id: "prod-1",
      p_branch_id: "wh-1",
      p_quantity: -5,
      p_type: "damage",
    });

    expect(result.data).toBeNull();
    expect(result.error).toEqual({ message: "negative_stock" });
  });
});

describe("InventoryRepository.transferStockRpc", () => {
  it("calls the transfer_stock RPC with the args", async () => {
    const { client, rpc } = createMockClient([], { data: null, error: null });
    const repo = new InventoryRepository(client);

    const result = await repo.transferStockRpc({
      p_organization_id: "org-1",
      p_product_id: "prod-1",
      p_from_branch_id: "wh-1",
      p_to_branch_id: "wh-2",
      p_quantity: 8,
      p_note: "rebalance",
    });

    expect(rpc).toHaveBeenCalledWith("transfer_stock", {
      p_organization_id: "org-1",
      p_product_id: "prod-1",
      p_from_branch_id: "wh-1",
      p_to_branch_id: "wh-2",
      p_quantity: 8,
      p_note: "rebalance",
    });
    expect(result).toEqual({ data: null, error: null });
  });

  it("passes through the RPC error", async () => {
    const { client } = createMockClient([], {
      data: null,
      error: { message: "insufficient_stock" },
    });
    const repo = new InventoryRepository(client);

    const result = await repo.transferStockRpc({
      p_organization_id: "org-1",
      p_product_id: "prod-1",
      p_from_branch_id: "wh-1",
      p_to_branch_id: "wh-2",
      p_quantity: 99,
    });

    expect(result.error).toEqual({ message: "insufficient_stock" });
    expect(result.data).toBeNull();
  });
});
