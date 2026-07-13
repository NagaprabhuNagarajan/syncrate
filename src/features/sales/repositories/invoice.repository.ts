import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Invoice,
  InvoiceItem,
  InvoiceListItem,
  InvoiceListParams,
  InvoiceListResult,
  InvoiceStats,
  InvoiceStatus,
  InvoiceWithItems,
  OutstandingInvoiceSummary,
} from "@/features/sales/types/invoice.types";

type DbInvoice = Database["public"]["Tables"]["invoices"]["Row"];
type DbInvoiceInsert = Database["public"]["Tables"]["invoices"]["Insert"];
type DbInvoiceItem = Database["public"]["Tables"]["invoice_items"]["Row"];
type DbInvoiceItemInsert =
  Database["public"]["Tables"]["invoice_items"]["Insert"];

/** A list row enriched with the joined customer name from `customers(name)`. */
type DbInvoiceListRow = DbInvoice & {
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

function mapInvoice(row: DbInvoice): Invoice {
  return {
    id: row.id,
    organizationId: row.organization_id,
    invoiceNumber: row.invoice_number,
    invoiceType: row.invoice_type,
    customerId: row.customer_id,
    salesOrderId: row.sales_order_id,
    branchId: row.branch_id,
    salespersonId: row.salesperson_id,
    referenceNumber: row.reference_number,
    invoiceDate: new Date(row.invoice_date),
    dueDate: row.due_date ? new Date(row.due_date) : null,
    paymentTermsDays: Number(row.payment_terms_days),
    supplyState: row.supply_state,
    isInterstate: row.is_interstate,
    status: row.status,
    paymentStatus: row.payment_status,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    cgstAmount: Number(row.cgst_amount),
    sgstAmount: Number(row.sgst_amount),
    igstAmount: Number(row.igst_amount),
    taxAmount: Number(row.tax_amount),
    roundOff: Number(row.round_off),
    totalAmount: Number(row.total_amount),
    amountPaid: Number(row.amount_paid),
    notes: row.notes,
    terms: row.terms,
    postedAt: row.posted_at ? new Date(row.posted_at) : null,
    postedBy: row.posted_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    version: row.version,
  };
}

function mapItem(row: DbInvoiceItem): InvoiceItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    invoiceId: row.invoice_id,
    productId: row.product_id,
    description: row.description,
    hsnCode: row.hsn_code,
    quantity: Number(row.quantity),
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
  joined: DbInvoiceListRow["customers"]
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

export class InvoiceRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<Invoice | null> {
    const { data, error } = await this.supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapInvoice(data);
  }

  async findByNumber(
    organizationId: string,
    invoiceNumber: string
  ): Promise<Invoice | null> {
    const { data, error } = await this.supabase
      .from("invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("invoice_number", invoiceNumber.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapInvoice(data);
  }

  async findItems(invoiceId: string): Promise<InvoiceItem[]> {
    const { data, error } = await this.supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapItem);
  }

  async findWithItems(id: string): Promise<InvoiceWithItems | null> {
    const header = await this.findById(id);
    if (!header) {
      return null;
    }
    const items = await this.findItems(id);
    return { ...header, items };
  }

  async list(
    organizationId: string,
    params: InvoiceListParams = {}
  ): Promise<InvoiceListResult> {
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
      .from("invoices")
      .select("*, customers(name)", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.paymentStatus) {
      // Invoices carry a real `payment_status` column (unpaid/partial/paid);
      // 'overdue' is never written, so it is derived here from due_date vs
      // today — kept consistent with the payment badge (overdue wins over
      // unpaid/partial for posted, past-due, still-owing invoices).
      const today = new Date().toISOString().slice(0, 10);
      if (params.paymentStatus === "overdue") {
        query = query
          .eq("status", "posted")
          .neq("payment_status", "paid")
          .lt("due_date", today);
      } else if (params.paymentStatus === "paid") {
        query = query.eq("payment_status", "paid");
      } else {
        // unpaid | partial — exact match, EXCLUDING rows shown as overdue.
        query = query
          .eq("payment_status", params.paymentStatus)
          .or(`status.neq.posted,due_date.is.null,due_date.gte.${today}`);
      }
    }

    if (params.customerId) {
      query = query.eq("customer_id", params.customerId);
    }

    if (params.dateFrom) {
      query = query.gte("invoice_date", params.dateFrom);
    }

    if (params.dateTo) {
      query = query.lte("invoice_date", params.dateTo);
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

    const rows = data as unknown as DbInvoiceListRow[];
    return {
      items: rows.map((row) => ({
        ...mapInvoice(row),
        customerName: readCustomerName(row.customers),
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  /**
   * Aggregate counts + money sums for the list header tiles. Head-only count
   * queries run in parallel for the status tiles. The money aggregates need
   * sums PostgREST cannot compute server-side via head queries, so we fetch
   * the minimal `total_amount`/`amount_paid` columns for non-cancelled
   * invoices and reduce in JS. `overdue` similarly compares two columns
   * (`due_date` vs today, and balance due), so we fetch the minimal columns
   * for posted invoices past their due date and reduce in JS.
   */
  async getStats(organizationId: string): Promise<InvoiceStats> {
    const base = () =>
      this.supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .is("deleted_at", null);

    const [total, draft, posted, cancelled] = await Promise.all([
      base(),
      base().eq("status", "draft"),
      base().eq("status", "posted"),
      base().eq("status", "cancelled"),
    ]);

    const { data: valueRows } = await this.supabase
      .from("invoices")
      .select("total_amount, amount_paid")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("status", "cancelled");

    let totalInvoiced = 0;
    let outstanding = 0;
    let paid = 0;
    for (const row of valueRows ?? []) {
      const totalAmount = Number(row.total_amount);
      const amountPaid = Number(row.amount_paid);
      totalInvoiced += totalAmount;
      outstanding += totalAmount - amountPaid;
      paid += amountPaid;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: overdueRows } = await this.supabase
      .from("invoices")
      .select("total_amount, amount_paid")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq("status", "posted")
      .lt("due_date", today);

    const overdue = (overdueRows ?? []).reduce(
      (sum, row) =>
        sum + Math.max(0, Number(row.total_amount) - Number(row.amount_paid)),
      0
    );

    return {
      total: total.count ?? 0,
      draft: draft.count ?? 0,
      posted: posted.count ?? 0,
      cancelled: cancelled.count ?? 0,
      totalInvoiced,
      outstanding,
      overdue,
      paid,
    };
  }

  /** Invoices linked to a sales order, newest first. */
  async findBySalesOrder(salesOrderId: string): Promise<InvoiceListItem[]> {
    const { data, error } = await this.supabase
      .from("invoices")
      .select("*, customers(name)")
      .eq("sales_order_id", salesOrderId)
      .is("deleted_at", null)
      .order("invoice_date", { ascending: false });

    if (error || !data) {
      return [];
    }

    const rows = data as unknown as DbInvoiceListRow[];
    return rows.map((row) => ({
      ...mapInvoice(row),
      customerName: readCustomerName(row.customers),
    }));
  }

  /**
   * Lists a single customer's invoices that still carry a balance due, for the
   * record-payment "settle outstanding" picker. Filters to POSTED invoices only
   * (drafts aren't payable, cancelled are void) with unsettled payment statuses
   * (`unpaid`/`partial`/`overdue`) that are non-deleted, then keeps only rows
   * where `total_amount − amount_paid > 0`. Ordered by invoice date (oldest
   * first) so the earliest debts surface first.
   */
  async listOutstandingByCustomer(
    organizationId: string,
    customerId: string
  ): Promise<OutstandingInvoiceSummary[]> {
    const { data, error } = await this.supabase
      .from("invoices")
      .select(
        "id, invoice_number, invoice_date, total_amount, amount_paid"
      )
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .eq("status", "posted")
      .in("payment_status", ["unpaid", "partial", "overdue"])
      .order("invoice_date", { ascending: true });

    if (error || !data) {
      return [];
    }

    const summaries: OutstandingInvoiceSummary[] = [];
    for (const row of data) {
      const totalAmount = Number(row.total_amount);
      const amountPaid = Number(row.amount_paid);
      const outstandingAmount = totalAmount - amountPaid;
      if (outstandingAmount > 0) {
        summaries.push({
          id: row.id,
          invoiceNumber: row.invoice_number,
          invoiceDate: row.invoice_date,
          totalAmount,
          amountPaid,
          outstandingAmount,
        });
      }
    }
    return summaries;
  }

  async createHeader(input: DbInvoiceInsert): Promise<Invoice | null> {
    const { data, error } = await this.supabase
      .from("invoices")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapInvoice(data);
  }

  async insertItems(items: DbInvoiceItemInsert[]): Promise<boolean> {
    if (items.length === 0) {
      return true;
    }
    const { error } = await this.supabase.from("invoice_items").insert(items);
    return !error;
  }

  /** Deletes all existing items for a draft invoice, then inserts the new set. */
  async replaceItems(
    invoiceId: string,
    items: DbInvoiceItemInsert[]
  ): Promise<boolean> {
    const { error: deleteError } = await this.supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", invoiceId);

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
    patch: Partial<DbInvoice>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<Invoice | null> {
    const { data, error } = await this.supabase
      .from("invoices")
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
    return mapInvoice(data);
  }

  /** Transitions an invoice to a new status. */
  async updateStatus(
    id: string,
    status: InvoiceStatus,
    userId: string
  ): Promise<Invoice | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("invoices")
      .update({ status, updated_by: userId, updated_at: now })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapInvoice(data);
  }

  /**
   * Posts an invoice atomically via the `post_sales_invoice` Postgres function:
   * in a single transaction it stamps the invoice posted (posted_at/posted_by)
   * AND appends the customer-ledger debit (receivable increases). Raises
   * messages containing `not_found` or `invalid_status`.
   */
  async postInvoiceRpc(invoiceId: string): Promise<RpcResult<null>> {
    const { error } = await this.supabase.rpc("post_sales_invoice", {
      p_invoice_id: invoiceId,
    });
    return { data: null, error };
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("invoices")
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
