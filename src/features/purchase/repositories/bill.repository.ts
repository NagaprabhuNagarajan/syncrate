import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Bill,
  BillItem,
  BillListItem,
  BillListParams,
  BillListResult,
  BillStats,
  BillStatus,
  BillWithItems,
  OutstandingBillSummary,
} from "@/features/purchase/types/bill.types";

type DbBill =
  Database["public"]["Tables"]["purchase_invoices"]["Row"];
type DbBillInsert =
  Database["public"]["Tables"]["purchase_invoices"]["Insert"];
type DbBillItem =
  Database["public"]["Tables"]["purchase_invoice_items"]["Row"];
type DbBillItemInsert =
  Database["public"]["Tables"]["purchase_invoice_items"]["Insert"];

/** A list row enriched with the joined supplier name from `suppliers(name)`. */
type DbBillListRow = DbBill & {
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

function mapBill(row: DbBill): Bill {
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

function mapItem(row: DbBillItem): BillItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    billId: row.purchase_invoice_id,
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
  joined: DbBillListRow["suppliers"]
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

export class BillRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<Bill | null> {
    const { data, error } = await this.supabase
      .from("purchase_invoices")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapBill(data);
  }

  async findByNumber(
    organizationId: string,
    invoiceNumber: string
  ): Promise<Bill | null> {
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
    return mapBill(data);
  }

  async findItems(billId: string): Promise<BillItem[]> {
    const { data, error } = await this.supabase
      .from("purchase_invoice_items")
      .select("*")
      .eq("purchase_invoice_id", billId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapItem);
  }

  async findWithItems(id: string): Promise<BillWithItems | null> {
    const header = await this.findById(id);
    if (!header) {
      return null;
    }
    const items = await this.findItems(id);
    return { ...header, items };
  }

  async list(
    organizationId: string,
    params: BillListParams = {}
  ): Promise<BillListResult> {
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

    if (params.paymentStatus) {
      // The stored `payment_status` generated column only knows
      // paid/partial/unpaid. "overdue" is time-dependent (due_date vs today),
      // so it is layered on with an explicit due_date condition — kept
      // consistent with the badge's `deriveBillPaymentStatus` (overdue wins).
      const today = new Date().toISOString().slice(0, 10);
      if (params.paymentStatus === "overdue") {
        query = query
          .eq("status", "posted")
          .neq("payment_status", "paid")
          .lt("due_date", today);
      } else if (params.paymentStatus === "paid") {
        query = query.eq("payment_status", "paid");
      } else {
        // unpaid | partial — exact match, but EXCLUDE rows the badge would show
        // as overdue (posted + past-due + still owing), so the two agree.
        query = query
          .eq("payment_status", params.paymentStatus)
          .or(`status.neq.posted,due_date.is.null,due_date.gte.${today}`);
      }
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

    const rows = data as unknown as DbBillListRow[];
    return {
      items: rows.map((row) => ({
        ...mapBill(row),
        supplierName: readSupplierName(row.suppliers),
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  /** Bills linked to a purchase order, newest first. */
  async findByPurchaseOrder(
    purchaseOrderId: string
  ): Promise<BillListItem[]> {
    const { data, error } = await this.supabase
      .from("purchase_invoices")
      .select("*, suppliers(name)")
      .eq("purchase_order_id", purchaseOrderId)
      .is("deleted_at", null)
      .order("invoice_date", { ascending: false });

    if (error || !data) {
      return [];
    }

    const rows = data as unknown as DbBillListRow[];
    return rows.map((row) => ({
      ...mapBill(row),
      supplierName: readSupplierName(row.suppliers),
    }));
  }

  /**
   * Aggregate counts + total value for the list header tiles. Head-only count
   * queries run in parallel for the status-group tiles; `totalValue` needs a
   * sum, which PostgREST cannot compute server-side via a head query, so we
   * fetch the minimal `total_amount` column for non-cancelled invoices and
   * reduce it in JS. `overdue` similarly can't compare two columns
   * (`due_date` vs today, `amount_paid` vs `total_amount`) in a single
   * head-count query, so we fetch the minimal columns for posted invoices
   * past their due date and reduce in JS.
   */
  async getStats(organizationId: string): Promise<BillStats> {
    const base = () =>
      this.supabase
        .from("purchase_invoices")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .is("deleted_at", null);

    const [draft, posted] = await Promise.all([
      base().eq("status", "draft"),
      base().eq("status", "posted"),
    ]);

    const { data: valueRows } = await this.supabase
      .from("purchase_invoices")
      .select("total_amount")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("status", "cancelled");

    const totalValue = (valueRows ?? []).reduce(
      (sum, row) => sum + Number(row.total_amount),
      0
    );

    const today = new Date().toISOString().slice(0, 10);
    const { data: overdueRows } = await this.supabase
      .from("purchase_invoices")
      .select("total_amount, amount_paid")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq("status", "posted")
      .lt("due_date", today);

    const overdue = (overdueRows ?? []).filter(
      (row) => Number(row.amount_paid) < Number(row.total_amount)
    ).length;

    return {
      totalValue,
      draft: draft.count ?? 0,
      posted: posted.count ?? 0,
      overdue,
    };
  }

  /**
   * Lists a single supplier's bills that still carry a balance due, for the
   * make-payment "settle outstanding" picker. A bill only accrues a balance
   * once posted (drafts have no ledger impact and cancelled bills are void),
   * so this filters to `status = 'posted'` on non-deleted bills, then keeps
   * only rows where `total_amount − amount_paid > 0`. Ordered by bill date
   * (oldest first) so the earliest dues surface first.
   */
  async listOutstandingBySupplier(
    organizationId: string,
    supplierId: string
  ): Promise<OutstandingBillSummary[]> {
    const { data, error } = await this.supabase
      .from("purchase_invoices")
      .select("id, invoice_number, invoice_date, total_amount, amount_paid")
      .eq("organization_id", organizationId)
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .eq("status", "posted")
      .order("invoice_date", { ascending: true });

    if (error || !data) {
      return [];
    }

    const summaries: OutstandingBillSummary[] = [];
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

  async createHeader(
    input: DbBillInsert
  ): Promise<Bill | null> {
    const { data, error } = await this.supabase
      .from("purchase_invoices")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapBill(data);
  }

  async insertItems(items: DbBillItemInsert[]): Promise<boolean> {
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
    billId: string,
    items: DbBillItemInsert[]
  ): Promise<boolean> {
    const { error: deleteError } = await this.supabase
      .from("purchase_invoice_items")
      .delete()
      .eq("purchase_invoice_id", billId);

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
    patch: Partial<DbBill>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<Bill | null> {
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
    return mapBill(data);
  }

  /** Transitions a bill to a new status. */
  async updateStatus(
    id: string,
    status: BillStatus,
    userId: string
  ): Promise<Bill | null> {
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
    return mapBill(data);
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
