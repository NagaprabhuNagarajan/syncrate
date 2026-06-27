import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Unit, UnitActionResult } from "@/features/unit/types/unit.types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  createUnitAction,
  updateUnitAction,
  archiveUnitAction,
} from "./unit.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const {
  mockUnitService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockUnitService: {
    createUnit: vi.fn(),
    updateUnit: vi.fn(),
    archiveUnit: vi.fn(),
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

vi.mock("@/features/unit/services/unit.service", () => ({
  UnitService: vi.fn(() => mockUnitService),
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

function buildUnit(): Unit {
  return {
    id: "unit-1",
    organizationId: "org-1",
    name: "Kilogram",
    symbol: "kg",
    status: "active",
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
// createUnitAction
// ─────────────────────────────────────────────────────────────

describe("createUnitAction", () => {
  it("returns a validation error and does not call the service on invalid input", async () => {
    const result = await createUnitAction("org-1", fd({ name: "Kilogram" }));

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockUnitService.createUnit).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await createUnitAction(
      "org-1",
      fd({ name: "Kilogram", symbol: "kg" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockUnitService.createUnit).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller has no org context", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await createUnitAction(
      "org-1",
      fd({ name: "Kilogram", symbol: "kg" })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    });
    expect(mockUnitService.createUnit).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks product.create", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );

    const result = await createUnitAction(
      "org-1",
      fd({ name: "Kilogram", symbol: "kg" })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockUnitService.createUnit).not.toHaveBeenCalled();
  });

  it("calls the service with parsed args and revalidates/audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );
    const success: UnitActionResult<Unit> = {
      success: true,
      data: buildUnit(),
    };
    mockUnitService.createUnit.mockResolvedValue(success);

    const result = await createUnitAction(
      "org-1",
      fd({ name: "Kilogram", symbol: "kg" })
    );

    expect(mockUnitService.createUnit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Kilogram", symbol: "kg" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products/units");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "unit.create",
        entityType: "unit",
        entityId: "unit-1",
        actorUserId: "user-1",
        organizationId: "org-1",
      })
    );
  });

  it("does not change the result when the audit log fails", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );
    const success: UnitActionResult<Unit> = {
      success: true,
      data: buildUnit(),
    };
    mockUnitService.createUnit.mockResolvedValue(success);
    auditLogMock.mockResolvedValue(false);

    const result = await createUnitAction(
      "org-1",
      fd({ name: "Kilogram", symbol: "kg" })
    );

    expect(result).toBe(success);
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );
    const failure: UnitActionResult<Unit> = {
      success: false,
      error: { code: "duplicate_name", message: "taken" },
    };
    mockUnitService.createUnit.mockResolvedValue(failure);

    const result = await createUnitAction(
      "org-1",
      fd({ name: "Kilogram", symbol: "kg" })
    );

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updateUnitAction
// ─────────────────────────────────────────────────────────────

describe("updateUnitAction", () => {
  it("returns a validation error and does not call the service on invalid input", async () => {
    const result = await updateUnitAction(
      "org-1",
      "unit-1",
      fd({ symbol: "x".repeat(11) })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockUnitService.updateUnit).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks product.update", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );

    const result = await updateUnitAction(
      "org-1",
      "unit-1",
      fd({ name: "Gram" })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockUnitService.updateUnit).not.toHaveBeenCalled();
  });

  it("calls the service with parsed args and revalidates/audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const success: UnitActionResult<Unit> = {
      success: true,
      data: buildUnit(),
    };
    mockUnitService.updateUnit.mockResolvedValue(success);

    const result = await updateUnitAction(
      "org-1",
      "unit-1",
      fd({ name: "Gram" })
    );

    expect(mockUnitService.updateUnit).toHaveBeenCalledWith(
      "unit-1",
      expect.objectContaining({ name: "Gram" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products/units");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "unit.update",
        entityType: "unit",
        entityId: "unit-1",
      })
    );
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const failure: UnitActionResult<Unit> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockUnitService.updateUnit.mockResolvedValue(failure);

    const result = await updateUnitAction(
      "org-1",
      "unit-1",
      fd({ name: "Gram" })
    );

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// archiveUnitAction
// ─────────────────────────────────────────────────────────────

describe("archiveUnitAction", () => {
  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await archiveUnitAction("org-1", "unit-1");

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockUnitService.archiveUnit).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks product.update", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.view"])
    );

    const result = await archiveUnitAction("org-1", "unit-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockUnitService.archiveUnit).not.toHaveBeenCalled();
  });

  it("calls the service and revalidates/audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const success: UnitActionResult<void> = {
      success: true,
      data: undefined,
    };
    mockUnitService.archiveUnit.mockResolvedValue(success);

    const result = await archiveUnitAction("org-1", "unit-1");

    expect(mockUnitService.archiveUnit).toHaveBeenCalledWith("unit-1", "user-1");
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products/units");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "unit.archive",
        entityType: "unit",
        entityId: "unit-1",
      })
    );
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const failure: UnitActionResult<void> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockUnitService.archiveUnit.mockResolvedValue(failure);

    const result = await archiveUnitAction("org-1", "unit-1");

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
