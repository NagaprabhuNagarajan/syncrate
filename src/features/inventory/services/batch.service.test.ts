import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Batch } from "@/features/inventory/types/batch.types";
import { BatchService } from "./batch.service";

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    findByNumber: vi.fn(),
    create: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock("@/features/inventory/repositories/batch.repository", () => ({
  BatchRepository: vi.fn(() => mockRepo),
}));

function buildBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: "batch-1",
    organizationId: "org-1",
    productId: "prod-1",
    batchNumber: "B-001",
    manufacturingDate: null,
    expiryDate: null,
    supplierBatch: null,
    receivedQuantity: 100,
    remainingQuantity: 100,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
    ...overrides,
  };
}

let service: BatchService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new BatchService({} as unknown as AppSupabaseClient);
});

describe("BatchService.listBatches", () => {
  it("delegates to the repository", async () => {
    const listResult = { items: [], total: 0, page: 1, pageSize: 20 };
    mockRepo.list.mockResolvedValue(listResult);
    const result = await service.listBatches("org-1", { productId: "prod-1" });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { productId: "prod-1" });
  });
});

describe("BatchService.createBatch", () => {
  it("rejects a duplicate batch number for the product", async () => {
    mockRepo.findByNumber.mockResolvedValue(buildBatch());
    const result = await service.createBatch(
      { productId: "prod-1", batchNumber: "B-001", receivedQuantity: 10 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_number");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("defaults remaining quantity to the received quantity", async () => {
    mockRepo.findByNumber.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildBatch());

    const result = await service.createBatch(
      { productId: "prod-1", batchNumber: "B-001", receivedQuantity: 50 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    const insertArg = mockRepo.create.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(insertArg.received_quantity).toBe(50);
    expect(insertArg.remaining_quantity).toBe(50);
    expect(insertArg.created_by).toBe("user-1");
  });

  it("uses an explicit remaining quantity when provided", async () => {
    mockRepo.findByNumber.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildBatch());

    await service.createBatch(
      {
        productId: "prod-1",
        batchNumber: "B-001",
        receivedQuantity: 50,
        remainingQuantity: 30,
      },
      "org-1",
      "user-1"
    );

    const insertArg = mockRepo.create.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(insertArg.remaining_quantity).toBe(30);
  });

  it("returns unknown when the repository fails", async () => {
    mockRepo.findByNumber.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(null);
    const result = await service.createBatch(
      { productId: "prod-1", batchNumber: "B-001", receivedQuantity: 10 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("BatchService.getBatch", () => {
  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.getBatch("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

describe("BatchService.getBatchStats", () => {
  it("delegates to the repository", async () => {
    const stats = { total: 8, active: 5, expired: 2, depleted: 1 };
    mockRepo.getStats.mockResolvedValue(stats);

    const result = await service.getBatchStats("org-1");
    expect(result).toBe(stats);
    expect(mockRepo.getStats).toHaveBeenCalledWith("org-1");
  });
});
