import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Quotation,
  QuotationItem,
  QuotationListParams,
  QuotationListResult,
  QuotationStatus,
  QuotationWithItems,
} from "@/features/sales/types/quotation.types";

type DbQuotation = Database["public"]["Tables"]["quotations"]["Row"];
type DbQuotationInsert = Database["public"]["Tables"]["quotations"]["Insert"];
type DbQuotationItem = Database["public"]["Tables"]["quotation_items"]["Row"];
type DbQuotationItemInsert =
  Database["public"]["Tables"]["quotation_items"]["Insert"];

/** A list row enriched with the joined customer name from `customers(name)`. */
type DbQuotationListRow = DbQuotation & {
  customers: { name: string } | { name: string }[] | null;
};

/**
 * Outcome of an optimistically-locked header update:
 *   - `ok`       → the row was updated (returns the new state),
 *   - `conflict` → the row exists but its version moved on (no write happened),
 *   - `error`    → the write failed for another reason.
 */
export type UpdateQuotationHeaderResult =
  | { readonly status: "ok"; readonly quotation: Quotation }
  | { readonly status: "conflict" }
  | { readonly status: "error" };

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapQuotation(row: DbQuotation): Quotation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    quotationNumber: row.quotation_number,
    customerId: row.customer_id,
    branchId: row.branch_id,
    salespersonId: row.salesperson_id,
    referenceNumber: row.reference_number,
    quotationDate: new Date(row.quotation_date),
    expiryDate: row.expiry_date ? new Date(row.expiry_date) : null,
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
    convertedSoId: row.converted_so_id,
    convertedInvId: row.converted_inv_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    version: Number(row.version),
  };
}

function mapItem(row: DbQuotationItem): QuotationItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    quotationId: row.quotation_id,
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
  joined: DbQuotationListRow["customers"]
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

export class QuotationRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<Quotation | null> {
    const { data, error } = await this.supabase
      .from("quotations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapQuotation(data);
  }

  async findItems(quotationId: string): Promise<QuotationItem[]> {
    const { data, error } = await this.supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapItem);
  }

  async findWithItems(id: string): Promise<QuotationWithItems | null> {
    const header = await this.findById(id);
    if (!header) {
      return null;
    }
    const items = await this.findItems(id);
    return { ...header, items };
  }

  async list(
    organizationId: string,
    params: QuotationListParams = {}
  ): Promise<QuotationListResult> {
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
      .from("quotations")
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
        query = query.ilike("quotation_number", `%${term}%`);
      }
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    const rows = data as unknown as DbQuotationListRow[];
    return {
      items: rows.map((row) => ({
        ...mapQuotation(row),
        customerName: readCustomerName(row.customers),
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async createHeader(input: DbQuotationInsert): Promise<Quotation | null> {
    const { data, error } = await this.supabase
      .from("quotations")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapQuotation(data);
  }

  async insertItems(items: DbQuotationItemInsert[]): Promise<boolean> {
    if (items.length === 0) {
      return true;
    }
    const { error } = await this.supabase
      .from("quotation_items")
      .insert(items);
    return !error;
  }

  /** Deletes all existing items for a draft quotation, then inserts the new set. */
  async replaceItems(
    quotationId: string,
    items: DbQuotationItemInsert[]
  ): Promise<boolean> {
    const { error: deleteError } = await this.supabase
      .from("quotation_items")
      .delete()
      .eq("quotation_id", quotationId);

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
    patch: Partial<DbQuotation>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<UpdateQuotationHeaderResult> {
    const { data, error } = await this.supabase
      .from("quotations")
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
    return { status: "ok", quotation: mapQuotation(data) };
  }

  /**
   * Transitions a quotation to a new status. When `markConverted` is true the
   * `converted_so_id` is stamped on the row.
   */
  async updateStatus(
    id: string,
    status: QuotationStatus,
    userId: string,
    convertedSoId?: string
  ): Promise<Quotation | null> {
    const now = new Date().toISOString();
    const patch: Partial<DbQuotation> = {
      status,
      updated_by: userId,
      updated_at: now,
    };
    if (convertedSoId) {
      patch.converted_so_id = convertedSoId;
    }

    const { data, error } = await this.supabase
      .from("quotations")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapQuotation(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("quotations")
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
