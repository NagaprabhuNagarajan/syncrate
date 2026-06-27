"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SalesReturnService } from "@/features/sales/services/sales-return.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import {
  createSalesReturnSchema,
  updateSalesReturnSchema,
} from "@/features/sales/schemas/sales-return.schemas";
import type {
  SalesReturn,
  SalesReturnActionResult,
  SalesReturnWithItems,
} from "@/features/sales/types/sales-return.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): SalesReturnActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): SalesReturnActionResult<never> {
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

/** Builds the schema-shaped candidate object from a sales return FormData. */
function readFormCandidate(formData: FormData): Record<string, unknown> {
  return {
    returnNumber: formData.get("returnNumber") || undefined,
    invoiceId: formData.get("invoiceId") || undefined,
    customerId: formData.get("customerId") || undefined,
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
  | { ok: false; result: SalesReturnActionResult<never> }
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

export async function createSalesReturnAction(
  organizationId: string,
  formData: FormData
): Promise<SalesReturnActionResult<SalesReturnWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = createSalesReturnSchema.safeParse(
    readFormCandidate(formData)
  );
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "sales.create");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SalesReturnService(supabase);
  const result = await service.createSalesReturn(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/sales/returns");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "sales_return.create",
      entityType: "sales_return",
      entityId: result.data.id,
      summary: `Created sales return ${result.data.returnNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update (draft only)
// ─────────────────────────────────────────────────────────────

export async function updateSalesReturnAction(
  organizationId: string,
  salesReturnId: string,
  formData: FormData
): Promise<SalesReturnActionResult<SalesReturnWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = updateSalesReturnSchema.safeParse(
    readFormCandidate(formData)
  );
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "sales.create");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SalesReturnService(supabase);
  const result = await service.updateSalesReturn(
    salesReturnId,
    parsed.data,
    organizationId,
    auth.userId,
    parseVersion(formData.get("version"))
  );

  if (result.success) {
    revalidatePath("/sales/returns");
    revalidatePath(`/sales/returns/${salesReturnId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "sales_return.update",
      entityType: "sales_return",
      entityId: salesReturnId,
      summary: `Updated sales return ${result.data.returnNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────

async function runTransition(
  organizationId: string,
  salesReturnId: string,
  permission: string,
  auditAction: string,
  run: (
    service: SalesReturnService,
    userId: string
  ) => Promise<SalesReturnActionResult<SalesReturn>>
): Promise<SalesReturnActionResult<SalesReturn>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, permission);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SalesReturnService(supabase);
  const result = await run(service, auth.userId);

  if (result.success) {
    revalidatePath("/sales/returns");
    revalidatePath(`/sales/returns/${salesReturnId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: auditAction,
      entityType: "sales_return",
      entityId: salesReturnId,
      summary: `${auditAction} ${result.data.returnNumber}`,
    });
  }
  return result;
}

export async function completeSalesReturnAction(
  organizationId: string,
  salesReturnId: string
): Promise<SalesReturnActionResult<SalesReturn>> {
  return runTransition(
    organizationId,
    salesReturnId,
    "sales.receive",
    "sales_return.complete",
    (service, userId) =>
      service.completeSalesReturn(salesReturnId, organizationId, userId)
  );
}

export async function cancelSalesReturnAction(
  organizationId: string,
  salesReturnId: string
): Promise<SalesReturnActionResult<SalesReturn>> {
  return runTransition(
    organizationId,
    salesReturnId,
    "sales.cancel",
    "sales_return.cancel",
    (service, userId) =>
      service.cancelSalesReturn(salesReturnId, organizationId, userId)
  );
}
