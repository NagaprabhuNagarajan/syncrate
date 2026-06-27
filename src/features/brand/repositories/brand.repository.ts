import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Brand,
  BrandListParams,
  BrandListResult,
} from "@/features/brand/types/brand.types";

type DbBrand = Database["public"]["Tables"]["brands"]["Row"];
type DbBrandInsert = Database["public"]["Tables"]["brands"]["Insert"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapBrand(row: DbBrand): Brand {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
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

export class BrandRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<Brand | null> {
    const { data, error } = await this.supabase
      .from("brands")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapBrand(data);
  }

  async findByName(
    organizationId: string,
    name: string
  ): Promise<Brand | null> {
    const { data, error } = await this.supabase
      .from("brands")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("name", name.trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapBrand(data);
  }

  async list(
    organizationId: string,
    params: BrandListParams = {}
  ): Promise<BrandListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("brands")
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
          `name.ilike.%${term}%,description.ilike.%${term}%`
        );
      }
    }

    const { data, error, count } = await query
      .order("name", { ascending: true })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    return {
      items: data.map(mapBrand),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async create(input: DbBrandInsert): Promise<Brand | null> {
    const { data, error } = await this.supabase
      .from("brands")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapBrand(data);
  }

  async update(
    id: string,
    patch: Partial<DbBrand>,
    updatedBy: string
  ): Promise<Brand | null> {
    const { data, error } = await this.supabase
      .from("brands")
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
    return mapBrand(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("brands")
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
