import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Product,
  ProductListParams,
  ProductListResult,
  ProductStats,
} from "@/features/product/types/product.types";

type DbProduct = Database["public"]["Tables"]["products"]["Row"];
type DbProductInsert = Database["public"]["Tables"]["products"]["Insert"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function mapProduct(row: DbProduct): Product {
  return {
    id: row.id,
    organizationId: row.organization_id,
    code: row.code,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    categoryId: row.category_id,
    brandId: row.brand_id,
    unitId: row.unit_id,
    manufacturer: row.manufacturer,
    hsnCode: row.hsn_code,
    gstRate: Number(row.gst_rate),
    gstRates: (row.gst_rates ?? []).map(Number),
    taxInclusive: row.tax_inclusive,
    purchasePrice: Number(row.purchase_price),
    sellingPrice: Number(row.selling_price),
    dealerPrice: Number(row.dealer_price),
    wholesalePrice: Number(row.wholesale_price),
    retailPrice: Number(row.retail_price),
    minSellingPrice: Number(row.min_selling_price),
    sku: row.sku,
    barcode: row.barcode,
    qrCode: row.qr_code,
    trackInventory: row.track_inventory,
    reorderLevel: Number(row.reorder_level),
    maxStock: Number(row.max_stock),
    openingStock: Number(row.opening_stock),
    preferredSupplierId: row.preferred_supplier_id,
    isSeasonal: row.is_seasonal,
    isFastMoving: row.is_fast_moving,
    isSlowMoving: row.is_slow_moving,
    aiTags: row.ai_tags,
    tags: row.tags,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function sanitizeSearch(term: string): string {
  return term.trim().replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
}

export class ProductRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<Product | null> {
    // No deleted_at constraint: archived products are soft-deleted but must
    // remain viewable and editable (e.g. to restore them).
    const { data, error } = await this.supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      return null;
    }
    return mapProduct(data);
  }

  async findByField(
    organizationId: string,
    field: "code" | "sku" | "barcode",
    value: string
  ): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from("products")
      .select("*")
      .eq("organization_id", organizationId)
      .eq(field, value.trim())
      .is("deleted_at", null)
      .single();
    if (error || !data) {
      return null;
    }
    return mapProduct(data);
  }

  async list(
    organizationId: string,
    params: ProductListParams = {}
  ): Promise<ProductListResult> {
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
      .from("products")
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
    if (params.type) {
      query = query.eq("type", params.type);
    }
    if (params.categoryId) {
      query = query.eq("category_id", params.categoryId);
    }
    if (params.brandId) {
      query = query.eq("brand_id", params.brandId);
    }
    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.or(
          `name.ilike.%${term}%,code.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%`
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
      items: data.map(mapProduct),
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
  async getStats(organizationId: string): Promise<ProductStats> {
    const base = () =>
      this.supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId);

    const [total, active, draft, discontinued] = await Promise.all([
      base(),
      base().eq("status", "active"),
      base().eq("status", "draft"),
      base().eq("status", "discontinued"),
    ]);

    return {
      total: total.count ?? 0,
      active: active.count ?? 0,
      draft: draft.count ?? 0,
      discontinued: discontinued.count ?? 0,
    };
  }

  async findAllForExport(organizationId: string): Promise<Product[]> {
    const pageSize = 1000;
    const all: Product[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await this.supabase
        .from("products")
        .select("*")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) {
        break;
      }
      all.push(...data.map(mapProduct));
      if (data.length < pageSize) {
        break;
      }
      from += pageSize;
    }
    return all;
  }

  async create(input: DbProductInsert): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from("products")
      .insert(input)
      .select("*")
      .single();
    if (error || !data) {
      return null;
    }
    return mapProduct(data);
  }

  async update(
    id: string,
    patch: Partial<DbProduct>,
    updatedBy: string
  ): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from("products")
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
    return mapProduct(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("products")
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
