import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  SerialNumber,
  SerialActionResult,
  BulkSerialResult,
} from "@/features/serial/types/serial.types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  createSerialAction,
  bulkCreateSerialsAction,
  updateSerialAction,
  archiveSerialAction,
} from "./serial.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const {
  mockSerialService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockSerialService: {
    createSerial: vi.fn(),
    bulkCreateSerials: vi.fn(),
    updateSerial: vi.fn(),
    archiveSerial: vi.fn(),
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

vi.mock("@/features/serial/services/serial.service", () => ({
  SerialService: vi.fn(() => mockSerialService),
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

const PROD = "11111111-1111-1111-1111-111111111111";

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

function buildSerial(): SerialNumber {
  return {
    id: "ser-1",
    organizationId: "org-1",
    productId: PROD,
    productName: "Laptop",
    productCode: "LAP-1",
    warehouseId: null,
    batchId: null,
    serialNumber: "SN-0001",
    status: "in_stock",
    referenceType: null,
    referenceId: null,
    notes: null,
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
// createSerialAction
// ─────────────────────────────────────────────────────────────

describe("createSerialAction", () => {
  it("returns a validation error on invalid input", async () => {
    const result = await createSerialAction("org-1", fd({ serialNumber: "" }));
    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockSerialService.createSerial).not.toHaveBeenCalled();
  });

  it("returns forbidden when not authenticated", async () => {
    unauthenticated();
    const result = await createSerialAction(
      "org-1",
      fd({ productId: PROD, serialNumber: "SN-1" })
    );
    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
  });

  it("returns forbidden when the caller lacks inventory.adjust", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.view"])
    );
    const result = await createSerialAction(
      "org-1",
      fd({ productId: PROD, serialNumber: "SN-1" })
    );
    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockSerialService.createSerial).not.toHaveBeenCalled();
  });

  it("creates, revalidates and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    const success: SerialActionResult<SerialNumber> = {
      success: true,
      data: buildSerial(),
    };
    mockSerialService.createSerial.mockResolvedValue(success);

    const result = await createSerialAction(
      "org-1",
      fd({ productId: PROD, serialNumber: "SN-0001" })
    );

    expect(mockSerialService.createSerial).toHaveBeenCalledWith(
      expect.objectContaining({ productId: PROD, serialNumber: "SN-0001" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/inventory/serials");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "serial.create",
        entityType: "serial",
        entityId: "ser-1",
      })
    );
  });

  it("surfaces a service failure without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    const failure: SerialActionResult<SerialNumber> = {
      success: false,
      error: { code: "duplicate_serial", message: "taken" },
    };
    mockSerialService.createSerial.mockResolvedValue(failure);

    const result = await createSerialAction(
      "org-1",
      fd({ productId: PROD, serialNumber: "SN-0001" })
    );

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// bulkCreateSerialsAction
// ─────────────────────────────────────────────────────────────

describe("bulkCreateSerialsAction", () => {
  it("returns a validation error when no serials are provided", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    const result = await bulkCreateSerialsAction(
      "org-1",
      fd({ productId: PROD, serialNumbers: "  \n , " })
    );
    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockSerialService.bulkCreateSerials).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks inventory.adjust", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.view"])
    );
    const result = await bulkCreateSerialsAction(
      "org-1",
      fd({ productId: PROD, serialNumbers: "SN-1\nSN-2" })
    );
    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockSerialService.bulkCreateSerials).not.toHaveBeenCalled();
  });

  it("splits serials, bulk-creates, revalidates and audits with counts", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    const summary: BulkSerialResult = {
      created: 2,
      skipped: 1,
      errors: [{ serial: "SN-1", message: "Duplicate within this batch" }],
    };
    mockSerialService.bulkCreateSerials.mockResolvedValue(summary);

    const result = await bulkCreateSerialsAction(
      "org-1",
      fd({ productId: PROD, serialNumbers: "SN-1, SN-1\nSN-2, SN-3" })
    );

    expect(result).toEqual({ success: true, data: summary });
    const [serials, productId, orgId, userId] =
      mockSerialService.bulkCreateSerials.mock.calls[0] as [
        string[],
        string,
        string,
        string,
        unknown,
      ];
    expect(serials).toEqual(["SN-1", "SN-2", "SN-3"]);
    expect(productId).toBe(PROD);
    expect(orgId).toBe("org-1");
    expect(userId).toBe("user-1");
    expect(revalidateMock).toHaveBeenCalledWith("/inventory/serials");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "serial.create",
        entityType: "serial",
        metadata: { created: 2, skipped: 1, errorCount: 1 },
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// updateSerialAction
// ─────────────────────────────────────────────────────────────

describe("updateSerialAction", () => {
  it("returns a validation error on an invalid status", async () => {
    const result = await updateSerialAction(
      "org-1",
      "ser-1",
      fd({ status: "exploded" })
    );
    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockSerialService.updateSerial).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks inventory.adjust", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.view"])
    );
    const result = await updateSerialAction(
      "org-1",
      "ser-1",
      fd({ status: "sold" })
    );
    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
  });

  it("updates, revalidates and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    const success: SerialActionResult<SerialNumber> = {
      success: true,
      data: buildSerial(),
    };
    mockSerialService.updateSerial.mockResolvedValue(success);

    const result = await updateSerialAction(
      "org-1",
      "ser-1",
      fd({ status: "sold" })
    );

    expect(mockSerialService.updateSerial).toHaveBeenCalledWith(
      "ser-1",
      expect.objectContaining({ status: "sold" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/inventory/serials");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "serial.update",
        entityType: "serial",
        entityId: "ser-1",
      })
    );
  });

  it("surfaces a service failure without auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    const failure: SerialActionResult<SerialNumber> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockSerialService.updateSerial.mockResolvedValue(failure);

    const result = await updateSerialAction(
      "org-1",
      "ser-1",
      fd({ status: "sold" })
    );

    expect(result).toBe(failure);
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// archiveSerialAction
// ─────────────────────────────────────────────────────────────

describe("archiveSerialAction", () => {
  it("returns forbidden when the caller lacks inventory.adjust", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.view"])
    );
    const result = await archiveSerialAction("org-1", "ser-1");
    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockSerialService.archiveSerial).not.toHaveBeenCalled();
  });

  it("archives, revalidates and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    const success: SerialActionResult<void> = {
      success: true,
      data: undefined,
    };
    mockSerialService.archiveSerial.mockResolvedValue(success);

    const result = await archiveSerialAction("org-1", "ser-1");

    expect(mockSerialService.archiveSerial).toHaveBeenCalledWith(
      "ser-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/inventory/serials");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "serial.archive",
        entityType: "serial",
        entityId: "ser-1",
      })
    );
  });

  it("surfaces a service failure without auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    const failure: SerialActionResult<void> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockSerialService.archiveSerial.mockResolvedValue(failure);

    const result = await archiveSerialAction("org-1", "ser-1");

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
