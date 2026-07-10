import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import type {
  Bill,
  BillActionResult,
  BillWithItems,
} from "@/features/purchase/types/bill.types";
import {
  createBillAction,
  updateBillAction,
  postBillAction,
  cancelBillAction,
} from "./bill.actions";

const {
  mockService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockService: {
    createBill: vi.fn(),
    updateBill: vi.fn(),
    postBill: vi.fn(),
    cancelBill: vi.fn(),
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
vi.mock("@/features/purchase/services/bill.service", () => ({
  BillService: vi.fn(() => mockService),
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

function buildInvoice(): Bill {
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

const fullInvoice: BillWithItems = { ...buildInvoice(), items: [] };

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// createBillAction
// ─────────────────────────────────────────────────────────────

describe("createBillAction", () => {
  it("returns a validation error when items JSON is malformed", async () => {
    const result = await createBillAction(
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
    expect(mockService.createBill).not.toHaveBeenCalled();
  });

  it("returns a validation error when items are missing", async () => {
    const form = new FormData();
    form.set("supplierId", "sup-1");
    const result = await createBillAction("org-1", form);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("returns a validation error on schema failure", async () => {
    const result = await createBillAction(
      "org-1",
      invoiceFormData({ supplierId: "" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockService.createBill).not.toHaveBeenCalled();
  });

  it("returns forbidden when unauthenticated", async () => {
    unauthenticated();
    const result = await createBillAction("org-1", invoiceFormData());
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
    const result = await createBillAction("org-1", invoiceFormData());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.createBill).not.toHaveBeenCalled();
  });

  it("parses JSON items, calls the service, revalidates and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const success: BillActionResult<BillWithItems> = {
      success: true,
      data: fullInvoice,
    };
    mockService.createBill.mockResolvedValue(success);

    const result = await createBillAction("org-1", invoiceFormData());

    expect(result).toBe(success);
    expect(mockService.createBill).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: "sup-1",
        items: [
          expect.objectContaining({ productId: "p-1", quantity: 2, taxRate: 18 }),
        ],
      }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/bills");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "bill.create",
        entityType: "bill",
        entityId: "pinv-1",
      })
    );
  });

  it("does not revalidate or audit on service failure", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.createBill.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "x" },
    });
    await createBillAction("org-1", invoiceFormData());
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updateBillAction
// ─────────────────────────────────────────────────────────────

describe("updateBillAction", () => {
  it("requires purchase.create permission", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.view"])
    );
    const result = await updateBillAction(
      "org-1",
      "pinv-1",
      invoiceFormData()
    );
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.updateBill).not.toHaveBeenCalled();
  });

  it("calls the service, revalidates list + detail, and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.updateBill.mockResolvedValue({
      success: true,
      data: fullInvoice,
    });
    await updateBillAction(
      "org-1",
      "pinv-1",
      invoiceFormData({ version: "5" })
    );
    expect(mockService.updateBill).toHaveBeenCalledWith(
      "pinv-1",
      expect.objectContaining({ supplierId: "sup-1" }),
      "org-1",
      "user-1",
      5
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/bills");
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/bills/pinv-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "bill.update" })
    );
  });

  it("defaults the optimistic-lock version to 1 when the field is absent", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.updateBill.mockResolvedValue({
      success: true,
      data: fullInvoice,
    });
    await updateBillAction("org-1", "pinv-1", invoiceFormData());
    expect(mockService.updateBill).toHaveBeenCalledWith(
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
  const invoiceResult: BillActionResult<Bill> = {
    success: true,
    data: buildInvoice(),
  };

  it("postBillAction uses purchase.create and audits post", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.postBill.mockResolvedValue(invoiceResult);
    const result = await postBillAction("org-1", "pinv-1");
    expect(result).toBe(invoiceResult);
    expect(mockService.postBill).toHaveBeenCalledWith(
      "pinv-1",
      "org-1",
      "user-1"
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "bill.post" })
    );
  });

  it("postBillAction is forbidden without purchase.create", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.view"])
    );
    const result = await postBillAction("org-1", "pinv-1");
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.postBill).not.toHaveBeenCalled();
  });

  it("cancelBillAction requires purchase.cancel", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const result = await cancelBillAction("org-1", "pinv-1");
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.cancelBill).not.toHaveBeenCalled();
  });

  it("cancelBillAction cancels, revalidates and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.cancel"])
    );
    mockService.cancelBill.mockResolvedValue(invoiceResult);
    await cancelBillAction("org-1", "pinv-1");
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/bills/pinv-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "bill.cancel" })
    );
  });

  it("does not audit when a transition fails", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.postBill.mockResolvedValue({
      success: false,
      error: { code: "invalid_status", message: "x" },
    });
    await postBillAction("org-1", "pinv-1");
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
