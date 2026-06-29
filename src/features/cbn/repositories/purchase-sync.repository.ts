import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  CbnPurchaseOrder,
  CbnPoListParams,
} from "@/features/cbn/types/cbn.types";

type DbRow = Database["public"]["Tables"]["cbn_purchase_orders"]["Row"];

// ─────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────

function mapRow(row: DbRow): CbnPurchaseOrder {
  return {
    id: row.id,
    organizationId: row.organization_id,
    counterpartyOrganizationId: row.counterparty_organization_id,
    connectionId: row.connection_id,
    sourcePurchaseOrderId: row.source_purchase_order_id,
    poNumber: row.po_number,
    poDate: row.po_date,
    expectedDeliveryDate: row.expected_delivery_date,
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
    supplierSalesOrderId: row.supplier_sales_order_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class PurchaseSyncRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<CbnPurchaseOrder | null> {
    const { data, error } = await this.supabase
      .from("cbn_purchase_orders")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {return null;}
    return mapRow(data);
  }

  async listBySenderOrg(
    orgId: string,
    params?: CbnPoListParams
  ): Promise<CbnPurchaseOrder[]> {
    let query = this.supabase
      .from("cbn_purchase_orders")
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
    params?: CbnPoListParams
  ): Promise<CbnPurchaseOrder[]> {
    let query = this.supabase
      .from("cbn_purchase_orders")
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
    params?: CbnPoListParams
  ): Promise<CbnPurchaseOrder[]> {
    let query = this.supabase
      .from("cbn_purchase_orders")
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
