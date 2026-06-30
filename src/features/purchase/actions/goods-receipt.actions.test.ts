import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import type {
  GoodsReceiptActionResult,
  GoodsReceiptWithItems,
} from "@/features/purchase/types/goods-receipt.types";
import { createGoodsReceiptAction } from "./goods-receipt.actions";

const {
  mockService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockService: { createGoodsReceipt: vi.fn() },
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
vi.mock("@/features/purchase/services/goods-receipt.service", () => ({
  GoodsReceiptService: vi.fn(() => mockService),
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
  { purchaseOrderItemId: "poi-1", productId: "prod-1", receivedQuantity: 5, rejectedQuantity: 0 },
]);

function grnFormData(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("purchaseOrderId", "po-1");
  form.set("branchId", "wh-1");
  form.set("items", VALID_ITEMS);
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

const fullReceipt: GoodsReceiptWithItems = {
  id: "grn-1",
  organizationId: "org-1",
  grnNumber: "GRN-00001",
  purchaseOrderId: "po-1",
  branchId: "wh-1",
  receivedDate: new Date(),
  status: "completed",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "user-1",
  items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  auditLogMock.mockResolvedValue(true);
});

describe("createGoodsReceiptAction", () => {
  it("returns a validation error when items JSON is malformed", async () => {
    const result = await createGoodsReceiptAction(
      "org-1",
      grnFormData({ items: "{not-json" })
    );
    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: "Received line items are missing or malformed" },
    });
    expect(mockService.createGoodsReceipt).not.toHaveBeenCalled();
  });

  it("returns a validation error when items are missing", async () => {
    const form = new FormData();
    form.set("purchaseOrderId", "po-1");
    form.set("branchId", "wh-1");
    const result = await createGoodsReceiptAction("org-1", form);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("returns a validation error on schema failure (missing branch)", async () => {
    const result = await createGoodsReceiptAction(
      "org-1",
      grnFormData({ branchId: "" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockService.createGoodsReceipt).not.toHaveBeenCalled();
  });

  it("returns forbidden when unauthenticated", async () => {
    unauthenticated();
    const result = await createGoodsReceiptAction("org-1", grnFormData());
    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
  });

  it("returns forbidden when the caller lacks purchase.receive", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.view"])
    );
    const result = await createGoodsReceiptAction("org-1", grnFormData());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.createGoodsReceipt).not.toHaveBeenCalled();
  });

  it("parses JSON items, calls the service, revalidates list + PO detail, and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.receive"])
    );
    const success: GoodsReceiptActionResult<GoodsReceiptWithItems> = {
      success: true,
      data: fullReceipt,
    };
    mockService.createGoodsReceipt.mockResolvedValue(success);

    const result = await createGoodsReceiptAction("org-1", grnFormData());

    expect(result).toBe(success);
    expect(mockService.createGoodsReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseOrderId: "po-1",
        branchId: "wh-1",
        items: [
          expect.objectContaining({
            purchaseOrderItemId: "poi-1",
            productId: "prod-1",
            receivedQuantity: 5,
          }),
        ],
      }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases");
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/po-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "goods_receipt.create",
        entityType: "goods_receipt",
        entityId: "grn-1",
      })
    );
  });

  it("does not revalidate or audit on service failure", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.receive"])
    );
    mockService.createGoodsReceipt.mockResolvedValue({
      success: false,
      error: { code: "invalid_status", message: "x" },
    });
    await createGoodsReceiptAction("org-1", grnFormData());
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
