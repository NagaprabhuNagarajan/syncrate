import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  Supplier,
  SupplierActionResult,
} from "@/features/supplier/types/supplier.types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  createSupplierAction,
  updateSupplierAction,
  archiveSupplierAction,
  restoreSupplierAction,
  exportSuppliersAction,
  importSuppliersAction,
} from "./supplier.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const {
  mockSupplierService,
  mockOrgService,
  mockAuditLog,
  revalidateMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  mockSupplierService: {
    createSupplier: vi.fn(),
    updateSupplier: vi.fn(),
    archiveSupplier: vi.fn(),
    restoreSupplier: vi.fn(),
    exportSuppliersCsv: vi.fn(),
    importSuppliers: vi.fn(),
  },
  mockOrgService: {
    getOrganizationContext: vi.fn(),
  },
  mockAuditLog: vi.fn(),
  revalidateMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidateMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createClientMock,
}));

vi.mock("@/features/supplier/services/supplier.service", () => ({
  SupplierService: vi.fn(() => mockSupplierService),
}));

vi.mock("@/features/organization/services/organization.service", () => ({
  OrganizationService: vi.fn(() => mockOrgService),
}));

vi.mock("@/features/audit/services/audit.service", () => ({
  AuditService: vi.fn(() => ({ log: mockAuditLog })),
}));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const ORG_ID = "org-1";

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

function grant(permissions: string[]): void {
  mockOrgService.getOrganizationContext.mockResolvedValue({
    permissions,
  } as unknown as OrganizationContext);
}

