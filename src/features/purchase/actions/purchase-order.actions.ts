"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PurchaseOrderService } from "@/features/purchase/services/purchase-order.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
} from "@/features/purchase/schemas/purchase-order.schemas";
import type {
  PurchaseOrder,
  PurchaseOrderActionResult,
  PurchaseOrderWithItems,
} from "@/features/purchase/types/purchase-order.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): PurchaseOrderActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): PurchaseOrderActionResult<never> {
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

/** Builds the schema-shaped candidate object from a purchase order FormData. */
function readFormCandidate(formData: FormData): Record<string, unknown> {
  return {
    supplierId: formData.get("supplierId") || undefined,
    warehouseId: formData.get("warehouseId") || undefined,
    orderDate: formData.get("orderDate") || undefined,
    expectedDeliveryDate: formData.get("expectedDeliveryDate") || undefined,
    currency: formData.get("currency") || undefined,
    notes: formData.get("notes") || undefined,
    terms: formData.get("terms") || undefined,
    version: formData.get("version") || undefined,
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
  | { ok: false; result: PurchaseOrderActionResult<never> }
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

export async function createPurchaseOrderAction(
  organizationId: string,
  formData: FormData
): Promise<PurchaseOrderActionResult<PurchaseOrderWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = createPurchaseOrderSchema.safeParse(
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

  const service = new PurchaseOrderService(supabase);
  const result = await service.createPurchaseOrder(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/purchases");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "purchase_order.create",
      entityType: "purchase_order",
      entityId: result.data.id,
      summary: `Created purchase order ${result.data.poNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update (draft only)
// ─────────────────────────────────────────────────────────────

export async function updatePurchaseOrderAction(
  organizationId: string,
  purchaseOrderId: string,
  formData: FormData
): Promise<PurchaseOrderActionResult<PurchaseOrderWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = updatePurchaseOrderSchema.safeParse(
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

  const service = new PurchaseOrderService(supabase);
  const result = await service.updatePurchaseOrder(
    purchaseOrderId,
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${purchaseOrderId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "purchase_order.update",
      entityType: "purchase_order",
      entityId: purchaseOrderId,
      summary: `Updated purchase order ${result.data.poNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────

async function runTransition(
  organizationId: string,
  purchaseOrderId: string,
  permission: string,
  auditAction: string,
  run: (
    service: PurchaseOrderService,
    userId: string
  ) => Promise<PurchaseOrderActionResult<PurchaseOrder>>
): Promise<PurchaseOrderActionResult<PurchaseOrder>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, permission);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new PurchaseOrderService(supabase);
  const result = await run(service, auth.userId);

  if (result.success) {
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${purchaseOrderId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: auditAction,
      entityType: "purchase_order",
      entityId: purchaseOrderId,
      summary: `${auditAction} ${result.data.poNumber}`,
    });
  }
  return result;
}

export async function submitPurchaseOrderAction(
  organizationId: string,
  purchaseOrderId: string
): Promise<PurchaseOrderActionResult<PurchaseOrder>> {
  return runTransition(
    organizationId,
    purchaseOrderId,
    "purchase.create",
    "purchase_order.submit",
    (service, userId) =>
      service.submitPurchaseOrder(purchaseOrderId, organizationId, userId)
  );
}

export async function approvePurchaseOrderAction(
  organizationId: string,
  purchaseOrderId: string
): Promise<PurchaseOrderActionResult<PurchaseOrder>> {
  return runTransition(
    organizationId,
    purchaseOrderId,
    "purchase.approve",
    "purchase_order.approve",
    (service, userId) =>
      service.approvePurchaseOrder(purchaseOrderId, organizationId, userId)
  );
}

export async function cancelPurchaseOrderAction(
  organizationId: string,
  purchaseOrderId: string
): Promise<PurchaseOrderActionResult<PurchaseOrder>> {
  return runTransition(
    organizationId,
    purchaseOrderId,
    "purchase.cancel",
    "purchase_order.cancel",
    (service, userId) =>
      service.cancelPurchaseOrder(purchaseOrderId, organizationId, userId)
  );
}
