"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UnitService } from "@/features/unit/services/unit.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createUnitSchema,
  updateUnitSchema,
} from "@/features/unit/schemas/unit.schemas";
import type {
  Unit,
  UnitActionResult,
} from "@/features/unit/types/unit.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): UnitActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): UnitActionResult<never> {
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
  { ok: true; userId: string } | { ok: false; result: UnitActionResult<never> }
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

export async function createUnitAction(
  organizationId: string,
  formData: FormData
): Promise<UnitActionResult<Unit>> {
  const parsed = createUnitSchema.safeParse({
    name: formData.get("name"),
    symbol: formData.get("symbol"),
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

  const service = new UnitService(supabase);
  const result = await service.createUnit(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/products/units");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "unit.create",
      entityType: "unit",
      entityId: result.data.id,
      summary: `Created unit "${result.data.name}" (${result.data.symbol})`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateUnitAction(
  organizationId: string,
  unitId: string,
  formData: FormData
): Promise<UnitActionResult<Unit>> {
  const parsed = updateUnitSchema.safeParse({
    name: formData.get("name") || undefined,
    symbol: formData.get("symbol") || undefined,
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

  const service = new UnitService(supabase);
  const result = await service.updateUnit(
    unitId,
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/products/units");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "unit.update",
      entityType: "unit",
      entityId: unitId,
      summary: `Updated unit "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Archive
// ─────────────────────────────────────────────────────────────

export async function archiveUnitAction(
  organizationId: string,
  unitId: string
): Promise<UnitActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "product.update");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new UnitService(supabase);
  const result = await service.archiveUnit(unitId, auth.userId);

  if (result.success) {
    revalidatePath("/products/units");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "unit.archive",
      entityType: "unit",
      entityId: unitId,
      summary: "Archived unit",
    });
  }
  return result;
}
