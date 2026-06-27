import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Warehouse,
  WarehouseListParams,
  WarehouseListResult,
  WarehouseOption,
} from "@/features/warehouse/types/warehouse.types";

type DbWarehouse = Database["public"]["Tables"]["warehouses"]["Row"];
type DbWarehouseInsert = Database["public"]["Tables"]["warehouses"]["Insert"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapWarehouse(row: DbWarehouse): Warehouse {
  return {
    id: row.id,
    organizationId: row.organization_id,
    branchId: row.branch_id,
    code: row.code,
    name: row.name,
    addressLine1: row.address_line1,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    capacity: row.capacity === null ? null : Number(row.capacity),
    isDefault: row.is_default,
    status: row.status,
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

export class WarehouseRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<Warehouse | null> {
    const { data, error } = await this.supabase
      .from("warehouses")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapWarehouse(data);
  }

  async findByCode(
    organizationId: string,
    code: string
  ): Promise<Warehouse | null> {
    const { data, error } = await this.supabase
      .from("warehouses")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("code", code.toUpperCase().trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapWarehouse(data);
  }

  async list(
    organizationId: string,
    params: WarehouseListParams = {}
  ): Promise<WarehouseListResult> {
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
      .from("warehouses")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.or(
          `name.ilike.%${term}%,code.ilike.%${term}%,city.ilike.%${term}%`
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
      items: data.map(mapWarehouse),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  /** Active + inactive warehouses as lightweight options for pickers. */
  async listOptions(organizationId: string): Promise<WarehouseOption[]> {
    const { data, error } = await this.supabase
      .from("warehouses")
      .select("id,code,name")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map((row) => ({ id: row.id, code: row.code, name: row.name }));
  }

  async create(input: DbWarehouseInsert): Promise<Warehouse | null> {
    const { data, error } = await this.supabase
      .from("warehouses")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapWarehouse(data);
  }

  async update(
    id: string,
    patch: Partial<DbWarehouse>,
    updatedBy: string
  ): Promise<Warehouse | null> {
    const { data, error } = await this.supabase
      .from("warehouses")
      .update({
        ...patch,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapWarehouse(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("warehouses")
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
}
