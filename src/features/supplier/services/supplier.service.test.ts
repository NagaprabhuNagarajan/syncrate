import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { csvToObjects } from "@/utils/csv";
import type {
  Supplier,
  SupplierLedgerEntry,
} from "@/features/supplier/types/supplier.types";
import { SupplierService } from "./supplier.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    findByCode: vi.fn(),
    findByGst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    findLedgerEntries: vi.fn(),
    findAllForExport: vi.fn(),
  },
}));

vi.mock("@/features/supplier/repositories/supplier.repository", () => ({
  SupplierRepository: vi.fn(() => mockRepo),
}));

const fakeSupabase = {} as unknown as AppSupabaseClient;

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: "supplier-1",
    organizationId: "org-1",
    code: "SUPP-00001",
    name: "Acme Industries",
    contactPerson: "Ramesh",
    gstNumber: null,
    panNumber: null,
    mobile: null,
    email: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    pincode: null,
    country: "IN",
    bankAccountName: null,
    bankAccountNumber: null,
    bankIfsc: null,
    bankName: null,
    upiId: null,
    paymentTermsDays: 0,
    openingBalance: 0,
    rating: null,
    status: "active",
    tags: [],
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

function buildLedgerEntry(
  overrides: Partial<SupplierLedgerEntry> = {}
): SupplierLedgerEntry {
  return {
    id: "entry-1",
    supplierId: "supplier-1",
    entryDate: new Date("2026-01-05T00:00:00Z"),
    referenceType: "purchase",
    referenceId: "po-1",
    description: "Purchase",
    debit: 0,
    credit: 500,
    runningBalance: 1500,
    createdAt: new Date("2026-01-05T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("SupplierService reads", () => {
  it("listSuppliers delegates to the repository", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.list.mockResolvedValue({
      items: [buildSupplier()],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const result = await service.listSuppliers("org-1", { search: "acme" });

    expect(result.total).toBe(1);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { search: "acme" });
  });

  it("getSupplier returns the supplier when found", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findById.mockResolvedValue(buildSupplier());

    const result = await service.getSupplier("supplier-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("supplier-1");
    }
  });

  it("getSupplier returns not_found when missing", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.getSupplier("missing");

    expect(result).toEqual({
      success: false,
      error: { code: "not_found", message: "Supplier not found" },
    });
  });

  it("getSupplierLedger uses the last running balance as outstanding", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findLedgerEntries.mockResolvedValue([
      buildLedgerEntry({ runningBalance: 1500 }),
      buildLedgerEntry({ id: "entry-2", runningBalance: 2000 }),
    ]);

    const ledger = await service.getSupplierLedger(
      buildSupplier({ openingBalance: 1000 })
    );

    expect(ledger.openingBalance).toBe(1000);
    expect(ledger.outstanding).toBe(2000);
    expect(ledger.entries).toHaveLength(2);
  });

  it("getSupplierLedger falls back to opening balance with no entries", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findLedgerEntries.mockResolvedValue([]);

    const ledger = await service.getSupplierLedger(
      buildSupplier({ openingBalance: 750 })
    );

    expect(ledger.outstanding).toBe(750);
  });
});

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

