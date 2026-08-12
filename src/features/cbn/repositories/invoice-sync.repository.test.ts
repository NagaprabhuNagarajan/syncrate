import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { InvoiceSyncRepository } from "./invoice-sync.repository";

type DbRow = Database["public"]["Tables"]["cbn_invoices"]["Row"];

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
    id: "inv-1",
    organization_id: "org-1",
    counterparty_organization_id: "org-2",
    connection_id: "conn-1",
    source_invoice_id: "src-1",
    invoice_number: "INV-001",
    invoice_date: "2026-01-01",
    due_date: "2026-01-31",
    subtotal: 100,
    tax_amount: 18,
    total_amount: 118,
    currency: "INR",
    status: "pending",
    accepted_at: null,
    accepted_by: null,
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
    buyer_purchase_invoice_id: null,
    buyer_purchase_order_id: null,
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

describe("InvoiceSyncRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps the row with numeric and date conversions", async () => {
      const row = buildRow({
        subtotal: "200" as unknown as number,
        accepted_at: "2026-02-01T00:00:00.000Z",
        accepted_by: "user-9",
      });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new InvoiceSyncRepository(client);

      const inv = await repo.findById("inv-1");
      expect(inv?.id).toBe("inv-1");
      expect(inv?.counterpartyOrganizationId).toBe("org-2");
      expect(inv?.subtotal).toBe(200);
      expect(inv?.taxAmount).toBe(18);
      expect(inv?.totalAmount).toBe(118);
      expect(inv?.invoiceDate).toBe("2026-01-01");
      expect(inv?.dueDate).toBe("2026-01-31");
      expect(inv?.acceptedAt).toBeInstanceOf(Date);
      expect(inv?.createdAt).toBeInstanceOf(Date);
      expect(inv?.rejectedAt).toBeNull();
      expect(builders[0].eq).toHaveBeenCalledWith("id", "inv-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new InvoiceSyncRepository(client);
      expect(await repo.findById("inv-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new InvoiceSyncRepository(client);
      expect(await repo.findById("inv-1")).toBeNull();
    });
  });

  describe("listBySenderOrg", () => {
    it("filters by organization_id with status + pagination", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new InvoiceSyncRepository(client);

      const items = await repo.listBySenderOrg("org-1", {
        status: "accepted",
        limit: 5,
        offset: 10,
      });

      expect(items).toHaveLength(1);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(builders[0].eq).toHaveBeenCalledWith("status", "accepted");
      expect(builders[0].range).toHaveBeenCalledWith(10, 14);
    });

    it("ranges from offset 0 when limit is given without an offset", async () => {
      const { client, builders } = createMockClient([{ data: [], error: null }]);
      const repo = new InvoiceSyncRepository(client);

      await repo.listBySenderOrg("org-1", { limit: 3 });
      expect(builders[0].range).toHaveBeenCalledWith(0, 2);
    });

    it("returns [] on error and skips optional filters with no params", async () => {
      const okClient = createMockClient([{ data: [buildRow()], error: null }]);
      const repoOk = new InvoiceSyncRepository(okClient.client);
      expect(await repoOk.listBySenderOrg("org-1")).toHaveLength(1);
      expect(okClient.builders[0].range).not.toHaveBeenCalled();

      const errClient = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repoErr = new InvoiceSyncRepository(errClient.client);
      expect(await repoErr.listBySenderOrg("org-1")).toEqual([]);
    });
  });

  describe("listByReceiverOrg", () => {
    it("filters by counterparty_organization_id", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new InvoiceSyncRepository(client);

      await repo.listByReceiverOrg("org-2", { status: "pending", limit: 2 });
      expect(builders[0].eq).toHaveBeenCalledWith(
        "counterparty_organization_id",
        "org-2"
      );
      expect(builders[0].eq).toHaveBeenCalledWith("status", "pending");
      expect(builders[0].range).toHaveBeenCalledWith(0, 1);
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new InvoiceSyncRepository(client);
      expect(await repo.listByReceiverOrg("org-2")).toEqual([]);
    });
  });

  describe("listByConnection", () => {
    it("filters by connection_id", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new InvoiceSyncRepository(client);

      await repo.listByConnection("conn-1", { status: "rejected", limit: 4 });
      expect(builders[0].eq).toHaveBeenCalledWith("connection_id", "conn-1");
      expect(builders[0].eq).toHaveBeenCalledWith("status", "rejected");
      expect(builders[0].range).toHaveBeenCalledWith(0, 3);
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new InvoiceSyncRepository(client);
      expect(await repo.listByConnection("conn-1")).toEqual([]);
    });
  });
});
