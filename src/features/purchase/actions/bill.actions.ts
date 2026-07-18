"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BillService } from "@/features/purchase/services/bill.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { raiseApprovalsForEntity } from "@/features/approvals/server/raise-approvals";
import {
  createBillSchema,
  updateBillSchema,
} from "@/features/purchase/schemas/bill.schemas";
import type {
  Bill,
  BillActionResult,
  BillWithItems,
} from "@/features/purchase/types/bill.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): BillActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): BillActionResult<never> {
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

/** Builds the schema-shaped candidate object from a bill FormData. */
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
  | { ok: false; result: BillActionResult<never> }
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

export async function createBillAction(
  organizationId: string,
  formData: FormData
): Promise<BillActionResult<BillWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = createBillSchema.safeParse(
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

  const service = new BillService(supabase);
  const result = await service.createBill(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/bills");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "bill.create",
      entityType: "bill",
      entityId: result.data.id,
      summary: `Created bill ${result.data.invoiceNumber}`,
    });
    // Only posted bills go through approval — a draft raises nothing until it
    // is posted (see runTransition). Best-effort; never blocks creation.
    if (result.data.status === "posted") {
      await raiseApprovalsForEntity(supabase, {
        organizationId,
        entityType: "purchase_invoice",
        entityId: result.data.id,
        requestedBy: auth.userId,
        fields: {
          total_amount: result.data.totalAmount,
          status: result.data.status,
        },
      });
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update (draft only)
// ─────────────────────────────────────────────────────────────

export async function updateBillAction(
  organizationId: string,
  billId: string,
  formData: FormData
): Promise<BillActionResult<BillWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = updateBillSchema.safeParse(
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

  const service = new BillService(supabase);
  const result = await service.updateBill(
    billId,
    parsed.data,
    organizationId,
    auth.userId,
    parseVersion(formData.get("version"))
  );

  if (result.success) {
    revalidatePath("/bills");
    revalidatePath(`/bills/${billId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "bill.update",
      entityType: "bill",
      entityId: billId,
      summary: `Updated bill ${result.data.invoiceNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────

async function runTransition(
  organizationId: string,
  billId: string,
  permission: string,
  auditAction: string,
  run: (
    service: BillService,
    userId: string
  ) => Promise<BillActionResult<Bill>>
): Promise<BillActionResult<Bill>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, permission);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new BillService(supabase);
  const result = await run(service, auth.userId);

  if (result.success) {
    revalidatePath("/bills");
    revalidatePath(`/bills/${billId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: auditAction,
      entityType: "bill",
      entityId: billId,
      summary: `${auditAction} ${result.data.invoiceNumber}`,
    });
    // A bill entering the posted state runs the approval rules. Cancel and
    // other transitions do not. Best-effort — never blocks the transition.
    if (result.data.status === "posted") {
      await raiseApprovalsForEntity(supabase, {
        organizationId,
        entityType: "purchase_invoice",
        entityId: billId,
        requestedBy: auth.userId,
        fields: {
          total_amount: result.data.totalAmount,
          status: result.data.status,
        },
      });
    }
  }
  return result;
}

export async function postBillAction(
  organizationId: string,
  billId: string
): Promise<BillActionResult<Bill>> {
  return runTransition(
    organizationId,
    billId,
    "purchase.create",
    "bill.post",
    (service, userId) =>
      service.postBill(billId, organizationId, userId)
  );
}

export async function cancelBillAction(
  organizationId: string,
  billId: string
): Promise<BillActionResult<Bill>> {
  return runTransition(
    organizationId,
    billId,
    "purchase.cancel",
    "bill.cancel",
    (service, userId) =>
      service.cancelBill(billId, organizationId, userId)
  );
}
