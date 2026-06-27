import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { CustomerRepository } from "./customer.repository";

type DbCustomer = Database["public"]["Tables"]["customers"]["Row"];
type DbLedgerEntry =
  Database["public"]["Tables"]["customer_ledger_entries"]["Row"];

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

function buildDbCustomer(overrides: Partial<DbCustomer> = {}): DbCustomer {
  return {
    id: "cust-1",
    organization_id: "org-1",
    code: "CUST-00001",
    name: "Acme Traders",
    company: "Acme Pvt Ltd",
    gst_number: "22AAAAA0000A1Z5",
    pan_number: "ABCDE1234F",
    mobile: "+919876543210",
    email: "sales@acme.test",
    website: "https://acme.test",
    billing_address_line1: "Line 1",
    billing_address_line2: "Line 2",
    billing_city: "Chennai",
    billing_state: "TN",
    billing_pincode: "600001",
    billing_country: "IN",
    shipping_address_line1: "S Line 1",
    shipping_address_line2: null,
    shipping_city: "Chennai",
    shipping_state: "TN",
    shipping_pincode: "600002",
    shipping_country: "IN",
    credit_limit: 5000,
    payment_terms_days: 30,
    preferred_payment_method: "upi",
    opening_balance: 1500,
    status: "active",
    tags: ["vip"],
    notes: "Important customer",
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

function buildDbLedgerEntry(
  overrides: Partial<DbLedgerEntry> = {}
): DbLedgerEntry {
  return {
    id: "ledger-1",
    organization_id: "org-1",
    customer_id: "cust-1",
    entry_date: "2026-01-05T00:00:00.000Z",
    reference_type: "invoice",
    reference_id: "inv-1",
    description: "Invoice #1",
    debit: 1000,
    credit: 0,
    running_balance: 2500,
    created_at: "2026-01-05T00:00:00.000Z",
    created_by: "user-1",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("CustomerRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findById", () => {
    it("maps a DB customer row to the domain Customer", async () => {
      const row = buildDbCustomer();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new CustomerRepository(client);

      const customer = await repo.findById("cust-1");

      expect(customer).toEqual({
        id: "cust-1",
        organizationId: "org-1",
        code: "CUST-00001",
        name: "Acme Traders",
        company: "Acme Pvt Ltd",
        gstNumber: "22AAAAA0000A1Z5",
        panNumber: "ABCDE1234F",
        mobile: "+919876543210",
        email: "sales@acme.test",
        website: "https://acme.test",
        billingAddressLine1: "Line 1",
        billingAddressLine2: "Line 2",
        billingCity: "Chennai",
        billingState: "TN",
        billingPincode: "600001",
        billingCountry: "IN",
        shippingAddressLine1: "S Line 1",
        shippingAddressLine2: null,
        shippingCity: "Chennai",
        shippingState: "TN",
        shippingPincode: "600002",
        shippingCountry: "IN",
        creditLimit: 5000,
        paymentTermsDays: 30,
        preferredPaymentMethod: "upi",
        openingBalance: 1500,
        status: "active",
        tags: ["vip"],
        notes: "Important customer",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: "user-1",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("id", "cust-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("converts numeric strings via Number()", async () => {
      const row = buildDbCustomer({
        credit_limit: "7500" as unknown as number,
        opening_balance: "250.5" as unknown as number,
      });
      const { client } = createMockClient([{ data: row, error: null }]);
      const repo = new CustomerRepository(client);

      const customer = await repo.findById("cust-1");
      expect(customer?.creditLimit).toBe(7500);
      expect(customer?.openingBalance).toBe(250.5);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new CustomerRepository(client);
      expect(await repo.findById("cust-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new CustomerRepository(client);
      expect(await repo.findById("cust-1")).toBeNull();
    });
  });

  describe("findByCode", () => {
    it("uppercases/trims the code and maps the customer", async () => {
      const row = buildDbCustomer();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new CustomerRepository(client);

      const customer = await repo.findByCode("org-1", "  cust-00001  ");
      expect(customer?.id).toBe("cust-1");
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].eq).toHaveBeenCalledWith("code", "CUST-00001");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CustomerRepository(client);
      expect(await repo.findByCode("org-1", "CUST-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new CustomerRepository(client);
      expect(await repo.findByCode("org-1", "CUST-1")).toBeNull();
    });
  });

  describe("findByGst", () => {
    it("uppercases/trims the GST number and maps the customer", async () => {
      const row = buildDbCustomer();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new CustomerRepository(client);

      const customer = await repo.findByGst("org-1", "  22aaaaa0000a1z5  ");
      expect(customer?.id).toBe("cust-1");
      expect(builders[0].eq).toHaveBeenCalledWith(
        "gst_number",
        "22AAAAA0000A1Z5"
      );
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CustomerRepository(client);
      expect(await repo.findByGst("org-1", "22AAAAA0000A1Z5")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new CustomerRepository(client);
      expect(await repo.findByGst("org-1", "22AAAAA0000A1Z5")).toBeNull();
    });
  });

  describe("list", () => {
    it("maps items, returns count as total, and applies default pagination/sort", async () => {
      const rows = [
        buildDbCustomer({ id: "cust-1" }),
        buildDbCustomer({ id: "cust-2" }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null, count: 42 },
      ]);
      const repo = new CustomerRepository(client);

      const result = await repo.list("org-1");

      expect(result.items.map((c) => c.id)).toEqual(["cust-1", "cust-2"]);
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

    it("applies a status filter, search, custom sort and pagination range", async () => {
      const { client, builders } = createMockClient([
        { data: [buildDbCustomer()], error: null, count: 1 },
      ]);
      const repo = new CustomerRepository(client);

      const result = await repo.list("org-1", {
        status: "active",
        search: "acme",
        page: 3,
        pageSize: 10,
        sortBy: "created_at",
        sortDir: "desc",
      });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(builders[0].eq).toHaveBeenCalledWith("status", "active");
      expect(builders[0].or).toHaveBeenCalledWith(
        "name.ilike.%acme%,company.ilike.%acme%,code.ilike.%acme%,mobile.ilike.%acme%,email.ilike.%acme%"
      );
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(builders[0].range).toHaveBeenCalledWith(20, 29);
    });

    it("skips the search filter when the sanitized term is empty", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new CustomerRepository(client);

      await repo.list("org-1", { search: "()," });
      expect(builders[0].or).not.toHaveBeenCalled();
    });

    it("returns an empty result with page/pageSize on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" }, count: null },
      ]);
      const repo = new CustomerRepository(client);

      const result = await repo.list("org-1", { page: 2, pageSize: 5 });
      expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 5 });
    });

    it("defaults total to 0 when count is null", async () => {
      const { client } = createMockClient([
        { data: [buildDbCustomer()], error: null, count: null },
      ]);
      const repo = new CustomerRepository(client);

      const result = await repo.list("org-1");
      expect(result.total).toBe(0);
    });

    it("clamps page and pageSize to safe bounds", async () => {
      const { client, builders } = createMockClient([
        { data: [], error: null, count: 0 },
      ]);
      const repo = new CustomerRepository(client);

      await repo.list("org-1", { page: 0, pageSize: 1000 });
      // page clamped to 1, pageSize clamped to 100 → range(0, 99)
      expect(builders[0].range).toHaveBeenCalledWith(0, 99);
    });
  });

  describe("findAllForExport", () => {
    it("maps every row and orders by name ascending", async () => {
      const rows = [
        buildDbCustomer({ id: "cust-1", name: "Acme" }),
        buildDbCustomer({ id: "cust-2", name: "Beta" }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null },
      ]);
      const repo = new CustomerRepository(client);

      const customers = await repo.findAllForExport("org-1");

      expect(customers.map((c) => c.id)).toEqual(["cust-1", "cust-2"]);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
      expect(builders[0].range).toHaveBeenCalledWith(0, 999);
    });

    it("returns an empty array on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new CustomerRepository(client);
      expect(await repo.findAllForExport("org-1")).toEqual([]);
    });

    it("returns an empty array when there are no rows", async () => {
      const { client } = createMockClient([{ data: [], error: null }]);
      const repo = new CustomerRepository(client);
      expect(await repo.findAllForExport("org-1")).toEqual([]);
    });
  });

  describe("create", () => {
    it("inserts the row and maps the created customer", async () => {
      const row = buildDbCustomer();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new CustomerRepository(client);

      const customer = await repo.create({
        organization_id: "org-1",
        code: "CUST-00001",
        name: "Acme Traders",
      });

      expect(customer?.id).toBe("cust-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.organization_id).toBe("org-1");
      expect(insertArg.code).toBe("CUST-00001");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "dup" } },
      ]);
      const repo = new CustomerRepository(client);
      expect(
        await repo.create({
          organization_id: "org-1",
          code: "X",
          name: "X",
        })
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new CustomerRepository(client);
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
    it("applies the patch, sets updated_by/updated_at, and maps the result", async () => {
      const row = buildDbCustomer({ name: "Renamed" });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new CustomerRepository(client);

      const customer = await repo.update(
        "cust-1",
        { name: "Renamed" },
        "user-9"
      );

      expect(customer?.name).toBe("Renamed");
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.name).toBe("Renamed");
      expect(patchArg.updated_by).toBe("user-9");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "cust-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CustomerRepository(client);
      expect(
        await repo.update("cust-1", { name: "x" }, "user-9")
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new CustomerRepository(client);
      expect(
        await repo.update("cust-1", { name: "x" }, "user-9")
      ).toBeNull();
    });
  });

  describe("softDelete", () => {
    it("sets deleted_at/deleted_by/status and returns true on success", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const repo = new CustomerRepository(client);

      const result = await repo.softDelete("cust-1", "user-9");
      expect(result).toBe(true);
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(typeof patchArg.deleted_at).toBe("string");
      expect(patchArg.deleted_by).toBe("user-9");
      expect(patchArg.status).toBe("archived");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "cust-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns false when the update errors", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new CustomerRepository(client);
      expect(await repo.softDelete("cust-1", "user-9")).toBe(false);
    });
  });

  describe("findLedgerEntries", () => {
    it("maps ledger entries with numeric and date conversions", async () => {
      const rows = [
        buildDbLedgerEntry({ id: "ledger-1" }),
        buildDbLedgerEntry({ id: "ledger-2", running_balance: 3500 }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null },
      ]);
      const repo = new CustomerRepository(client);

      const entries = await repo.findLedgerEntries("cust-1");

      expect(entries.map((e) => e.id)).toEqual(["ledger-1", "ledger-2"]);
      expect(entries[0].customerId).toBe("cust-1");
      expect(entries[0].debit).toBe(1000);
      expect(entries[0].runningBalance).toBe(2500);
      expect(entries[0].entryDate).toBeInstanceOf(Date);
      expect(entries[0].createdAt).toBeInstanceOf(Date);
      expect(builders[0].eq).toHaveBeenCalledWith("customer_id", "cust-1");
      expect(builders[0].order).toHaveBeenCalledWith("entry_date", {
        ascending: true,
      });
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new CustomerRepository(client);
      expect(await repo.findLedgerEntries("cust-1")).toEqual([]);
    });

    it("returns [] when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new CustomerRepository(client);
      expect(await repo.findLedgerEntries("cust-1")).toEqual([]);
    });
  });
});
