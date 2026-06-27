"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PurchaseReturnService } from "@/features/purchase/services/purchase-return.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createPurchaseReturnSchema,
  updatePurchaseReturnSchema,
} from "@/features/purchase/schemas/purchase-return.schemas";
import type {
  PurchaseReturn,
  PurchaseReturnActionResult,
  PurchaseReturnWithItems,
} from "@/features/purchase/types/purchase-return.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): PurchaseReturnActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): PurchaseReturnActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

/** Safely parses the JSON-encoded `items` form field. */
function parseItems(value: FormDataEntryValue | null): unknown[] | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Parses the optimistic-lock `version` from FormData. Defaults to 1 when the
 * field is missing or malformed so the update is still attempted against the
 * initial version rather than silently skipping the lock.
 */
function parseVersion(value: FormDataEntryValue | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Builds the schema-shaped candidate object from a purchase return FormData. */
function readFormCandidate(formData: FormData): Record<string, unknown> {
  return {
    returnNumber: formData.get("returnNumber") || undefined,
    purchaseOrderId: formData.get("purchaseOrderId") || undefined,
    supplierId: formData.get("supplierId") || undefined,
    warehouseId: formData.get("warehouseId") || undefined,
    returnDate: formData.get("returnDate") || undefined,
    reason: formData.get("reason") || undefined,
    notes: formData.get("notes") || undefined,
    items: parseItems(formData.get("items")) ?? [],
  };
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
  | { ok: false; result: PurchaseReturnActionResult<never> }
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

export async function createPurchaseReturnAction(
  organizationId: string,
  formData: FormData
): Promise<PurchaseReturnActionResult<PurchaseReturnWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = createPurchaseReturnSchema.safeParse(
    readFormCandidate(formData)
  );
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "purchase.create");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new PurchaseReturnService(supabase);
  const result = await service.createPurchaseReturn(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/purchases/returns");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "purchase_return.create",
      entityType: "purchase_return",
      entityId: result.data.id,
      summary: `Created purchase return ${result.data.returnNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update (draft only)
// ─────────────────────────────────────────────────────────────

export async function updatePurchaseReturnAction(
  organizationId: string,
  purchaseReturnId: string,
  formData: FormData
): Promise<PurchaseReturnActionResult<PurchaseReturnWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = updatePurchaseReturnSchema.safeParse(
    readFormCandidate(formData)
  );
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "purchase.create");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new PurchaseReturnService(supabase);
  const result = await service.updatePurchaseReturn(
    purchaseReturnId,
    parsed.data,
    organizationId,
    auth.userId,
    parseVersion(formData.get("version"))
  );

  if (result.success) {
    revalidatePath("/purchases/returns");
    revalidatePath(`/purchases/returns/${purchaseReturnId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "purchase_return.update",
      entityType: "purchase_return",
      entityId: purchaseReturnId,
      summary: `Updated purchase return ${result.data.returnNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────

async function runTransition(
  organizationId: string,
  purchaseReturnId: string,
  permission: string,
  auditAction: string,
  run: (
    service: PurchaseReturnService,
    userId: string
  ) => Promise<PurchaseReturnActionResult<PurchaseReturn>>
): Promise<PurchaseReturnActionResult<PurchaseReturn>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, permission);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new PurchaseReturnService(supabase);
  const result = await run(service, auth.userId);

  if (result.success) {
    revalidatePath("/purchases/returns");
    revalidatePath(`/purchases/returns/${purchaseReturnId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: auditAction,
      entityType: "purchase_return",
      entityId: purchaseReturnId,
      summary: `${auditAction} ${result.data.returnNumber}`,
    });
  }
  return result;
}

export async function completePurchaseReturnAction(
  organizationId: string,
  purchaseReturnId: string
): Promise<PurchaseReturnActionResult<PurchaseReturn>> {
  return runTransition(
    organizationId,
    purchaseReturnId,
    "purchase.receive",
    "purchase_return.complete",
    (service, userId) =>
      service.completePurchaseReturn(purchaseReturnId, organizationId, userId)
  );
}

export async function cancelPurchaseReturnAction(
  organizationId: string,
  purchaseReturnId: string
): Promise<PurchaseReturnActionResult<PurchaseReturn>> {
  return runTransition(
    organizationId,
    purchaseReturnId,
    "purchase.cancel",
    "purchase_return.cancel",
    (service, userId) =>
      service.cancelPurchaseReturn(purchaseReturnId, organizationId, userId)
  );
}
