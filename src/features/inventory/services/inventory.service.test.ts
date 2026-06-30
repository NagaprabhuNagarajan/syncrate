import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { StockLevel } from "@/features/inventory/types/inventory.types";
import { InventoryService } from "./inventory.service";

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    getLevel: vi.fn(),
    listLevels: vi.fn(),
    listTransactions: vi.fn(),
    adjustStockRpc: vi.fn(),
    transferStockRpc: vi.fn(),
  },
}));

vi.mock("@/features/inventory/repositories/inventory.repository", () => ({
  InventoryRepository: vi.fn(() => mockRepo),
}));

const PRODUCT = "prod-1";
const WH_A = "wh-a";
const WH_B = "wh-b";

function level(quantity: number, branchId = WH_A): StockLevel {
  return {
    id: `lvl-${branchId}`,
    organizationId: "org-1",
    productId: PRODUCT,
    branchId,
    quantity,
    reservedQuantity: 0,
  };
}

let service: InventoryService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new InventoryService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// adjustStock
// ─────────────────────────────────────────────────────────────

describe("InventoryService.adjustStock", () => {
  it("calls adjust_stock as ONE atomic RPC and returns the new quantity", async () => {
    mockRepo.adjustStockRpc.mockResolvedValue({ data: 15, error: null });

    const result = await service.adjustStock(
      { productId: PRODUCT, branchId: WH_A, quantity: 5, reason: "recount" },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(15);
    }
    expect(mockRepo.adjustStockRpc).toHaveBeenCalledTimes(1);
    expect(mockRepo.adjustStockRpc).toHaveBeenCalledWith({
      p_organization_id: "org-1",
      p_product_id: PRODUCT,
      p_branch_id: WH_A,
      p_quantity: 5,
      p_type: "adjustment",
      p_note: "recount",
      p_reference_type: "manual",
    });
  });

  it("sends type `damage` for a negative adjustment", async () => {
    mockRepo.adjustStockRpc.mockResolvedValue({ data: 7, error: null });

    const result = await service.adjustStock(
      { productId: PRODUCT, branchId: WH_A, quantity: -3 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    const args = mockRepo.adjustStockRpc.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(args.p_type).toBe("damage");
    expect(args.p_quantity).toBe(-3);
    expect(args.p_note).toBeNull();
  });

  it("maps a negative_stock RPC error", async () => {
    mockRepo.adjustStockRpc.mockResolvedValue({
      data: null,
      error: { message: "negative_stock: stock cannot go below zero" },
    });

    const result = await service.adjustStock(
      { productId: PRODUCT, branchId: WH_A, quantity: -5 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("negative_stock");
    }
  });

  it("maps an unrecognized RPC error to unknown", async () => {
    mockRepo.adjustStockRpc.mockResolvedValue({
      data: null,
      error: { message: "deadlock detected" },
    });

    const result = await service.adjustStock(
      { productId: PRODUCT, branchId: WH_A, quantity: 5 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("returns unknown when the RPC returns neither data nor error", async () => {
    mockRepo.adjustStockRpc.mockResolvedValue({ data: null, error: null });

    const result = await service.adjustStock(
      { productId: PRODUCT, branchId: WH_A, quantity: 5 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("rejects a zero quantity without calling the RPC", async () => {
    const result = await service.adjustStock(
      { productId: PRODUCT, branchId: WH_A, quantity: 0 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockRepo.adjustStockRpc).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// transferStock
// ─────────────────────────────────────────────────────────────

describe("InventoryService.transferStock", () => {
  it("calls transfer_stock as ONE atomic RPC on success", async () => {
    mockRepo.transferStockRpc.mockResolvedValue({ data: null, error: null });

    const result = await service.transferStock(
      {
        productId: PRODUCT,
        fromBranchId: WH_A,
        toBranchId: WH_B,
        quantity: 8,
        note: "rebalance",
      },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    expect(mockRepo.transferStockRpc).toHaveBeenCalledTimes(1);
    expect(mockRepo.transferStockRpc).toHaveBeenCalledWith({
      p_organization_id: "org-1",
      p_product_id: PRODUCT,
      p_from_branch_id: WH_A,
      p_to_branch_id: WH_B,
      p_quantity: 8,
      p_note: "rebalance",
    });
  });

  it("maps an insufficient_stock RPC error", async () => {
    mockRepo.transferStockRpc.mockResolvedValue({
      data: null,
      error: { message: "insufficient_stock at source branch" },
    });

    const result = await service.transferStock(
      { productId: PRODUCT, fromBranchId: WH_A, toBranchId: WH_B, quantity: 99 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("insufficient_stock");
    }
  });

  it("maps a same_warehouse RPC error", async () => {
    mockRepo.transferStockRpc.mockResolvedValue({
      data: null,
      error: { message: "same_warehouse not allowed" },
    });

    const result = await service.transferStock(
      { productId: PRODUCT, fromBranchId: WH_A, toBranchId: WH_B, quantity: 5 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("same_warehouse");
    }
  });

  it("maps an invalid_quantity RPC error to validation", async () => {
    mockRepo.transferStockRpc.mockResolvedValue({
      data: null,
      error: { message: "invalid_quantity: must be positive" },
    });

    const result = await service.transferStock(
      { productId: PRODUCT, fromBranchId: WH_A, toBranchId: WH_B, quantity: 5 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("maps an unrecognized RPC error to unknown", async () => {
    mockRepo.transferStockRpc.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });

    const result = await service.transferStock(
      { productId: PRODUCT, fromBranchId: WH_A, toBranchId: WH_B, quantity: 5 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("rejects a same-branch transfer without calling the RPC", async () => {
    const result = await service.transferStock(
      { productId: PRODUCT, fromBranchId: WH_A, toBranchId: WH_A, quantity: 5 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("same_warehouse");
    }
    expect(mockRepo.transferStockRpc).not.toHaveBeenCalled();
  });

  it("rejects a non-positive quantity without calling the RPC", async () => {
    const result = await service.transferStock(
      { productId: PRODUCT, fromBranchId: WH_A, toBranchId: WH_B, quantity: 0 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockRepo.transferStockRpc).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// setOpeningStock
// ─────────────────────────────────────────────────────────────

describe("InventoryService.setOpeningStock", () => {
  it("calls adjust_stock with type `opening` and returns the new quantity", async () => {
    mockRepo.adjustStockRpc.mockResolvedValue({ data: 50, error: null });

    const result = await service.setOpeningStock(
      { productId: PRODUCT, branchId: WH_A, quantity: 50 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(50);
    }
    expect(mockRepo.adjustStockRpc).toHaveBeenCalledWith({
      p_organization_id: "org-1",
      p_product_id: PRODUCT,
      p_branch_id: WH_A,
      p_quantity: 50,
      p_type: "opening",
      p_note: null,
      p_reference_type: "opening",
    });
  });

  it("rejects a negative opening quantity without calling the RPC", async () => {
    const result = await service.setOpeningStock(
      { productId: PRODUCT, branchId: WH_A, quantity: -1 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockRepo.adjustStockRpc).not.toHaveBeenCalled();
  });

  it("maps an RPC error", async () => {
    mockRepo.adjustStockRpc.mockResolvedValue({
      data: null,
      error: { message: "negative_stock" },
    });

    const result = await service.setOpeningStock(
      { productId: PRODUCT, branchId: WH_A, quantity: 5 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("negative_stock");
    }
  });

  it("returns unknown when the RPC yields no data and no error", async () => {
    mockRepo.adjustStockRpc.mockResolvedValue({ data: null, error: null });

    const result = await service.setOpeningStock(
      { productId: PRODUCT, branchId: WH_A, quantity: 5 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// reads
// ─────────────────────────────────────────────────────────────

describe("InventoryService reads", () => {
  it("listLevels delegates to the repository", async () => {
    const listResult = { items: [], total: 0, page: 1, pageSize: 20 };
    mockRepo.listLevels.mockResolvedValue(listResult);
    const result = await service.listLevels("org-1", { search: "x" });
    expect(result).toBe(listResult);
    expect(mockRepo.listLevels).toHaveBeenCalledWith("org-1", { search: "x" });
  });

  it("listTransactions delegates to the repository", async () => {
    mockRepo.listTransactions.mockResolvedValue([]);
    await service.listTransactions("org-1", { limit: 10 });
    expect(mockRepo.listTransactions).toHaveBeenCalledWith("org-1", {
      limit: 10,
    });
  });

  it("getStockValue sums quantity × purchase price", async () => {
    mockRepo.listLevels.mockResolvedValue({
      items: [
        { quantity: 10, purchasePrice: 5 },
        { quantity: 3, purchasePrice: 20 },
      ],
      total: 2,
      page: 1,
      pageSize: 100,
    });
    const value = await service.getStockValue("org-1");
    expect(value).toBe(10 * 5 + 3 * 20);
  });

  it("getCurrentQuantity returns the level quantity or zero", async () => {
    mockRepo.getLevel.mockResolvedValueOnce(level(12));
    expect(await service.getCurrentQuantity(PRODUCT, WH_A)).toBe(12);
    mockRepo.getLevel.mockResolvedValueOnce(null);
    expect(await service.getCurrentQuantity(PRODUCT, WH_A)).toBe(0);
  });
});
