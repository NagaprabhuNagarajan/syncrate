import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  SerialNumber,
  SerialListParams,
  SerialListResult,
} from "@/features/serial/types/serial.types";

type DbSerial = Database["public"]["Tables"]["serial_numbers"]["Row"];
type DbSerialInsert = Database["public"]["Tables"]["serial_numbers"]["Insert"];

/** Shape of a serial row with the joined product columns. */
type DbSerialWithProduct = DbSerial & {
  products: { name: string; code: string } | null;
};

const SELECT_WITH_PRODUCT = "*, products(name, code)";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapSerial(row: DbSerialWithProduct): SerialNumber {
  return {
    id: row.id,
    organizationId: row.organization_id,
    productId: row.product_id,
    productName: row.products?.name ?? null,
    productCode: row.products?.code ?? null,
    warehouseId: row.warehouse_id,
    batchId: row.batch_id,
    serialNumber: row.serial_number,
    status: row.status,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
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

export class SerialRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<SerialNumber | null> {
    const { data, error } = await this.supabase
      .from("serial_numbers")
      .select(SELECT_WITH_PRODUCT)
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSerial(data as unknown as DbSerialWithProduct);
  }

  async findBySerial(
    organizationId: string,
    serialNumber: string
  ): Promise<SerialNumber | null> {
    const { data, error } = await this.supabase
      .from("serial_numbers")
      .select(SELECT_WITH_PRODUCT)
      .eq("organization_id", organizationId)
      .eq("serial_number", serialNumber.trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSerial(data as unknown as DbSerialWithProduct);
  }

  async list(
    organizationId: string,
    params: SerialListParams = {}
  ): Promise<SerialListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("serial_numbers")
      .select(SELECT_WITH_PRODUCT, { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.productId) {
      query = query.eq("product_id", params.productId);
    }

    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.or(
          `serial_number.ilike.%${term}%,notes.ilike.%${term}%`
        );
      }
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    return {
      items: (data as unknown as DbSerialWithProduct[]).map(mapSerial),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async create(input: DbSerialInsert): Promise<SerialNumber | null> {
    const { data, error } = await this.supabase
      .from("serial_numbers")
      .insert(input)
      .select(SELECT_WITH_PRODUCT)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSerial(data as unknown as DbSerialWithProduct);
  }

  async update(
    id: string,
    patch: Partial<DbSerial>,
    updatedBy: string
  ): Promise<SerialNumber | null> {
    const { data, error } = await this.supabase
      .from("serial_numbers")
      .update({
        ...patch,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select(SELECT_WITH_PRODUCT)
      .single();

    if (error || !data) {
      return null;
    }
    return mapSerial(data as unknown as DbSerialWithProduct);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("serial_numbers")
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
