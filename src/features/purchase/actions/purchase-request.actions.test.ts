import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import type {
  PurchaseRequest,
  PurchaseRequestActionResult,
  PurchaseRequestWithItems,
} from "@/features/purchase/types/purchase-request.types";
import type { PurchaseOrderWithItems } from "@/features/purchase/types/purchase-order.types";
import {
  createPurchaseRequestAction,
  updatePurchaseRequestAction,
  submitPurchaseRequestAction,
  approvePurchaseRequestAction,
  rejectPurchaseRequestAction,
  cancelPurchaseRequestAction,
  convertPurchaseRequestAction,
} from "./purchase-request.actions";

const {
  mockService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockService: {
    createPurchaseRequest: vi.fn(),
    updatePurchaseRequest: vi.fn(),
    submitPurchaseRequest: vi.fn(),
    approvePurchaseRequest: vi.fn(),
    rejectPurchaseRequest: vi.fn(),
    cancelPurchaseRequest: vi.fn(),
    convertToPurchaseOrder: vi.fn(),
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
vi.mock("@/features/purchase/services/purchase-request.service", () => ({
  PurchaseRequestService: vi.fn(() => mockService),
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
  { productId: "p-1", quantity: 2, estimatedPrice: 100 },
]);

function prFormData(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("items", VALID_ITEMS);
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

function buildRequest(): PurchaseRequest {
  return {
    id: "pr-1",
    organizationId: "org-1",
    requestNumber: "PR-00001",
    status: "draft",
    warehouseId: null,
    requiredDate: null,
    notes: null,
    approvedBy: null,
    approvedAt: null,
    rejectedReason: null,
    convertedPoId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
    version: 1,
  };
}

const fullRequest: PurchaseRequestWithItems = { ...buildRequest(), items: [] };

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// createPurchaseRequestAction
// ─────────────────────────────────────────────────────────────

describe("createPurchaseRequestAction", () => {
  it("returns a validation error when items JSON is malformed", async () => {
    const result = await createPurchaseRequestAction(
      "org-1",
      prFormData({ items: "{not-json" })
    );
    expect(result).toEqual({
      success: false,
      error: { code: "validation", message: "Line items are missing or malformed" },
    });
    expect(mockService.createPurchaseRequest).not.toHaveBeenCalled();
  });

  it("returns a validation error when items are missing", async () => {
    const result = await createPurchaseRequestAction("org-1", new FormData());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("returns forbidden when unauthenticated", async () => {
    unauthenticated();
    const result = await createPurchaseRequestAction("org-1", prFormData());
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
    const result = await createPurchaseRequestAction("org-1", prFormData());
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.createPurchaseRequest).not.toHaveBeenCalled();
  });

  it("parses JSON items, calls the service, revalidates and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const success: PurchaseRequestActionResult<PurchaseRequestWithItems> = {
      success: true,
      data: fullRequest,
    };
    mockService.createPurchaseRequest.mockResolvedValue(success);

    const result = await createPurchaseRequestAction(
      "org-1",
      prFormData({ warehouseId: "wh-1" })
    );

    expect(result).toBe(success);
    expect(mockService.createPurchaseRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        warehouseId: "wh-1",
        items: [expect.objectContaining({ productId: "p-1", quantity: 2 })],
      }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/requests");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "purchase_request.create",
        entityType: "purchase_request",
        entityId: "pr-1",
      })
    );
  });

  it("does not revalidate or audit on service failure", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.createPurchaseRequest.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "x" },
    });
    await createPurchaseRequestAction("org-1", prFormData());
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updatePurchaseRequestAction (optimistic locking)
// ─────────────────────────────────────────────────────────────

