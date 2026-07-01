import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Customer,
  CustomerLedgerEntry,
  CustomerListParams,
  CustomerListResult,
  CustomerStats,
} from "@/features/customer/types/customer.types";

type DbCustomer = Database["public"]["Tables"]["customers"]["Row"];
type DbCustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
type DbLedgerEntry =
  Database["public"]["Tables"]["customer_ledger_entries"]["Row"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapCustomer(row: DbCustomer): Customer {
  return {
    id: row.id,
    organizationId: row.organization_id,
    code: row.code,
    name: row.name,
    company: row.company,
    gstNumber: row.gst_number,
    panNumber: row.pan_number,
    mobile: row.mobile,
    email: row.email,
    website: row.website,
    billingAddressLine1: row.billing_address_line1,
    billingAddressLine2: row.billing_address_line2,
    billingCity: row.billing_city,
    billingState: row.billing_state,
    billingPincode: row.billing_pincode,
    billingCountry: row.billing_country,
    shippingAddressLine1: row.shipping_address_line1,
    shippingAddressLine2: row.shipping_address_line2,
    shippingCity: row.shipping_city,
    shippingState: row.shipping_state,
    shippingPincode: row.shipping_pincode,
    shippingCountry: row.shipping_country,
    creditLimit: Number(row.credit_limit),
    paymentTermsDays: row.payment_terms_days,
    preferredPaymentMethod: row.preferred_payment_method,
    openingBalance: Number(row.opening_balance),
    status: row.status,
    tags: row.tags,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function mapLedgerEntry(row: DbLedgerEntry): CustomerLedgerEntry {
  return {
    id: row.id,
    customerId: row.customer_id,
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

export class CustomerRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<Customer | null> {
    // No deleted_at constraint: archived customers are soft-deleted but must
    // remain viewable and editable (e.g. to restore them).
    const { data, error } = await this.supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }
    return mapCustomer(data);
  }

  async findByCode(
    organizationId: string,
    code: string
  ): Promise<Customer | null> {
    const { data, error } = await this.supabase
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("code", code.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapCustomer(data);
  }

  async findByGst(
    organizationId: string,
    gstNumber: string
  ): Promise<Customer | null> {
    const { data, error } = await this.supabase
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("gst_number", gstNumber.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapCustomer(data);
  }

  async list(
    organizationId: string,
    params: CustomerListParams = {}
  ): Promise<CustomerListResult> {
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
      .from("customers")
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
          `name.ilike.%${term}%,company.ilike.%${term}%,code.ilike.%${term}%,mobile.ilike.%${term}%,email.ilike.%${term}%`
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
      items: data.map(mapCustomer),
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
  async getStats(organizationId: string): Promise<CustomerStats> {
    const base = () =>
      this.supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [total, active, blacklisted, newThisMonth] = await Promise.all([
      base(),
      base().eq("status", "active"),
      base().eq("status", "blacklisted"),
      base().gte("created_at", monthStart.toISOString()),
    ]);

    return {
      total: total.count ?? 0,
      active: active.count ?? 0,
      blacklisted: blacklisted.count ?? 0,
      newThisMonth: newThisMonth.count ?? 0,
    };
  }

  /**
   * Fetches every non-deleted customer for an organization, ordered by name.
   * Pages through results so exports are not capped by the PostgREST row limit.
   */
  async findAllForExport(organizationId: string): Promise<Customer[]> {
    const pageSize = 1000;
    const all: Customer[] = [];
    let from = 0;

    for (;;) {
      const { data, error } = await this.supabase
        .from("customers")
        .select("*")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error || !data || data.length === 0) {
        break;
      }

      all.push(...data.map(mapCustomer));

      if (data.length < pageSize) {
        break;
      }
      from += pageSize;
    }

    return all;
  }

  async create(input: DbCustomerInsert): Promise<Customer | null> {
    const { data, error } = await this.supabase
      .from("customers")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapCustomer(data);
  }

  async update(
    id: string,
    patch: Partial<DbCustomer>,
    updatedBy: string
  ): Promise<Customer | null> {
    const { data, error } = await this.supabase
      .from("customers")
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
    return mapCustomer(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("customers")
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

  async findLedgerEntries(
    customerId: string
  ): Promise<CustomerLedgerEntry[]> {
    const { data, error } = await this.supabase
      .from("customer_ledger_entries")
      .select("*")
      .eq("customer_id", customerId)
      .order("entry_date", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapLedgerEntry);
  }
}
