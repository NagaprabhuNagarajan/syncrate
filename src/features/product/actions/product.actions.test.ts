import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  Product,
  ProductActionResult,
} from "@/features/product/types/product.types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  createProductAction,
  updateProductAction,
  archiveProductAction,
  exportProductsAction,
  importProductsAction,
} from "./product.actions";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const {
  mockProductService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockProductService: {
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    archiveProduct: vi.fn(),
    exportProductsCsv: vi.fn(),
    importProducts: vi.fn(),
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

vi.mock("@/features/product/services/product.service", () => ({
  ProductService: vi.fn(() => mockProductService),
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

function buildProduct(): Product {
  return {
    id: "prod-1",
    organizationId: "org-1",
    code: "PROD-00001",
    name: "Premium Widget",
    description: null,
    type: "inventory",
    status: "active",
    categoryId: null,
    brandId: null,
    unitId: null,
    manufacturer: null,
    hsnCode: null,
    gstRate: 0,
    gstRates: [0],
    taxInclusive: false,
    purchasePrice: 0,
    sellingPrice: 0,
    dealerPrice: 0,
    wholesalePrice: 0,
    retailPrice: 0,
    minSellingPrice: 0,
    sku: null,
    barcode: null,
    qrCode: null,
    trackInventory: true,
    reorderLevel: 0,
    maxStock: 0,
    openingStock: 0,
    preferredSupplierId: null,
    isSeasonal: false,
    isFastMoving: false,
    isSlowMoving: false,
    aiTags: [],
    tags: [],
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
// createProductAction
// ─────────────────────────────────────────────────────────────

describe("createProductAction", () => {
  it("returns a validation error and does not call the service on invalid input", async () => {
    const result = await createProductAction(
      "org-1",
      fd({ name: "Widget", code: "A" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockProductService.createProduct).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await createProductAction("org-1", fd({ name: "Widget" }));

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockProductService.createProduct).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller has no org context", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await createProductAction("org-1", fd({ name: "Widget" }));

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have access to this organization",
      },
    });
    expect(mockProductService.createProduct).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks product.create", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );

    const result = await createProductAction("org-1", fd({ name: "Widget" }));

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockProductService.createProduct).not.toHaveBeenCalled();
  });

  it("calls the service with parsed args and revalidates on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );
    const success: ProductActionResult<Product> = {
      success: true,
      data: buildProduct(),
    };
    mockProductService.createProduct.mockResolvedValue(success);

    const result = await createProductAction(
      "org-1",
      fd({
        name: "Premium Widget",
        type: "service",
        sellingPrice: "199.5",
        tags: "featured, seasonal ,",
      })
    );

    expect(mockProductService.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Premium Widget",
        type: "service",
        sellingPrice: 199.5,
        tags: ["featured", "seasonal"],
      }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "product.create",
        entityType: "product",
        entityId: "prod-1",
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
    const success: ProductActionResult<Product> = {
      success: true,
      data: buildProduct(),
    };
    mockProductService.createProduct.mockResolvedValue(success);
    auditLogMock.mockResolvedValue(false);

    const result = await createProductAction("org-1", fd({ name: "Widget" }));

    expect(result).toBe(success);
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );
    const failure: ProductActionResult<Product> = {
      success: false,
      error: { code: "duplicate_code", message: "taken" },
    };
    mockProductService.createProduct.mockResolvedValue(failure);

    const result = await createProductAction("org-1", fd({ name: "Widget" }));

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updateProductAction
// ─────────────────────────────────────────────────────────────

describe("updateProductAction", () => {
  it("returns a validation error and does not call the service on invalid input", async () => {
    const result = await updateProductAction(
      "org-1",
      "prod-1",
      fd({ code: "A" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: expect.any(String) },
    });
    expect(mockProductService.updateProduct).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await updateProductAction(
      "org-1",
      "prod-1",
      fd({ name: "Valid Name" })
    );

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockProductService.updateProduct).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks product.update", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );

    const result = await updateProductAction(
      "org-1",
      "prod-1",
      fd({ name: "Valid Name" })
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockProductService.updateProduct).not.toHaveBeenCalled();
  });

  it("calls the service with parsed args and revalidates on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const success: ProductActionResult<Product> = {
      success: true,
      data: buildProduct(),
    };
    mockProductService.updateProduct.mockResolvedValue(success);

    const result = await updateProductAction(
      "org-1",
      "prod-1",
      fd({ name: "Renamed Widget", status: "discontinued" })
    );

    expect(mockProductService.updateProduct).toHaveBeenCalledWith(
      "prod-1",
      expect.objectContaining({ name: "Renamed Widget", status: "discontinued" }),
      "org-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products");
    expect(revalidateMock).toHaveBeenCalledWith("/products/prod-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "product.update",
        entityType: "product",
        entityId: "prod-1",
      })
    );
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );
    const failure: ProductActionResult<Product> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockProductService.updateProduct.mockResolvedValue(failure);

    const result = await updateProductAction(
      "org-1",
      "prod-1",
      fd({ name: "Renamed Widget" })
    );

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// archiveProductAction
// ─────────────────────────────────────────────────────────────

describe("archiveProductAction", () => {
  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();

    const result = await archiveProductAction("org-1", "prod-1");

    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockProductService.archiveProduct).not.toHaveBeenCalled();
  });

  it("returns forbidden when the caller lacks product.delete", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.update"])
    );

    const result = await archiveProductAction("org-1", "prod-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockProductService.archiveProduct).not.toHaveBeenCalled();
  });

  it("calls the service and revalidates on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.delete"])
    );
    const success: ProductActionResult<void> = {
      success: true,
      data: undefined,
    };
    mockProductService.archiveProduct.mockResolvedValue(success);

    const result = await archiveProductAction("org-1", "prod-1");

    expect(mockProductService.archiveProduct).toHaveBeenCalledWith(
      "prod-1",
      "user-1"
    );
    expect(result).toBe(success);
    expect(revalidateMock).toHaveBeenCalledWith("/products");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "product.archive",
        entityType: "product",
        entityId: "prod-1",
      })
    );
  });

  it("surfaces the service failure result without revalidating or auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.delete"])
    );
    const failure: ProductActionResult<void> = {
      success: false,
      error: { code: "not_found", message: "missing" },
    };
    mockProductService.archiveProduct.mockResolvedValue(failure);

    const result = await archiveProductAction("org-1", "prod-1");

    expect(result).toBe(failure);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// exportProductsAction
