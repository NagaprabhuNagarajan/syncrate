import type { AppSupabaseClient } from "@/lib/supabase/types";
import { CategoryRepository } from "@/features/category/repositories/category.repository";
import type {
  Category,
  CategoryActionResult,
  CategoryError,
  CategoryErrorCode,
  CategoryListParams,
  CategoryListResult,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/features/category/types/category.types";

function ok<T>(data: T): CategoryActionResult<T> {
  return { success: true, data };
}

function fail(
  code: CategoryErrorCode,
  message: string
): CategoryActionResult<never> {
  const error: CategoryError = { code, message };
  return { success: false, error };
}

/** Normalizes an optional string: trims and converts "" → null. */
function nz(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Resolves a parent id input: undefined/"" → null. */
function resolveParentId(parentId: string | null | undefined): string | null {
  return parentId && parentId !== "" ? parentId : null;
}

export class CategoryService {
  private readonly repo: CategoryRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new CategoryRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listCategories(
    organizationId: string,
    params?: CategoryListParams
  ): Promise<CategoryListResult> {
    return this.repo.list(organizationId, params);
  }

  async listAllCategories(organizationId: string): Promise<Category[]> {
    return this.repo.listAll(organizationId);
  }

  async getCategory(id: string): Promise<CategoryActionResult<Category>> {
    const category = await this.repo.findById(id);
    if (!category) {
      return fail("not_found", "Category not found");
    }
    return ok(category);
  }

  // ── Create ─────────────────────────────────────────────────

  async createCategory(
    input: CreateCategoryInput,
    organizationId: string,
    userId: string
  ): Promise<CategoryActionResult<Category>> {
    const name = input.name.trim();
    const parentId = resolveParentId(input.parentId);

    const existing = await this.repo.findByName(organizationId, name, parentId);
    if (existing) {
      return fail(
        "duplicate_name",
        `A category named "${name}" already exists`
      );
    }

    const category = await this.repo.create({
      organization_id: organizationId,
      parent_id: parentId,
      name,
      description: nz(input.description),
      status: input.status ?? "active",
      created_by: userId,
    });

    if (!category) {
      return fail("unknown", "Failed to create category. Please try again.");
    }

    return ok(category);
  }

  // ── Update ─────────────────────────────────────────────────

  async updateCategory(
    categoryId: string,
    input: UpdateCategoryInput,
    organizationId: string,
    userId: string
  ): Promise<CategoryActionResult<Category>> {
    if (input.parentId === categoryId) {
      return fail("validation", "A category cannot be its own parent");
    }

    const existing = await this.repo.findById(categoryId);
    if (!existing) {
      return fail("not_found", "Category not found");
    }

    const parentScope =
      input.parentId !== undefined
        ? resolveParentId(input.parentId)
        : existing.parentId;

    if (input.name !== undefined) {
      const name = input.name.trim();
      const duplicate = await this.repo.findByName(
        organizationId,
        name,
        parentScope
      );
      if (duplicate && duplicate.id !== categoryId) {
        return fail(
          "duplicate_name",
          `A category named "${name}" already exists`
        );
      }
    }

    const category = await this.repo.update(
      categoryId,
      buildUpdatePatch(input),
      userId
    );

    if (!category) {
      return fail("not_found", "Category not found or update failed");
    }

    return ok(category);
  }

  // ── Archive (soft delete) ──────────────────────────────────

  /**
   * Archives a category via soft delete. Per the business rule "categories
   * cannot be deleted while products exist", we never hard delete — archiving
   * preserves historical references while removing the category from active use.
   */
  async archiveCategory(
    categoryId: string,
    userId: string
  ): Promise<CategoryActionResult<void>> {
    const existing = await this.repo.findById(categoryId);
    if (!existing) {
      return fail("not_found", "Category not found");
    }

    const archived = await this.repo.softDelete(categoryId, userId);
    if (!archived) {
      return fail("unknown", "Failed to archive category. Please try again.");
    }
    return ok(undefined);
  }
}

// ─────────────────────────────────────────────────────────────
// Patch builder — only includes provided fields, mapped to snake_case
// ─────────────────────────────────────────────────────────────

function buildUpdatePatch(
  input: UpdateCategoryInput
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    patch.name = input.name.trim();
  }
  if (input.parentId !== undefined) {
    patch.parent_id = resolveParentId(input.parentId);
  }
  if (input.description !== undefined) {
    patch.description = nz(input.description);
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }

  return patch;
}
