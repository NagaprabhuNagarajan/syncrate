import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Category } from "@/features/category/types/category.types";
import { CategoryService } from "./category.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    listAll: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/features/category/repositories/category.repository", () => ({
  CategoryRepository: vi.fn(() => mockRepo),
}));

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    organizationId: "org-1",
    parentId: null,
    name: "Electronics",
    description: null,
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

let service: CategoryService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new CategoryService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("CategoryService.listCategories", () => {
  it("delegates to the repository", async () => {
    const listResult = {
      items: [buildCategory()],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockRepo.list.mockResolvedValue(listResult);

    const result = await service.listCategories("org-1", { search: "elec" });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { search: "elec" });
  });
});

describe("CategoryService.listAllCategories", () => {
  it("delegates to the repository", async () => {
    const all = [buildCategory()];
    mockRepo.listAll.mockResolvedValue(all);

    const result = await service.listAllCategories("org-1");
    expect(result).toBe(all);
    expect(mockRepo.listAll).toHaveBeenCalledWith("org-1");
  });
});

describe("CategoryService.getCategory", () => {
  it("returns the category when found", async () => {
    mockRepo.findById.mockResolvedValue(buildCategory());
    const result = await service.getCategory("cat-1");
    expect(result.success).toBe(true);
  });

  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.getCategory("missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// createCategory
// ─────────────────────────────────────────────────────────────

describe("CategoryService.createCategory", () => {
  it("creates a root category when no parent is provided", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildCategory());

    const result = await service.createCategory(
      { name: "  Electronics  ", description: "" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const arg = mockRepo.create.mock.calls[0]?.[0];
    expect(arg.name).toBe("Electronics");
    expect(arg.parent_id).toBeNull();
    expect(arg.description).toBeNull();
    expect(arg.status).toBe("active");
    expect(arg.created_by).toBe("user-1");
    expect(mockRepo.findByName).toHaveBeenCalledWith(
      "org-1",
      "Electronics",
      null
    );
  });

  it("resolves an empty-string parentId to null", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildCategory());

    await service.createCategory(
      { name: "Phones", parentId: "" },
      "org-1",
      "user-1"
    );
    const arg = mockRepo.create.mock.calls[0]?.[0];
    expect(arg.parent_id).toBeNull();
  });

  it("passes a provided parentId through", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildCategory({ parentId: "cat-parent" }));

    await service.createCategory(
      { name: "Phones", parentId: "cat-parent" },
      "org-1",
      "user-1"
    );
    const arg = mockRepo.create.mock.calls[0]?.[0];
    expect(arg.parent_id).toBe("cat-parent");
    expect(mockRepo.findByName).toHaveBeenCalledWith(
      "org-1",
      "Phones",
      "cat-parent"
    );
  });

  it("fails with duplicate_name when a sibling with the same name exists", async () => {
    mockRepo.findByName.mockResolvedValue(buildCategory());

    const result = await service.createCategory(
      { name: "Electronics" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_name");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("fails with unknown when the repository create returns null", async () => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(null);

    const result = await service.createCategory(
      { name: "Electronics" },
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
// updateCategory
// ─────────────────────────────────────────────────────────────

describe("CategoryService.updateCategory", () => {
  it("fails with validation when a category is set as its own parent", async () => {
    const result = await service.updateCategory(
      "cat-1",
      { parentId: "cat-1" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it("fails with not_found when the category does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.updateCategory(
      "cat-1",
      { name: "Renamed" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("fails with duplicate_name when another sibling has the new name", async () => {
    mockRepo.findById.mockResolvedValue(buildCategory({ id: "cat-1" }));
    mockRepo.findByName.mockResolvedValue(buildCategory({ id: "other" }));

    const result = await service.updateCategory(
      "cat-1",
      { name: "Taken" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("duplicate_name");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("allows renaming to a name owned by the same category", async () => {
    mockRepo.findById.mockResolvedValue(buildCategory({ id: "cat-1" }));
    mockRepo.findByName.mockResolvedValue(buildCategory({ id: "cat-1" }));
    mockRepo.update.mockResolvedValue(buildCategory({ name: "Electronics" }));

    const result = await service.updateCategory(
      "cat-1",
      { name: "Electronics" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
  });

  it("uses the existing parent scope for the duplicate check when parentId is not provided", async () => {
    mockRepo.findById.mockResolvedValue(
      buildCategory({ id: "cat-1", parentId: "cat-parent" })
    );
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.update.mockResolvedValue(buildCategory());

    await service.updateCategory("cat-1", { name: "Renamed" }, "org-1", "user-1");
    expect(mockRepo.findByName).toHaveBeenCalledWith(
      "org-1",
      "Renamed",
      "cat-parent"
    );
  });

  it("builds a snake_case patch with resolved parent and nz description", async () => {
    mockRepo.findById.mockResolvedValue(buildCategory({ id: "cat-1" }));
    mockRepo.update.mockResolvedValue(buildCategory());

    const result = await service.updateCategory(
      "cat-1",
      { parentId: "", description: "  ", status: "archived" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(true);
    const patch = mockRepo.update.mock.calls[0]?.[1];
    expect(patch.parent_id).toBeNull();
    expect(patch.description).toBeNull();
    expect(patch.status).toBe("archived");
    expect(mockRepo.update.mock.calls[0]?.[2]).toBe("user-1");
  });

  it("returns not_found when the repository update returns null", async () => {
    mockRepo.findById.mockResolvedValue(buildCategory({ id: "cat-1" }));
    mockRepo.update.mockResolvedValue(null);

    const result = await service.updateCategory(
      "cat-1",
      { description: "x" },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// archiveCategory
// ─────────────────────────────────────────────────────────────

describe("CategoryService.archiveCategory", () => {
  it("returns not_found when the category does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.archiveCategory("cat-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it("fails with unknown when the soft delete fails", async () => {
    mockRepo.findById.mockResolvedValue(buildCategory());
    mockRepo.softDelete.mockResolvedValue(false);

    const result = await service.archiveCategory("cat-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("succeeds when the category is soft deleted", async () => {
    mockRepo.findById.mockResolvedValue(buildCategory());
    mockRepo.softDelete.mockResolvedValue(true);

    const result = await service.archiveCategory("cat-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("cat-1", "user-1");
  });
});
