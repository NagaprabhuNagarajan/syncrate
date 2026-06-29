import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  MarketplaceBrowseListing,
  MarketplaceBrowseParams,
  MarketplaceListing,
  MarketplaceListingListParams,
  MarketplaceListingListResult,
  ReputationSummary,
} from "@/features/marketplace/types/marketplace.types";

type DbListing = Database["public"]["Tables"]["marketplace_listings"]["Row"];
type DbListingInsert =
  Database["public"]["Tables"]["marketplace_listings"]["Insert"];
type DbBrowseRow =
  Database["public"]["Functions"]["search_marketplace_listings"]["Returns"][number];
type DbReputationRow =
  Database["public"]["Functions"]["get_organization_reputation"]["Returns"][number];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapListing(row: DbListing): MarketplaceListing {
  return {
    id: row.id,
    organizationId: row.organization_id,
    listingType: row.listing_type,
    productId: row.product_id,
    title: row.title,
    description: row.description,
    category: row.category,
    price: row.price === null ? null : Number(row.price),
    currency: row.currency,
    unit: row.unit,
    minOrderQty: row.min_order_qty === null ? null : Number(row.min_order_qty),
    isPublished: row.is_published,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    version: row.version,
  };
}

function mapBrowseRow(row: DbBrowseRow): MarketplaceBrowseListing {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sellerName: row.seller_name,
    listingType: row.listing_type === "supplier" ? "supplier" : "product",
    productId: row.product_id,
    title: row.title,
    description: row.description,
    category: row.category,
    price: row.price === null ? null : Number(row.price),
    currency: row.currency,
    unit: row.unit,
    minOrderQty: row.min_order_qty === null ? null : Number(row.min_order_qty),
    createdAt: new Date(row.created_at),
    reputation: null,
  };
}

function mapReputationRow(row: DbReputationRow): ReputationSummary {
  return {
    reviewCount: Number(row.review_count),
    averageRating: Number(row.average_rating),
    recommendedCount: Number(row.recommended_count),
    recommendPercent: Number(row.recommend_percent),
  };
}

/** Strips PostgREST `or()`/ILIKE metacharacters from a search term. */
function sanitizeSearch(term: string): string {
  return term.trim().replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class MarketplaceRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  // ── Own-org CRUD (RLS-scoped to the caller's organization) ──

  async findById(id: string): Promise<MarketplaceListing | null> {
    const { data, error } = await this.supabase
      .from("marketplace_listings")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapListing(data);
  }

  async listOwn(
    organizationId: string,
    params: MarketplaceListingListParams = {}
  ): Promise<MarketplaceListingListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("marketplace_listings")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (params.status) {
      query = query.eq("status", params.status);
    }
    if (params.listingType) {
      query = query.eq("listing_type", params.listingType);
    }
    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.or(
          `title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`
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
      items: data.map(mapListing),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async create(input: DbListingInsert): Promise<MarketplaceListing | null> {
    const { data, error } = await this.supabase
      .from("marketplace_listings")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapListing(data);
  }

  /**
   * Optimistic-locked update: only matches when the stored `version` equals
   * `expectedVersion`. A concurrent write bumps the version, so a stale caller
   * matches no row and gets `null` — the service maps this to a conflict.
   */
  async update(
    id: string,
    patch: Partial<DbListing>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<MarketplaceListing | null> {
    const { data, error } = await this.supabase
      .from("marketplace_listings")
      .update({
        ...patch,
        version: expectedVersion + 1,
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
    return mapListing(data);
  }

  /** Sets a small patch (status / publish flag) without optimistic locking. */
  async setFields(
    id: string,
    patch: Partial<DbListing>,
    updatedBy: string
  ): Promise<MarketplaceListing | null> {
    const { data, error } = await this.supabase
      .from("marketplace_listings")
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
    return mapListing(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("marketplace_listings")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        status: "archived",
        is_published: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    return !error;
  }

  // ── Cross-org discovery (SECURITY DEFINER RPC, not a table select) ──

  async browse(
    params: MarketplaceBrowseParams,
    limit: number,
    offset: number
  ): Promise<MarketplaceBrowseListing[]> {
    const { data, error } = await this.supabase.rpc(
      "search_marketplace_listings",
      {
        p_query: params.query?.trim() || undefined,
        p_listing_type: params.listingType ?? undefined,
        p_category: params.category?.trim() || undefined,
        p_limit: limit,
        p_offset: offset,
      }
    );

    if (error || !data) {
      return [];
    }
    return (data as DbBrowseRow[]).map(mapBrowseRow);
  }

  async getReputation(orgId: string): Promise<ReputationSummary | null> {
    const { data, error } = await this.supabase.rpc(
      "get_organization_reputation",
      { p_org_id: orgId }
    );

    if (error || !data || (data as DbReputationRow[]).length === 0) {
      return null;
    }
    return mapReputationRow((data as DbReputationRow[])[0]);
  }
}
