import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  Brand,
  BrandActionResult,
} from "@/features/brand/types/brand.types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  createBrandAction,
  updateBrandAction,
  archiveBrandAction,
} from "./brand.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const {
  mockBrandService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockBrandService: {
    createBrand: vi.fn(),
    updateBrand: vi.fn(),
    archiveBrand: vi.fn(),
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

vi.mock("@/features/brand/services/brand.service", () => ({
  BrandService: vi.fn(() => mockBrandService),
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

function buildBrand(): Brand {
  return {
    id: "brand-1",
    organizationId: "org-1",
    name: "Samsung",
    description: null,
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
// createBrandAction
// ─────────────────────────────────────────────────────────────

describe("createBrandAction", () => {
  it("returns a validation error and does not call the service on invalid input", async () => {
    const result = await createBrandAction("org-1", fd({ name: "A" }));

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockBrandService.createBrand).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await createBrandAction("org-1", fd({ name: "Samsung" }));

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockBrandService.createBrand).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller has no org context", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await createBrandAction("org-1", fd({ name: "Samsung" }));

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    });
    expect(mockBrandService.createBrand).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks product.create", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );

    const result = await createBrandAction("org-1", fd({ name: "Samsung" }));

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockBrandService.createBrand).not.toHaveBeenCalled();
  });

  it("calls the service with parsed args and revalidates on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );
    const success: BrandActionResult<Brand> = {
      success: true,
      data: buildBrand(),
    };
    mockBrandService.createBrand.mockResolvedValue(success);

    const result = await createBrandAction(
      "org-1",
      fd({ name: "Samsung", description: "Electronics" })
    );

    expect(mockBrandService.createBrand).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Samsung", description: "Electronics" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products/brands");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "brand.create",
        entityType: "brand",
        entityId: "brand-1",
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
    const success: BrandActionResult<Brand> = {
      success: true,
      data: buildBrand(),
    };
    mockBrandService.createBrand.mockResolvedValue(success);
    auditLogMock.mockResolvedValue(false);

    const result = await createBrandAction("org-1", fd({ name: "Samsung" }));
    expect(result).toBe(success);
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );
    const failure: BrandActionResult<Brand> = {
      success: false,
      error: { code: "duplicate_name", message: "taken" },
    };
    mockBrandService.createBrand.mockResolvedValue(failure);

    const result = await createBrandAction("org-1", fd({ name: "Samsung" }));

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updateBrandAction
// ─────────────────────────────────────────────────────────────

describe("updateBrandAction", () => {
  it("returns a validation error on invalid input", async () => {
    const result = await updateBrandAction(
      "org-1",
      "brand-1",
      fd({ name: "A" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockBrandService.updateBrand).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks product.update", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );

    const result = await updateBrandAction(
      "org-1",
      "brand-1",
      fd({ name: "Renamed" })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockBrandService.updateBrand).not.toHaveBeenCalled();
  });

  it("calls the service with parsed args and revalidates on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const success: BrandActionResult<Brand> = {
      success: true,
      data: buildBrand(),
    };
    mockBrandService.updateBrand.mockResolvedValue(success);

    const result = await updateBrandAction(
      "org-1",
      "brand-1",
      fd({ name: "Renamed", status: "archived" })
    );

    expect(mockBrandService.updateBrand).toHaveBeenCalledWith(
      "brand-1",
      expect.objectContaining({ name: "Renamed", status: "archived" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products/brands");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "brand.update",
        entityType: "brand",
        entityId: "brand-1",
      })
    );
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const failure: BrandActionResult<Brand> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockBrandService.updateBrand.mockResolvedValue(failure);

    const result = await updateBrandAction(
      "org-1",
      "brand-1",
      fd({ name: "Renamed" })
    );

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// archiveBrandAction
// ─────────────────────────────────────────────────────────────

describe("archiveBrandAction", () => {
  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await archiveBrandAction("org-1", "brand-1");

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockBrandService.archiveBrand).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks product.update", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.view"])
    );

    const result = await archiveBrandAction("org-1", "brand-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockBrandService.archiveBrand).not.toHaveBeenCalled();
  });

  it("calls the service and revalidates on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const success: BrandActionResult<void> = {
      success: true,
      data: undefined,
    };
    mockBrandService.archiveBrand.mockResolvedValue(success);

    const result = await archiveBrandAction("org-1", "brand-1");

    expect(mockBrandService.archiveBrand).toHaveBeenCalledWith(
      "brand-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products/brands");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "brand.archive",
        entityType: "brand",
        entityId: "brand-1",
      })
    );
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const failure: BrandActionResult<void> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockBrandService.archiveBrand.mockResolvedValue(failure);

    const result = await archiveBrandAction("org-1", "brand-1");

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
