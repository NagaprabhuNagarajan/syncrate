import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  PurchaseReturn,
  PurchaseReturnItem,
  PurchaseReturnListItem,
  PurchaseReturnListParams,
  PurchaseReturnListResult,
  PurchaseReturnStats,
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

/** A list row enriched with the joined supplier name from `suppliers(name)`. */
type DbPurchaseReturnListRow = DbPurchaseReturn & {
  suppliers: { name: string } | { name: string }[] | null;
};

/** Minimal error shape surfaced by Supabase RPC calls. */
export interface RpcError {
  readonly message: string;
}

/** Passthrough result of an atomic RPC call. */
export interface RpcResult<T> {
  readonly data: T | null;
  readonly error: RpcError | null;
}

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
    branchId: row.branch_id,
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
    version: row.version,
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

  /** Returns linked to a purchase order, newest first. */
  async findByPurchaseOrder(
    purchaseOrderId: string
  ): Promise<PurchaseReturnListItem[]> {
    const { data, error } = await this.supabase
      .from("purchase_returns")
      .select("*, suppliers(name)")
      .eq("purchase_order_id", purchaseOrderId)
      .is("deleted_at", null)
      .order("return_date", { ascending: false });

    if (error || !data) {
      return [];
    }

    const rows = data as unknown as DbPurchaseReturnListRow[];
    return rows.map((row) => ({
      ...mapPurchaseReturn(row),
      supplierName: readSupplierName(row.suppliers),
    }));
  }

  /**
   * Aggregate counts + total value for the list header tiles. Head-only count
   * queries run in parallel for the per-status tiles; `totalValue` needs a
   * sum, which PostgREST cannot compute server-side via a head query, so we
   * fetch the minimal `total_amount` column for non-cancelled returns and
   * reduce it in JS.
   */
  async getStats(organizationId: string): Promise<PurchaseReturnStats> {
    const base = () =>
      this.supabase
        .from("purchase_returns")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .is("deleted_at", null);

    const [draft, completed, cancelled] = await Promise.all([
      base().eq("status", "draft"),
      base().eq("status", "completed"),
      base().eq("status", "cancelled"),
    ]);

    const { data: valueRows } = await this.supabase
      .from("purchase_returns")
      .select("total_amount")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("status", "cancelled");

    const totalValue = (valueRows ?? []).reduce(
      (sum, row) => sum + Number(row.total_amount),
      0
    );

    return {
      totalValue,
      draft: draft.count ?? 0,
      completed: completed.count ?? 0,
      cancelled: cancelled.count ?? 0,
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

  /**
   * Applies a header patch guarded by an optimistic lock: the update only
   * matches when the stored `version` equals `expectedVersion`. A concurrent
   * write bumps the version (via the `handle_updated_at` trigger), so a stale
   * caller matches no row and gets `null` — the service maps this to a conflict.
   */
  async updateHeader(
    id: string,
    patch: Partial<DbPurchaseReturn>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<PurchaseReturn | null> {
    const { data, error } = await this.supabase
      .from("purchase_returns")
      .update({
        ...patch,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("version", expectedVersion)
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

  /**
   * Completes a return atomically via the `complete_purchase_return` Postgres
   * function: in a single transaction it writes a negative `purchase_return`
   * stock event per line (reusing `adjust_stock`), appends the supplier-ledger
   * debit (running_balance = last − total) and flips the status to `completed`.
   * Raises messages containing `not_found`, `invalid_status`,
   * `insufficient_stock` or `validation`.
   */
  async completeReturnRpc(returnId: string): Promise<RpcResult<null>> {
    const { error } = await this.supabase.rpc("complete_purchase_return", {
      p_return_id: returnId,
    });
    return { data: null, error };
  }
}
