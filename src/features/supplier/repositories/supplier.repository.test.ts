import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { SupplierRepository } from "./supplier.repository";

type DbSupplier = Database["public"]["Tables"]["suppliers"]["Row"];
type DbLedgerEntry =
  Database["public"]["Tables"]["supplier_ledger_entries"]["Row"];

// ─────────────────────────────────────────────────────────────
// Chainable Supabase mock
// ─────────────────────────────────────────────────────────────

interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number;
}

interface MockBuilder {
  select: Mock;
  eq: Mock;
  is: Mock;
  or: Mock;
  gte: Mock;
  order: Mock;
  range: Mock;
  update: Mock;
  insert: Mock;
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
      gte: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => Promise.resolve(result)),
      update: vi.fn(() => builder),
      insert: vi.fn(() => builder),
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

function buildDbSupplier(overrides: Partial<DbSupplier> = {}): DbSupplier {
  return {
    cbn_connection_id: null,
    id: "supplier-1",
    organization_id: "org-1",
    code: "SUPP-00001",
    name: "Acme Industries",
    contact_person: "Ramesh Kumar",
    gst_number: "22AAAAA0000A1Z5",
    pan_number: "AAAAA0000A",
    mobile: "+91 98765 43210",
    email: "acme@example.com",
    website: "https://acme.test",
    address_line1: "12 MG Road",
    address_line2: null,
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "IN",
    bank_account_name: "Acme Industries",
    bank_account_number: "123456789012",
    bank_ifsc: "HDFC0001234",
    bank_name: "HDFC Bank",
    upi_id: "acme@okhdfcbank",
    payment_terms_days: 30,
    opening_balance: 1000,
    rating: 4.5,
    status: "active",
    tags: ["preferred"],
    notes: "Reliable",
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
    id: "entry-1",
    organization_id: "org-1",
    supplier_id: "supplier-1",
    entry_date: "2026-01-05T00:00:00.000Z",
    reference_type: "purchase",
    reference_id: "po-1",
    description: "Purchase order",
    debit: 0,
    credit: 500,
    running_balance: 1500,
    created_at: "2026-01-05T00:00:00.000Z",
    created_by: "user-1",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SupplierRepository.findById", () => {
  it("maps a DB row to a domain supplier", async () => {
    const { client, builders } = createMockClient([
      { data: buildDbSupplier(), error: null },
    ]);
    const repo = new SupplierRepository(client);

    const supplier = await repo.findById("supplier-1");

    expect(supplier).not.toBeNull();
    expect(supplier?.id).toBe("supplier-1");
    expect(supplier?.contactPerson).toBe("Ramesh Kumar");
    expect(supplier?.bankIfsc).toBe("HDFC0001234");
    expect(supplier?.rating).toBe(4.5);
    expect(supplier?.openingBalance).toBe(1000);
    expect(supplier?.createdAt).toBeInstanceOf(Date);
    // Archived (soft-deleted) suppliers must still load, so no deleted_at
    // constraint is applied.
    expect(builders[0]?.is).not.toHaveBeenCalled();
  });

  it("returns null when the row is not found", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "not found" } },
    ]);
    const repo = new SupplierRepository(client);

    expect(await repo.findById("missing")).toBeNull();
  });

  it("maps a null rating to null", async () => {
    const { client } = createMockClient([
      { data: buildDbSupplier({ rating: null }), error: null },
    ]);
    const repo = new SupplierRepository(client);

    const supplier = await repo.findById("supplier-1");
    expect(supplier?.rating).toBeNull();
  });
});

describe("SupplierRepository.findByCode", () => {
  it("looks up by uppercased trimmed code", async () => {
    const { client, builders } = createMockClient([
      { data: buildDbSupplier(), error: null },
    ]);
    const repo = new SupplierRepository(client);

    const supplier = await repo.findByCode("org-1", "  supp-00001 ");

    expect(supplier?.code).toBe("SUPP-00001");
    expect(builders[0]?.eq).toHaveBeenCalledWith("code", "SUPP-00001");
  });

  it("returns null on error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "x" } },
    ]);
    const repo = new SupplierRepository(client);
    expect(await repo.findByCode("org-1", "SUPP-1")).toBeNull();
  });
});