function buildSupplier(): Supplier {
  return {
    id: "supplier-1",
    organizationId: ORG_ID,
    code: "SUPP-00001",
    name: "Acme",
    contactPerson: null,
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
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  mockAuditLog.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// createSupplierAction
// ─────────────────────────────────────────────────────────────

describe("createSupplierAction", () => {
  it("returns validation error on invalid input without calling the service", async () => {
    const result = await createSupplierAction(ORG_ID, fd({ name: "A" }));

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockSupplierService.createSupplier).not.toHaveBeenCalled();
  });

  it("returns forbidden when not authenticated", async () => {
    unauthenticated();

    const result = await createSupplierAction(ORG_ID, fd({ name: "Acme" }));

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockSupplierService.createSupplier).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user lacks supplier.create", async () => {
    authedAs("user-1");
    grant(["supplier.view"]);

    const result = await createSupplierAction(ORG_ID, fd({ name: "Acme" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockSupplierService.createSupplier).not.toHaveBeenCalled();
  });

  it("returns forbidden when there is no org context", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await createSupplierAction(ORG_ID, fd({ name: "Acme" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("creates the supplier, revalidates and returns the result on success", async () => {
    authedAs("user-1");
    grant(["supplier.create"]);
    const success: SupplierActionResult<Supplier> = {
      success: true,
      data: buildSupplier(),
    };
    mockSupplierService.createSupplier.mockResolvedValue(success);

    const result = await createSupplierAction(
      ORG_ID,
      fd({ name: "Acme", rating: "4.5", tags: "preferred, raw-materials" })
    );

    expect(result).toBe(success);
    expect(mockSupplierService.createSupplier).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Acme",
        rating: 4.5,
        tags: ["preferred", "raw-materials"],
      }),
      ORG_ID,
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/suppliers");
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "supplier.create",
        entityType: "supplier",
        entityId: "supplier-1",
        actorUserId: "user-1",
        organizationId: ORG_ID,
      })
    );
  });

  it("does not revalidate or audit when the service fails", async () => {
    authedAs("user-1");
    grant(["supplier.create"]);
    mockSupplierService.createSupplier.mockResolvedValue({
      success: false,
      error: { code: "duplicate_code", message: "taken" },
    });

    await createSupplierAction(ORG_ID, fd({ name: "Acme" }));

    expect(revalidateMock).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updateSupplierAction
// ─────────────────────────────────────────────────────────────

describe("updateSupplierAction", () => {
  it("returns validation error on invalid input", async () => {
    const result = await updateSupplierAction(
      ORG_ID,
      "supplier-1",
      fd({ name: "A" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockSupplierService.updateSupplier).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user lacks supplier.update", async () => {
    authedAs("user-1");
    grant(["supplier.view"]);

    const result = await updateSupplierAction(
      ORG_ID,
      "supplier-1",
      fd({ name: "Acme Updated" })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("updates and revalidates both list and detail paths on success", async () => {
    authedAs("user-1");
    grant(["supplier.update"]);
    mockSupplierService.updateSupplier.mockResolvedValue({
      success: true,
      data: buildSupplier(),
    });

    await updateSupplierAction(
      ORG_ID,
      "supplier-1",
      fd({ name: "Acme Updated", status: "inactive" })
    );

    expect(mockSupplierService.updateSupplier).toHaveBeenCalledWith(
      "supplier-1",
      expect.objectContaining({ name: "Acme Updated", status: "inactive" }),
      ORG_ID,
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/suppliers");
    expect(revalidateMock).toHaveBeenCalledWith("/suppliers/supplier-1");
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "supplier.update",
        entityType: "supplier",
        entityId: "supplier-1",
      })
    );
  });

  it("does not audit when the update service fails", async () => {
    authedAs("user-1");
    grant(["supplier.update"]);
    mockSupplierService.updateSupplier.mockResolvedValue({
      success: false,
      error: { code: "duplicate_code", message: "taken" },
    });

    await updateSupplierAction(ORG_ID, "supplier-1", fd({ name: "Acme Inc" }));

    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// archiveSupplierAction
// ─────────────────────────────────────────────────────────────

describe("archiveSupplierAction", () => {
  it("returns forbidden when not authenticated", async () => {
    unauthenticated();

    const result = await archiveSupplierAction(ORG_ID, "supplier-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockSupplierService.archiveSupplier).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user lacks supplier.archive", async () => {
    authedAs("user-1");
    grant(["supplier.view"]);

    const result = await archiveSupplierAction(ORG_ID, "supplier-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("archives and revalidates on success", async () => {
    authedAs("user-1");
    grant(["supplier.archive"]);
    mockSupplierService.archiveSupplier.mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await archiveSupplierAction(ORG_ID, "supplier-1");

    expect(result.success).toBe(true);
    expect(mockSupplierService.archiveSupplier).toHaveBeenCalledWith(
      "supplier-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/suppliers");
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "supplier.archive",
        entityType: "supplier",
        entityId: "supplier-1",
      })
    );
  });

  it("does not audit when archive fails", async () => {
    authedAs("user-1");
    grant(["supplier.archive"]);
    mockSupplierService.archiveSupplier.mockResolvedValue({
      success: false,
      error: { code: "not_found", message: "gone" },
    });

    await archiveSupplierAction(ORG_ID, "supplier-1");

    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// restoreSupplierAction
// ─────────────────────────────────────────────────────────────

describe("restoreSupplierAction", () => {
  it("returns forbidden when the user lacks supplier.update", async () => {
    authedAs("user-1");
    grant(["supplier.view"]);

    const result = await restoreSupplierAction(ORG_ID, "supplier-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockSupplierService.restoreSupplier).not.toHaveBeenCalled();
  });

  it("restores, revalidates and audits on success", async () => {
    authedAs("user-1");
    grant(["supplier.update"]);
    mockSupplierService.restoreSupplier.mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await restoreSupplierAction(ORG_ID, "supplier-1");

    expect(result.success).toBe(true);
    expect(mockSupplierService.restoreSupplier).toHaveBeenCalledWith(
      "supplier-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/suppliers");
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "supplier.restore",
        entityType: "supplier",
        entityId: "supplier-1",
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// exportSuppliersAction
// ─────────────────────────────────────────────────────────────

describe("exportSuppliersAction", () => {
  it("returns forbidden when the user lacks supplier.view", async () => {
    authedAs("user-1");
    grant([]);

    const result = await exportSuppliersAction(ORG_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockSupplierService.exportSuppliersCsv).not.toHaveBeenCalled();
  });

  it("returns the CSV and writes an audit entry on success", async () => {
    authedAs("user-1");
    grant(["supplier.view"]);
    mockSupplierService.exportSuppliersCsv.mockResolvedValue("code,name\r\n");

    const result = await exportSuppliersAction(ORG_ID);

    expect(result).toEqual({ success: true, data: "code,name\r\n" });
    expect(mockSupplierService.exportSuppliersCsv).toHaveBeenCalledWith(ORG_ID);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "supplier.export",
        entityType: "supplier",
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// importSuppliersAction
// ─────────────────────────────────────────────────────────────

describe("importSuppliersAction", () => {
  it("returns forbidden when the user lacks supplier.create", async () => {
    authedAs("user-1");
    grant(["supplier.view"]);

    const result = await importSuppliersAction(ORG_ID, "code,name\r\nSUPP-1,Acme");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockSupplierService.importSuppliers).not.toHaveBeenCalled();
  });

  it("parses the CSV, imports rows, revalidates and audits the summary", async () => {
    authedAs("user-1");
    grant(["supplier.create"]);
    const summary = { created: 1, skipped: 1, errors: [{ row: 3, message: "bad" }] };
    mockSupplierService.importSuppliers.mockResolvedValue(summary);

    const result = await importSuppliersAction(
      ORG_ID,
      "code,name\r\nSUPP-1,Acme\r\nSUPP-2,A"
    );

    expect(result).toEqual({ success: true, data: summary });
    const [rowsArg, orgArg, userArg] =
      mockSupplierService.importSuppliers.mock.calls[0] ?? [];
    expect(rowsArg).toEqual([
      { code: "SUPP-1", name: "Acme" },
      { code: "SUPP-2", name: "A" },
    ]);
    expect(orgArg).toBe(ORG_ID);
    expect(userArg).toBe("user-1");
    expect(revalidateMock).toHaveBeenCalledWith("/suppliers");
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "supplier.import",
        entityType: "supplier",
        metadata: { created: 1, skipped: 1, errorCount: 1 },
      })
    );
  });
});
