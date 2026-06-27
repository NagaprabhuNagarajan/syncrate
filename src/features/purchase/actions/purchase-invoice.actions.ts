"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PurchaseInvoiceService } from "@/features/purchase/services/purchase-invoice.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createPurchaseInvoiceSchema,
  updatePurchaseInvoiceSchema,
} from "@/features/purchase/schemas/purchase-invoice.schemas";
import type {
  PurchaseInvoice,
  PurchaseInvoiceActionResult,
  PurchaseInvoiceWithItems,
} from "@/features/purchase/types/purchase-invoice.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): PurchaseInvoiceActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): PurchaseInvoiceActionResult<never> {
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

/** Builds the schema-shaped candidate object from a purchase invoice FormData. */
function readFormCandidate(formData: FormData): Record<string, unknown> {
  return {
    supplierId: formData.get("supplierId") || undefined,
    invoiceNumber: formData.get("invoiceNumber") || undefined,
    supplierInvoiceNumber: formData.get("supplierInvoiceNumber") || undefined,
    purchaseOrderId: formData.get("purchaseOrderId") || undefined,
    invoiceDate: formData.get("invoiceDate") || undefined,
    dueDate: formData.get("dueDate") || undefined,
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
  | { ok: false; result: PurchaseInvoiceActionResult<never> }
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

export async function createPurchaseInvoiceAction(
  organizationId: string,
  formData: FormData
): Promise<PurchaseInvoiceActionResult<PurchaseInvoiceWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = createPurchaseInvoiceSchema.safeParse(
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

  const service = new PurchaseInvoiceService(supabase);
  const result = await service.createPurchaseInvoice(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/purchases/invoices");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "purchase_invoice.create",
      entityType: "purchase_invoice",
      entityId: result.data.id,
      summary: `Created purchase invoice ${result.data.invoiceNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update (draft only)
// ─────────────────────────────────────────────────────────────

export async function updatePurchaseInvoiceAction(
  organizationId: string,
  purchaseInvoiceId: string,
  formData: FormData
): Promise<PurchaseInvoiceActionResult<PurchaseInvoiceWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = updatePurchaseInvoiceSchema.safeParse(
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

  const service = new PurchaseInvoiceService(supabase);
  const result = await service.updatePurchaseInvoice(
    purchaseInvoiceId,
    parsed.data,
    organizationId,
    auth.userId,
    parseVersion(formData.get("version"))
  );

  if (result.success) {
    revalidatePath("/purchases/invoices");
    revalidatePath(`/purchases/invoices/${purchaseInvoiceId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "purchase_invoice.update",
      entityType: "purchase_invoice",
      entityId: purchaseInvoiceId,
      summary: `Updated purchase invoice ${result.data.invoiceNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────

async function runTransition(
  organizationId: string,
  purchaseInvoiceId: string,
  permission: string,
  auditAction: string,
  run: (
    service: PurchaseInvoiceService,
    userId: string
  ) => Promise<PurchaseInvoiceActionResult<PurchaseInvoice>>
): Promise<PurchaseInvoiceActionResult<PurchaseInvoice>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, permission);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new PurchaseInvoiceService(supabase);
  const result = await run(service, auth.userId);

  if (result.success) {
    revalidatePath("/purchases/invoices");
    revalidatePath(`/purchases/invoices/${purchaseInvoiceId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: auditAction,
      entityType: "purchase_invoice",
      entityId: purchaseInvoiceId,
      summary: `${auditAction} ${result.data.invoiceNumber}`,
    });
  }
  return result;
}

export async function postPurchaseInvoiceAction(
  organizationId: string,
  purchaseInvoiceId: string
): Promise<PurchaseInvoiceActionResult<PurchaseInvoice>> {
  return runTransition(
    organizationId,
    purchaseInvoiceId,
    "purchase.create",
    "purchase_invoice.post",
    (service, userId) =>
      service.postPurchaseInvoice(purchaseInvoiceId, organizationId, userId)
  );
}

export async function cancelPurchaseInvoiceAction(
  organizationId: string,
  purchaseInvoiceId: string
): Promise<PurchaseInvoiceActionResult<PurchaseInvoice>> {
  return runTransition(
    organizationId,
    purchaseInvoiceId,
    "purchase.cancel",
    "purchase_invoice.cancel",
    (service, userId) =>
      service.cancelPurchaseInvoice(purchaseInvoiceId, organizationId, userId)
  );
}
