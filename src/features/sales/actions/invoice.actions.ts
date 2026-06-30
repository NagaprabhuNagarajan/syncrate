"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { DomainEventService } from "@/features/events/services/domain-event.service";
import { DOMAIN_EVENTS } from "@/features/events/domain-events";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
} from "@/features/sales/schemas/invoice.schemas";
import type {
  Invoice,
  InvoiceActionResult,
  InvoiceWithItems,
} from "@/features/sales/types/invoice.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): InvoiceActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): InvoiceActionResult<never> {
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

/** Builds the schema-shaped candidate object from an invoice FormData. */
function readFormCandidate(formData: FormData): Record<string, unknown> {
  const isInterstateRaw = formData.get("isInterstate");
  return {
    customerId: formData.get("customerId") || undefined,
    salesOrderId: formData.get("salesOrderId") || undefined,
    quotationId: formData.get("quotationId") || undefined,
    branchId: formData.get("branchId") || undefined,
    invoiceDate: formData.get("invoiceDate") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    paymentTermsDays: formData.get("paymentTermsDays") || undefined,
    supplyState: formData.get("supplyState") || undefined,
    isInterstate:
      isInterstateRaw === "true"
        ? true
        : isInterstateRaw === "false"
          ? false
          : undefined,
    invoiceType: formData.get("invoiceType") || undefined,
    referenceNumber: formData.get("referenceNumber") || undefined,
    notes: formData.get("notes") || undefined,
    terms: formData.get("terms") || undefined,
    items: parseItems(formData.get("items")) ?? [],
  };
}

/**
 * Resolves the caller, verifies org membership, and checks a permission.
 * Returns the authenticated userId and the org billing state on success.
 */
async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  | { ok: true; userId: string; orgState: string | null }
  | { ok: false; result: InvoiceActionResult<never> }
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

  return {
    ok: true,
    userId: authData.user.id,
    orgState: context.organization.state,
  };
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export async function createInvoiceAction(
  organizationId: string,
  formData: FormData
): Promise<InvoiceActionResult<InvoiceWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = createInvoiceSchema.safeParse(readFormCandidate(formData));
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "invoice.create");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new InvoiceService(supabase);
  const result = await service.createInvoice(
    parsed.data,
    organizationId,
    auth.userId,
    auth.orgState
  );

  if (result.success) {
    revalidatePath("/invoices");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "invoice.create",
      entityType: "invoice",
      entityId: result.data.id,
      summary: `Created invoice ${result.data.invoiceNumber}`,
    });
    // Fire automation (webhooks + matching workflows). Best-effort — never
    // throws, so it cannot affect the invoice that was just created.
    await new DomainEventService(supabase).emit({
      organizationId,
      eventType: DOMAIN_EVENTS.INVOICE_CREATED,
      entityType: "sales_invoice",
      entityId: result.data.id,
      actorUserId: auth.userId,
      payload: {
        invoiceId: result.data.id,
        invoiceNumber: result.data.invoiceNumber,
        customerId: result.data.customerId,
        status: result.data.status,
        total_amount: result.data.totalAmount,
      },
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update (draft only)
// ─────────────────────────────────────────────────────────────

export async function updateInvoiceAction(
  organizationId: string,
  invoiceId: string,
  formData: FormData
): Promise<InvoiceActionResult<InvoiceWithItems>> {
  if (parseItems(formData.get("items")) === null) {
    return invalid("Line items are missing or malformed");
  }

  const parsed = updateInvoiceSchema.safeParse(readFormCandidate(formData));
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "invoice.create");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new InvoiceService(supabase);
  const result = await service.updateInvoice(
    invoiceId,
    { ...parsed.data, version: parseVersion(formData.get("version")) },
    organizationId,
    auth.userId,
    auth.orgState
  );

  if (result.success) {
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "invoice.update",
      entityType: "invoice",
      entityId: invoiceId,
      summary: `Updated invoice ${result.data.invoiceNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────

async function runTransition(
  organizationId: string,
  invoiceId: string,
  permission: string,
  auditAction: string,
  run: (
    service: InvoiceService,
    userId: string
  ) => Promise<InvoiceActionResult<Invoice>>
): Promise<InvoiceActionResult<Invoice>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, permission);
  if (!auth.ok) {
    return auth.result;
  }

  const service = new InvoiceService(supabase);
  const result = await run(service, auth.userId);

  if (result.success) {
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: auditAction,
      entityType: "invoice",
      entityId: invoiceId,
      summary: `${auditAction} ${result.data.invoiceNumber}`,
    });
  }
  return result;
}

export async function postInvoiceAction(
  organizationId: string,
  invoiceId: string
): Promise<InvoiceActionResult<Invoice>> {
  return runTransition(
    organizationId,
    invoiceId,
    "invoice.create",
    "invoice.post",
    (service, userId) =>
      service.postInvoice(invoiceId, organizationId, userId)
  );
}

export async function cancelInvoiceAction(
  organizationId: string,
  invoiceId: string
): Promise<InvoiceActionResult<Invoice>> {
  return runTransition(
    organizationId,
    invoiceId,
    "invoice.cancel",
    "invoice.cancel",
    (service, userId) =>
      service.cancelInvoice(invoiceId, organizationId, userId)
  );
}