describe("SupplierRepository.findByGst", () => {
  it("looks up by uppercased GST", async () => {
    const { client, builders } = createMockClient([
      { data: buildDbSupplier(), error: null },
    ]);
    const repo = new SupplierRepository(client);

    await repo.findByGst("org-1", "22aaaaa0000a1z5");

    expect(builders[0]?.eq).toHaveBeenCalledWith(
      "gst_number",
      "22AAAAA0000A1Z5"
    );
  });

  it("returns null when not found", async () => {
    const { client } = createMockClient([{ data: null, error: null }]);
    const repo = new SupplierRepository(client);
    expect(await repo.findByGst("org-1", "22AAAAA0000A1Z5")).toBeNull();
  });
});

describe("SupplierRepository.list", () => {
  it("returns mapped items with total count", async () => {
    const { client, builders } = createMockClient([
      { data: [buildDbSupplier(), buildDbSupplier({ id: "s-2" })], count: 2, error: null },
    ]);
    const repo = new SupplierRepository(client);

    const result = await repo.list("org-1");

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    // "All" view returns every status, so no deleted_at constraint is applied.
    expect(builders[0]?.is).not.toHaveBeenCalled();
  });

  it("applies the status filter and search term", async () => {
    const { client, builders } = createMockClient([
      { data: [], count: 0, error: null },
    ]);
    const repo = new SupplierRepository(client);

    await repo.list("org-1", { status: "active", search: "acme" });

    expect(builders[0]?.eq).toHaveBeenCalledWith("status", "active");
    expect(builders[0]?.or).toHaveBeenCalledWith(
      expect.stringContaining("name.ilike.%acme%")
    );
  });

  it("includes soft-deleted rows when filtering by the archived status", async () => {
    const { client, builders } = createMockClient([
      { data: [buildDbSupplier({ status: "archived" })], count: 1, error: null },
    ]);
    const repo = new SupplierRepository(client);

    const result = await repo.list("org-1", { status: "archived" });

    expect(result.items).toHaveLength(1);
    // Archived view filters by status and does NOT constrain deleted_at.
    expect(builders[0]?.eq).toHaveBeenCalledWith("status", "archived");
    expect(builders[0]?.is).not.toHaveBeenCalled();
  });

  it("clamps page size and computes range", async () => {
    const { client, builders } = createMockClient([
      { data: [], count: 0, error: null },
    ]);
    const repo = new SupplierRepository(client);

    await repo.list("org-1", { page: 2, pageSize: 500 });

    // page 2 with clamped pageSize 100 → range(100, 199)
    expect(builders[0]?.range).toHaveBeenCalledWith(100, 199);
  });

  it("returns an empty result on error", async () => {
    const { client } = createMockClient([
      { data: null, count: null as unknown as number, error: { message: "x" } },
    ]);
    const repo = new SupplierRepository(client);

    const result = await repo.list("org-1");
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("SupplierRepository.getStats", () => {
  it("returns counts for total, active, inactive and new-this-month", async () => {
    const { client } = createMockClient([
      { data: null, error: null, count: 12 },
      { data: null, error: null, count: 9 },
      { data: null, error: null, count: 2 },
      { data: null, error: null, count: 3 },
    ]);
    const repo = new SupplierRepository(client);

    const stats = await repo.getStats("org-1");

    expect(stats).toEqual({
      total: 12,
      active: 9,
      inactive: 2,
      newThisMonth: 3,
    });
  });

  it("defaults each count to 0 when null", async () => {
    const { client } = createMockClient([
      { data: null, error: null, count: undefined },
      { data: null, error: null, count: undefined },
      { data: null, error: null, count: undefined },
      { data: null, error: null, count: undefined },
    ]);
    const repo = new SupplierRepository(client);

    const stats = await repo.getStats("org-1");

    expect(stats).toEqual({
      total: 0,
      active: 0,
      inactive: 0,
      newThisMonth: 0,
    });
  });
});

describe("SupplierRepository.create", () => {
  it("inserts and maps the created supplier", async () => {
    const { client, builders } = createMockClient([
      { data: buildDbSupplier(), error: null },
    ]);
    const repo = new SupplierRepository(client);

    const supplier = await repo.create({
      organization_id: "org-1",
      code: "SUPP-00001",
      name: "Acme Industries",
    });

    expect(supplier?.id).toBe("supplier-1");
    expect(builders[0]?.insert).toHaveBeenCalled();
  });

  it("returns null on insert error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "fail" } },
    ]);
    const repo = new SupplierRepository(client);

    expect(
      await repo.create({
        organization_id: "org-1",
        code: "SUPP-00001",
        name: "Acme",
      })
    ).toBeNull();
  });
});

describe("SupplierRepository.findAllForExport", () => {
  it("returns every mapped supplier ordered by name", async () => {
    const { client, builders } = createMockClient([
      {
        data: [buildDbSupplier(), buildDbSupplier({ id: "s-2", name: "Beta" })],
        error: null,
      },
    ]);
    const repo = new SupplierRepository(client);

    const suppliers = await repo.findAllForExport("org-1");

    expect(suppliers).toHaveLength(2);
    expect(builders[0]?.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(builders[0]?.is).toHaveBeenCalledWith("deleted_at", null);
    expect(builders[0]?.order).toHaveBeenCalledWith("name", {
      ascending: true,
    });
  });

  it("returns an empty array on error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "x" } },
    ]);
    const repo = new SupplierRepository(client);

    expect(await repo.findAllForExport("org-1")).toEqual([]);
  });
});

