import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Category,
  CategoryListParams,
  CategoryListResult,
} from "@/features/category/types/category.types";

type DbCategory = Database["public"]["Tables"]["categories"]["Row"];
type DbCategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapCategory(row: DbCategory): Category {
  return {
    id: row.id,
    organizationId: row.organization_id,
    parentId: row.parent_id,
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

export class CategoryRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<Category | null> {
    const { data, error } = await this.supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapCategory(data);
  }

  /**
   * Finds a non-deleted category by name within a parent scope. A `parentId`
   * of `null` matches root (top-level) categories.
   */
  async findByName(
    organizationId: string,
    name: string,
    parentId: string | null = null
  ): Promise<Category | null> {
    let query = this.supabase
      .from("categories")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("name", name.trim())
      .is("deleted_at", null);

    query = parentId === null ? query.is("parent_id", null) : query.eq("parent_id", parentId);

    const { data, error } = await query.single();

    if (error || !data) {
      return null;
    }
    return mapCategory(data);
  }

  async list(
    organizationId: string,
    params: CategoryListParams = {}
  ): Promise<CategoryListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("categories")
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
      items: data.map(mapCategory),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  /**
   * Fetches every non-deleted category for an organization, ordered by name.
   * Used to build the category tree and parent <select> options.
   */
  async listAll(organizationId: string): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from("categories")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapCategory);
  }

  async create(input: DbCategoryInsert): Promise<Category | null> {
    const { data, error } = await this.supabase
      .from("categories")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapCategory(data);
  }

  async update(
    id: string,
    patch: Partial<DbCategory>,
    updatedBy: string
  ): Promise<Category | null> {
    const { data, error } = await this.supabase
      .from("categories")
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
    return mapCategory(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("categories")
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