describe("updatePurchaseRequestAction", () => {
  it("returns validation when the version field is missing", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const result = await updatePurchaseRequestAction("org-1", "pr-1", prFormData());
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockService.updatePurchaseRequest).not.toHaveBeenCalled();
  });

  it("requires purchase.create permission", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.view"])
    );
    const result = await updatePurchaseRequestAction(
      "org-1",
      "pr-1",
      prFormData({ version: "1" })
    );
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("passes the parsed version to the service and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.updatePurchaseRequest.mockResolvedValue({
      success: true,
      data: fullRequest,
    });
    await updatePurchaseRequestAction(
      "org-1",
      "pr-1",
      prFormData({ version: "4" })
    );
    expect(mockService.updatePurchaseRequest).toHaveBeenCalledWith(
      "pr-1",
      expect.any(Object),
      "org-1",
      "user-1",
      4
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/requests/pr-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_request.update" })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Status transition actions
// ─────────────────────────────────────────────────────────────

describe("status transition actions", () => {
  const requestResult: PurchaseRequestActionResult<PurchaseRequest> = {
    success: true,
    data: buildRequest(),
  };

  it("submitPurchaseRequestAction uses purchase.create and audits submit", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.submitPurchaseRequest.mockResolvedValue(requestResult);
    await submitPurchaseRequestAction("org-1", "pr-1");
    expect(mockService.submitPurchaseRequest).toHaveBeenCalledWith(
      "pr-1",
      "org-1",
      "user-1"
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_request.submit" })
    );
  });

  it("approvePurchaseRequestAction requires purchase.approve", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const result = await approvePurchaseRequestAction("org-1", "pr-1");
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.approvePurchaseRequest).not.toHaveBeenCalled();
  });

  it("approvePurchaseRequestAction approves and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.approve"])
    );
    mockService.approvePurchaseRequest.mockResolvedValue(requestResult);
    await approvePurchaseRequestAction("org-1", "pr-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_request.approve" })
    );
  });

  it("rejectPurchaseRequestAction validates the reason", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.approve"])
    );
    const result = await rejectPurchaseRequestAction("org-1", "pr-1", "   ");
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockService.rejectPurchaseRequest).not.toHaveBeenCalled();
  });

  it("rejectPurchaseRequestAction requires purchase.approve", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const result = await rejectPurchaseRequestAction("org-1", "pr-1", "No budget");
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("rejectPurchaseRequestAction rejects with a reason and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.approve"])
    );
    mockService.rejectPurchaseRequest.mockResolvedValue(requestResult);
    await rejectPurchaseRequestAction("org-1", "pr-1", "No budget");
    expect(mockService.rejectPurchaseRequest).toHaveBeenCalledWith(
      "pr-1",
      "org-1",
      "user-1",
      "No budget"
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_request.reject" })
    );
  });

  it("cancelPurchaseRequestAction requires purchase.cancel", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    const result = await cancelPurchaseRequestAction("org-1", "pr-1");
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("cancelPurchaseRequestAction cancels and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.cancel"])
    );
    mockService.cancelPurchaseRequest.mockResolvedValue(requestResult);
    await cancelPurchaseRequestAction("org-1", "pr-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_request.cancel" })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// convertPurchaseRequestAction
// ─────────────────────────────────────────────────────────────

describe("convertPurchaseRequestAction", () => {
  const po: PurchaseOrderWithItems = {
    id: "po-9",
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
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
    version: 1,
    items: [],
  };

  it("returns validation when no supplier is provided", async () => {
    const result = await convertPurchaseRequestAction("org-1", "pr-1", "  ");
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockService.convertToPurchaseOrder).not.toHaveBeenCalled();
  });

  it("requires purchase.create permission", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.approve"])
    );
    const result = await convertPurchaseRequestAction("org-1", "pr-1", "sup-1");
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockService.convertToPurchaseOrder).not.toHaveBeenCalled();
  });

  it("converts, revalidates purchases + requests, and audits", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["purchase.create"])
    );
    mockService.convertToPurchaseOrder.mockResolvedValue({
      success: true,
      data: po,
    });
    const result = await convertPurchaseRequestAction("org-1", "pr-1", " sup-1 ");
    expect(result.success).toBe(true);
    expect(mockService.convertToPurchaseOrder).toHaveBeenCalledWith(
      "pr-1",
      "sup-1",
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/purchases");
    expect(revalidateMock).toHaveBeenCalledWith("/purchases/requests/pr-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase_request.convert" })
    );
  });
});