describe("SupplierRepository.update", () => {
  it("merges audit fields and maps the result", async () => {
    const { client, builders } = createMockClient([
      { data: buildDbSupplier({ name: "New Name" }), error: null },
    ]);
    const repo = new SupplierRepository(client);

    const supplier = await repo.update(
      "supplier-1",
      { name: "New Name" },
      "user-2"
    );

    expect(supplier?.name).toBe("New Name");
    const updateArg = builders[0]?.update.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(updateArg.name).toBe("New Name");
    expect(updateArg.updated_by).toBe("user-2");
    expect(updateArg.updated_at).toEqual(expect.any(String));
    // Updates may target archived (soft-deleted) rows, e.g. to restore them.
    expect(builders[0]?.is).not.toHaveBeenCalled();
  });

  it("returns null on error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "x" } },
    ]);
    const repo = new SupplierRepository(client);
    expect(await repo.update("supplier-1", {}, "user-2")).toBeNull();
  });
});

describe("SupplierRepository.softDelete", () => {
  it("sets archived status and deletion audit fields", async () => {
    const { client, builders } = createMockClient([{ data: null, error: null }]);
    const repo = new SupplierRepository(client);

    const ok = await repo.softDelete("supplier-1", "user-2");

    expect(ok).toBe(true);
    const updateArg = builders[0]?.update.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(updateArg.status).toBe("archived");
    expect(updateArg.deleted_by).toBe("user-2");
    expect(updateArg.deleted_at).toEqual(expect.any(String));
  });

  it("returns false on error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "fail" } },
    ]);
    const repo = new SupplierRepository(client);
    expect(await repo.softDelete("supplier-1", "user-2")).toBe(false);
  });
});

describe("SupplierRepository.restore", () => {
  it("clears deleted_at/deleted_by, sets status active and updated_by", async () => {
    const { client, builders } = createMockClient([{ data: null, error: null }]);
    const repo = new SupplierRepository(client);

    const ok = await repo.restore("supplier-1", "user-2");

    expect(ok).toBe(true);
    const updateArg = builders[0]?.update.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(updateArg.deleted_at).toBeNull();
    expect(updateArg.deleted_by).toBeNull();
    expect(updateArg.status).toBe("active");
    expect(updateArg.updated_by).toBe("user-2");
    expect(builders[0]?.eq).toHaveBeenCalledWith("id", "supplier-1");
  });

  it("returns false on error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "fail" } },
    ]);
    const repo = new SupplierRepository(client);
    expect(await repo.restore("supplier-1", "user-2")).toBe(false);
  });
});

describe("SupplierRepository.findLedgerEntries", () => {
  it("maps ledger entries", async () => {
    const { client } = createMockClient([
      { data: [buildDbLedgerEntry()], error: null },
    ]);
    const repo = new SupplierRepository(client);

    const entries = await repo.findLedgerEntries("supplier-1");

    expect(entries).toHaveLength(1);
    expect(entries[0]?.runningBalance).toBe(1500);
    expect(entries[0]?.entryDate).toBeInstanceOf(Date);
  });

  it("returns an empty array on error", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "x" } },
    ]);
    const repo = new SupplierRepository(client);
    expect(await repo.findLedgerEntries("supplier-1")).toEqual([]);
  });
});
