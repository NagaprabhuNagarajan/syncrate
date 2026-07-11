"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { SalesOrderService } from "@/features/sales/services/sales-order.service";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import {
  createSalesOrderSchema,
  recordDeliverySchema,
  updateSalesOrderSchema,
} from "@/features/sales/schemas/sales-order.schemas";
import type {
  SalesOrder,
  SalesOrderActionResult,
  SalesOrderWithItems,
} from "@/features/sales/types/sales-order.types";
import type { InvoiceActionResult, InvoiceWithItems } from "@/features/sales/types/invoice.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): SalesOrderActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): SalesOrderActionResult<never> {
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
    orderDate: formData.get("orderDate") || undefined,
    deliveryDate: formData.get("deliveryDate") || undefined,
    paymentTermsDays: formData.get("paymentTermsDays") || undefined,
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
  | { ok: false; result: SalesOrderActionResult<never> }
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

export async function createSalesOrderAction(
  organizationId: string,
  formData: FormData
): Promise<SalesOrderActionResult<SalesOrderWithItems>> {
  const parsed = createSalesOrderSchema.safeParse(readFormCandidate(formData));
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "sales.create");
  if (!auth.ok) {return auth.result;}

  const service = new SalesOrderService(supabase);
  const result = await service.createSalesOrder(
    parsed.data,
    organizationId,
    auth.userId,
    auth.orgState
  );

  if (result.success) {
    revalidatePath("/sales-orders");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "sales_order.create",
      entityType: "sales_order",
      entityId: result.data.id,
      summary: `Created sales order ${result.data.soNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateSalesOrderAction(
  organizationId: string,
  salesOrderId: string,
  formData: FormData
): Promise<SalesOrderActionResult<SalesOrderWithItems>> {
  const parsed = updateSalesOrderSchema.safeParse(readFormCandidate(formData));
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "sales.create");
  if (!auth.ok) {return auth.result;}

  const service = new SalesOrderService(supabase);
  const result = await service.updateSalesOrder(
    salesOrderId,
    parsed.data,
    organizationId,
    auth.userId,
    auth.orgState
  );

  if (result.success) {
    revalidatePath("/sales-orders");
    revalidatePath(`/sales-orders/${salesOrderId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "sales_order.update",
      entityType: "sales_order",
      entityId: salesOrderId,
      summary: `Updated sales order ${result.data.soNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────────────────────

async function runTransition(
  organizationId: string,
  salesOrderId: string,
  permission: string,
  auditAction: string,
  run: (
    service: SalesOrderService,
    userId: string
  ) => Promise<SalesOrderActionResult<SalesOrder>>
): Promise<SalesOrderActionResult<SalesOrder>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, permission);
  if (!auth.ok) {return auth.result;}

  const service = new SalesOrderService(supabase);
  const result = await run(service, auth.userId);

  if (result.success) {
    revalidatePath("/sales-orders");
    revalidatePath(`/sales-orders/${salesOrderId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: auditAction,
      entityType: "sales_order",
      entityId: salesOrderId,
      summary: `${auditAction} ${result.data.soNumber}`,
    });
  }
  return result;
}

export async function submitSalesOrderAction(
  organizationId: string,
  salesOrderId: string
): Promise<SalesOrderActionResult<SalesOrder>> {
  return runTransition(
    organizationId,
    salesOrderId,
    "sales.create",
    "sales_order.submit",
    (service, userId) =>
      service.submitSalesOrder(salesOrderId, organizationId, userId)
  );
}

export async function approveSalesOrderAction(
  organizationId: string,
  salesOrderId: string
): Promise<SalesOrderActionResult<SalesOrder>> {
  return runTransition(
    organizationId,
    salesOrderId,
    "sales.approve",
    "sales_order.approve",
    (service, userId) =>
      service.approveSalesOrder(salesOrderId, organizationId, userId)
  );
}

export async function cancelSalesOrderAction(
  organizationId: string,
  salesOrderId: string
): Promise<SalesOrderActionResult<SalesOrder>> {
  return runTransition(
    organizationId,
    salesOrderId,
    "sales.cancel",
    "sales_order.cancel",
    (service, userId) =>
      service.cancelSalesOrder(salesOrderId, organizationId, userId)
  );
}

// ─────────────────────────────────────────────────────────────
// Record delivery (fulfilment)
// ─────────────────────────────────────────────────────────────

export async function recordSalesOrderDeliveryAction(
  organizationId: string,
  salesOrderId: string,
  formData: FormData
): Promise<SalesOrderActionResult<SalesOrderWithItems>> {
  if (parseItems(formData.get("lines")) === null) {
    return invalid("Delivery line items are missing or malformed");
  }

  const parsed = recordDeliverySchema.safeParse({
    version: formData.get("version") || undefined,
    lines: parseItems(formData.get("lines")) ?? [],
  });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "sales.create");
  if (!auth.ok) {return auth.result;}

  const service = new SalesOrderService(supabase);
  const result = await service.recordDelivery(
    organizationId,
    salesOrderId,
    auth.userId,
    parsed.data.lines.map((line) => ({
      itemId: line.itemId,
      deliverQty: line.deliverQty,
    })),
    parsed.data.version
  );

  if (result.success) {
    revalidatePath("/sales-orders");
    revalidatePath(`/sales-orders/${salesOrderId}`);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "sales_order.deliver",
      entityType: "sales_order",
      entityId: salesOrderId,
      summary: `Recorded delivery for sales order ${result.data.soNumber}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Convert to Invoice
// ─────────────────────────────────────────────────────────────

export async function convertSOToInvoiceAction(
  organizationId: string,
  salesOrderId: string
): Promise<InvoiceActionResult<InvoiceWithItems>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "sales.create");
  if (!auth.ok) {
    const r = auth.result;
    const message = !r.success ? r.error.message : "Forbidden";
    return { success: false, error: { code: "forbidden", message } };
  }

  const service = new InvoiceService(supabase);
  const result = await service.convertFromSalesOrder(
    salesOrderId,
    organizationId,
    auth.userId,
    auth.orgState
  );

  if (result.success) {
    revalidatePath("/sales-orders");
    revalidatePath(`/sales-orders/${salesOrderId}`);
    revalidatePath("/invoices");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "invoice.convert_from_so",
      entityType: "invoice",
      entityId: result.data.id,
      summary: `Converted sales order ${salesOrderId} to invoice ${result.data.invoiceNumber}`,
    });
  }
  return result;
}
