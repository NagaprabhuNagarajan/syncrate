import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  SalesOrder,
  SalesOrderItem,
  SalesOrderListParams,
  SalesOrderListResult,
  SalesOrderStatus,
  SalesOrderWithItems,
} from "@/features/sales/types/sales-order.types";

type DbSalesOrder = Database["public"]["Tables"]["sales_orders"]["Row"];
type DbSalesOrderInsert = Database["public"]["Tables"]["sales_orders"]["Insert"];
type DbSalesOrderItem = Database["public"]["Tables"]["sales_order_items"]["Row"];
type DbSalesOrderItemInsert =
  Database["public"]["Tables"]["sales_order_items"]["Insert"];

/** A list row enriched with the joined customer name from `customers(name)`. */
type DbSalesOrderListRow = DbSalesOrder & {
  customers: { name: string } | { name: string }[] | null;
};

/**
 * Outcome of an optimistically-locked header update:
 *   - `ok`       → the row was updated (returns the new state),
 *   - `conflict` → the row exists but its version moved on (no write happened),
 *   - `error`    → the write failed for another reason.
 */
export type UpdateSalesOrderHeaderResult =
  | { readonly status: "ok"; readonly salesOrder: SalesOrder }
  | { readonly status: "conflict" }
  | { readonly status: "error" };

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapSalesOrder(row: DbSalesOrder): SalesOrder {
  return {
    id: row.id,
    organizationId: row.organization_id,
    soNumber: row.so_number,
    customerId: row.customer_id,
    quotationId: row.quotation_id,
    branchId: row.branch_id,
    warehouseId: row.warehouse_id,
    salespersonId: row.salesperson_id,
    referenceNumber: row.reference_number,
    orderDate: new Date(row.order_date),
    deliveryDate: row.delivery_date ? new Date(row.delivery_date) : null,
    paymentTermsDays: Number(row.payment_terms_days),
    supplyState: row.supply_state,
    isInterstate: row.is_interstate,
    status: row.status,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    cgstAmount: Number(row.cgst_amount),
    sgstAmount: Number(row.sgst_amount),
    igstAmount: Number(row.igst_amount),
    taxAmount: Number(row.tax_amount),
    roundOff: Number(row.round_off),
    totalAmount: Number(row.total_amount),
    notes: row.notes,
    terms: row.terms,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? new Date(row.approved_at) : null,
    convertedInvId: row.converted_inv_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    version: Number(row.version),
  };
}

function mapItem(row: DbSalesOrderItem): SalesOrderItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    salesOrderId: row.sales_order_id,
    productId: row.product_id,
    description: row.description,
    hsnCode: row.hsn_code,
    quantity: Number(row.quantity),
    deliveredQty: Number(row.delivered_qty),
    unitPrice: Number(row.unit_price),
    discountPercent: Number(row.discount_percent),
    discountAmount: Number(row.discount_amount),
    taxableAmount: Number(row.taxable_amount),
    gstRate: Number(row.gst_rate),
    cgstRate: Number(row.cgst_rate),
    sgstRate: Number(row.sgst_rate),
    igstRate: Number(row.igst_rate),
    cgstAmount: Number(row.cgst_amount),
    sgstAmount: Number(row.sgst_amount),
    igstAmount: Number(row.igst_amount),
    taxAmount: Number(row.tax_amount),
    lineTotal: Number(row.line_total),
    sortOrder: Number(row.sort_order),
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
  };
}

function readCustomerName(
  joined: DbSalesOrderListRow["customers"]
): string | null {
  if (!joined) {
    return null;
  }
  if (Array.isArray(joined)) {
    return joined[0]?.name ?? null;
  }
  return joined.name;
}

/** Escapes PostgREST `or()`/ILIKE meta-characters so search stays safe. */
function sanitizeSearch(term: string): string {
  return term.trim().replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class SalesOrderRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<SalesOrder | null> {
    const { data, error } = await this.supabase
      .from("sales_orders")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSalesOrder(data);
  }

  async findItems(salesOrderId: string): Promise<SalesOrderItem[]> {
    const { data, error } = await this.supabase
      .from("sales_order_items")
      .select("*")
      .eq("sales_order_id", salesOrderId)
      .order("sort_order", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapItem);
  }

  async findWithItems(id: string): Promise<SalesOrderWithItems | null> {
    const header = await this.findById(id);
    if (!header) {
      return null;
    }
    const items = await this.findItems(id);
    return { ...header, items };
  }

  async list(
    organizationId: string,
    params: SalesOrderListParams = {}
  ): Promise<SalesOrderListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sortBy = params.sortBy ?? "created_at";
    const ascending = (params.sortDir ?? "desc") === "asc";

    let query = this.supabase
      .from("sales_orders")
      .select("*, customers(name)", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.customerId) {
      query = query.eq("customer_id", params.customerId);
    }

    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.ilike("so_number", `%${term}%`);
      }
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    const rows = data as unknown as DbSalesOrderListRow[];
    return {
      items: rows.map((row) => ({
        ...mapSalesOrder(row),
        customerName: readCustomerName(row.customers),
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async createHeader(input: DbSalesOrderInsert): Promise<SalesOrder | null> {
    const { data, error } = await this.supabase
      .from("sales_orders")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapSalesOrder(data);
  }

  async insertItems(items: DbSalesOrderItemInsert[]): Promise<boolean> {
    if (items.length === 0) {
      return true;
    }
    const { error } = await this.supabase
      .from("sales_order_items")
      .insert(items);
    return !error;
  }

  /** Deletes all existing items for a draft SO, then inserts the new set. */
  async replaceItems(
    salesOrderId: string,
    items: DbSalesOrderItemInsert[]
  ): Promise<boolean> {
    const { error: deleteError } = await this.supabase
      .from("sales_order_items")
      .delete()
      .eq("sales_order_id", salesOrderId);

    if (deleteError) {
      return false;
    }
    return this.insertItems(items);
  }

  /**
   * Optimistically-locked header update. The write only matches a row whose
   * `version` equals `expectedVersion`; the `handle_updated_at` trigger bumps
   * the version automatically. A zero-row result means another writer won the
   * race — reported as a `conflict` rather than an error.
   */
  async updateHeader(
    id: string,
    patch: Partial<DbSalesOrder>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<UpdateSalesOrderHeaderResult> {
    const { data, error } = await this.supabase
      .from("sales_orders")
      .update({
        ...patch,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("version", expectedVersion)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) {
      return { status: "error" };
    }
    if (!data) {
      return { status: "conflict" };
    }
    return { status: "ok", salesOrder: mapSalesOrder(data) };
  }

  /**
   * Transitions a sales order to a new status. When `approve` is true the
   * approver and approval timestamp are stamped on the row.
   */
  async updateStatus(
    id: string,
    status: SalesOrderStatus,
    userId: string,
    approve = false
  ): Promise<SalesOrder | null> {
    const now = new Date().toISOString();
    const patch: Partial<DbSalesOrder> = {
      status,
      updated_by: userId,
      updated_at: now,
    };
    if (approve) {
      patch.approved_by = userId;
      patch.approved_at = now;
    }

    const { data, error } = await this.supabase
      .from("sales_orders")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapSalesOrder(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("sales_orders")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    return !error;
  }
}
