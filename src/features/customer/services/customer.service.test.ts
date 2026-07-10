import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  Customer,
  CustomerLedgerEntry,
} from "@/features/customer/types/customer.types";
import { CustomerService } from "./customer.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    findByCode: vi.fn(),
    findByGst: vi.fn(),
    findAllForExport: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
    findLedgerEntries: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock("@/features/customer/repositories/customer.repository", () => ({
  CustomerRepository: vi.fn(() => mockRepo),
}));

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    organizationId: "org-1",
    code: "CUST-00001",
    name: "Acme Traders",
    company: null,
    gstNumber: null,
    panNumber: null,
    mobile: null,
    email: null,
    website: null,
    billingAddressLine1: null,
    billingAddressLine2: null,
    billingCity: null,
    billingState: null,
    billingPincode: null,
    billingCountry: "IN",
    shippingAddressLine1: null,
    shippingAddressLine2: null,
    shippingCity: null,
    shippingState: null,
    shippingPincode: null,
    shippingCountry: null,
    creditLimit: 0,
    paymentTermsDays: 0,
    preferredPaymentMethod: null,
    openingBalance: 1000,
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
  overrides: Partial<CustomerLedgerEntry> = {}
): CustomerLedgerEntry {
  return {
    id: "ledger-1",
    customerId: "cust-1",
    entryDate: new Date("2026-01-05T00:00:00Z"),
    referenceType: "invoice",
    referenceId: "inv-1",
    description: "Invoice #1",
    debit: 1000,
    credit: 0,
    runningBalance: 2500,
    createdAt: new Date("2026-01-05T00:00:00Z"),
    ...overrides,
  };
}

let service: CustomerService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new CustomerService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("CustomerService.listCustomers", () => {
  it("delegates to the repository", async () => {
    const listResult = {
      items: [buildCustomer()],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockRepo.list.mockResolvedValue(listResult);

    const result = await service.listCustomers("org-1", { search: "acme" });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { search: "acme" });
  });
});

describe("CustomerService.getCustomerStats", () => {
  it("delegates to the repository", async () => {
    const stats = { total: 5, active: 4, blacklisted: 1, newThisMonth: 2 };
    mockRepo.getStats.mockResolvedValue(stats);

    const result = await service.getCustomerStats("org-1");
    expect(result).toBe(stats);
    expect(mockRepo.getStats).toHaveBeenCalledWith("org-1");
  });
});

