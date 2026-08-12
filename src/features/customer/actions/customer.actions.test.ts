import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  Customer,
  CustomerActionResult,
} from "@/features/customer/types/customer.types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  createCustomerAction,
  updateCustomerAction,
  archiveCustomerAction,
  restoreCustomerAction,
  exportCustomersAction,
  importCustomersAction,
} from "./customer.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const {
  mockCustomerService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockCustomerService: {
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    archiveCustomer: vi.fn(),
    restoreCustomer: vi.fn(),
    exportCustomersCsv: vi.fn(),
    importCustomers: vi.fn(),
  },
  mockOrgService: {
    getOrganizationContext: vi.fn(),
  },
  revalidateMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  auditLogMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidateMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createClientMock,
}));

vi.mock("@/features/customer/services/customer.service", () => ({
  CustomerService: vi.fn(() => mockCustomerService),
}));

vi.mock("@/features/organization/services/organization.service", () => ({
  OrganizationService: vi.fn(() => mockOrgService),
}));

vi.mock("@/features/audit/services/audit.service", () => ({
  AuditService: vi.fn(() => ({ log: auditLogMock })),
}));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }
  return form;
}

const fakeSupabase = {
  auth: { getUser: getUserMock },
} as unknown as AppSupabaseClient;

function authedAs(userId: string): void {
  getUserMock.mockResolvedValue({ data: { user: { id: userId } } });
}

function unauthenticated(): void {
  getUserMock.mockResolvedValue({ data: { user: null } });
}

function contextWith(permissions: readonly string[]): OrganizationContext {
  return { permissions } as unknown as OrganizationContext;
}

function buildCustomer(): Customer {
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
    openingBalance: 0,
    status: "active",
    tags: [],
    notes: null,
    cbnConnectionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// createCustomerAction
// ─────────────────────────────────────────────────────────────

describe("createCustomerAction", () => {
  it("returns a validation error and does not call the service on invalid input", async () => {
    const result = await createCustomerAction("org-1", fd({ name: "A" }));

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockCustomerService.createCustomer).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await createCustomerAction("org-1", fd({ name: "Acme Co" }));

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockCustomerService.createCustomer).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller has no org context", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await createCustomerAction("org-1", fd({ name: "Acme Co" }));

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    });
    expect(mockCustomerService.createCustomer).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks customer.create", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.update"])
    );

    const result = await createCustomerAction("org-1", fd({ name: "Acme Co" }));

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockCustomerService.createCustomer).not.toHaveBeenCalled();
  });

  it("calls the service with parsed args and revalidates on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.create"])
    );
    const success: CustomerActionResult<Customer> = {
      success: true,
      data: buildCustomer(),
    };
    mockCustomerService.createCustomer.mockResolvedValue(success);

    const result = await createCustomerAction(
      "org-1",
      fd({ name: "Acme Co", email: "Sales@Acme.TEST", tags: "vip, wholesale ," })
    );

    expect(mockCustomerService.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Acme Co",
        email: "sales@acme.test",
        tags: ["vip", "wholesale"],
      }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/customers");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer.create",
        entityType: "customer",
        entityId: "cust-1",
        actorUserId: "user-1",
        organizationId: "org-1",
      })
    );
  });

  it("does not change the result when the audit log fails", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.create"])
    );
    const success: CustomerActionResult<Customer> = {
      success: true,
      data: buildCustomer(),
    };
    mockCustomerService.createCustomer.mockResolvedValue(success);
    auditLogMock.mockResolvedValue(false);

    const result = await createCustomerAction("org-1", fd({ name: "Acme Co" }));

    expect(result).toBe(success);
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.create"])
    );
    const failure: CustomerActionResult<Customer> = {
      success: false,
      error: { code: "duplicate_code", message: "taken" },
    };
    mockCustomerService.createCustomer.mockResolvedValue(failure);

    const result = await createCustomerAction("org-1", fd({ name: "Acme Co" }));

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("does not audit on forbidden paths", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.update"])
    );

    await createCustomerAction("org-1", fd({ name: "Acme Co" }));

    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updateCustomerAction
// ─────────────────────────────────────────────────────────────

