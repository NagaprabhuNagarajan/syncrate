import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Brand } from "@/features/brand/types/brand.types";
import { BrandService } from "./brand.service";

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

vi.mock("@/features/brand/repositories/brand.repository", () => ({
  BrandRepository: vi.fn(() => mockRepo),
}));

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: "brand-1",
    organizationId: "org-1",
    name: "Samsung",
    description: null,
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

let service: BrandService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new BrandService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("BrandService.listBrands", () => {
  it("delegates to the repository", async () => {
    const listResult = {
      items: [buildBrand()],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockRepo.list.mockResolvedValue(listResult);

    const result = await service.listBrands("org-1", { search: "sam" });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { search: "sam" });
  });
});

describe("BrandService.getBrand", () => {
  it("returns the brand when found", async () => {
    mockRepo.findById.mockResolvedValue(buildBrand());
    const result = await service.getBrand("brand-1");
    expect(result.success).toBe(true);
  });

  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.getBrand("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// createBrand
// ─────────────────────────────────────────────────────────────

describe("BrandService.createBrand", () => {
  it("fails with duplicate_name when the name already exists", async () => {
    mockRepo.findByName.mockResolvedValue(buildBrand());

    const result = await service.createBrand(
      { name: "Samsung" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_name");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("trims the name, normalizes description and applies the default status", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildBrand());

    await service.createBrand(
      { name: "  Bosch  ", description: "" },
      "org-1",
      "user-1"
    );

    const arg = mockRepo.create.mock.calls[0]?.[0];
    expect(arg.name).toBe("Bosch");
    expect(arg.description).toBeNull();
    expect(arg.status).toBe("active");
    expect(arg.created_by).toBe("user-1");
    expect(mockRepo.findByName).toHaveBeenCalledWith("org-1", "Bosch");
  });

  it("honors an explicit status", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildBrand());

    await service.createBrand(
      { name: "Bosch", status: "archived" },
      "org-1",
      "user-1"
    );
    const arg = mockRepo.create.mock.calls[0]?.[0];
    expect(arg.status).toBe("archived");
  });

  it("fails with unknown when the repository create returns null", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(null);

    const result = await service.createBrand(
      { name: "Bosch" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("succeeds and returns the created brand", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    const created = buildBrand();
    mockRepo.create.mockResolvedValue(created);

    const result = await service.createBrand(
      { name: "Bosch" },
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
// updateBrand
// ─────────────────────────────────────────────────────────────

describe("BrandService.updateBrand", () => {
  it("fails with duplicate_name when the name belongs to a different brand", async () => {
    mockRepo.findByName.mockResolvedValue(buildBrand({ id: "other" }));

    const result = await service.updateBrand(
      "brand-1",
      { name: "Samsung" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_name");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("allows updating to a name owned by the same brand", async () => {
    mockRepo.findByName.mockResolvedValue(buildBrand({ id: "brand-1" }));
    mockRepo.update.mockResolvedValue(buildBrand({ id: "brand-1" }));

    const result = await service.updateBrand(
      "brand-1",
      { name: "Samsung", description: "" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.name).toBe("Samsung");
    expect(patch.description).toBeNull();
    expect(mockRepo.update.mock.calls[0]?.[2]).toBe("user-1");
  });

  it("skips the name duplicate check when the name is empty", async () => {
    mockRepo.update.mockResolvedValue(buildBrand());

    const result = await service.updateBrand(
      "brand-1",
      { name: "", description: "x" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRepo.findByName).not.toHaveBeenCalled();
  });

  it("returns not_found when the repository update returns null", async () => {
    mockRepo.update.mockResolvedValue(null);

    const result = await service.updateBrand(
      "brand-1",
      { description: "x" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("succeeds with the built patch including status", async () => {
    mockRepo.update.mockResolvedValue(buildBrand());

    const result = await service.updateBrand(
      "brand-1",
      { status: "archived" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.status).toBe("archived");
  });
});

// ─────────────────────────────────────────────────────────────
// archiveBrand
// ─────────────────────────────────────────────────────────────

describe("BrandService.archiveBrand", () => {
  it("returns not_found when the brand does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.archiveBrand("brand-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it("fails with unknown when the soft delete fails", async () => {
    mockRepo.findById.mockResolvedValue(buildBrand());
    mockRepo.softDelete.mockResolvedValue(false);

    const result = await service.archiveBrand("brand-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("succeeds when the brand is soft deleted", async () => {
    mockRepo.findById.mockResolvedValue(buildBrand());
    mockRepo.softDelete.mockResolvedValue(true);

    const result = await service.archiveBrand("brand-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("brand-1", "user-1");
  });
});
