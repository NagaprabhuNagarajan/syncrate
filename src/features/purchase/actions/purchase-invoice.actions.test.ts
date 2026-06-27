import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import type {
  PurchaseInvoice,
  PurchaseInvoiceActionResult,
  PurchaseInvoiceWithItems,
} from "@/features/purchase/types/purchase-invoice.types";
import {
  createPurchaseInvoiceAction,
  updatePurchaseInvoiceAction,
  postPurchaseInvoiceAction,
  cancelPurchaseInvoiceAction,
} from "./purchase-invoice.actions";

const {
  mockService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockService: {
    createPurchaseInvoice: vi.fn(),
    updatePurchaseInvoice: vi.fn(),
    postPurchaseInvoice: vi.fn(),
    cancelPurchaseInvoice: vi.fn(),
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
vi.mock("@/features/purchase/services/purchase-invoice.service", () => ({
  PurchaseInvoiceService: vi.fn(() => mockService),
}));
vi.mock("@/features/organization/services/organization.service", () => ({
  OrganizationService: vi.fn(() => mockOrgService),
}));
vi.mock("@/features/audit/services/audit.service", () => ({
  AuditService: vi.fn(() => ({ log: auditLogMock })),
}));

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

const VALID_ITEMS = JSON.stringify([
  { productId: "p-1", quantity: 2, unitPrice: 100, taxRate: 18 },
]);

function invoiceFormData(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("supplierId", "sup-1");
  form.set("items", VALID_ITEMS);
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

function buildInvoice(): PurchaseInvoice {
  return {
    id: "pinv-1",
    organizationId: "org-1",
    invoiceNumber: "PINV-00001",
    supplierInvoiceNumber: null,
    purchaseOrderId: null,
    supplierId: "sup-1",
    status: "draft",
    invoiceDate: new Date(),
    dueDate: null,
    subtotal: 200,
    discountAmount: 0,
    taxAmount: 36,
    totalAmount: 236,
    amountPaid: 0,
    notes: null,
    postedAt: null,
    postedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
  };
}

const fullInvoice: PurchaseInvoiceWithItems = { ...buildInvoice(), items: [] };

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// createPurchaseInvoiceAction
// ─────────────────────────────────────────────────────────────

describe("createPurchaseInvoiceAction", () => {
  it("returns a validation error when items JSON is malformed", async () => {
    const result = await createPurchaseInvoiceAction(
      "org-1",
      invoiceFormData({ items: "{not-json" })
    );
    expect(result).toEqual({
      success: false,
      error: {
        code: "validation",
        message: "Line items are missing or malformed",
      },
    });
    expect(mockService.createPurchaseInvoice).not.toHaveBeenCalled();
  });

  it("returns a validation error when items are missing", async () => {
    const form = new FormData();
    form.set("supplierId", "sup-1");
    const result = await createPurchaseInvoiceAction("org-1", form);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("returns a validation error on schema failure", async () => {
    const result = await createPurchaseInvoiceAction(
      "org-1",
      invoiceFormData({ supplierId: "" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockService.createPurchaseInvoice).not.toHaveBeenCalled();
  });

  it("returns forbidden when unauthenticated", async () => {
    unauthenticated();
    const result = await createPurchaseInvoiceAction("org-1", invoiceFormData());
    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
  });

  it("returns forbidden when the caller lacks purchase.create", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.view"])
    );
    const result = await createPurchaseInvoiceAction("org-1", invoiceFormData());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.createPurchaseInvoice).not.toHaveBeenCalled();
  });

  it("parses JSON items, calls the service, revalidates and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const success: PurchaseInvoiceActionResult<PurchaseInvoiceWithItems> = {
      success: true,
      data: fullInvoice,
    };
    mockService.createPurchaseInvoice.mockResolvedValue(success);

    const result = await createPurchaseInvoiceAction("org-1", invoiceFormData());

    expect(result).toBe(success);
    expect(mockService.createPurchaseInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: "sup-1",
        items: [
          expect.objectContaining({ productId: "p-1", quantity: 2, taxRate: 18 }),
        ],
      }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/invoices");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "purchase_invoice.create",
        entityType: "purchase_invoice",
        entityId: "pinv-1",
      })
    );
  });

  it("does not revalidate or audit on service failure", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.createPurchaseInvoice.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "x" },
    });
    await createPurchaseInvoiceAction("org-1", invoiceFormData());
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updatePurchaseInvoiceAction
// ─────────────────────────────────────────────────────────────

describe("updatePurchaseInvoiceAction", () => {
  it("requires purchase.create permission", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.view"])
    );
    const result = await updatePurchaseInvoiceAction(
      "org-1",
      "pinv-1",
      invoiceFormData()
    );
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.updatePurchaseInvoice).not.toHaveBeenCalled();
  });

  it("calls the service, revalidates list + detail, and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.updatePurchaseInvoice.mockResolvedValue({
      success: true,
      data: fullInvoice,
    });
    await updatePurchaseInvoiceAction(
      "org-1",
      "pinv-1",
      invoiceFormData({ version: "5" })
    );
    expect(mockService.updatePurchaseInvoice).toHaveBeenCalledWith(
      "pinv-1",
      expect.objectContaining({ supplierId: "sup-1" }),
      "org-1",
      "user-1",
      5
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/invoices");
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/invoices/pinv-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_invoice.update" })
    );
  });

  it("defaults the optimistic-lock version to 1 when the field is absent", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.updatePurchaseInvoice.mockResolvedValue({
      success: true,
      data: fullInvoice,
    });
    await updatePurchaseInvoiceAction("org-1", "pinv-1", invoiceFormData());
    expect(mockService.updatePurchaseInvoice).toHaveBeenCalledWith(
      "pinv-1",
      expect.anything(),
      "org-1",
      "user-1",
      1
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Status transition actions
// ─────────────────────────────────────────────────────────────

describe("status transition actions", () => {
  const invoiceResult: PurchaseInvoiceActionResult<PurchaseInvoice> = {
    success: true,
    data: buildInvoice(),
  };

  it("postPurchaseInvoiceAction uses purchase.create and audits post", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.postPurchaseInvoice.mockResolvedValue(invoiceResult);
    const result = await postPurchaseInvoiceAction("org-1", "pinv-1");
    expect(result).toBe(invoiceResult);
    expect(mockService.postPurchaseInvoice).toHaveBeenCalledWith(
      "pinv-1",
      "org-1",
      "user-1"
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_invoice.post" })
    );
  });

  it("postPurchaseInvoiceAction is forbidden without purchase.create", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.view"])
    );
    const result = await postPurchaseInvoiceAction("org-1", "pinv-1");
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.postPurchaseInvoice).not.toHaveBeenCalled();
  });

  it("cancelPurchaseInvoiceAction requires purchase.cancel", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const result = await cancelPurchaseInvoiceAction("org-1", "pinv-1");
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.cancelPurchaseInvoice).not.toHaveBeenCalled();
  });

  it("cancelPurchaseInvoiceAction cancels, revalidates and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.cancel"])
    );
    mockService.cancelPurchaseInvoice.mockResolvedValue(invoiceResult);
    await cancelPurchaseInvoiceAction("org-1", "pinv-1");
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/invoices/pinv-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_invoice.cancel" })
    );
  });

  it("does not audit when a transition fails", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.postPurchaseInvoice.mockResolvedValue({
      success: false,
      error: { code: "invalid_status", message: "x" },
    });
    await postPurchaseInvoiceAction("org-1", "pinv-1");
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
