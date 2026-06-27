import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  SalesReturn,
  SalesReturnItem,
  SalesReturnListParams,
  SalesReturnListResult,
  SalesReturnStatus,
  SalesReturnWithItems,
} from "@/features/sales/types/sales-return.types";

type DbSalesReturn = Database["public"]["Tables"]["sales_returns"]["Row"];
type DbSalesReturnInsert =
  Database["public"]["Tables"]["sales_returns"]["Insert"];
type DbSalesReturnItem =
  Database["public"]["Tables"]["sales_return_items"]["Row"];
type DbSalesReturnItemInsert =
  Database["public"]["Tables"]["sales_return_items"]["Insert"];

/** A list row enriched with the joined customer name from `customers(name)`. */
type DbSalesReturnListRow = DbSalesReturn & {
  customers: { name: string } | { name: string }[] | null;
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

function mapSalesReturn(row: DbSalesReturn): SalesReturn {
  return {
    id: row.id,
    organizationId: row.organization_id,
    returnNumber: row.return_number,
    invoiceId: row.invoice_id,
    customerId: row.customer_id,
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
    version: row.version,
  };
}

function mapItem(row: DbSalesReturnItem): SalesReturnItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    salesReturnId: row.sales_return_id,
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

function readCustomerName(
  joined: DbSalesReturnListRow["customers"]
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

export class SalesReturnRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<SalesReturn | null> {
    const { data, error } = await this.supabase
      .from("sales_returns")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSalesReturn(data);
  }

  async findByNumber(
    organizationId: string,
    returnNumber: string
  ): Promise<SalesReturn | null> {
    const { data, error } = await this.supabase
      .from("sales_returns")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("return_number", returnNumber.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSalesReturn(data);
  }

  async findItems(salesReturnId: string): Promise<SalesReturnItem[]> {
    const { data, error } = await this.supabase
      .from("sales_return_items")
      .select("*")
      .eq("sales_return_id", salesReturnId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapItem);
  }

  async findWithItems(id: string): Promise<SalesReturnWithItems | null> {
    const header = await this.findById(id);
    if (!header) {
      return null;
    }
    const items = await this.findItems(id);
    return { ...header, items };
  }

  async list(
    organizationId: string,
    params: SalesReturnListParams = {}
  ): Promise<SalesReturnListResult> {
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
      .from("sales_returns")
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
        query = query.ilike("return_number", `%${term}%`);
      }
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    const rows = data as unknown as DbSalesReturnListRow[];
    return {
      items: rows.map((row) => ({
        ...mapSalesReturn(row),
        customerName: readCustomerName(row.customers),
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async createHeader(
    input: DbSalesReturnInsert
  ): Promise<SalesReturn | null> {
    const { data, error } = await this.supabase
      .from("sales_returns")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapSalesReturn(data);
  }

  async insertItems(items: DbSalesReturnItemInsert[]): Promise<boolean> {
    if (items.length === 0) {
      return true;
    }
    const { error } = await this.supabase
      .from("sales_return_items")
      .insert(items);
    return !error;
  }

  /** Deletes all existing items for a draft return, then inserts the new set. */
  async replaceItems(
    salesReturnId: string,
    items: DbSalesReturnItemInsert[]
  ): Promise<boolean> {
    const { error: deleteError } = await this.supabase
      .from("sales_return_items")
      .delete()
      .eq("sales_return_id", salesReturnId);

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
    patch: Partial<DbSalesReturn>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<SalesReturn | null> {
    const { data, error } = await this.supabase
      .from("sales_returns")
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
    return mapSalesReturn(data);
  }

  /** Transitions a sales return to a new status. */
  async updateStatus(
    id: string,
    status: SalesReturnStatus,
    userId: string
  ): Promise<SalesReturn | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("sales_returns")
      .update({ status, updated_by: userId, updated_at: now })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapSalesReturn(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("sales_returns")
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
   * Completes a return atomically via the `complete_sales_return` Postgres
   * function: in a single transaction it writes positive `sales_return` stock
   * events per line (goods return to warehouse), credits the customer ledger
   * (reduces receivable), auto-generates a credit note, and flips the status
   * to `completed`. Raises messages containing `not_found`, `invalid_status`,
   * `insufficient_stock` or `validation`.
   */
  async completeReturnRpc(returnId: string): Promise<RpcResult<null>> {
    const { error } = await this.supabase.rpc("complete_sales_return", {
      p_return_id: returnId,
    });
    return { data: null, error };
  }
}
