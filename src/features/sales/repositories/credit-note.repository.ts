import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  CreditNote,
  CreditNoteListParams,
  CreditNoteListResult,
} from "@/features/sales/types/credit-note.types";

type DbCreditNote = Database["public"]["Tables"]["credit_notes"]["Row"];

/** A list row enriched with the joined customer name from `customers(name)`. */
type DbCreditNoteListRow = DbCreditNote & {
  customers: { name: string } | { name: string }[] | null;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapCreditNote(row: DbCreditNote): CreditNote {
  return {
    id: row.id,
    organizationId: row.organization_id,
    creditNoteNumber: row.credit_note_number,
    customerId: row.customer_id,
    invoiceId: row.invoice_id,
    salesReturnId: row.sales_return_id,
    issueDate: new Date(row.issue_date),
    reason: row.reason,
    amount: Number(row.amount),
    status: row.status,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function readCustomerName(
  joined: DbCreditNoteListRow["customers"]
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

export class CreditNoteRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<CreditNote | null> {
    const { data, error } = await this.supabase
      .from("credit_notes")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapCreditNote(data);
  }

  async list(
    organizationId: string,
    params: CreditNoteListParams = {}
  ): Promise<CreditNoteListResult> {
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
      .from("credit_notes")
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
        query = query.ilike("credit_note_number", `%${term}%`);
      }
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    const rows = data as unknown as DbCreditNoteListRow[];
    return {
      items: rows.map((row) => ({
        ...mapCreditNote(row),
        customerName: readCustomerName(row.customers),
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  }
}
