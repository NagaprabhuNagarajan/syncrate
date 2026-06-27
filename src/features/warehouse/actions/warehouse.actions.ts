"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { WarehouseService } from "@/features/warehouse/services/warehouse.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
} from "@/features/warehouse/schemas/warehouse.schemas";
import type {
  Warehouse,
  WarehouseActionResult,
} from "@/features/warehouse/types/warehouse.types";

// ─────────────────────────────────────────────────────────────
// Permissions — there is no warehouse-specific permission, so warehouse
// management reuses the inventory permission set.
// ─────────────────────────────────────────────────────────────

const MANAGE_PERMISSION = "inventory.adjust";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): WarehouseActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): WarehouseActionResult<never> {
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
  | { ok: false; result: WarehouseActionResult<never> }
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

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export async function createWarehouseAction(
  organizationId: string,
  formData: FormData
): Promise<WarehouseActionResult<Warehouse>> {
  const parsed = createWarehouseSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    branchId: formData.get("branchId") || undefined,
    addressLine1: formData.get("addressLine1") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    pincode: formData.get("pincode") || undefined,
    capacity: formData.get("capacity") || undefined,
    isDefault: parseCheckbox(formData.get("isDefault")),
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, MANAGE_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new WarehouseService(supabase);
  const result = await service.createWarehouse(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/inventory/warehouses");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "warehouse.create",
      entityType: "warehouse",
      entityId: result.data.id,
      summary: `Created warehouse "${result.data.name}" (${result.data.code})`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateWarehouseAction(
  organizationId: string,
  warehouseId: string,
  formData: FormData
): Promise<WarehouseActionResult<Warehouse>> {
  const parsed = updateWarehouseSchema.safeParse({
    code: formData.get("code") || undefined,
    name: formData.get("name") || undefined,
    branchId: formData.get("branchId") || undefined,
    addressLine1: formData.get("addressLine1") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    pincode: formData.get("pincode") || undefined,
    capacity: formData.get("capacity") || undefined,
    isDefault: parseCheckbox(formData.get("isDefault")),
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, MANAGE_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new WarehouseService(supabase);
  const result = await service.updateWarehouse(
    warehouseId,
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/inventory/warehouses");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "warehouse.update",
      entityType: "warehouse",
      entityId: warehouseId,
      summary: `Updated warehouse "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Archive
// ─────────────────────────────────────────────────────────────

export async function archiveWarehouseAction(
  organizationId: string,
  warehouseId: string
): Promise<WarehouseActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, MANAGE_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new WarehouseService(supabase);
  const result = await service.archiveWarehouse(warehouseId, auth.userId);

  if (result.success) {
    revalidatePath("/inventory/warehouses");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "warehouse.archive",
      entityType: "warehouse",
      entityId: warehouseId,
      summary: "Archived warehouse",
    });
  }
  return result;
}
