import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  CbnInvoice,
  CbnInvoiceListParams,
} from "@/features/cbn/types/cbn.types";

type DbRow = Database["public"]["Tables"]["cbn_invoices"]["Row"];

// ─────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────

function mapRow(row: DbRow): CbnInvoice {
  return {
    id: row.id,
    organizationId: row.organization_id,
    counterpartyOrganizationId: row.counterparty_organization_id,
    connectionId: row.connection_id,
    sourceInvoiceId: row.source_invoice_id,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    subtotal: Number(row.subtotal),
    taxAmount: Number(row.tax_amount),
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    status: row.status,
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
    acceptedBy: row.accepted_by,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at) : null,
    rejectedBy: row.rejected_by,
    rejectionReason: row.rejection_reason,
    buyerPurchaseInvoiceId: row.buyer_purchase_invoice_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class InvoiceSyncRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<CbnInvoice | null> {
    const { data, error } = await this.supabase
      .from("cbn_invoices")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {return null;}
    return mapRow(data);
  }

  async listBySenderOrg(
    orgId: string,
    params?: CbnInvoiceListParams
  ): Promise<CbnInvoice[]> {
    let query = this.supabase
      .from("cbn_invoices")
      .select("*")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (params?.status) {
      query = query.eq("status", params.status);
    }
    if (params?.limit) {
      const limit = params.limit;
      const offset = params.offset ?? 0;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (error || !data) {return [];}
    return data.map(mapRow);
  }

  async listByReceiverOrg(
    orgId: string,
    params?: CbnInvoiceListParams
  ): Promise<CbnInvoice[]> {
    let query = this.supabase
      .from("cbn_invoices")
      .select("*")
      .eq("counterparty_organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (params?.status) {
      query = query.eq("status", params.status);
    }
    if (params?.limit) {
      const limit = params.limit;
      const offset = params.offset ?? 0;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (error || !data) {return [];}
    return data.map(mapRow);
  }

  async listByConnection(
    connectionId: string,
    params?: CbnInvoiceListParams
  ): Promise<CbnInvoice[]> {
    let query = this.supabase
      .from("cbn_invoices")
      .select("*")
      .eq("connection_id", connectionId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (params?.status) {
      query = query.eq("status", params.status);
    }
    if (params?.limit) {
      const limit = params.limit;
      const offset = params.offset ?? 0;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (error || !data) {return [];}
    return data.map(mapRow);
  }
}
