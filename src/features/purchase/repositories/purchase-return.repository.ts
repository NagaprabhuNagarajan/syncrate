import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  PurchaseReturn,
  PurchaseReturnItem,
  PurchaseReturnListParams,
  PurchaseReturnListResult,
  PurchaseReturnStatus,
  PurchaseReturnWithItems,
} from "@/features/purchase/types/purchase-return.types";

type DbPurchaseReturn = Database["public"]["Tables"]["purchase_returns"]["Row"];
type DbPurchaseReturnInsert =
  Database["public"]["Tables"]["purchase_returns"]["Insert"];
type DbPurchaseReturnItem =
  Database["public"]["Tables"]["purchase_return_items"]["Row"];
type DbPurchaseReturnItemInsert =
  Database["public"]["Tables"]["purchase_return_items"]["Insert"];
type DbSupplierLedgerInsert =
  Database["public"]["Tables"]["supplier_ledger_entries"]["Insert"];

/** A list row enriched with the joined supplier name from `suppliers(name)`. */
type DbPurchaseReturnListRow = DbPurchaseReturn & {
  suppliers: { name: string } | { name: string }[] | null;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapPurchaseReturn(row: DbPurchaseReturn): PurchaseReturn {
  return {
    id: row.id,
    organizationId: row.organization_id,
    returnNumber: row.return_number,
    purchaseOrderId: row.purchase_order_id,
    supplierId: row.supplier_id,
    warehouseId: row.warehouse_id,
    status: row.status,
    returnDate: new Date(row.return_date),
    reason: row.reason,
    subtotal: Number(row.subtotal),
    taxAmount: Number(row.tax_amount),
    totalAmount: Number(row.total_amount),
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function mapItem(row: DbPurchaseReturnItem): PurchaseReturnItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    purchaseReturnId: row.purchase_return_id,
    productId: row.product_id,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    lineTotal: Number(row.line_total),
    batchId: row.batch_id,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
  };
}

function readSupplierName(
  joined: DbPurchaseReturnListRow["suppliers"]
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

export class PurchaseReturnRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<PurchaseReturn | null> {
    const { data, error } = await this.supabase
      .from("purchase_returns")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseReturn(data);
  }

  async findByNumber(
    organizationId: string,
    returnNumber: string
  ): Promise<PurchaseReturn | null> {
    const { data, error } = await this.supabase
      .from("purchase_returns")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("return_number", returnNumber.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseReturn(data);
  }

  async findItems(purchaseReturnId: string): Promise<PurchaseReturnItem[]> {
    const { data, error } = await this.supabase
      .from("purchase_return_items")
      .select("*")
      .eq("purchase_return_id", purchaseReturnId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapItem);
  }

  async findWithItems(id: string): Promise<PurchaseReturnWithItems | null> {
    const header = await this.findById(id);
    if (!header) {
      return null;
    }
    const items = await this.findItems(id);
    return { ...header, items };
  }

  async list(
    organizationId: string,
    params: PurchaseReturnListParams = {}
  ): Promise<PurchaseReturnListResult> {
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
      .from("purchase_returns")
      .select("*, suppliers(name)", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.ilike("return_number", `%${term}%`);
      }
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    const rows = data as unknown as DbPurchaseReturnListRow[];
    return {
      items: rows.map((row) => ({
        ...mapPurchaseReturn(row),
        supplierName: readSupplierName(row.suppliers),
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async createHeader(
    input: DbPurchaseReturnInsert
  ): Promise<PurchaseReturn | null> {
    const { data, error } = await this.supabase
      .from("purchase_returns")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseReturn(data);
  }

  async insertItems(items: DbPurchaseReturnItemInsert[]): Promise<boolean> {
    if (items.length === 0) {
      return true;
    }
    const { error } = await this.supabase
      .from("purchase_return_items")
      .insert(items);
    return !error;
  }

  /** Deletes all existing items for a draft return, then inserts the new set. */
  async replaceItems(
    purchaseReturnId: string,
    items: DbPurchaseReturnItemInsert[]
  ): Promise<boolean> {
    const { error: deleteError } = await this.supabase
      .from("purchase_return_items")
      .delete()
      .eq("purchase_return_id", purchaseReturnId);

    if (deleteError) {
      return false;
    }
    return this.insertItems(items);
  }

  async updateHeader(
    id: string,
    patch: Partial<DbPurchaseReturn>,
    updatedBy: string
  ): Promise<PurchaseReturn | null> {
    const { data, error } = await this.supabase
      .from("purchase_returns")
      .update({
        ...patch,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseReturn(data);
  }

  /** Transitions a purchase return to a new status. */
  async updateStatus(
    id: string,
    status: PurchaseReturnStatus,
    userId: string
  ): Promise<PurchaseReturn | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("purchase_returns")
      .update({ status, updated_by: userId, updated_at: now })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseReturn(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("purchase_returns")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    return !error;
  }

  // ── Supplier ledger (read last balance + append) ───────────────
  //
  // Owned here (not in the supplier module) so the purchase return flow can
  // compute a running balance and append a reversing entry without coupling to
  // sibling features still in flight.

  /**
   * Reads the latest running balance for a supplier. Returns 0 when the supplier
   * has no ledger history yet. Uses `limit(1)` rather than `single()` so an
   * empty ledger does not surface as an error.
   */
  async getLastLedgerBalance(supplierId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("supplier_ledger_entries")
      .select("running_balance")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return 0;
    }
    return Number(data[0]?.running_balance ?? 0);
  }

  async insertLedgerEntry(entry: DbSupplierLedgerInsert): Promise<boolean> {
    const { error } = await this.supabase
      .from("supplier_ledger_entries")
      .insert(entry);
    return !error;
  }
}
