"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import type { CbnActionResult } from "@/features/cbn/types/cbn.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): CbnActionResult<never> {
  return { success: false, error: { code: "permission_denied", message } };
}

function invalid(message: string): CbnActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

function unknown(message: string): CbnActionResult<never> {
  return { success: false, error: { code: "unknown", message } };
}

async function authenticate(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  | { ok: true; userId: string }
  | { ok: false; result: CbnActionResult<never> }
> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { ok: false, result: forbidden("Not authenticated") };
  }

  const orgService = new OrganizationService(supabase);
  const context = await orgService.getOrganizationContext(
    organizationId,
    data.user.id
  );
  if (!context) {
    return { ok: false, result: forbidden("Organization not found") };
  }
  if (!context.permissions.includes(permission)) {
    return { ok: false, result: forbidden("Permission denied") };
  }

  return { ok: true, userId: data.user.id };
}

// ─────────────────────────────────────────────────────────────
// Invoice sync actions
// ─────────────────────────────────────────────────────────────

export async function sendCbnInvoice(
  invoiceId: string,
  connectionId: string,
  organizationId: string
): Promise<CbnActionResult<string>> {
  if (!invoiceId || !connectionId || !organizationId) {
    return invalid("Invoice ID, connection ID, and organization ID are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, organizationId, "invoice.create");
  if (!auth.ok) {return auth.result;}

  const { data, error } = await supabase.rpc("send_cbn_invoice", {
    p_invoice_id: invoiceId,
    p_connection_id: connectionId,
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/cbn/synced-invoices");
  revalidatePath(`/cbn/connections/${connectionId}`);

  return { success: true, data: data as string };
}

export async function acceptCbnInvoice(
  cbnInvoiceId: string,
  buyerOrgId: string,
  notes?: string
): Promise<CbnActionResult<string>> {
  if (!cbnInvoiceId || !buyerOrgId) {
    return invalid("CBN invoice ID and buyer org ID are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, buyerOrgId, "invoice.create");
  if (!auth.ok) {return auth.result;}

  const { data, error } = await supabase.rpc("accept_cbn_invoice", {
    p_cbn_invoice_id: cbnInvoiceId,
    p_buyer_org_id: buyerOrgId,
    p_notes: notes ?? null,
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/cbn/synced-invoices");
  revalidatePath("/cbn");

  return { success: true, data: data as string };
}

export async function rejectCbnInvoice(
  cbnInvoiceId: string,
  buyerOrgId: string,
  reason: string
): Promise<CbnActionResult<void>> {
  if (!cbnInvoiceId || !buyerOrgId || !reason) {
    return invalid("CBN invoice ID, buyer org ID, and reason are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, buyerOrgId, "invoice.create");
  if (!auth.ok) {return auth.result;}

  const { error } = await supabase.rpc("reject_cbn_invoice", {
    p_cbn_invoice_id: cbnInvoiceId,
    p_buyer_org_id: buyerOrgId,
    p_reason: reason,
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/cbn/synced-invoices");
  revalidatePath("/cbn");

  return { success: true, data: undefined };
}

// ─────────────────────────────────────────────────────────────
// Purchase Order sync actions
// ─────────────────────────────────────────────────────────────

export async function sendCbnPurchaseOrder(
  poId: string,
  connectionId: string,
  organizationId: string
): Promise<CbnActionResult<string>> {
  if (!poId || !connectionId || !organizationId) {
    return invalid("PO ID, connection ID, and organization ID are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, organizationId, "purchase_order.create");
  if (!auth.ok) {return auth.result;}

  const { data, error } = await supabase.rpc("send_cbn_purchase_order", {
    p_po_id: poId,
    p_connection_id: connectionId,
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/cbn/synced-orders");
  revalidatePath(`/cbn/connections/${connectionId}`);

  return { success: true, data: data as string };
}

export async function acceptCbnPurchaseOrder(
  cbnPoId: string,
  supplierOrgId: string,
  notes?: string
): Promise<CbnActionResult<string>> {
  if (!cbnPoId || !supplierOrgId) {
    return invalid("CBN PO ID and supplier org ID are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, supplierOrgId, "purchase_order.update");
  if (!auth.ok) {return auth.result;}

  const { data, error } = await supabase.rpc("accept_cbn_purchase_order", {
    p_cbn_po_id: cbnPoId,
    p_supplier_org_id: supplierOrgId,
    p_notes: notes ?? null,
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/cbn/synced-orders");
  revalidatePath("/cbn");

  return { success: true, data: data as string };
}

export async function rejectCbnPurchaseOrder(
  cbnPoId: string,
  supplierOrgId: string,
  reason: string
): Promise<CbnActionResult<void>> {
  if (!cbnPoId || !supplierOrgId || !reason) {
    return invalid("CBN PO ID, supplier org ID, and reason are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, supplierOrgId, "purchase_order.update");
  if (!auth.ok) {return auth.result;}

  const { error } = await supabase.rpc("reject_cbn_purchase_order", {
    p_cbn_po_id: cbnPoId,
    p_supplier_org_id: supplierOrgId,
    p_reason: reason,
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/cbn/synced-orders");
  revalidatePath("/cbn");

  return { success: true, data: undefined };
}
