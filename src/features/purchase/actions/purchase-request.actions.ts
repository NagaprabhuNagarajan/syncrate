"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PurchaseRequestService } from "@/features/purchase/services/purchase-request.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createPurchaseRequestSchema,
  updatePurchaseRequestSchema,
  rejectPurchaseRequestSchema,
} from "@/features/purchase/schemas/purchase-request.schemas";
import type {
  PurchaseOrderWithItems,
} from "@/features/purchase/types/purchase-order.types";
import type {
  PurchaseRequest,
  PurchaseRequestActionResult,
  PurchaseRequestWithItems,
} from "@/features/purchase/types/purchase-request.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): PurchaseRequestActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): PurchaseRequestActionResult<never> {
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

/** Builds the schema-shaped candidate object from a purchase request FormData. */
function readFormCandidate(formData: FormData): Record<string, unknown> {
  return {
    requestNumber: formData.get("requestNumber") || undefined,
    warehouseId: formData.get("warehouseId") || undefined,
    requiredDate: formData.get("requiredDate") || undefined,
    notes: formData.get("notes") || undefined,
    items: parseItems(formData.get("items")) ?? [],
  };
}

/** Parses the hidden optimistic-locking `version` field; null when invalid. */
function parseVersion(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
  | { ok: false; result: PurchaseRequestActionResult<never> }
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

export async function createPurchaseRequestAction(
  organizationId: string,
  formData: FormData
): Promise<PurchaseRequestActionResult<PurchaseRequestWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = createPurchaseRequestSchema.safeParse(
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

  const service = new PurchaseRequestService(supabase);
  const result = await service.createPurchaseRequest(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/purchases/requests");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "purchase_request.create",
      entityType: "purchase_request",
      entityId: result.data.id,
      summary: `Created purchase request ${result.data.requestNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update (draft only, optimistic locking)
// ─────────────────────────────────────────────────────────────

export async function updatePurchaseRequestAction(
  organizationId: string,
  purchaseRequestId: string,
  formData: FormData
): Promise<PurchaseRequestActionResult<PurchaseRequestWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const expectedVersion = parseVersion(formData.get("version"));
  if (expectedVersion === null) {
    return invalid("Missing or invalid version for optimistic locking");
  }

  const parsed = updatePurchaseRequestSchema.safeParse(
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

  const service = new PurchaseRequestService(supabase);
  const result = await service.updatePurchaseRequest(
    purchaseRequestId,
    parsed.data,
    organizationId,
    auth.userId,
    expectedVersion
  );

  if (result.success) {
    revalidatePath("/purchases/requests");
    revalidatePath(`/purchases/requests/${purchaseRequestId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "purchase_request.update",
      entityType: "purchase_request",
      entityId: purchaseRequestId,
      summary: `Updated purchase request ${result.data.requestNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────

async function runTransition(
  organizationId: string,
  purchaseRequestId: string,
  permission: string,
  auditAction: string,
  run: (
    service: PurchaseRequestService,
    userId: string
  ) => Promise<PurchaseRequestActionResult<PurchaseRequest>>
): Promise<PurchaseRequestActionResult<PurchaseRequest>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, permission);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new PurchaseRequestService(supabase);
  const result = await run(service, auth.userId);

  if (result.success) {
    revalidatePath("/purchases/requests");
    revalidatePath(`/purchases/requests/${purchaseRequestId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: auditAction,
      entityType: "purchase_request",
      entityId: purchaseRequestId,
      summary: `${auditAction} ${result.data.requestNumber}`,
    });
  }
  return result;
}

export async function submitPurchaseRequestAction(
  organizationId: string,
  purchaseRequestId: string
): Promise<PurchaseRequestActionResult<PurchaseRequest>> {
  return runTransition(
    organizationId,
    purchaseRequestId,
    "purchase.create",
    "purchase_request.submit",
    (service, userId) =>
      service.submitPurchaseRequest(purchaseRequestId, organizationId, userId)
  );
}

export async function approvePurchaseRequestAction(
  organizationId: string,
  purchaseRequestId: string
): Promise<PurchaseRequestActionResult<PurchaseRequest>> {
  return runTransition(
    organizationId,
    purchaseRequestId,
    "purchase.approve",
    "purchase_request.approve",
    (service, userId) =>
      service.approvePurchaseRequest(purchaseRequestId, organizationId, userId)
  );
}

export async function rejectPurchaseRequestAction(
  organizationId: string,
  purchaseRequestId: string,
  reason: string
): Promise<PurchaseRequestActionResult<PurchaseRequest>> {
  const parsed = rejectPurchaseRequestSchema.safeParse({ reason });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "A reason is required");
  }
  return runTransition(
    organizationId,
    purchaseRequestId,
    "purchase.approve",
    "purchase_request.reject",
    (service, userId) =>
      service.rejectPurchaseRequest(
        purchaseRequestId,
        organizationId,
        userId,
        parsed.data.reason
      )
  );
}

export async function cancelPurchaseRequestAction(
  organizationId: string,
  purchaseRequestId: string
): Promise<PurchaseRequestActionResult<PurchaseRequest>> {
  return runTransition(
    organizationId,
    purchaseRequestId,
    "purchase.cancel",
    "purchase_request.cancel",
    (service, userId) =>
      service.cancelPurchaseRequest(purchaseRequestId, organizationId, userId)
  );
}

// ─────────────────────────────────────────────────────────────
// Convert to purchase order
// ─────────────────────────────────────────────────────────────

export async function convertPurchaseRequestAction(
  organizationId: string,
  purchaseRequestId: string,
  supplierId: string
): Promise<PurchaseRequestActionResult<PurchaseOrderWithItems>> {
  if (typeof supplierId !== "string" || supplierId.trim() === "") {
    return invalid("A supplier is required to create the purchase order");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "purchase.create");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new PurchaseRequestService(supabase);
  const result = await service.convertToPurchaseOrder(
    purchaseRequestId,
    supplierId.trim(),
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/purchases/requests");
    revalidatePath(`/purchases/requests/${purchaseRequestId}`);
    revalidatePath("/purchases");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "purchase_request.convert",
      entityType: "purchase_request",
      entityId: purchaseRequestId,
      summary: `Converted purchase request to purchase order ${result.data.poNumber}`,
    });
  }
  return result;
}
