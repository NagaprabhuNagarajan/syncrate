import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CreatePurchaseRequestInput,
  PurchaseRequest,
  PurchaseRequestWithItems,
} from "@/features/purchase/types/purchase-request.types";
import type { PurchaseOrderWithItems } from "@/features/purchase/types/purchase-order.types";
import { PurchaseRequestService } from "./purchase-request.service";

const { mockRepo, createPurchaseOrderMock } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    findByNumber: vi.fn(),
    findItems: vi.fn(),
    findWithItems: vi.fn(),
    createHeader: vi.fn(),
    insertItems: vi.fn(),
    replaceItems: vi.fn(),
    updateHeader: vi.fn(),
    updateStatus: vi.fn(),
    softDelete: vi.fn(),
  },
  createPurchaseOrderMock: vi.fn(),
}));

vi.mock(
  "@/features/purchase/repositories/purchase-request.repository",
  () => ({
    PurchaseRequestRepository: vi.fn(() => mockRepo),
  })
);

vi.mock("@/features/purchase/services/purchase-order.service", () => ({
  PurchaseOrderService: vi.fn(() => ({
    createPurchaseOrder: createPurchaseOrderMock,
  })),
}));

function buildRequest(
  overrides: Partial<PurchaseRequest> = {}
): PurchaseRequest {
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
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version: 1,
    ...overrides,
  };
}

function withItems(
  request: PurchaseRequest,
  items: PurchaseRequestWithItems["items"] = []
): PurchaseRequestWithItems {
  return { ...request, items };
}

const SAMPLE_ITEM = {
  id: "item-1",
  organizationId: "org-1",
  purchaseRequestId: "pr-1",
  productId: "p-a",
  description: "Widget",
  quantity: 4,
  estimatedPrice: 25,
  createdAt: new Date("2026-06-01"),
  createdBy: "user-1",
};

const CREATE_INPUT: CreatePurchaseRequestInput = {
  items: [
    { productId: "p-a", quantity: 4, estimatedPrice: 25 },
    { productId: "p-b", quantity: 2 },
  ],
};

let service: PurchaseRequestService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new PurchaseRequestService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// createPurchaseRequest
// ─────────────────────────────────────────────────────────────

describe("PurchaseRequestService.createPurchaseRequest", () => {
  it("auto-generates the request number and persists items", async () => {
    mockRepo.list.mockResolvedValue({
      items: [],
      total: 2,
      page: 1,
      pageSize: 1,
    });
    mockRepo.createHeader.mockResolvedValue(buildRequest({ id: "pr-9" }));
    mockRepo.insertItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildRequest({ id: "pr-9" }))
    );

    const result = await service.createPurchaseRequest(
      CREATE_INPUT,
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    const header = mockRepo.createHeader.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(header.request_number).toBe("PR-00003"); // count 2 + 1
    expect(header.status).toBe("draft");

    const items = mockRepo.insertItems.mock.calls[0][0] as Array<
      Record<string, number>
    >;
    expect(items).toHaveLength(2);
    expect(items[0].estimated_price).toBe(25);
    expect(items[1].estimated_price).toBe(0); // defaulted
  });

  it("uses a provided request number (uppercased)", async () => {
    mockRepo.createHeader.mockResolvedValue(buildRequest());
    mockRepo.insertItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildRequest()));

    await service.createPurchaseRequest(
      { ...CREATE_INPUT, requestNumber: "req-77" },
      "org-1",
      "user-1"
    );

    const header = mockRepo.createHeader.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(header.request_number).toBe("REQ-77");
    expect(mockRepo.list).not.toHaveBeenCalled();
  });

  it("fails when the header insert fails", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(null);
    const result = await service.createPurchaseRequest(
      CREATE_INPUT,
      "org-1",
      "u"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(mockRepo.insertItems).not.toHaveBeenCalled();
  });

  it("rolls back the header when item insert fails", async () => {
    mockRepo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    mockRepo.createHeader.mockResolvedValue(buildRequest({ id: "pr-9" }));
    mockRepo.insertItems.mockResolvedValue(false);
    const result = await service.createPurchaseRequest(
      CREATE_INPUT,
      "org-1",
      "u"
    );
    expect(result.success).toBe(false);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("pr-9", "u");
  });
});

// ─────────────────────────────────────────────────────────────
// updatePurchaseRequest (draft only, optimistic locking)
// ─────────────────────────────────────────────────────────────

