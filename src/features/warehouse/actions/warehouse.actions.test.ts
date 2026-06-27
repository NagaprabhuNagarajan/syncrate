import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  Warehouse,
  WarehouseActionResult,
} from "@/features/warehouse/types/warehouse.types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  createWarehouseAction,
  updateWarehouseAction,
  archiveWarehouseAction,
} from "./warehouse.actions";

const {
  mockWarehouseService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockWarehouseService: {
    createWarehouse: vi.fn(),
    updateWarehouse: vi.fn(),
    archiveWarehouse: vi.fn(),
  },
  mockOrgService: { getOrganizationContext: vi.fn() },
  revalidateMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  auditLogMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createClientMock,
}));
vi.mock("@/features/warehouse/services/warehouse.service", () => ({
  WarehouseService: vi.fn(() => mockWarehouseService),
}));
vi.mock("@/features/organization/services/organization.service", () => ({
  OrganizationService: vi.fn(() => mockOrgService),
}));
vi.mock("@/features/audit/services/audit.service", () => ({
  AuditService: vi.fn(() => ({ log: auditLogMock })),
}));

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

function buildWarehouse(): Warehouse {
  return {
    id: "wh-1",
    organizationId: "org-1",
    branchId: null,
    code: "WH-01",
    name: "Chennai Central",
    addressLine1: null,
    city: null,
    state: null,
    pincode: null,
    capacity: null,
    isDefault: false,
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

describe("createWarehouseAction", () => {
  it("returns validation error on invalid input", async () => {
    const result = await createWarehouseAction("org-1", fd({ name: "Main" }));
    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockWarehouseService.createWarehouse).not.toHaveBeenCalled();
  });

  it("returns forbidden when unauthenticated", async () => {
    unauthenticated();
    const result = await createWarehouseAction(
      "org-1",
      fd({ code: "WH-01", name: "Main" })
    );
    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
  });

  it("returns forbidden when lacking inventory.adjust", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.view"])
    );
    const result = await createWarehouseAction(
      "org-1",
      fd({ code: "WH-01", name: "Main" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockWarehouseService.createWarehouse).not.toHaveBeenCalled();
  });

  it("creates, revalidates and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    const success: WarehouseActionResult<Warehouse> = {
      success: true,
      data: buildWarehouse(),
    };
    mockWarehouseService.createWarehouse.mockResolvedValue(success);

    const result = await createWarehouseAction(
      "org-1",
      fd({ code: "WH-01", name: "Chennai Central", capacity: "500" })
    );

    expect(result).toBe(success);
    expect(mockWarehouseService.createWarehouse).toHaveBeenCalledWith(
      expect.objectContaining({ code: "WH-01", name: "Chennai Central" }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/inventory/warehouses");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "warehouse.create",
        entityType: "warehouse",
        entityId: "wh-1",
      })
    );
  });

  it("does not revalidate/audit on service failure", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    mockWarehouseService.createWarehouse.mockResolvedValue({
      success: false,
      error: { code: "duplicate_code", message: "taken" },
    });
    await createWarehouseAction("org-1", fd({ code: "WH-01", name: "Main" }));
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

describe("updateWarehouseAction", () => {
  it("updates, revalidates and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    const success: WarehouseActionResult<Warehouse> = {
      success: true,
      data: buildWarehouse(),
    };
    mockWarehouseService.updateWarehouse.mockResolvedValue(success);

    const result = await updateWarehouseAction(
      "org-1",
      "wh-1",
      fd({ name: "Renamed" })
    );

    expect(result).toBe(success);
    expect(mockWarehouseService.updateWarehouse).toHaveBeenCalledWith(
      "wh-1",
      expect.objectContaining({ name: "Renamed" }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/inventory/warehouses");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "warehouse.update" })
    );
  });

  it("returns forbidden when lacking permission", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.view"])
    );
    const result = await updateWarehouseAction(
      "org-1",
      "wh-1",
      fd({ name: "Renamed" })
    );
    expect(result.success).toBe(false);
    expect(mockWarehouseService.updateWarehouse).not.toHaveBeenCalled();
  });
});

describe("archiveWarehouseAction", () => {
  it("archives, revalidates and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    mockWarehouseService.archiveWarehouse.mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await archiveWarehouseAction("org-1", "wh-1");
    expect(result.success).toBe(true);
    expect(mockWarehouseService.archiveWarehouse).toHaveBeenCalledWith(
      "wh-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/inventory/warehouses");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "warehouse.archive" })
    );
  });

  it("returns forbidden when unauthenticated", async () => {
    unauthenticated();
    const result = await archiveWarehouseAction("org-1", "wh-1");
    expect(result.success).toBe(false);
    expect(mockWarehouseService.archiveWarehouse).not.toHaveBeenCalled();
  });
});
