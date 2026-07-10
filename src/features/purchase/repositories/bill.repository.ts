import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PurchaseInvoiceListParams,
  PurchaseInvoiceListResult,
  PurchaseInvoiceStatus,
  PurchaseInvoiceWithItems,
} from "@/features/purchase/types/purchase-invoice.types";

type DbPurchaseInvoice =
  Database["public"]["Tables"]["purchase_invoices"]["Row"];
type DbPurchaseInvoiceInsert =
  Database["public"]["Tables"]["purchase_invoices"]["Insert"];
type DbPurchaseInvoiceItem =
  Database["public"]["Tables"]["purchase_invoice_items"]["Row"];
type DbPurchaseInvoiceItemInsert =
  Database["public"]["Tables"]["purchase_invoice_items"]["Insert"];

/** A list row enriched with the joined supplier name from `suppliers(name)`. */
type DbPurchaseInvoiceListRow = DbPurchaseInvoice & {
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

function mapPurchaseInvoice(row: DbPurchaseInvoice): PurchaseInvoice {
  return {
    id: row.id,
    organizationId: row.organization_id,
    invoiceNumber: row.invoice_number,
    supplierInvoiceNumber: row.supplier_invoice_number,
    purchaseOrderId: row.purchase_order_id,
    supplierId: row.supplier_id,
    status: row.status,
    invoiceDate: new Date(row.invoice_date),
    dueDate: row.due_date ? new Date(row.due_date) : null,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    taxAmount: Number(row.tax_amount),
    totalAmount: Number(row.total_amount),
    amountPaid: Number(row.amount_paid),
    notes: row.notes,
    postedAt: row.posted_at ? new Date(row.posted_at) : null,
    postedBy: row.posted_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    version: row.version,
  };
}

function mapItem(row: DbPurchaseInvoiceItem): PurchaseInvoiceItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    purchaseInvoiceId: row.purchase_invoice_id,
    productId: row.product_id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    lineTotal: Number(row.line_total),
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
  };
}

function readSupplierName(
  joined: DbPurchaseInvoiceListRow["suppliers"]
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

export class PurchaseInvoiceRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<PurchaseInvoice | null> {
    const { data, error } = await this.supabase
      .from("purchase_invoices")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseInvoice(data);
  }

  async findByNumber(
    organizationId: string,
    invoiceNumber: string
  ): Promise<PurchaseInvoice | null> {
    const { data, error } = await this.supabase
      .from("purchase_invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("invoice_number", invoiceNumber.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseInvoice(data);
  }

  async findItems(purchaseInvoiceId: string): Promise<PurchaseInvoiceItem[]> {
    const { data, error } = await this.supabase
      .from("purchase_invoice_items")
      .select("*")
      .eq("purchase_invoice_id", purchaseInvoiceId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapItem);
  }

  async findWithItems(id: string): Promise<PurchaseInvoiceWithItems | null> {
    const header = await this.findById(id);
    if (!header) {
      return null;
    }
    const items = await this.findItems(id);
    return { ...header, items };
  }

  async list(
    organizationId: string,
    params: PurchaseInvoiceListParams = {}
  ): Promise<PurchaseInvoiceListResult> {
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
      .from("purchase_invoices")
      .select("*, suppliers(name)", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.ilike("invoice_number", `%${term}%`);
      }
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    const rows = data as unknown as DbPurchaseInvoiceListRow[];
    return {
      items: rows.map((row) => ({
        ...mapPurchaseInvoice(row),
        supplierName: readSupplierName(row.suppliers),
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async createHeader(
    input: DbPurchaseInvoiceInsert
  ): Promise<PurchaseInvoice | null> {
    const { data, error } = await this.supabase
      .from("purchase_invoices")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseInvoice(data);
  }

  async insertItems(items: DbPurchaseInvoiceItemInsert[]): Promise<boolean> {
    if (items.length === 0) {
      return true;
    }
    const { error } = await this.supabase
      .from("purchase_invoice_items")
      .insert(items);
    return !error;
  }

  /** Deletes all existing items for a draft invoice, then inserts the new set. */
  async replaceItems(
    purchaseInvoiceId: string,
    items: DbPurchaseInvoiceItemInsert[]
  ): Promise<boolean> {
    const { error: deleteError } = await this.supabase
      .from("purchase_invoice_items")
      .delete()
      .eq("purchase_invoice_id", purchaseInvoiceId);

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
    patch: Partial<DbPurchaseInvoice>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<PurchaseInvoice | null> {
    const { data, error } = await this.supabase
      .from("purchase_invoices")
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
    return mapPurchaseInvoice(data);
  }

  /** Transitions a purchase invoice to a new status. */
  async updateStatus(
    id: string,
    status: PurchaseInvoiceStatus,
    userId: string
  ): Promise<PurchaseInvoice | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("purchase_invoices")
      .update({ status, updated_by: userId, updated_at: now })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseInvoice(data);
  }

  /**
   * Posts an invoice atomically via the `post_purchase_invoice` Postgres
   * function: in a single transaction it stamps the invoice posted
   * (posted_at/posted_by) AND appends the supplier-ledger credit
   * (running_balance = last + total). Raises messages containing `not_found`
   * or `invalid_status`.
   */
  async postInvoiceRpc(invoiceId: string): Promise<RpcResult<null>> {
    const { error } = await this.supabase.rpc("post_purchase_invoice", {
      p_invoice_id: invoiceId,
    });
    return { data: null, error };
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("purchase_invoices")
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
