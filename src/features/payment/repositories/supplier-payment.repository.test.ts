import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { SupplierPaymentRepository } from "./supplier-payment.repository";

type DbSupplierPayment =
  Database["public"]["Tables"]["supplier_payments"]["Row"];
type DbSupplierPaymentAllocation =
  Database["public"]["Tables"]["supplier_payment_allocations"]["Row"];

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

function buildDbPayment(
  overrides: Partial<DbSupplierPayment & { suppliers?: { name: string } | null }> = {}
): DbSupplierPayment & { suppliers?: { name: string } | null } {
  return {
    id: "pay-1",
    organization_id: "org-1",
    payment_number: "SPAY-2026-000001",
    supplier_id: "sup-1",
    payment_date: "2026-06-01",
    amount: 2500,
    payment_method: "bank_transfer",
    reference_number: "UTR-999",
    notes: "Settlement",
    status: "completed",
    voided_at: null,
    voided_by: null,
    void_reason: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    deleted_at: null,
    created_by: "user-1",
    updated_by: null,
    deleted_by: null,
    version: 1,
    suppliers: { name: "Globex Supplies" },
    ...overrides,
  };
}

function buildDbAllocation(
  overrides: Partial<DbSupplierPaymentAllocation> = {}
): DbSupplierPaymentAllocation {
  return {
    id: "alloc-1",
    organization_id: "org-1",
    supplier_payment_id: "pay-1",
    purchase_invoice_id: "pinv-1",
    allocated_amount: 800,
    created_at: "2026-06-01T00:00:00.000Z",
    created_by: "user-1",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SupplierPaymentRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findAll", () => {
    it("maps payments, returns count as total and applies default pagination/sort", async () => {
      const rows = [
        buildDbPayment({ id: "pay-1" }),
        buildDbPayment({ id: "pay-2", suppliers: null }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 5 },
      ]);
      const repo = new SupplierPaymentRepository(client);

      const result = await repo.findAll("org-1");

      expect(result.payments.map((p) => p.id)).toEqual(["pay-1", "pay-2"]);
      expect(result.payments[0].supplierName).toBe("Globex Supplies");
      expect(result.payments[1].supplierName).toBeUndefined();
      expect(result.payments[0].amount).toBe(2500);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].order).toHaveBeenCalledWith("payment_date", {
        ascending: false,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 19);
    });

    it("applies a status filter, search, and custom pagination range", async () => {
      const { client, builders } = createMockClient([
        { data: [buildDbPayment()], error: null, count: 1 },
      ]);
      const repo = new SupplierPaymentRepository(client);

      const result = await repo.findAll("org-1", {
        status: "voided",
        search: "SPAY",
        page: 2,
        pageSize: 15,
      });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(15);
      expect(builders[0].eq).toHaveBeenCalledWith("status", "voided");
      expect(builders[0].or).toHaveBeenCalledWith(
        "payment_number.ilike.%SPAY%,reference_number.ilike.%SPAY%"
      );
      expect(builders[0].range).toHaveBeenCalledWith(15, 29);
    });

    it("skips the search filter when the sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new SupplierPaymentRepository(client);

      await repo.findAll("org-1", { search: "%(),%" });
      expect(builders[0].or).not.toHaveBeenCalled();
    });

    it("clamps page and pageSize to safe bounds", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new SupplierPaymentRepository(client);

      await repo.findAll("org-1", { page: 0, pageSize: 1000 });
      expect(builders[0].range).toHaveBeenCalledWith(0, 99);
    });

    it("returns an empty result with page/pageSize on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const repo = new SupplierPaymentRepository(client);

      const result = await repo.findAll("org-1", { page: 2, pageSize: 5 });
      expect(result).toEqual({ payments: [], total: 0, page: 2, pageSize: 5 });
    });

    it("defaults total to 0 when count is null", async () => {
      const { client } = createMockClient([
        { data: [buildDbPayment()], error: null, count: null },
      ]);
      const repo = new SupplierPaymentRepository(client);

      const result = await repo.findAll("org-1");
      expect(result.total).toBe(0);
    });
  });

  describe("findById", () => {
    it("maps a single payment row", async () => {
      const { client, builders } = createMockClient([
        { data: buildDbPayment(), error: null },
      ]);
      const repo = new SupplierPaymentRepository(client);

      const payment = await repo.findById("pay-1");

      expect(payment?.id).toBe("pay-1");
      expect(payment?.supplierName).toBe("Globex Supplies");
      expect(payment?.referenceNumber).toBe("UTR-999");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "pay-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new SupplierPaymentRepository(client);
      expect(await repo.findById("pay-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new SupplierPaymentRepository(client);
      expect(await repo.findById("pay-1")).toBeNull();
    });
  });

  describe("findBySupplier", () => {
    it("maps payments for a supplier ordered by date desc", async () => {
      const rows = [buildDbPayment({ id: "pay-1" })];
      const { client, builders } = createMockClient([
        { data: rows, error: null },
      ]);
      const repo = new SupplierPaymentRepository(client);

      const payments = await repo.findBySupplier("sup-1", "org-1");

      expect(payments.map((p) => p.id)).toEqual(["pay-1"]);
      expect(builders[0].eq).toHaveBeenCalledWith("supplier_id", "sup-1");
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].order).toHaveBeenCalledWith("payment_date", {
        ascending: false,
      });
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new SupplierPaymentRepository(client);
      expect(await repo.findBySupplier("sup-1", "org-1")).toEqual([]);
    });

    it("returns [] when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new SupplierPaymentRepository(client);
      expect(await repo.findBySupplier("sup-1", "org-1")).toEqual([]);
    });
  });

  describe("findAllocations", () => {
    it("maps allocations ordered by created_at asc", async () => {
      const rows = [
        buildDbAllocation({ id: "alloc-1" }),
        buildDbAllocation({ id: "alloc-2", allocated_amount: 200 }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null },
      ]);
      const repo = new SupplierPaymentRepository(client);

      const allocations = await repo.findAllocations("pay-1");

      expect(allocations.map((a) => a.id)).toEqual(["alloc-1", "alloc-2"]);
      expect(allocations[0].supplierPaymentId).toBe("pay-1");
      expect(allocations[0].purchaseInvoiceId).toBe("pinv-1");
      expect(allocations[0].allocatedAmount).toBe(800);
      expect(builders[0].eq).toHaveBeenCalledWith(
        "supplier_payment_id",
        "pay-1"
      );
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: true,
      });
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new SupplierPaymentRepository(client);
      expect(await repo.findAllocations("pay-1")).toEqual([]);
    });

    it("returns [] when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new SupplierPaymentRepository(client);
      expect(await repo.findAllocations("pay-1")).toEqual([]);
    });
  });

  describe("countByOrg", () => {
    it("returns the count", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null, count: 9 },
      ]);
      const repo = new SupplierPaymentRepository(client);

      expect(await repo.countByOrg("org-1")).toBe(9);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("defaults to 0 when count is null", async () => {
      const { client } = createMockClient([
        { data: null, error: null, count: null },
      ]);
      const repo = new SupplierPaymentRepository(client);
      expect(await repo.countByOrg("org-1")).toBe(0);
    });
  });
});
