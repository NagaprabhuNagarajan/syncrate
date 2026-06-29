import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { PurchaseSyncRepository } from "./purchase-sync.repository";

type DbRow = Database["public"]["Tables"]["cbn_purchase_orders"]["Row"];

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface MockBuilder {
  select: Mock;
  eq: Mock;
  is: Mock;
  order: Mock;
  range: Mock;
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
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
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

function buildRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    id: "po-1",
    organization_id: "org-1",
    counterparty_organization_id: "org-2",
    connection_id: "conn-1",
    source_purchase_order_id: "src-1",
    po_number: "PO-001",
    po_date: "2026-01-01",
    expected_delivery_date: "2026-01-15",
    subtotal: 500,
    tax_amount: 90,
    total_amount: 590,
    currency: "INR",
    status: "pending",
    accepted_at: null,
    accepted_by: null,
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
    supplier_sales_order_id: null,
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

describe("PurchaseSyncRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps the row with numeric and date conversions", async () => {
      const row = buildRow({
        total_amount: "590.5" as unknown as number,
        rejected_at: "2026-02-02T00:00:00.000Z",
        rejected_by: "user-9",
        supplier_sales_order_id: "so-1",
      });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new PurchaseSyncRepository(client);

      const po = await repo.findById("po-1");
      expect(po?.id).toBe("po-1");
      expect(po?.poNumber).toBe("PO-001");
      expect(po?.subtotal).toBe(500);
      expect(po?.totalAmount).toBe(590.5);
      expect(po?.poDate).toBe("2026-01-01");
      expect(po?.expectedDeliveryDate).toBe("2026-01-15");
      expect(po?.supplierSalesOrderId).toBe("so-1");
      expect(po?.rejectedAt).toBeInstanceOf(Date);
      expect(po?.acceptedAt).toBeNull();
      expect(builders[0].eq).toHaveBeenCalledWith("id", "po-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new PurchaseSyncRepository(client);
      expect(await repo.findById("po-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new PurchaseSyncRepository(client);
      expect(await repo.findById("po-1")).toBeNull();
    });
  });

  describe("listBySenderOrg", () => {
    it("filters by organization_id with status + pagination", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new PurchaseSyncRepository(client);

      await repo.listBySenderOrg("org-1", {
        status: "fulfilled",
        limit: 5,
        offset: 10,
      });

      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(builders[0].eq).toHaveBeenCalledWith("status", "fulfilled");
      expect(builders[0].range).toHaveBeenCalledWith(10, 14);
    });

    it("maps rows with no params and skips pagination", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new PurchaseSyncRepository(client);

      const items = await repo.listBySenderOrg("org-1");
      expect(items).toHaveLength(1);
      expect(builders[0].range).not.toHaveBeenCalled();
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new PurchaseSyncRepository(client);
      expect(await repo.listBySenderOrg("org-1")).toEqual([]);
    });
  });

  describe("listByReceiverOrg", () => {
    it("filters by counterparty_organization_id", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new PurchaseSyncRepository(client);

      await repo.listByReceiverOrg("org-2", { status: "accepted", limit: 2 });
      expect(builders[0].eq).toHaveBeenCalledWith(
        "counterparty_organization_id",
        "org-2"
      );
      expect(builders[0].eq).toHaveBeenCalledWith("status", "accepted");
      expect(builders[0].range).toHaveBeenCalledWith(0, 1);
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new PurchaseSyncRepository(client);
      expect(await repo.listByReceiverOrg("org-2")).toEqual([]);
    });
  });

  describe("listByConnection", () => {
    it("filters by connection_id", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new PurchaseSyncRepository(client);

      await repo.listByConnection("conn-1", { status: "cancelled", limit: 4 });
      expect(builders[0].eq).toHaveBeenCalledWith("connection_id", "conn-1");
      expect(builders[0].eq).toHaveBeenCalledWith("status", "cancelled");
      expect(builders[0].range).toHaveBeenCalledWith(0, 3);
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new PurchaseSyncRepository(client);
      expect(await repo.listByConnection("conn-1")).toEqual([]);
    });
  });
});
