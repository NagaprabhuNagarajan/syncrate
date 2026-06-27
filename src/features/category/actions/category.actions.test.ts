import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  Category,
  CategoryActionResult,
} from "@/features/category/types/category.types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  createCategoryAction,
  updateCategoryAction,
  archiveCategoryAction,
} from "./category.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const {
  mockCategoryService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockCategoryService: {
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    archiveCategory: vi.fn(),
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

vi.mock("@/features/category/services/category.service", () => ({
  CategoryService: vi.fn(() => mockCategoryService),
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

function buildCategory(): Category {
  return {
    id: "cat-1",
    organizationId: "org-1",
    parentId: null,
    name: "Electronics",
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
// createCategoryAction
// ─────────────────────────────────────────────────────────────

describe("createCategoryAction", () => {
  it("returns a validation error and does not call the service on invalid input", async () => {
    const result = await createCategoryAction("org-1", fd({ name: "A" }));

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockCategoryService.createCategory).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await createCategoryAction("org-1", fd({ name: "Electronics" }));

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockCategoryService.createCategory).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller has no org context", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await createCategoryAction("org-1", fd({ name: "Electronics" }));

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    });
    expect(mockCategoryService.createCategory).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks product.create", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.view"])
    );

    const result = await createCategoryAction("org-1", fd({ name: "Electronics" }));

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockCategoryService.createCategory).not.toHaveBeenCalled();
  });

  it("calls the service with parsed args and revalidates + audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );
    const success: CategoryActionResult<Category> = {
      success: true,
      data: buildCategory(),
    };
    mockCategoryService.createCategory.mockResolvedValue(success);

    const result = await createCategoryAction(
      "org-1",
      fd({ name: "Electronics" })
    );

    expect(mockCategoryService.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Electronics" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products/categories");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "category.create",
        entityType: "category",
        entityId: "cat-1",
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
    const success: CategoryActionResult<Category> = {
      success: true,
      data: buildCategory(),
    };
    mockCategoryService.createCategory.mockResolvedValue(success);
    auditLogMock.mockResolvedValue(false);

    const result = await createCategoryAction("org-1", fd({ name: "Electronics" }));
    expect(result).toBe(success);
  });

  it("surfaces the service failure without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );
    const failure: CategoryActionResult<Category> = {
      success: false,
      error: { code: "duplicate_name", message: "taken" },
    };
    mockCategoryService.createCategory.mockResolvedValue(failure);

    const result = await createCategoryAction("org-1", fd({ name: "Electronics" }));

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updateCategoryAction
// ─────────────────────────────────────────────────────────────

describe("updateCategoryAction", () => {
  it("returns forbidden when the caller lacks product.update", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );

    const result = await updateCategoryAction(
      "org-1",
      "cat-1",
      fd({ name: "Renamed" })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockCategoryService.updateCategory).not.toHaveBeenCalled();
  });

  it("calls the service with parsed args and revalidates + audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const success: CategoryActionResult<Category> = {
      success: true,
      data: buildCategory(),
    };
    mockCategoryService.updateCategory.mockResolvedValue(success);

    const result = await updateCategoryAction(
      "org-1",
      "cat-1",
      fd({ name: "Renamed" })
    );

    expect(mockCategoryService.updateCategory).toHaveBeenCalledWith(
      "cat-1",
      expect.objectContaining({ name: "Renamed" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products/categories");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "category.update",
        entityType: "category",
        entityId: "cat-1",
      })
    );
  });

  it("surfaces the service failure without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const failure: CategoryActionResult<Category> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockCategoryService.updateCategory.mockResolvedValue(failure);

    const result = await updateCategoryAction(
      "org-1",
      "cat-1",
      fd({ name: "Renamed" })
    );

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// archiveCategoryAction
// ─────────────────────────────────────────────────────────────

describe("archiveCategoryAction", () => {
  it("returns forbidden when the caller lacks product.update", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.view"])
    );

    const result = await archiveCategoryAction("org-1", "cat-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockCategoryService.archiveCategory).not.toHaveBeenCalled();
  });

  it("calls the service and revalidates + audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const success: CategoryActionResult<void> = {
      success: true,
      data: undefined,
    };
    mockCategoryService.archiveCategory.mockResolvedValue(success);

    const result = await archiveCategoryAction("org-1", "cat-1");

    expect(mockCategoryService.archiveCategory).toHaveBeenCalledWith(
      "cat-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products/categories");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "category.archive",
        entityType: "category",
        entityId: "cat-1",
      })
    );
  });

  it("surfaces the service failure without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const failure: CategoryActionResult<void> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockCategoryService.archiveCategory.mockResolvedValue(failure);

    const result = await archiveCategoryAction("org-1", "cat-1");

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
