import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestListParams,
  PurchaseRequestListResult,
  PurchaseRequestStatus,
  PurchaseRequestWithItems,
} from "@/features/purchase/types/purchase-request.types";

type DbPurchaseRequest =
  Database["public"]["Tables"]["purchase_requests"]["Row"];
type DbPurchaseRequestInsert =
  Database["public"]["Tables"]["purchase_requests"]["Insert"];
type DbPurchaseRequestItem =
  Database["public"]["Tables"]["purchase_request_items"]["Row"];
type DbPurchaseRequestItemInsert =
  Database["public"]["Tables"]["purchase_request_items"]["Insert"];

/** A list row enriched with the joined warehouse name from `warehouses(name)`. */
type DbPurchaseRequestListRow = DbPurchaseRequest & {
  warehouses: { name: string } | { name: string }[] | null;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapPurchaseRequest(row: DbPurchaseRequest): PurchaseRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    requestNumber: row.request_number,
    status: row.status,
    warehouseId: row.warehouse_id,
    requiredDate: row.required_date ? new Date(row.required_date) : null,
    notes: row.notes,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? new Date(row.approved_at) : null,
    rejectedReason: row.rejected_reason,
    convertedPoId: row.converted_po_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    version: row.version,
  };
}

function mapItem(row: DbPurchaseRequestItem): PurchaseRequestItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    purchaseRequestId: row.purchase_request_id,
    productId: row.product_id,
    description: row.description,
    quantity: Number(row.quantity),
    estimatedPrice: Number(row.estimated_price),
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
  };
}

function readWarehouseName(
  joined: DbPurchaseRequestListRow["warehouses"]
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

export class PurchaseRequestRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<PurchaseRequest | null> {
    const { data, error } = await this.supabase
      .from("purchase_requests")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseRequest(data);
  }

  async findByNumber(
    organizationId: string,
    requestNumber: string
  ): Promise<PurchaseRequest | null> {
    const { data, error } = await this.supabase
      .from("purchase_requests")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("request_number", requestNumber.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseRequest(data);
  }

  async findItems(purchaseRequestId: string): Promise<PurchaseRequestItem[]> {
    const { data, error } = await this.supabase
      .from("purchase_request_items")
      .select("*")
      .eq("purchase_request_id", purchaseRequestId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapItem);
  }

  async findWithItems(id: string): Promise<PurchaseRequestWithItems | null> {
    const header = await this.findById(id);
    if (!header) {
      return null;
    }
    const items = await this.findItems(id);
    return { ...header, items };
  }

  async list(
    organizationId: string,
    params: PurchaseRequestListParams = {}
  ): Promise<PurchaseRequestListResult> {
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
      .from("purchase_requests")
      .select("*, warehouses(name)", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.ilike("request_number", `%${term}%`);
      }
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    const rows = data as unknown as DbPurchaseRequestListRow[];
    return {
      items: rows.map((row) => ({
        ...mapPurchaseRequest(row),
        warehouseName: readWarehouseName(row.warehouses),
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async createHeader(
    input: DbPurchaseRequestInsert
  ): Promise<PurchaseRequest | null> {
    const { data, error } = await this.supabase
      .from("purchase_requests")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseRequest(data);
  }

  async insertItems(items: DbPurchaseRequestItemInsert[]): Promise<boolean> {
    if (items.length === 0) {
      return true;
    }
    const { error } = await this.supabase
      .from("purchase_request_items")
      .insert(items);
    return !error;
  }

  /** Deletes all existing items for a draft request, then inserts the new set. */
  async replaceItems(
    purchaseRequestId: string,
    items: DbPurchaseRequestItemInsert[]
  ): Promise<boolean> {
    const { error: deleteError } = await this.supabase
      .from("purchase_request_items")
      .delete()
      .eq("purchase_request_id", purchaseRequestId);

    if (deleteError) {
      return false;
    }
    return this.insertItems(items);
  }

  /**
   * Updates the header with OPTIMISTIC LOCKING. The update only matches when
   * the row's `version` still equals `expectedVersion`; the `handle_updated_at`
   * DB trigger increments `version` on every write, so a concurrent update will
   * bump it and this query will match no rows. A null return therefore means
   * either the row is gone or another writer won the race (a version conflict).
   */
  async updateHeader(
    id: string,
    patch: Partial<DbPurchaseRequest>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<PurchaseRequest | null> {
    const { data, error } = await this.supabase
      .from("purchase_requests")
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
    return mapPurchaseRequest(data);
  }

  /**
   * Transitions a purchase request to a new status, optionally stamping the
   * approver (on approve), the rejection reason (on reject) or the converted
   * purchase order id (on convert).
   */
  async updateStatus(
    id: string,
    status: PurchaseRequestStatus,
    userId: string,
    extra: {
      approve?: boolean;
      rejectedReason?: string;
      convertedPoId?: string;
    } = {}
  ): Promise<PurchaseRequest | null> {
    const now = new Date().toISOString();
    const patch: Partial<DbPurchaseRequest> = {
      status,
      updated_by: userId,
      updated_at: now,
    };
    if (extra.approve) {
      patch.approved_by = userId;
      patch.approved_at = now;
    }
    if (extra.rejectedReason !== undefined) {
      patch.rejected_reason = extra.rejectedReason;
    }
    if (extra.convertedPoId !== undefined) {
      patch.converted_po_id = extra.convertedPoId;
    }

    const { data, error } = await this.supabase
      .from("purchase_requests")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapPurchaseRequest(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("purchase_requests")
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