describe("updateCustomerAction", () => {
  it("returns a validation error and does not call the service on invalid input", async () => {
    const result = await updateCustomerAction(
      "org-1",
      "cust-1",
      fd({ name: "A" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockCustomerService.updateCustomer).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await updateCustomerAction(
      "org-1",
      "cust-1",
      fd({ name: "Valid Name" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockCustomerService.updateCustomer).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller has no org context", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await updateCustomerAction(
      "org-1",
      "cust-1",
      fd({ name: "Valid Name" })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    });
    expect(mockCustomerService.updateCustomer).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks customer.update", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.create"])
    );

    const result = await updateCustomerAction(
      "org-1",
      "cust-1",
      fd({ name: "Valid Name" })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockCustomerService.updateCustomer).not.toHaveBeenCalled();
  });

  it("calls the service with parsed args and revalidates on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.update"])
    );
    const success: CustomerActionResult<Customer> = {
      success: true,
      data: buildCustomer(),
    };
    mockCustomerService.updateCustomer.mockResolvedValue(success);

    const result = await updateCustomerAction(
      "org-1",
      "cust-1",
      fd({ name: "Renamed Co" })
    );

    expect(mockCustomerService.updateCustomer).toHaveBeenCalledWith(
      "cust-1",
      expect.objectContaining({ name: "Renamed Co" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/customers");
    expect(revalidateMock).toHaveBeenCalledWith("/customers/cust-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer.update",
        entityType: "customer",
        entityId: "cust-1",
      })
    );
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.update"])
    );
    const failure: CustomerActionResult<Customer> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockCustomerService.updateCustomer.mockResolvedValue(failure);

    const result = await updateCustomerAction(
      "org-1",
      "cust-1",
      fd({ name: "Renamed Co" })
    );

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// archiveCustomerAction
// ─────────────────────────────────────────────────────────────

describe("archiveCustomerAction", () => {
  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await archiveCustomerAction("org-1", "cust-1");

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockCustomerService.archiveCustomer).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller has no org context", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await archiveCustomerAction("org-1", "cust-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    });
    expect(mockCustomerService.archiveCustomer).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks customer.archive", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.update"])
    );

    const result = await archiveCustomerAction("org-1", "cust-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockCustomerService.archiveCustomer).not.toHaveBeenCalled();
  });

  it("calls the service and revalidates on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.archive"])
    );
    const success: CustomerActionResult<void> = {
      success: true,
      data: undefined,
    };
    mockCustomerService.archiveCustomer.mockResolvedValue(success);

    const result = await archiveCustomerAction("org-1", "cust-1");

    expect(mockCustomerService.archiveCustomer).toHaveBeenCalledWith(
      "cust-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/customers");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer.archive",
        entityType: "customer",
        entityId: "cust-1",
      })
    );
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.archive"])
    );
    const failure: CustomerActionResult<void> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockCustomerService.archiveCustomer.mockResolvedValue(failure);

    const result = await archiveCustomerAction("org-1", "cust-1");

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// restoreCustomerAction
// ─────────────────────────────────────────────────────────────

describe("restoreCustomerAction", () => {
  it("returns forbidden when the caller lacks customer.update", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.view"])
    );

    const result = await restoreCustomerAction("org-1", "cust-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockCustomerService.restoreCustomer).not.toHaveBeenCalled();
  });

  it("calls the service, revalidates and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.update"])
    );
    const success: CustomerActionResult<void> = {
      success: true,
      data: undefined,
    };
    mockCustomerService.restoreCustomer.mockResolvedValue(success);

    const result = await restoreCustomerAction("org-1", "cust-1");

    expect(mockCustomerService.restoreCustomer).toHaveBeenCalledWith(
      "cust-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/customers");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer.restore",
        entityType: "customer",
        entityId: "cust-1",
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// exportCustomersAction
// ─────────────────────────────────────────────────────────────

describe("exportCustomersAction", () => {
  it("returns forbidden when the caller lacks customer.export", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.create"])
    );

    const result = await exportCustomersAction("org-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockCustomerService.exportCustomersCsv).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("returns the CSV and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.export"])
    );
    mockCustomerService.exportCustomersCsv.mockResolvedValue(
      "code,name\r\nC1,Acme"
    );

    const result = await exportCustomersAction("org-1");

    expect(result).toEqual({ success: true, data: "code,name\r\nC1,Acme" });
    expect(mockCustomerService.exportCustomersCsv).toHaveBeenCalledWith("org-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer.export",
        entityType: "customer",
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// importCustomersAction
// ─────────────────────────────────────────────────────────────

describe("importCustomersAction", () => {
  it("returns forbidden when the caller lacks customer.create", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.update"])
    );

    const result = await importCustomersAction("org-1", "code,name");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockCustomerService.importCustomers).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("parses the CSV, imports, revalidates and audits with counts", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["customer.create"])
    );
    const summary = {
      created: 2,
      skipped: 1,
      errors: [{ row: 4, message: "duplicate" }],
    };
    mockCustomerService.importCustomers.mockResolvedValue(summary);

    const csv = "name\r\nAcme\r\nBeta\r\nGamma";
    const result = await importCustomersAction("org-1", csv);

    expect(result).toEqual({ success: true, data: summary });
    // csvToObjects strips the header row, so 3 data rows are passed.
    const rowsArg = mockCustomerService.importCustomers.mock.calls[0]?.[0];
    expect(rowsArg).toHaveLength(3);
    expect(mockCustomerService.importCustomers).toHaveBeenCalledWith(
      expect.any(Array),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/customers");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer.import",
        entityType: "customer",
        metadata: { created: 2, skipped: 1, errorCount: 1 },
      })
    );
  });
});
