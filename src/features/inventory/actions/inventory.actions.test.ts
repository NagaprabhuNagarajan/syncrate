import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import {
  adjustStockAction,
  transferStockAction,
  createBatchAction,
} from "./inventory.actions";

const {
  mockInventoryService,
  mockBatchService,
  mockOrgService,
  revalidateMock,
  getUserMock,
  createClientMock,
  auditLogMock,
} = vi.hoisted(() => ({
  mockInventoryService: {
    adjustStock: vi.fn(),
    transferStock: vi.fn(),
  },
  mockBatchService: {
    createBatch: vi.fn(),
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
vi.mock("@/features/inventory/services/inventory.service", () => ({
  InventoryService: vi.fn(() => mockInventoryService),
}));
vi.mock("@/features/inventory/services/batch.service", () => ({
  BatchService: vi.fn(() => mockBatchService),
}));
vi.mock("@/features/organization/services/organization.service", () => ({
  OrganizationService: vi.fn(() => mockOrgService),
}));
vi.mock("@/features/audit/services/audit.service", () => ({
  AuditService: vi.fn(() => ({ log: auditLogMock })),
}));

const PRODUCT = "11111111-1111-1111-1111-111111111111";
const WH_A = "22222222-2222-2222-2222-222222222222";
const WH_B = "33333333-3333-3333-3333-333333333333";

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

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// adjustStockAction
// ─────────────────────────────────────────────────────────────

describe("adjustStockAction", () => {
  it("returns validation error on invalid input", async () => {
    const result = await adjustStockAction(
      "org-1",
      fd({ productId: "x", branchId: WH_A, quantity: "1" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockInventoryService.adjustStock).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user is not authenticated", async () => {
    unauthenticated();
    const result = await adjustStockAction(
      "org-1",
      fd({ productId: PRODUCT, branchId: WH_A, quantity: "5" })
    );
    expect(result).toEqual({
      success: false,
      error: { code: "forbidden", message: "Not authenticated" },
    });
    expect(mockInventoryService.adjustStock).not.toHaveBeenCalled();
  });

  it("returns forbidden when lacking inventory.adjust", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.view"])
    );
    const result = await adjustStockAction(
      "org-1",
      fd({ productId: PRODUCT, branchId: WH_A, quantity: "5" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockInventoryService.adjustStock).not.toHaveBeenCalled();
  });

  it("adjusts, revalidates and audits with metadata on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    mockInventoryService.adjustStock.mockResolvedValue({
      success: true,
      data: 15,
    });

    const result = await adjustStockAction(
      "org-1",
      fd({ productId: PRODUCT, branchId: WH_A, quantity: "5", reason: "recount" })
    );

    expect(result.success).toBe(true);
    expect(mockInventoryService.adjustStock).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: PRODUCT,
        branchId: WH_A,
        quantity: 5,
      }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/inventory");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inventory.adjust",
        entityType: "inventory",
        metadata: { productId: PRODUCT, branchId: WH_A, quantity: 5 },
      })
    );
  });

  it("does not revalidate/audit on service failure", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    mockInventoryService.adjustStock.mockResolvedValue({
      success: false,
      error: { code: "negative_stock", message: "no" },
    });
    await adjustStockAction(
      "org-1",
      fd({ productId: PRODUCT, branchId: WH_A, quantity: "-5" })
    );
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// transferStockAction
// ─────────────────────────────────────────────────────────────

describe("transferStockAction", () => {
  it("returns validation error when branches are equal", async () => {
    const result = await transferStockAction(
      "org-1",
      fd({
        productId: PRODUCT,
        fromBranchId: WH_A,
        toBranchId: WH_A,
        quantity: "5",
      })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockInventoryService.transferStock).not.toHaveBeenCalled();
  });

  it("requires inventory.transfer (not inventory.adjust)", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    const result = await transferStockAction(
      "org-1",
      fd({
        productId: PRODUCT,
        fromBranchId: WH_A,
        toBranchId: WH_B,
        quantity: "5",
      })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockInventoryService.transferStock).not.toHaveBeenCalled();
  });

  it("transfers, revalidates and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.transfer"])
    );
    mockInventoryService.transferStock.mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await transferStockAction(
      "org-1",
      fd({
        productId: PRODUCT,
        fromBranchId: WH_A,
        toBranchId: WH_B,
        quantity: "8",
      })
    );

    expect(result.success).toBe(true);
    expect(mockInventoryService.transferStock).toHaveBeenCalledWith(
      expect.objectContaining({
        fromBranchId: WH_A,
        toBranchId: WH_B,
        quantity: 8,
      }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/inventory");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inventory.transfer",
        entityType: "inventory",
        entityId: PRODUCT,
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// createBatchAction
// ─────────────────────────────────────────────────────────────

describe("createBatchAction", () => {
  it("requires inventory.adjust", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.view"])
    );
    const result = await createBatchAction(
      "org-1",
      fd({ productId: PRODUCT, batchNumber: "B-001", receivedQuantity: "10" })
    );
    expect(result.success).toBe(false);
    expect(mockBatchService.createBatch).not.toHaveBeenCalled();
  });

  it("creates, revalidates and audits on success", async () => {
    authedAs("user-1");
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["inventory.adjust"])
    );
    mockBatchService.createBatch.mockResolvedValue({
      success: true,
      data: { id: "batch-1", batchNumber: "B-001" },
    });

    const result = await createBatchAction(
      "org-1",
      fd({ productId: PRODUCT, batchNumber: "B-001", receivedQuantity: "10" })
    );

    expect(result.success).toBe(true);
    expect(mockBatchService.createBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: PRODUCT,
        batchNumber: "B-001",
        receivedQuantity: 10,
      }),
      "org-1",
      "user-1"
    );
    expect(revalidateMock).toHaveBeenCalledWith("/inventory/batches");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "batch.create", entityType: "batch" })
    );
  });
});
