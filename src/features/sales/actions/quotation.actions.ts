"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { QuotationService } from "@/features/sales/services/quotation.service";
import { SalesOrderService } from "@/features/sales/services/sales-order.service";
import {
  createQuotationSchema,
  updateQuotationSchema,
} from "@/features/sales/schemas/quotation.schemas";
import type {
  Quotation,
  QuotationActionResult,
  QuotationWithItems,
} from "@/features/sales/types/quotation.types";
import type { SalesOrderActionResult, SalesOrderWithItems } from "@/features/sales/types/sales-order.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): QuotationActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): QuotationActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

function parseItems(value: FormDataEntryValue | null): unknown[] | null {
  if (typeof value !== "string" || value.trim() === "") {return null;}
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readFormCandidate(formData: FormData): Record<string, unknown> {
  return {
    customerId: formData.get("customerId") || undefined,
    branchId: formData.get("branchId") || undefined,
    salespersonId: formData.get("salespersonId") || undefined,
    referenceNumber: formData.get("referenceNumber") || undefined,
    quotationDate: formData.get("quotationDate") || undefined,
    expiryDate: formData.get("expiryDate") || undefined,
    supplyState: formData.get("supplyState") || undefined,
    notes: formData.get("notes") || undefined,
    terms: formData.get("terms") || undefined,
    version: formData.get("version") || undefined,
    items: parseItems(formData.get("items")) ?? [],
  };
}

async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  | { ok: true; userId: string; orgState: string | null }
  | { ok: false; result: QuotationActionResult<never> }
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

export async function createQuotationAction(
  organizationId: string,
  formData: FormData
): Promise<QuotationActionResult<QuotationWithItems>> {
  const parsed = createQuotationSchema.safeParse(readFormCandidate(formData));
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "sales.create");
  if (!auth.ok) {return auth.result;}

  const service = new QuotationService(supabase);
  const result = await service.createQuotation(
    parsed.data,
    organizationId,
    auth.userId,
    auth.orgState
  );

  if (result.success) {
    revalidatePath("/sales/quotations");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "quotation.create",
      entityType: "quotation",
      entityId: result.data.id,
      summary: `Created quotation ${result.data.quotationNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateQuotationAction(
  organizationId: string,
  quotationId: string,
  formData: FormData
): Promise<QuotationActionResult<QuotationWithItems>> {
  const parsed = updateQuotationSchema.safeParse(readFormCandidate(formData));
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "sales.create");
  if (!auth.ok) {return auth.result;}

  const service = new QuotationService(supabase);
  const result = await service.updateQuotation(
    quotationId,
    parsed.data,
    organizationId,
    auth.userId,
    auth.orgState
  );

  if (result.success) {
    revalidatePath("/sales/quotations");
    revalidatePath(`/sales/quotations/${quotationId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "quotation.update",
      entityType: "quotation",
      entityId: quotationId,
      summary: `Updated quotation ${result.data.quotationNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────

async function runTransition(
  organizationId: string,
  quotationId: string,
  permission: string,
  auditAction: string,
  run: (
    service: QuotationService,
    userId: string
  ) => Promise<QuotationActionResult<Quotation>>
): Promise<QuotationActionResult<Quotation>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, permission);
  if (!auth.ok) {return auth.result;}

  const service = new QuotationService(supabase);
  const result = await run(service, auth.userId);

  if (result.success) {
    revalidatePath("/sales/quotations");
    revalidatePath(`/sales/quotations/${quotationId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: auditAction,
      entityType: "quotation",
      entityId: quotationId,
      summary: `${auditAction} ${result.data.quotationNumber}`,
    });
  }
  return result;
}

export async function markViewedQuotationAction(
  organizationId: string,
  quotationId: string
): Promise<QuotationActionResult<Quotation>> {
  return runTransition(
    organizationId,
    quotationId,
    "sales.create",
    "quotation.viewed",
    (service, userId) =>
      service.markViewedQuotation(quotationId, organizationId, userId)
  );
}

export async function submitQuotationAction(
  organizationId: string,
  quotationId: string
): Promise<QuotationActionResult<Quotation>> {
  return runTransition(
    organizationId,
    quotationId,
    "sales.create",
    "quotation.submit",
    (service, userId) =>
      service.submitQuotation(quotationId, organizationId, userId)
  );
}

export async function acceptQuotationAction(
  organizationId: string,
  quotationId: string
): Promise<QuotationActionResult<Quotation>> {
  return runTransition(
    organizationId,
    quotationId,
    "sales.approve",
    "quotation.accept",
    (service, userId) =>
      service.acceptQuotation(quotationId, organizationId, userId)
  );
}

export async function rejectQuotationAction(
  organizationId: string,
  quotationId: string
): Promise<QuotationActionResult<Quotation>> {
  return runTransition(
    organizationId,
    quotationId,
    "sales.approve",
    "quotation.reject",
    (service, userId) =>
      service.rejectQuotation(quotationId, organizationId, userId)
  );
}

export async function cancelQuotationAction(
  organizationId: string,
  quotationId: string
): Promise<QuotationActionResult<Quotation>> {
  return runTransition(
    organizationId,
    quotationId,
    "sales.cancel",
    "quotation.cancel",
    (service, userId) =>
      service.cancelQuotation(quotationId, organizationId, userId)
  );
}

// ─────────────────────────────────────────────────────────────
// Convert to Sales Order
// ─────────────────────────────────────────────────────────────

export async function convertQuotationToSOAction(
  organizationId: string,
  quotationId: string
): Promise<SalesOrderActionResult<SalesOrderWithItems>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "sales.create");
  if (!auth.ok) {
    const r = auth.result;
    const message = !r.success ? r.error.message : "Forbidden";
    return { success: false, error: { code: "forbidden", message } };
  }

  const service = new SalesOrderService(supabase);
  const result = await service.convertFromQuotation(
    quotationId,
    organizationId,
    auth.userId,
    auth.orgState
  );

  if (result.success) {
    revalidatePath("/sales/quotations");
    revalidatePath("/sales-orders");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "quotation.convert_to_so",
      entityType: "sales_order",
      entityId: result.data.id,
      summary: `Converted quotation ${quotationId} to sales order ${result.data.soNumber}`,
    });
  }
  return result;
}
