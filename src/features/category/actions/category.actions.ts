"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CategoryService } from "@/features/category/services/category.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/features/category/schemas/category.schemas";
import type {
  Category,
  CategoryActionResult,
} from "@/features/category/types/category.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): CategoryActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): CategoryActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

/**
 * Resolves the caller, verifies org membership, and checks a permission.
 * Returns the authenticated userId on success.
 */
async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  | { ok: true; userId: string }
  | { ok: false; result: CategoryActionResult<never> }
> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { ok: false, result: forbidden("Not authenticated") };
  }

  const orgService = new OrganizationService(supabase);
  const context = await orgService.getOrganizationContext(
    organizationId,
    authData.user.id
  );
  if (!context) {
    return {
      ok: false,
      result: forbidden("You do not have access to this organization"),
    };
  }
  if (!context.permissions.includes(permission)) {
    return {
      ok: false,
      result: forbidden("You do not have permission to perform this action"),
    };
  }

  return { ok: true, userId: authData.user.id };
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export async function createCategoryAction(
  organizationId: string,
  formData: FormData
): Promise<CategoryActionResult<Category>> {
  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
    parentId: formData.get("parentId") || undefined,
    description: formData.get("description") || undefined,
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "product.create");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new CategoryService(supabase);
  const result = await service.createCategory(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/products/categories");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "category.create",
      entityType: "category",
      entityId: result.data.id,
      summary: `Created category "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateCategoryAction(
  organizationId: string,
  categoryId: string,
  formData: FormData
): Promise<CategoryActionResult<Category>> {
  const parsed = updateCategorySchema.safeParse({
    name: formData.get("name") || undefined,
    parentId: formData.has("parentId")
      ? formData.get("parentId") || ""
      : undefined,
    description: formData.get("description") || undefined,
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "product.update");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new CategoryService(supabase);
  const result = await service.updateCategory(
    categoryId,
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/products/categories");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "category.update",
      entityType: "category",
      entityId: categoryId,
      summary: `Updated category "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Archive
// ─────────────────────────────────────────────────────────────

export async function archiveCategoryAction(
  organizationId: string,
  categoryId: string
): Promise<CategoryActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "product.update");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new CategoryService(supabase);
  const result = await service.archiveCategory(categoryId, auth.userId);

  if (result.success) {
    revalidatePath("/products/categories");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "category.archive",
      entityType: "category",
      entityId: categoryId,
      summary: "Archived category",
    });
  }
  return result;
}