describe("PurchaseRequestService.updatePurchaseRequest", () => {
  it("updates a draft and replaces items, passing the expected version", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "draft", version: 3 }));
    mockRepo.updateHeader.mockResolvedValue(buildRequest({ version: 4 }));
    mockRepo.replaceItems.mockResolvedValue(true);
    mockRepo.findWithItems.mockResolvedValue(withItems(buildRequest()));

    const result = await service.updatePurchaseRequest(
      "pr-1",
      CREATE_INPUT,
      "org-1",
      "user-1",
      3
    );

    expect(result.success).toBe(true);
    expect(mockRepo.updateHeader).toHaveBeenCalledWith(
      "pr-1",
      expect.any(Object),
      "user-1",
      3
    );
    expect(mockRepo.replaceItems).toHaveBeenCalled();
  });

  it("returns conflict when the version no longer matches", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "draft", version: 3 }));
    mockRepo.updateHeader.mockResolvedValue(null); // version mismatch → no row
    const result = await service.updatePurchaseRequest(
      "pr-1",
      CREATE_INPUT,
      "org-1",
      "user-1",
      2
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
    expect(mockRepo.replaceItems).not.toHaveBeenCalled();
  });

  it("returns not_found when missing or cross-org", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const a = await service.updatePurchaseRequest("pr-1", CREATE_INPUT, "org-1", "u", 1);
    if (!a.success) {
      expect(a.error.code).toBe("not_found");
    }

    mockRepo.findById.mockResolvedValue(buildRequest({ organizationId: "org-1" }));
    const b = await service.updatePurchaseRequest("pr-1", CREATE_INPUT, "org-2", "u", 1);
    if (!b.success) {
      expect(b.error.code).toBe("not_found");
    }
  });

  it("rejects editing a non-draft request", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "submitted" }));
    const result = await service.updatePurchaseRequest("pr-1", CREATE_INPUT, "org-1", "u", 1);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(mockRepo.updateHeader).not.toHaveBeenCalled();
  });

  it("fails when replacing items fails", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "draft" }));
    mockRepo.updateHeader.mockResolvedValue(buildRequest());
    mockRepo.replaceItems.mockResolvedValue(false);
    const result = await service.updatePurchaseRequest("pr-1", CREATE_INPUT, "org-1", "u", 1);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────

