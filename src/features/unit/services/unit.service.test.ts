import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Unit } from "@/features/unit/types/unit.types";
import { UnitService } from "./unit.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/features/unit/repositories/unit.repository", () => ({
  UnitRepository: vi.fn(() => mockRepo),
}));

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "unit-1",
    organizationId: "org-1",
    name: "Kilogram",
    symbol: "kg",
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

let service: UnitService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new UnitService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("UnitService.listUnits", () => {
  it("delegates to the repository", async () => {
    const listResult = {
      items: [buildUnit()],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockRepo.list.mockResolvedValue(listResult);

    const result = await service.listUnits("org-1", { search: "kg" });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { search: "kg" });
  });
});

describe("UnitService.getUnit", () => {
  it("returns the unit when found", async () => {
    mockRepo.findById.mockResolvedValue(buildUnit());
    const result = await service.getUnit("unit-1");
    expect(result.success).toBe(true);
  });

  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.getUnit("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// createUnit
// ─────────────────────────────────────────────────────────────

describe("UnitService.createUnit", () => {
  it("fails with duplicate_name when the name already exists", async () => {
    mockRepo.findByName.mockResolvedValue(buildUnit());

    const result = await service.createUnit(
      { name: "Kilogram", symbol: "kg" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_name");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("trims fields, defaults status to active and sets created_by", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildUnit());

    await service.createUnit(
      { name: "  Kilogram  ", symbol: "  kg  " },
      "org-1",
      "user-1"
    );
    const arg = mockRepo.create.mock.calls[0]?.[0];
    expect(arg.name).toBe("Kilogram");
    expect(arg.symbol).toBe("kg");
    expect(arg.status).toBe("active");
    expect(arg.organization_id).toBe("org-1");
    expect(arg.created_by).toBe("user-1");
    expect(mockRepo.findByName).toHaveBeenCalledWith("org-1", "Kilogram");
  });

  it("uses the provided status", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildUnit());

    await service.createUnit(
      { name: "Kilogram", symbol: "kg", status: "archived" },
      "org-1",
      "user-1"
    );
    const arg = mockRepo.create.mock.calls[0]?.[0];
    expect(arg.status).toBe("archived");
  });

  it("fails with unknown when the repository create returns null", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(null);

    const result = await service.createUnit(
      { name: "Kilogram", symbol: "kg" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("succeeds and returns the created unit", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    const created = buildUnit();
    mockRepo.create.mockResolvedValue(created);

    const result = await service.createUnit(
      { name: "Kilogram", symbol: "kg" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(created);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// updateUnit
// ─────────────────────────────────────────────────────────────

describe("UnitService.updateUnit", () => {
  it("fails with duplicate_name when the name belongs to a different unit", async () => {
    mockRepo.findByName.mockResolvedValue(buildUnit({ id: "other" }));

    const result = await service.updateUnit(
      "unit-1",
      { name: "Gram" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_name");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("allows updating to a name owned by the same unit", async () => {
    mockRepo.findByName.mockResolvedValue(buildUnit({ id: "unit-1" }));
    mockRepo.update.mockResolvedValue(buildUnit({ id: "unit-1" }));

    const result = await service.updateUnit(
      "unit-1",
      { name: "Kilogram", symbol: "kgs" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.name).toBe("Kilogram");
    expect(patch.symbol).toBe("kgs");
    expect(mockRepo.update.mock.calls[0]?.[2]).toBe("user-1");
  });

  it("skips the name duplicate check when the name is empty", async () => {
    mockRepo.update.mockResolvedValue(buildUnit());

    const result = await service.updateUnit(
      "unit-1",
      { name: "", symbol: "kg" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRepo.findByName).not.toHaveBeenCalled();
  });

  it("returns not_found when the repository update returns null", async () => {
    mockRepo.update.mockResolvedValue(null);

    const result = await service.updateUnit(
      "unit-1",
      { symbol: "g" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("succeeds with the built patch including status", async () => {
    mockRepo.update.mockResolvedValue(buildUnit());

    const result = await service.updateUnit(
      "unit-1",
      { status: "archived" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.status).toBe("archived");
    expect(mockRepo.findByName).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// archiveUnit
// ─────────────────────────────────────────────────────────────

describe("UnitService.archiveUnit", () => {
  it("returns not_found when the unit does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.archiveUnit("unit-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it("fails with unknown when the soft delete fails", async () => {
    mockRepo.findById.mockResolvedValue(buildUnit());
    mockRepo.softDelete.mockResolvedValue(false);

    const result = await service.archiveUnit("unit-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("succeeds when the unit is soft deleted", async () => {
    mockRepo.findById.mockResolvedValue(buildUnit());
    mockRepo.softDelete.mockResolvedValue(true);

    const result = await service.archiveUnit("unit-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("unit-1", "user-1");
  });
});
