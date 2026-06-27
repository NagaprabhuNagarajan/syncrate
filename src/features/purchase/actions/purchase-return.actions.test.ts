import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import type {
  PurchaseReturn,
  PurchaseReturnActionResult,
  PurchaseReturnWithItems,
} from "@/features/purchase/types/purchase-return.types";
import {
  createPurchaseReturnAction,
  updatePurchaseReturnAction,
  completePurchaseReturnAction,
  cancelPurchaseReturnAction,
} from "./purchase-return.actions";

const {
  mockService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockService: {
    createPurchaseReturn: vi.fn(),
    updatePurchaseReturn: vi.fn(),
    completePurchaseReturn: vi.fn(),
    cancelPurchaseReturn: vi.fn(),
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
vi.mock("@/features/purchase/services/purchase-return.service", () => ({
  PurchaseReturnService: vi.fn(() => mockService),
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

function returnFormData(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("supplierId", "sup-1");
  form.set("warehouseId", "wh-1");
  form.set("reason", "damaged");
  form.set("items", VALID_ITEMS);
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

function buildReturn(): PurchaseReturn {
  return {
    id: "pret-1",
    organizationId: "org-1",
    returnNumber: "PRET-00001",
    purchaseOrderId: null,
    supplierId: "sup-1",
    warehouseId: "wh-1",
    status: "draft",
    returnDate: new Date(),
    reason: "damaged",
    subtotal: 200,
    taxAmount: 36,
    totalAmount: 236,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
  };
}

const fullReturn: PurchaseReturnWithItems = { ...buildReturn(), items: [] };

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// createPurchaseReturnAction
// ─────────────────────────────────────────────────────────────

describe("createPurchaseReturnAction", () => {
  it("returns a validation error when items JSON is malformed", async () => {
    const result = await createPurchaseReturnAction(
      "org-1",
      returnFormData({ items: "{not-json" })
    );
    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: "Line items are missing or malformed" },
    });
    expect(mockService.createPurchaseReturn).not.toHaveBeenCalled();
  });

  it("returns a validation error when items are missing", async () => {
    const form = new FormData();
    form.set("supplierId", "sup-1");
    form.set("warehouseId", "wh-1");
    form.set("reason", "damaged");
    const result = await createPurchaseReturnAction("org-1", form);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("returns a validation error on schema failure (missing warehouse)", async () => {
    const result = await createPurchaseReturnAction(
      "org-1",
      returnFormData({ warehouseId: "" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockService.createPurchaseReturn).not.toHaveBeenCalled();
  });

  it("returns forbidden when unauthenticated", async () => {
    unauthenticated();
    const result = await createPurchaseReturnAction("org-1", returnFormData());
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
    const result = await createPurchaseReturnAction("org-1", returnFormData());
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.createPurchaseReturn).not.toHaveBeenCalled();
  });

  it("parses JSON items, calls the service, revalidates and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const success: PurchaseReturnActionResult<PurchaseReturnWithItems> = {
      success: true,
      data: fullReturn,
    };
    mockService.createPurchaseReturn.mockResolvedValue(success);

    const result = await createPurchaseReturnAction("org-1", returnFormData());

    expect(result).toBe(success);
    expect(mockService.createPurchaseReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: "sup-1",
        warehouseId: "wh-1",
        reason: "damaged",
        items: [
          expect.objectContaining({ productId: "p-1", quantity: 2, taxRate: 18 }),
        ],
      }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/returns");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "purchase_return.create",
        entityType: "purchase_return",
        entityId: "pret-1",
      })
    );
  });

  it("does not revalidate or audit on service failure", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.createPurchaseReturn.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "x" },
    });
    await createPurchaseReturnAction("org-1", returnFormData());
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updatePurchaseReturnAction
// ─────────────────────────────────────────────────────────────

describe("updatePurchaseReturnAction", () => {
  it("requires purchase.create permission", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.view"])
    );
    const result = await updatePurchaseReturnAction(
      "org-1",
      "pret-1",
      returnFormData()
    );
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.updatePurchaseReturn).not.toHaveBeenCalled();
  });

  it("calls the service, revalidates list + detail, and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.updatePurchaseReturn.mockResolvedValue({
      success: true,
      data: fullReturn,
    });
    await updatePurchaseReturnAction(
      "org-1",
      "pret-1",
      returnFormData({ version: "5" })
    );
    expect(mockService.updatePurchaseReturn).toHaveBeenCalledWith(
      "pret-1",
      expect.objectContaining({ supplierId: "sup-1" }),
      "org-1",
      "user-1",
      5
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/returns");
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/returns/pret-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_return.update" })
    );
  });

  it("defaults the optimistic-lock version to 1 when the field is absent", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.updatePurchaseReturn.mockResolvedValue({
      success: true,
      data: fullReturn,
    });
    await updatePurchaseReturnAction("org-1", "pret-1", returnFormData());
    expect(mockService.updatePurchaseReturn).toHaveBeenCalledWith(
      "pret-1",
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
  const returnResult: PurchaseReturnActionResult<PurchaseReturn> = {
    success: true,
    data: buildReturn(),
  };

  it("completePurchaseReturnAction requires purchase.receive", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const result = await completePurchaseReturnAction("org-1", "pret-1");
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.completePurchaseReturn).not.toHaveBeenCalled();
  });

  it("completePurchaseReturnAction completes and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.receive"])
    );
    mockService.completePurchaseReturn.mockResolvedValue(returnResult);
    const result = await completePurchaseReturnAction("org-1", "pret-1");
    expect(result).toBe(returnResult);
    expect(mockService.completePurchaseReturn).toHaveBeenCalledWith(
      "pret-1",
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/returns/pret-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_return.complete" })
    );
  });

  it("cancelPurchaseReturnAction requires purchase.cancel", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const result = await cancelPurchaseReturnAction("org-1", "pret-1");
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.cancelPurchaseReturn).not.toHaveBeenCalled();
  });

  it("cancelPurchaseReturnAction cancels, revalidates and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.cancel"])
    );
    mockService.cancelPurchaseReturn.mockResolvedValue(returnResult);
    await cancelPurchaseReturnAction("org-1", "pret-1");
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/returns/pret-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_return.cancel" })
    );
  });

  it("does not audit when a transition fails", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.cancel"])
    );
    mockService.cancelPurchaseReturn.mockResolvedValue({
      success: false,
      error: { code: "invalid_status", message: "x" },
    });
    await cancelPurchaseReturnAction("org-1", "pret-1");
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
