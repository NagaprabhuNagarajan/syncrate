import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderListParams,
  PurchaseOrderListResult,
  PurchaseOrderStatus,
  PurchaseOrderWithItems,
} from "@/features/purchase/types/purchase-order.types";

type DbPurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
type DbPurchaseOrderInsert =
  Database["public"]["Tables"]["purchase_orders"]["Insert"];
type DbPurchaseOrderItem =
  Database["public"]["Tables"]["purchase_order_items"]["Row"];
type DbPurchaseOrderItemInsert =
  Database["public"]["Tables"]["purchase_order_items"]["Insert"];

/** A list row enriched with the joined supplier name from `suppliers(name)`. */
type DbPurchaseOrderListRow = DbPurchaseOrder & {
  suppliers: { name: string } | { name: string }[] | null;
};

/**
 * Outcome of an optimistically-locked header update:
 *   - `ok`       → the row was updated (returns the new state),
 *   - `conflict` → the row exists but its version moved on (no write happened),
 *   - `error`    → the write failed for another reason.
 */
export type UpdateHeaderResult =
  | { readonly status: "ok"; readonly order: PurchaseOrder }
  | { readonly status: "conflict" }
  | { readonly status: "error" };

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapPurchaseOrder(row: DbPurchaseOrder): PurchaseOrder {
  return {
    id: row.id,
    organizationId: row.organization_id,
    poNumber: row.po_number,
    supplierId: row.supplier_id,
    branchId: row.branch_id,
    status: row.status,
    orderDate: new Date(row.order_date),
    expectedDeliveryDate: row.expected_delivery_date
      ? new Date(row.expected_delivery_date)
      : null,
    currency: row.currency,
    notes: row.notes,
    terms: row.terms,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    taxAmount: Number(row.tax_amount),
    totalAmount: Number(row.total_amount),
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? new Date(row.approved_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    version: Number(row.version),
  };
}

function mapItem(row: DbPurchaseOrderItem): PurchaseOrderItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    purchaseOrderId: row.purchase_order_id,
    productId: row.product_id,
    description: row.description,
    quantity: Number(row.quantity),
    receivedQuantity: Number(row.received_quantity),
    unitPrice: Number(row.unit_price),
    discountPercent: Number(row.discount_percent),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    lineTotal: Number(row.line_total),
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
  };
}

function readSupplierName(
  joined: DbPurchaseOrderListRow["suppliers"]
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

export class PurchaseOrderRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<PurchaseOrder | null> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseOrder(data);
  }

  async findByNumber(
    organizationId: string,
    poNumber: string
  ): Promise<PurchaseOrder | null> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("po_number", poNumber.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseOrder(data);
  }

  async findItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]> {
    const { data, error } = await this.supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", purchaseOrderId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapItem);
  }

  async findWithItems(id: string): Promise<PurchaseOrderWithItems | null> {
    const header = await this.findById(id);
    if (!header) {
      return null;
    }
    const items = await this.findItems(id);
    return { ...header, items };
  }

  async list(
    organizationId: string,
    params: PurchaseOrderListParams = {}
  ): Promise<PurchaseOrderListResult> {
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
      .from("purchase_orders")
      .select("*, suppliers(name)", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.ilike("po_number", `%${term}%`);
      }
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    const rows = data as unknown as DbPurchaseOrderListRow[];
    return {
      items: rows.map((row) => ({
        ...mapPurchaseOrder(row),
        supplierName: readSupplierName(row.suppliers),
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async createHeader(
    input: DbPurchaseOrderInsert
  ): Promise<PurchaseOrder | null> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseOrder(data);
  }

  async insertItems(items: DbPurchaseOrderItemInsert[]): Promise<boolean> {
    if (items.length === 0) {
      return true;
    }
    const { error } = await this.supabase
      .from("purchase_order_items")
      .insert(items);
    return !error;
  }

  /** Deletes all existing items for a draft PO, then inserts the new set. */
  async replaceItems(
    purchaseOrderId: string,
    items: DbPurchaseOrderItemInsert[]
  ): Promise<boolean> {
    const { error: deleteError } = await this.supabase
      .from("purchase_order_items")
      .delete()
      .eq("purchase_order_id", purchaseOrderId);

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
    patch: Partial<DbPurchaseOrder>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<UpdateHeaderResult> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
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
    return { status: "ok", order: mapPurchaseOrder(data) };
  }

  /**
   * Transitions a purchase order to a new status. When `approve` is true the
   * approver and approval timestamp are stamped on the row.
   */
  async updateStatus(
    id: string,
    status: PurchaseOrderStatus,
    userId: string,
    approve = false
  ): Promise<PurchaseOrder | null> {
    const now = new Date().toISOString();
    const patch: Partial<DbPurchaseOrder> = {
      status,
      updated_by: userId,
      updated_at: now,
    };
    if (approve) {
      patch.approved_by = userId;
      patch.approved_at = now;
    }

    const { data, error } = await this.supabase
      .from("purchase_orders")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseOrder(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("purchase_orders")
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
