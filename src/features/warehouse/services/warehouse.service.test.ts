import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Warehouse } from "@/features/warehouse/types/warehouse.types";
import { WarehouseService } from "./warehouse.service";

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    listOptions: vi.fn(),
    findById: vi.fn(),
    findByCode: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/features/warehouse/repositories/warehouse.repository", () => ({
  WarehouseRepository: vi.fn(() => mockRepo),
}));

function buildWarehouse(overrides: Partial<Warehouse> = {}): Warehouse {
  return {
    id: "wh-1",
    organizationId: "org-1",
    branchId: null,
    code: "WH-01",
    name: "Chennai Central",
    addressLine1: null,
    city: "Chennai",
    state: "TN",
    pincode: null,
    capacity: 1000,
    isDefault: false,
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

let service: WarehouseService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new WarehouseService({} as unknown as AppSupabaseClient);
});

describe("WarehouseService.listWarehouses", () => {
  it("delegates to the repository", async () => {
    const listResult = { items: [buildWarehouse()], total: 1, page: 1, pageSize: 20 };
    mockRepo.list.mockResolvedValue(listResult);
    const result = await service.listWarehouses("org-1", { search: "chn" });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { search: "chn" });
  });
});

describe("WarehouseService.listWarehouseOptions", () => {
  it("delegates to the repository", async () => {
    mockRepo.listOptions.mockResolvedValue([]);
    await service.listWarehouseOptions("org-1");
    expect(mockRepo.listOptions).toHaveBeenCalledWith("org-1");
  });
});

describe("WarehouseService.getWarehouse", () => {
  it("returns the warehouse when found", async () => {
    mockRepo.findById.mockResolvedValue(buildWarehouse());
    const result = await service.getWarehouse("wh-1");
    expect(result.success).toBe(true);
  });

  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.getWarehouse("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

describe("WarehouseService.createWarehouse", () => {
  it("rejects a duplicate code", async () => {
    mockRepo.findByCode.mockResolvedValue(buildWarehouse());
    const result = await service.createWarehouse(
      { code: "wh-01", name: "Main" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_code");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("creates the warehouse with normalized fields", async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildWarehouse());

    const result = await service.createWarehouse(
      {
        code: "wh-01",
        name: "  Chennai Central  ",
        city: "Chennai",
        capacity: 500,
        isDefault: true,
      },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    const insertArg = mockRepo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.code).toBe("WH-01");
    expect(insertArg.name).toBe("Chennai Central");
    expect(insertArg.capacity).toBe(500);
    expect(insertArg.is_default).toBe(true);
    expect(insertArg.created_by).toBe("user-1");
  });

  it("returns unknown when the repository fails", async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(null);
    const result = await service.createWarehouse(
      { code: "WH-01", name: "Main" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("WarehouseService.updateWarehouse", () => {
  it("rejects a duplicate code held by another warehouse", async () => {
    mockRepo.findByCode.mockResolvedValue(buildWarehouse({ id: "wh-other" }));
    const result = await service.updateWarehouse(
      "wh-1",
      { code: "WH-01" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_code");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("allows keeping the same code on the same warehouse", async () => {
    mockRepo.findByCode.mockResolvedValue(buildWarehouse({ id: "wh-1" }));
    mockRepo.update.mockResolvedValue(buildWarehouse({ name: "Renamed" }));
    const result = await service.updateWarehouse(
      "wh-1",
      { code: "WH-01", name: "Renamed" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRepo.update).toHaveBeenCalled();
  });

  it("returns not_found when the update yields nothing", async () => {
    mockRepo.update.mockResolvedValue(null);
    const result = await service.updateWarehouse(
      "wh-1",
      { name: "Renamed" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

describe("WarehouseService.archiveWarehouse", () => {
  it("returns not_found when the warehouse does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.archiveWarehouse("wh-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it("archives an existing warehouse", async () => {
    mockRepo.findById.mockResolvedValue(buildWarehouse());
    mockRepo.softDelete.mockResolvedValue(true);
    const result = await service.archiveWarehouse("wh-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("wh-1", "user-1");
  });

  it("returns unknown when soft delete fails", async () => {
    mockRepo.findById.mockResolvedValue(buildWarehouse());
    mockRepo.softDelete.mockResolvedValue(false);
    const result = await service.archiveWarehouse("wh-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});
