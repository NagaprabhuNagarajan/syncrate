"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { InvoiceSyncService } from "@/features/cbn/services/invoice-sync.service";
import { PurchaseSyncService } from "@/features/cbn/services/purchase-sync.service";
import type {
  CbnActionResult,
  InvoiceLineMapping,
  ResolvedInvoiceLine,
} from "@/features/cbn/types/cbn.types";

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

  revalidatePath("/invoices");
  revalidatePath(`/cbn/connections/${connectionId}`);

  return { success: true, data: data as string };
}

/**
 * Loads the incoming lines with each one pre-matched to a local product where
 * the evidence is strong enough. Read-only: it is what the accept dialog opens
 * with, so the user only decides the lines that could not be matched.
 */
export async function resolveCbnInvoiceLines(
  cbnInvoiceId: string,
  buyerOrgId: string,
  connectionId: string
): Promise<CbnActionResult<readonly ResolvedInvoiceLine[]>> {
  if (!cbnInvoiceId || !buyerOrgId || !connectionId) {
    return invalid("CBN invoice, organization and connection are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, buyerOrgId, "purchase.create");
  if (!auth.ok) {return auth.result;}

  return new InvoiceSyncService(supabase).resolveIncomingLines(
    cbnInvoiceId,
    buyerOrgId,
    connectionId
  );
}

/**
 * Turns a received invoice into a draft bill. Every transmitted line must be
 * mapped to one of the buyer's products first — the RPC re-checks both the
 * completeness of the mapping and that each product really belongs to the
 * buyer, so this is convenience validation, not the security boundary.
 */
export async function acceptCbnInvoice(
  cbnInvoiceId: string,
  buyerOrgId: string,
  lineMappings: readonly InvoiceLineMapping[],
  notes?: string
): Promise<CbnActionResult<string>> {
  if (!cbnInvoiceId || !buyerOrgId) {
    return invalid("CBN invoice ID and buyer org ID are required");
  }
  if (lineMappings.length === 0) {
    return invalid("Match every line to one of your products before accepting");
  }

  const supabase = await createServerSupabaseClient();
  // Accepting creates a draft *bill* in the buyer's books, so the gate is the
  // purchase permission — `invoice.create` is the sales-side permission and was
  // the wrong one to check here.
  const auth = await authenticate(supabase, buyerOrgId, "purchase.create");
  if (!auth.ok) {return auth.result;}

  const { data, error } = await supabase.rpc("accept_cbn_invoice", {
    p_cbn_invoice_id: cbnInvoiceId,
    p_buyer_org_id: buyerOrgId,
    p_notes: notes ?? null,
    p_line_mappings: lineMappings.map((mapping) => ({
      line_id: mapping.cbnInvoiceItemId,
      product_id: mapping.productId,
    })),
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/bills");
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
  const auth = await authenticate(supabase, buyerOrgId, "purchase.create");
  if (!auth.ok) {return auth.result;}

  const { error } = await supabase.rpc("reject_cbn_invoice", {
    p_cbn_invoice_id: cbnInvoiceId,
    p_buyer_org_id: buyerOrgId,
    p_reason: reason,
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/bills");
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

  revalidatePath("/purchases");
  revalidatePath(`/cbn/connections/${connectionId}`);

  return { success: true, data: data as string };
}

/**
 * Loads an incoming purchase order's lines with each pre-matched to a local
 * product where the evidence is strong enough. Read-only.
 */
export async function resolveCbnPurchaseOrderLines(
  cbnPoId: string,
  supplierOrgId: string,
  connectionId: string
): Promise<CbnActionResult<readonly ResolvedInvoiceLine[]>> {
  if (!cbnPoId || !supplierOrgId || !connectionId) {
    return invalid("CBN purchase order, organization and connection are required");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authenticate(supabase, supplierOrgId, "sales.create");
  if (!auth.ok) {return auth.result;}

  return new PurchaseSyncService(supabase).resolveIncomingLines(
    cbnPoId,
    supplierOrgId,
    connectionId
  );
}

/**
 * Turns a received purchase order into a draft sales order. Every transmitted
 * line must be mapped to one of the supplier's products first; the RPC
 * re-checks both completeness and ownership, so this is convenience validation.
 */
export async function acceptCbnPurchaseOrder(
  cbnPoId: string,
  supplierOrgId: string,
  lineMappings: readonly InvoiceLineMapping[],
  notes?: string
): Promise<CbnActionResult<string>> {
  if (!cbnPoId || !supplierOrgId) {
    return invalid("CBN PO ID and supplier org ID are required");
  }
  if (lineMappings.length === 0) {
    return invalid("Match every line to one of your products before accepting");
  }

  const supabase = await createServerSupabaseClient();
  // Accepting creates a draft *sales order* in the supplier's books, so the
  // gate is the sales permission — `purchase_order.update` is the buyer-side
  // permission and was the wrong one to check here.
  const auth = await authenticate(supabase, supplierOrgId, "sales.create");
  if (!auth.ok) {return auth.result;}

  const { data, error } = await supabase.rpc("accept_cbn_purchase_order", {
    p_cbn_po_id: cbnPoId,
    p_supplier_org_id: supplierOrgId,
    p_notes: notes ?? null,
    p_line_mappings: lineMappings.map((mapping) => ({
      line_id: mapping.cbnInvoiceItemId,
      product_id: mapping.productId,
    })),
  });

  if (error) {return unknown(error.message);}

  revalidatePath("/sales-orders");
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

  revalidatePath("/sales-orders");
  revalidatePath("/cbn");

  return { success: true, data: undefined };
}