describe("CustomerService.getCustomer", () => {
  it("returns the customer when found", async () => {
    mockRepo.findById.mockResolvedValue(buildCustomer());
    const result = await service.getCustomer("cust-1");
    expect(result.success).toBe(true);
  });

  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.getCustomer("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

describe("CustomerService.getCustomerLedger", () => {
  it("uses the last entry's runningBalance as the outstanding amount", async () => {
    const entries = [
      buildLedgerEntry({ id: "l-1", runningBalance: 1500 }),
      buildLedgerEntry({ id: "l-2", runningBalance: 2750 }),
    ];
    mockRepo.findLedgerEntries.mockResolvedValue(entries);

    const customer = buildCustomer({ openingBalance: 1000 });
    const ledger = await service.getCustomerLedger(customer);

    expect(ledger.openingBalance).toBe(1000);
    expect(ledger.entries).toBe(entries);
    expect(ledger.outstanding).toBe(2750);
  });

  it("falls back to the opening balance when there are no entries", async () => {
    mockRepo.findLedgerEntries.mockResolvedValue([]);

    const customer = buildCustomer({ openingBalance: 1000 });
    const ledger = await service.getCustomerLedger(customer);

    expect(ledger.outstanding).toBe(1000);
  });
});

// ─────────────────────────────────────────────────────────────
// createCustomer
// ─────────────────────────────────────────────────────────────

describe("CustomerService.createCustomer", () => {
  it("auto-generates the next code from the list total when none is provided", async () => {
    mockRepo.list.mockResolvedValue({
      items: [],
      total: 4,
      page: 1,
      pageSize: 1,
    });
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildCustomer());

    const result = await service.createCustomer(
      { name: "Acme" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const createArg = mockRepo.create.mock.calls[0]?.[0];
    expect(createArg.code).toBe("CUST-00005");
    expect(mockRepo.findByCode).toHaveBeenCalledWith("org-1", "CUST-00005");
  });

  it("uppercases a provided code", async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildCustomer());

    await service.createCustomer(
      { name: "Acme", code: "  abc-1  " },
      "org-1",
      "user-1"
    );
    const createArg = mockRepo.create.mock.calls[0]?.[0];
    expect(createArg.code).toBe("ABC-1");
    expect(mockRepo.list).not.toHaveBeenCalled();
  });

  it("fails with duplicate_code when the code already exists", async () => {
    mockRepo.findByCode.mockResolvedValue(buildCustomer());

    const result = await service.createCustomer(
      { name: "Acme", code: "CUST-1" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_code");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("fails with duplicate_gst when the GST number already exists", async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.findByGst.mockResolvedValue(buildCustomer());

    const result = await service.createCustomer(
      { name: "Acme", code: "CUST-1", gstNumber: "22aaaaa0000a1z5" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_gst");
    }
    expect(mockRepo.findByGst).toHaveBeenCalledWith("org-1", "22AAAAA0000A1Z5");
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("maps fields, converting empty strings to null and applying defaults", async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildCustomer());

    await service.createCustomer(
      {
        name: "  Acme  ",
        code: "CUST-1",
        company: "",
        email: "Sales@Acme.TEST",
        panNumber: "abcde1234f",
        billingCountry: "us",
        shippingCountry: "",
        notes: "  note  ",
        tags: ["vip"],
      },
      "org-1",
      "user-1"
    );

    const arg = mockRepo.create.mock.calls[0]?.[0];
    expect(arg.name).toBe("Acme");
    expect(arg.company).toBeNull();
    expect(arg.email).toBe("sales@acme.test");
    expect(arg.pan_number).toBe("ABCDE1234F");
    expect(arg.billing_country).toBe("US");
    expect(arg.shipping_country).toBeNull();
    expect(arg.notes).toBe("note");
    expect(arg.tags).toEqual(["vip"]);
    expect(arg.credit_limit).toBe(0);
    expect(arg.payment_terms_days).toBe(0);
    expect(arg.opening_balance).toBe(0);
    expect(arg.created_by).toBe("user-1");
  });

  it("defaults billing_country to IN when not provided", async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildCustomer());

    await service.createCustomer(
      { name: "Acme", code: "CUST-1" },
      "org-1",
      "user-1"
    );
    const arg = mockRepo.create.mock.calls[0]?.[0];
    expect(arg.billing_country).toBe("IN");
  });

  it("fails with unknown when the repository create returns null", async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(null);

    const result = await service.createCustomer(
      { name: "Acme", code: "CUST-1" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("succeeds and returns the created customer", async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    const created = buildCustomer();
    mockRepo.create.mockResolvedValue(created);

    const result = await service.createCustomer(
      { name: "Acme", code: "CUST-1" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(created);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// updateCustomer
// ─────────────────────────────────────────────────────────────

describe("CustomerService.updateCustomer", () => {
  it("fails with duplicate_code when the code belongs to a different customer", async () => {
    mockRepo.findByCode.mockResolvedValue(buildCustomer({ id: "other" }));

    const result = await service.updateCustomer(
      "cust-1",
      { code: "DUP" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_code");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("allows updating to a code owned by the same customer", async () => {
    mockRepo.findByCode.mockResolvedValue(buildCustomer({ id: "cust-1" }));
    mockRepo.update.mockResolvedValue(buildCustomer({ id: "cust-1" }));

    const result = await service.updateCustomer(
      "cust-1",
      { code: "cust-00001", name: "New Name" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.code).toBe("CUST-00001");
    expect(patch.name).toBe("New Name");
    expect(mockRepo.update.mock.calls[0]?.[2]).toBe("user-1");
  });

  it("skips the code duplicate check when the code is empty", async () => {
    mockRepo.update.mockResolvedValue(buildCustomer());

    const result = await service.updateCustomer(
      "cust-1",
      { code: "", name: "Renamed" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRepo.findByCode).not.toHaveBeenCalled();
  });

  it("restores an archived customer by clearing deleted_at when status changes", async () => {
    mockRepo.update.mockResolvedValue(
      buildCustomer({ id: "cust-1", status: "active" })
    );

    const result = await service.updateCustomer(
      "cust-1",
      { status: "active" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.status).toBe("active");
    expect(patch.deleted_at).toBeNull();
    expect(patch.deleted_by).toBeNull();
  });

  it("stamps deleted_at/deleted_by when the status is set to archived", async () => {
    mockRepo.update.mockResolvedValue(
      buildCustomer({ id: "cust-1", status: "archived" })
    );

    const result = await service.updateCustomer(
      "cust-1",
      { status: "archived" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.status).toBe("archived");
    expect(typeof patch.deleted_at).toBe("string");
    expect(patch.deleted_by).toBe("user-1");
  });

  it("fails with duplicate_gst when the GST belongs to a different customer", async () => {
    mockRepo.findByGst.mockResolvedValue(buildCustomer({ id: "other" }));

    const result = await service.updateCustomer(
      "cust-1",
      { gstNumber: "22aaaaa0000a1z5" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_gst");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("allows updating to a GST owned by the same customer", async () => {
    mockRepo.findByGst.mockResolvedValue(buildCustomer({ id: "cust-1" }));
    mockRepo.update.mockResolvedValue(buildCustomer({ id: "cust-1" }));

    const result = await service.updateCustomer(
      "cust-1",
      { gstNumber: "22aaaaa0000a1z5" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.gst_number).toBe("22AAAAA0000A1Z5");
  });

  it("returns not_found when the repository update returns null", async () => {
    mockRepo.update.mockResolvedValue(null);

    const result = await service.updateCustomer(
      "cust-1",
      { name: "Renamed" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("succeeds with the built patch", async () => {
    mockRepo.update.mockResolvedValue(buildCustomer());

    const result = await service.updateCustomer(
      "cust-1",
      {
        company: "",
        panNumber: "abcde1234f",
        email: "Sales@Acme.TEST",
        billingCountry: "us",
        shippingCountry: "in",
        status: "inactive",
        creditLimit: 9000,
        paymentTermsDays: 15,
        openingBalance: 500,
        tags: ["wholesale"],
      },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.company).toBeNull();
    expect(patch.pan_number).toBe("ABCDE1234F");
    expect(patch.email).toBe("sales@acme.test");
    expect(patch.billing_country).toBe("US");
    expect(patch.shipping_country).toBe("IN");
    expect(patch.status).toBe("inactive");
    expect(patch.credit_limit).toBe(9000);
    expect(patch.payment_terms_days).toBe(15);
    expect(patch.opening_balance).toBe(500);
    expect(patch.tags).toEqual(["wholesale"]);
  });
});

// ─────────────────────────────────────────────────────────────
// archiveCustomer
// ─────────────────────────────────────────────────────────────

describe("CustomerService.archiveCustomer", () => {
  it("returns not_found when the customer does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.archiveCustomer("cust-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it("fails with unknown when the soft delete fails", async () => {
    mockRepo.findById.mockResolvedValue(buildCustomer());
    mockRepo.softDelete.mockResolvedValue(false);

    const result = await service.archiveCustomer("cust-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("succeeds when the customer is soft deleted", async () => {
    mockRepo.findById.mockResolvedValue(buildCustomer());
    mockRepo.softDelete.mockResolvedValue(true);

    const result = await service.archiveCustomer("cust-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("cust-1", "user-1");
  });
});

describe("CustomerService.restoreCustomer", () => {
  it("returns not_found when the customer does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.restoreCustomer("cust-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.restore).not.toHaveBeenCalled();
  });

  it("restores an archived customer", async () => {
    mockRepo.findById.mockResolvedValue(buildCustomer({ status: "archived" }));
    mockRepo.restore.mockResolvedValue(true);

    const result = await service.restoreCustomer("cust-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.restore).toHaveBeenCalledWith("cust-1", "user-1");
  });
});

// ─────────────────────────────────────────────────────────────
// exportCustomersCsv
// ─────────────────────────────────────────────────────────────

describe("CustomerService.exportCustomersCsv", () => {
  it("serializes customers with the stable column set and joins tags by ';'", async () => {
    mockRepo.findAllForExport.mockResolvedValue([
      buildCustomer({
        code: "C1",
        name: "Acme",
        company: "Acme Pvt",
        billingCity: "Chennai",
        creditLimit: 5000,
        paymentTermsDays: 30,
        openingBalance: 1000,
        status: "active",
        tags: ["vip", "wholesale"],
        notes: null,
      }),
    ]);

    const csv = await service.exportCustomersCsv("org-1");
    const [header, firstRow] = csv.split("\r\n");

    expect(header).toBe(
      "code,name,company,gstNumber,panNumber,mobile,email,website," +
        "billingCity,billingState,billingPincode,creditLimit," +
        "paymentTermsDays,openingBalance,status,tags,notes"
    );
    expect(firstRow.startsWith("C1,Acme,Acme Pvt,")).toBe(true);
    expect(firstRow).toContain("vip;wholesale");
    expect(mockRepo.findAllForExport).toHaveBeenCalledWith("org-1");
  });

  it("quotes a value containing a comma", async () => {
    mockRepo.findAllForExport.mockResolvedValue([
      buildCustomer({ code: "C1", name: "Acme, Inc", tags: [], notes: null }),
    ]);

    const csv = await service.exportCustomersCsv("org-1");
    expect(csv).toContain('"Acme, Inc"');
  });

  it("returns just the header when there are no customers", async () => {
    mockRepo.findAllForExport.mockResolvedValue([]);
    const csv = await service.exportCustomersCsv("org-1");
    expect(csv.split("\r\n")).toHaveLength(1);
    expect(csv.startsWith("code,name")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// importCustomers
// ─────────────────────────────────────────────────────────────

describe("CustomerService.importCustomers", () => {
  it("creates valid rows and reports the created count", async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildCustomer());

    const result = await service.importCustomers(
      [
        { code: "C1", name: "Acme", tags: "vip;wholesale" },
        { code: "C2", name: "Beta" },
      ],
      "org-1",
      "user-1"
    );

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    const firstArg = mockRepo.create.mock.calls[0]?.[0];
    expect(firstArg.tags).toEqual(["vip", "wholesale"]);
  });

  it("skips invalid rows with a 1-based row number (header is row 1)", async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildCustomer());

    const result = await service.importCustomers(
      [
        { code: "C1", name: "Acme" }, // row 2 — valid
        { code: "C2", name: "A" }, // row 3 — name too short
      ],
      "org-1",
      "user-1"
    );

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
  });

  it("records duplicate_code failures as skipped without aborting the batch", async () => {
    // First row duplicates an existing code; second row is fresh.
    mockRepo.findByCode
      .mockResolvedValueOnce(buildCustomer({ id: "existing" }))
      .mockResolvedValueOnce(null);
    mockRepo.create.mockResolvedValue(buildCustomer());

    const result = await service.importCustomers(
      [
        { code: "DUP", name: "Acme" }, // row 2 — duplicate code
        { code: "C2", name: "Beta" }, // row 3 — created
      ],
      "org-1",
      "user-1"
    );

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[0].message).toContain("DUP");
  });

  it("returns zeroed counts for an empty batch", async () => {
    const result = await service.importCustomers([], "org-1", "user-1");
    expect(result).toEqual({ created: 0, skipped: 0, errors: [] });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});