// ─────────────────────────────────────────────────────────────

describe("exportProductsAction", () => {
  it("returns forbidden when the caller lacks product.export", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );

    const result = await exportProductsAction("org-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockProductService.exportProductsCsv).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("returns the CSV and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.export"])
    );
    mockProductService.exportProductsCsv.mockResolvedValue(
      "code,name\r\nP1,Widget"
    );

    const result = await exportProductsAction("org-1");

    expect(result).toEqual({ success: true, data: "code,name\r\nP1,Widget" });
    expect(mockProductService.exportProductsCsv).toHaveBeenCalledWith("org-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "product.export",
        entityType: "product",
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// importProductsAction
// ─────────────────────────────────────────────────────────────

describe("importProductsAction", () => {
  it("returns forbidden when the caller lacks product.import", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.create"])
    );

    const result = await importProductsAction("org-1", "code,name");

    expect(result).toEqual({
      success: false,
      error: {
        code: "forbidden",
        message: "You do not have permission to perform this action",
      },
    });
    expect(mockProductService.importProducts).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("parses the CSV, imports, revalidates and audits with counts", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["product.import"])
    );
    const summary = {
      created: 2,
      skipped: 1,
      errors: [{ row: 4, message: "duplicate" }],
    };
    mockProductService.importProducts.mockResolvedValue(summary);

    const csv = "name\r\nWidget\r\nGadget\r\nGizmo";
    const result = await importProductsAction("org-1", csv);

    expect(result).toEqual({ success: true, data: summary });
    // csvToObjects strips the header row, so 3 data rows are passed.
    const rowsArg = mockProductService.importProducts.mock.calls[0]?.[0];
    expect(rowsArg).toHaveLength(3);
    expect(mockProductService.importProducts).toHaveBeenCalledWith(
      expect.any(Array),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/products");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "product.import",
        entityType: "product",
        metadata: { created: 2, skipped: 1, errorCount: 1 },
      })
    );
  });
});
