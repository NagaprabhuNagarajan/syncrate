import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Supplier,
  SupplierLedgerEntry,
  SupplierListParams,
  SupplierListResult,
  SupplierStats,
} from "@/features/supplier/types/supplier.types";

type DbSupplier = Database["public"]["Tables"]["suppliers"]["Row"];
type DbSupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];
type DbLedgerEntry =
  Database["public"]["Tables"]["supplier_ledger_entries"]["Row"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapSupplier(row: DbSupplier): Supplier {
  return {
    id: row.id,
    organizationId: row.organization_id,
    code: row.code,
    name: row.name,
    contactPerson: row.contact_person,
    gstNumber: row.gst_number,
    panNumber: row.pan_number,
    mobile: row.mobile,
    email: row.email,
    website: row.website,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    country: row.country,
    bankAccountName: row.bank_account_name,
    bankAccountNumber: row.bank_account_number,
    bankIfsc: row.bank_ifsc,
    bankName: row.bank_name,
    upiId: row.upi_id,
    paymentTermsDays: row.payment_terms_days,
    openingBalance: Number(row.opening_balance),
    rating: row.rating === null ? null : Number(row.rating),
    status: row.status,
    tags: row.tags,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function mapLedgerEntry(row: DbLedgerEntry): SupplierLedgerEntry {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    entryDate: new Date(row.entry_date),
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    description: row.description,
    debit: Number(row.debit),
    credit: Number(row.credit),
    runningBalance: Number(row.running_balance),
    createdAt: new Date(row.created_at),
  };
}

/**
 * Escapes characters that have meaning inside a PostgREST `or()` filter
 * (comma, parentheses) and the ILIKE wildcards, to keep search safe.
 */
function sanitizeSearch(term: string): string {
  return term.trim().replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class SupplierRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<Supplier | null> {
    // No deleted_at constraint: archived suppliers are soft-deleted but must
    // remain viewable and editable (e.g. to restore them).
    const { data, error } = await this.supabase
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSupplier(data);
  }

  async findByCode(
    organizationId: string,
    code: string
  ): Promise<Supplier | null> {
    const { data, error } = await this.supabase
      .from("suppliers")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("code", code.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSupplier(data);
  }

  async findByGst(
    organizationId: string,
    gstNumber: string
  ): Promise<Supplier | null> {
    const { data, error } = await this.supabase
      .from("suppliers")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("gst_number", gstNumber.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSupplier(data);
  }

  async list(
    organizationId: string,
    params: SupplierListParams = {}
  ): Promise<SupplierListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sortBy = params.sortBy ?? "name";
    const ascending = (params.sortDir ?? "asc") === "asc";

    let query = this.supabase
      .from("suppliers")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId);

    // Archiving is the only soft-delete path (it sets both status="archived"
    // and deleted_at), so the status column alone fully describes a record.
    // A specific status filter matches on status; the "All" view (no status)
    // returns every record — including archived — by not constraining
    // deleted_at.
    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.or(
          `name.ilike.%${term}%,contact_person.ilike.%${term}%,code.ilike.%${term}%,mobile.ilike.%${term}%,email.ilike.%${term}%`
        );
      }
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    return {
      items: data.map(mapSupplier),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  /**
   * Aggregate counts for the list header tiles. Runs the counts in parallel as
   * head-only queries (no rows transferred). "Total" counts every record —
   * including archived — to match the list's "All" view.
   */
  async getStats(organizationId: string): Promise<SupplierStats> {
    const base = () =>
      this.supabase
        .from("suppliers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [total, active, inactive, newThisMonth] = await Promise.all([
      base(),
      base().eq("status", "active"),
      base().eq("status", "inactive"),
      base().gte("created_at", monthStart.toISOString()),
    ]);

    return {
      total: total.count ?? 0,
      active: active.count ?? 0,
      inactive: inactive.count ?? 0,
      newThisMonth: newThisMonth.count ?? 0,
    };
  }

  /** Fetches every non-deleted supplier for an org, ordered by name (for export). */
  async findAllForExport(organizationId: string): Promise<Supplier[]> {
    const { data, error } = await this.supabase
      .from("suppliers")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapSupplier);
  }

  async create(input: DbSupplierInsert): Promise<Supplier | null> {
    const { data, error } = await this.supabase
      .from("suppliers")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapSupplier(data);
  }

  async update(
    id: string,
    patch: Partial<DbSupplier>,
    updatedBy: string
  ): Promise<Supplier | null> {
    const { data, error } = await this.supabase
      .from("suppliers")
      .update({
        ...patch,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapSupplier(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("suppliers")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    return !error;
  }

  /** Restores an archived (soft-deleted) supplier back to active. */
  async restore(id: string, restoredBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("suppliers")
      .update({
        deleted_at: null,
        deleted_by: null,
        status: "active",
        updated_by: restoredBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return !error;
  }

  async findLedgerEntries(supplierId: string): Promise<SupplierLedgerEntry[]> {
    const { data, error } = await this.supabase
      .from("supplier_ledger_entries")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("entry_date", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapLedgerEntry);
  }
}