describe("SupplierService.createSupplier", () => {
  it("auto-generates a code from the current total when none provided", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.list.mockResolvedValue({ items: [], total: 4, page: 1, pageSize: 1 });
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildSupplier({ code: "SUPP-00005" }));

    const result = await service.createSupplier(
      { name: "Acme" },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    expect(mockRepo.findByCode).toHaveBeenCalledWith("org-1", "SUPP-00005");
    const insertArg = mockRepo.create.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(insertArg.code).toBe("SUPP-00005");
    expect(insertArg.country).toBe("IN");
    expect(insertArg.created_by).toBe("user-1");
  });

  it("rejects a duplicate code", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findByCode.mockResolvedValue(buildSupplier());

    const result = await service.createSupplier(
      { name: "Acme", code: "SUPP-00001" },
      "org-1",
      "user-1"
    );

    expect(result).toEqual({
      success: false,
      error: { code: "duplicate_code", message: expect.any(String) },
    });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate GST", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.findByGst.mockResolvedValue(buildSupplier({ id: "other" }));

    const result = await service.createSupplier(
      { name: "Acme", code: "SUPP-1", gstNumber: "22AAAAA0000A1Z5" },
      "org-1",
      "user-1"
    );

    expect(result).toEqual({
      success: false,
      error: { code: "duplicate_gst", message: expect.any(String) },
    });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("normalizes optional fields and persists supplier-specific fields", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildSupplier());

    await service.createSupplier(
      {
        name: "  Acme  ",
        code: "supp-1",
        email: "Acme@Example.com",
        bankIfsc: "hdfc0001234",
        rating: 4.5,
        contactPerson: "  Ramesh  ",
        country: "us",
      },
      "org-1",
      "user-1"
    );

    const insertArg = mockRepo.create.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(insertArg.name).toBe("Acme");
    expect(insertArg.email).toBe("acme@example.com");
    expect(insertArg.bank_ifsc).toBe("HDFC0001234");
    expect(insertArg.rating).toBe(4.5);
    expect(insertArg.contact_person).toBe("Ramesh");
    expect(insertArg.country).toBe("US");
  });

  it("returns unknown error when the repository fails", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(null);

    const result = await service.createSupplier(
      { name: "Acme", code: "SUPP-1" },
      "org-1",
      "user-1"
    );

    expect(result).toEqual({
      success: false,
      error: { code: "unknown", message: expect.any(String) },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

describe("SupplierService.updateSupplier", () => {
  it("rejects when the new code belongs to another supplier", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findByCode.mockResolvedValue(buildSupplier({ id: "other" }));

    const result = await service.updateSupplier(
      "supplier-1",
      { code: "SUPP-9" },
      "org-1",
      "user-1"
    );

    expect(result).toEqual({
      success: false,
      error: { code: "duplicate_code", message: expect.any(String) },
    });
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("allows keeping the same code on the same supplier", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findByCode.mockResolvedValue(buildSupplier({ id: "supplier-1" }));
    mockRepo.update.mockResolvedValue(buildSupplier());

    const result = await service.updateSupplier(
      "supplier-1",
      { code: "SUPP-00001", name: "Renamed" },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch.name).toBe("Renamed");
  });

  it("rejects a duplicate GST owned by another supplier", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findByGst.mockResolvedValue(buildSupplier({ id: "other" }));

    const result = await service.updateSupplier(
      "supplier-1",
      { gstNumber: "22AAAAA0000A1Z5" },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({ code: "duplicate_gst" });
    }
  });

  it("builds a snake_case patch including status and rating", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.update.mockResolvedValue(buildSupplier());

    await service.updateSupplier(
      "supplier-1",
      { status: "inactive", rating: 3, bankIfsc: "hdfc0009999" },
      "org-1",
      "user-1"
    );

    const patch = mockRepo.update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch.status).toBe("inactive");
    expect(patch.rating).toBe(3);
    expect(patch.bank_ifsc).toBe("HDFC0009999");
  });

  it("returns not_found when the repository update returns null", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.update.mockResolvedValue(null);

    const result = await service.updateSupplier(
      "supplier-1",
      { name: "X Corp" },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({ code: "not_found" });
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Archive
// ─────────────────────────────────────────────────────────────

describe("SupplierService.archiveSupplier", () => {
  it("returns not_found when supplier does not exist", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.archiveSupplier("supplier-1", "user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({ code: "not_found" });
    }
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it("soft-deletes an existing supplier", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findById.mockResolvedValue(buildSupplier());
    mockRepo.softDelete.mockResolvedValue(true);

    const result = await service.archiveSupplier("supplier-1", "user-1");

    expect(result.success).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("supplier-1", "user-1");
  });

  it("returns unknown error when soft delete fails", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findById.mockResolvedValue(buildSupplier());
    mockRepo.softDelete.mockResolvedValue(false);

    const result = await service.archiveSupplier("supplier-1", "user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({ code: "unknown" });
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────

describe("SupplierService.exportSuppliersCsv", () => {
  it("emits the agreed header row in order", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findAllForExport.mockResolvedValue([]);

    const csv = await service.exportSuppliersCsv("org-1");
    const header = csv.split("\r\n")[0];

    expect(header).toBe(
      "code,name,contactPerson,gstNumber,panNumber,mobile,email,website," +
        "city,state,pincode,bankName,bankAccountNumber,bankIfsc,upiId," +
        "paymentTermsDays,openingBalance,rating,status,tags,notes"
    );
    expect(mockRepo.findAllForExport).toHaveBeenCalledWith("org-1");
  });

  it("serializes a supplier row with nulls blanked and tags joined by ';'", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findAllForExport.mockResolvedValue([
      buildSupplier({
        code: "SUPP-1",
        name: "Acme",
        contactPerson: null,
        gstNumber: null,
        paymentTermsDays: 30,
        openingBalance: 1500,
        rating: 4.5,
        status: "active",
        tags: ["preferred", "raw"],
        notes: null,
      }),
    ]);

    const csv = await service.exportSuppliersCsv("org-1");
    const { rows } = csvToObjects(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      code: "SUPP-1",
      name: "Acme",
      contactPerson: "",
      gstNumber: "",
      paymentTermsDays: "30",
      openingBalance: "1500",
      rating: "4.5",
      status: "active",
      tags: "preferred;raw",
      notes: "",
    });
  });

  it("quotes fields containing commas", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findAllForExport.mockResolvedValue([
      buildSupplier({ name: "Acme, Inc.", code: "SUPP-1" }),
    ]);

    const csv = await service.exportSuppliersCsv("org-1");
    expect(csv).toContain('"Acme, Inc."');
  });
});

// ─────────────────────────────────────────────────────────────
// Import
// ─────────────────────────────────────────────────────────────

describe("SupplierService.importSuppliers", () => {
  it("creates each valid row and counts results", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildSupplier());

    const result = await service.importSuppliers(
      [
        { code: "SUPP-1", name: "Acme", tags: "preferred;raw" },
        { code: "SUPP-2", name: "Beta" },
      ],
      "org-1",
      "user-1"
    );

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(mockRepo.create).toHaveBeenCalledTimes(2);
    const firstInput = mockRepo.create.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(firstInput.tags).toEqual(["preferred", "raw"]);
  });

  it("records a 1-based row number for schema-invalid rows and continues", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildSupplier());

    const result = await service.importSuppliers(
      [
        { name: "A" }, // too short → invalid (row 2)
        { name: "Valid Co" }, // row 3
      ],
      "org-1",
      "user-1"
    );

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.row).toBe(2);
    expect(mockRepo.create).toHaveBeenCalledTimes(1);
  });

  it("captures duplicate-code failures surfaced by the service", async () => {
    const service = new SupplierService(fakeSupabase);
    mockRepo.findByCode.mockResolvedValue(buildSupplier({ id: "existing" }));

    const result = await service.importSuppliers(
      [{ code: "SUPP-1", name: "Acme" }],
      "org-1",
      "user-1"
    );

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]?.row).toBe(2);
    expect(result.errors[0]?.message).toMatch(/already exists/i);
  });

  it("returns zeroed summary for an empty row set", async () => {
    const service = new SupplierService(fakeSupabase);

    const result = await service.importSuppliers([], "org-1", "user-1");

    expect(result).toEqual({ created: 0, skipped: 0, errors: [] });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});