describe("PurchaseRequestService transitions", () => {
  it("submits a draft", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "draft" }));
    mockRepo.updateStatus.mockResolvedValue(buildRequest({ status: "submitted" }));
    const result = await service.submitPurchaseRequest("pr-1", "org-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.updateStatus).toHaveBeenCalledWith("pr-1", "submitted", "user-1", {});
  });

  it("rejects submitting a non-draft", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "approved" }));
    const result = await service.submitPurchaseRequest("pr-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
  });

  it("approves a submitted request with the approve flag", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "submitted" }));
    mockRepo.updateStatus.mockResolvedValue(buildRequest({ status: "approved" }));
    const result = await service.approvePurchaseRequest("pr-1", "org-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.updateStatus).toHaveBeenCalledWith("pr-1", "approved", "user-1", {
      approve: true,
    });
  });

  it("rejects approving a non-submitted request", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "draft" }));
    const result = await service.approvePurchaseRequest("pr-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
  });

  it("rejects a submitted request with a reason", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "submitted" }));
    mockRepo.updateStatus.mockResolvedValue(buildRequest({ status: "rejected" }));
    const result = await service.rejectPurchaseRequest("pr-1", "org-1", "user-1", "  No budget  ");
    expect(result.success).toBe(true);
    expect(mockRepo.updateStatus).toHaveBeenCalledWith("pr-1", "rejected", "user-1", {
      rejectedReason: "No budget",
    });
  });

  it("cancels a draft request", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "draft" }));
    mockRepo.updateStatus.mockResolvedValue(buildRequest({ status: "cancelled" }));
    const result = await service.cancelPurchaseRequest("pr-1", "org-1", "user-1");
    expect(result.success).toBe(true);
  });

  it("rejects cancelling a converted request", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "converted" }));
    const result = await service.cancelPurchaseRequest("pr-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
  });

  it("returns not_found for a missing request on transition", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.submitPurchaseRequest("pr-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("fails when the status update fails", async () => {
    mockRepo.findById.mockResolvedValue(buildRequest({ status: "draft" }));
    mockRepo.updateStatus.mockResolvedValue(null);
    const result = await service.submitPurchaseRequest("pr-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// convertToPurchaseOrder
// ─────────────────────────────────────────────────────────────

const PO: PurchaseOrderWithItems = {
  id: "po-9",
  organizationId: "org-1",
  poNumber: "PO-00001",
  supplierId: "sup-1",
  warehouseId: null,
  status: "draft",
  orderDate: new Date("2026-06-01"),
  expectedDeliveryDate: null,
  currency: "INR",
  notes: null,
  terms: null,
  subtotal: 100,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 100,
  approvedBy: null,
  approvedAt: null,
  createdAt: new Date("2026-06-01"),
  updatedAt: new Date("2026-06-01"),
  createdBy: "user-1",
  version: 1,
  items: [],
};

describe("PurchaseRequestService.convertToPurchaseOrder", () => {
  it("creates a PO from an approved request and stamps converted_po_id", async () => {
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildRequest({ status: "approved", warehouseId: "wh-1" }), [
        SAMPLE_ITEM,
      ])
    );
    createPurchaseOrderMock.mockResolvedValue({ success: true, data: PO });
    mockRepo.updateStatus.mockResolvedValue(
      buildRequest({ status: "converted", convertedPoId: "po-9" })
    );

    const result = await service.convertToPurchaseOrder(
      "pr-1",
      "sup-1",
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("po-9");
    }
    const poInput = createPurchaseOrderMock.mock.calls[0][0] as {
      supplierId: string;
      warehouseId?: string;
      items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    };
    expect(poInput.supplierId).toBe("sup-1");
    expect(poInput.warehouseId).toBe("wh-1");
    expect(poInput.items[0]).toMatchObject({
      productId: "p-a",
      quantity: 4,
      unitPrice: 25,
    });
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      "pr-1",
      "converted",
      "user-1",
      { convertedPoId: "po-9" }
    );
  });

  it("returns not_found when the request is missing or cross-org", async () => {
    mockRepo.findWithItems.mockResolvedValue(null);
    const a = await service.convertToPurchaseOrder("pr-1", "sup-1", "org-1", "u");
    if (!a.success) {
      expect(a.error.code).toBe("not_found");
    }

    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildRequest({ status: "approved" }), [SAMPLE_ITEM])
    );
    const b = await service.convertToPurchaseOrder("pr-1", "sup-1", "org-2", "u");
    if (!b.success) {
      expect(b.error.code).toBe("not_found");
    }
  });

  it("rejects converting a request that is not approved", async () => {
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildRequest({ status: "submitted" }), [SAMPLE_ITEM])
    );
    const result = await service.convertToPurchaseOrder("pr-1", "sup-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("invalid_status");
    }
    expect(createPurchaseOrderMock).not.toHaveBeenCalled();
  });

  it("returns validation when the request has no items", async () => {
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildRequest({ status: "approved" }), [])
    );
    const result = await service.convertToPurchaseOrder("pr-1", "sup-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("fails when the purchase order creation fails", async () => {
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildRequest({ status: "approved" }), [SAMPLE_ITEM])
    );
    createPurchaseOrderMock.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "boom" },
    });
    const result = await service.convertToPurchaseOrder("pr-1", "sup-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("fails when the request status update fails after the PO is created", async () => {
    mockRepo.findWithItems.mockResolvedValue(
      withItems(buildRequest({ status: "approved" }), [SAMPLE_ITEM])
    );
    createPurchaseOrderMock.mockResolvedValue({ success: true, data: PO });
    mockRepo.updateStatus.mockResolvedValue(null);
    const result = await service.convertToPurchaseOrder("pr-1", "sup-1", "org-1", "u");
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("PurchaseRequestService reads", () => {
  it("getPurchaseRequest returns the request with items", async () => {
    mockRepo.findWithItems.mockResolvedValue(withItems(buildRequest()));
    const result = await service.getPurchaseRequest("pr-1");
    expect(result.success).toBe(true);
  });

  it("getPurchaseRequest returns not_found when missing", async () => {
    mockRepo.findWithItems.mockResolvedValue(null);
    const result = await service.getPurchaseRequest("pr-1");
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("listPurchaseRequests delegates to the repository", async () => {
    const listResult = { items: [], total: 0, page: 1, pageSize: 20 };
    mockRepo.list.mockResolvedValue(listResult);
    const result = await service.listPurchaseRequests("org-1", { status: "draft" });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { status: "draft" });
  });
});
