import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import type {
  PurchaseOrder,
  PurchaseOrderActionResult,
  PurchaseOrderWithItems,
} from "@/features/purchase/types/purchase-order.types";
import {
  createPurchaseOrderAction,
  updatePurchaseOrderAction,
  submitPurchaseOrderAction,
  approvePurchaseOrderAction,
  cancelPurchaseOrderAction,
} from "./purchase-order.actions";

const {
  mockService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockService: {
    createPurchaseOrder: vi.fn(),
    updatePurchaseOrder: vi.fn(),
    submitPurchaseOrder: vi.fn(),
    approvePurchaseOrder: vi.fn(),
    cancelPurchaseOrder: vi.fn(),
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
vi.mock("@/features/purchase/services/purchase-order.service", () => ({
  PurchaseOrderService: vi.fn(() => mockService),
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
  { productId: "p-1", quantity: 2, unitPrice: 100, discountPercent: 0, taxRate: 18 },
]);

function poFormData(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("supplierId", "sup-1");
  form.set("items", VALID_ITEMS);
  form.set("version", "1");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

function buildOrder(): PurchaseOrder {
  return {
    id: "po-1",
    organizationId: "org-1",
    poNumber: "PO-00001",
    supplierId: "sup-1",
    warehouseId: null,
    status: "draft",
    orderDate: new Date(),
    expectedDeliveryDate: null,
    currency: "INR",
    notes: null,
    terms: null,
    subtotal: 200,
    discountAmount: 0,
    taxAmount: 36,
    totalAmount: 236,
    approvedBy: null,
    approvedAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
  };
}

const fullOrder: PurchaseOrderWithItems = { ...buildOrder(), items: [] };

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// createPurchaseOrderAction
// ─────────────────────────────────────────────────────────────

describe("createPurchaseOrderAction", () => {
  it("returns a validation error when items JSON is malformed", async () => {
    const result = await createPurchaseOrderAction(
      "org-1",
      poFormData({ items: "{not-json" })
    );
    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: "Line items are missing or malformed" },
    });
    expect(mockService.createPurchaseOrder).not.toHaveBeenCalled();
  });

  it("returns a validation error when items are missing", async () => {
    const form = new FormData();
    form.set("supplierId", "sup-1");
    const result = await createPurchaseOrderAction("org-1", form);
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("validation");}
  });

  it("returns a validation error on schema failure", async () => {
    const result = await createPurchaseOrderAction(
      "org-1",
      poFormData({ supplierId: "" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("validation");}
    expect(mockService.createPurchaseOrder).not.toHaveBeenCalled();
  });

  it("returns forbidden when unauthenticated", async () => {
    unauthenticated();
    const result = await createPurchaseOrderAction("org-1", poFormData());
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
    const result = await createPurchaseOrderAction("org-1", poFormData());
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("forbidden");}
    expect(mockService.createPurchaseOrder).not.toHaveBeenCalled();
  });

  it("parses JSON items, calls the service, revalidates and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const success: PurchaseOrderActionResult<PurchaseOrderWithItems> = {
      success: true,
      data: fullOrder,
    };
    mockService.createPurchaseOrder.mockResolvedValue(success);

    const result = await createPurchaseOrderAction("org-1", poFormData());

    expect(result).toBe(success);
    expect(mockService.createPurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: "sup-1",
        items: [
          expect.objectContaining({ productId: "p-1", quantity: 2, taxRate: 18 }),
        ],
      }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "purchase_order.create",
        entityType: "purchase_order",
        entityId: "po-1",
      })
    );
  });

  it("does not revalidate or audit on service failure", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.createPurchaseOrder.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "x" },
    });
    await createPurchaseOrderAction("org-1", poFormData());
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updatePurchaseOrderAction
// ─────────────────────────────────────────────────────────────

describe("updatePurchaseOrderAction", () => {
  it("requires purchase.create permission", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.view"])
    );
    const result = await updatePurchaseOrderAction("org-1", "po-1", poFormData());
    if (!result.success) {expect(result.error.code).toBe("forbidden");}
    expect(mockService.updatePurchaseOrder).not.toHaveBeenCalled();
  });

  it("calls the service, revalidates list + detail, and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.updatePurchaseOrder.mockResolvedValue({
      success: true,
      data: fullOrder,
    });
    await updatePurchaseOrderAction("org-1", "po-1", poFormData());
    expect(mockService.updatePurchaseOrder).toHaveBeenCalledWith(
      "po-1",
      expect.objectContaining({ supplierId: "sup-1", version: 1 }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases");
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/po-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_order.update" })
    );
  });

  it("returns a validation error when the version is missing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const form = poFormData();
    form.delete("version");
    const result = await updatePurchaseOrderAction("org-1", "po-1", form);
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("validation");}
    expect(mockService.updatePurchaseOrder).not.toHaveBeenCalled();
  });

  it("surfaces a conflict from the service without auditing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.updatePurchaseOrder.mockResolvedValue({
      success: false,
      error: { code: "conflict", message: "changed by someone else" },
    });
    const result = await updatePurchaseOrderAction("org-1", "po-1", poFormData());
    expect(result.success).toBe(false);
    if (!result.success) {expect(result.error.code).toBe("conflict");}
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// Status transition actions
// ─────────────────────────────────────────────────────────────

describe("status transition actions", () => {
  const orderResult: PurchaseOrderActionResult<PurchaseOrder> = {
    success: true,
    data: buildOrder(),
  };

  it("submitPurchaseOrderAction uses purchase.create and audits submit", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.submitPurchaseOrder.mockResolvedValue(orderResult);
    const result = await submitPurchaseOrderAction("org-1", "po-1");
    expect(result).toBe(orderResult);
    expect(mockService.submitPurchaseOrder).toHaveBeenCalledWith("po-1", "org-1", "user-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_order.submit" })
    );
  });

  it("submitPurchaseOrderAction is forbidden without purchase.create", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.view"])
    );
    const result = await submitPurchaseOrderAction("org-1", "po-1");
    if (!result.success) {expect(result.error.code).toBe("forbidden");}
    expect(mockService.submitPurchaseOrder).not.toHaveBeenCalled();
  });

  it("approvePurchaseOrderAction requires purchase.approve", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const result = await approvePurchaseOrderAction("org-1", "po-1");
    if (!result.success) {expect(result.error.code).toBe("forbidden");}
    expect(mockService.approvePurchaseOrder).not.toHaveBeenCalled();
  });

  it("approvePurchaseOrderAction approves and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.approve"])
    );
    mockService.approvePurchaseOrder.mockResolvedValue(orderResult);
    await approvePurchaseOrderAction("org-1", "po-1");
    expect(mockService.approvePurchaseOrder).toHaveBeenCalledWith("po-1", "org-1", "user-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_order.approve" })
    );
  });

  it("cancelPurchaseOrderAction requires purchase.cancel", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const result = await cancelPurchaseOrderAction("org-1", "po-1");
    if (!result.success) {expect(result.error.code).toBe("forbidden");}
    expect(mockService.cancelPurchaseOrder).not.toHaveBeenCalled();
  });

  it("cancelPurchaseOrderAction cancels, revalidates and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.cancel"])
    );
    mockService.cancelPurchaseOrder.mockResolvedValue(orderResult);
    await cancelPurchaseOrderAction("org-1", "po-1");
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/po-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_order.cancel" })
    );
  });

  it("does not audit when a transition fails", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.cancel"])
    );
    mockService.cancelPurchaseOrder.mockResolvedValue({
      success: false,
      error: { code: "invalid_status", message: "x" },
    });
    await cancelPurchaseOrderAction("org-1", "po-1");
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
