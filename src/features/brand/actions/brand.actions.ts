"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BrandService } from "@/features/brand/services/brand.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createBrandSchema,
  updateBrandSchema,
} from "@/features/brand/schemas/brand.schemas";
import type {
  Brand,
  BrandActionResult,
} from "@/features/brand/types/brand.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): BrandActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): BrandActionResult<never> {
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
  { ok: true; userId: string } | { ok: false; result: BrandActionResult<never> }
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

export async function createBrandAction(
  organizationId: string,
  formData: FormData
): Promise<BrandActionResult<Brand>> {
  const parsed = createBrandSchema.safeParse({
    name: formData.get("name"),
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

  const service = new BrandService(supabase);
  const result = await service.createBrand(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/products/brands");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "brand.create",
      entityType: "brand",
      entityId: result.data.id,
      summary: `Created brand "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateBrandAction(
  organizationId: string,
  brandId: string,
  formData: FormData
): Promise<BrandActionResult<Brand>> {
  const parsed = updateBrandSchema.safeParse({
    name: formData.get("name") || undefined,
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

  const service = new BrandService(supabase);
  const result = await service.updateBrand(
    brandId,
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/products/brands");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "brand.update",
      entityType: "brand",
      entityId: brandId,
      summary: `Updated brand "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Archive
// ─────────────────────────────────────────────────────────────

export async function archiveBrandAction(
  organizationId: string,
  brandId: string
): Promise<BrandActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "product.update");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new BrandService(supabase);
  const result = await service.archiveBrand(brandId, auth.userId);

  if (result.success) {
    revalidatePath("/products/brands");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "brand.archive",
      entityType: "brand",
      entityId: brandId,
      summary: "Archived brand",
    });
  }
  return result;
}
