import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  SupplierCatalogItem,
  SupplierCatalogSearchResult,
  SupplierCatalogStockAvailability,
} from "@/features/cbn/types/cbn.types";
import type {
  CreateCatalogItemInput,
  UpdateCatalogItemInput,
} from "@/features/cbn/schemas/catalogSchema";

type DbRow = Database["public"]["Tables"]["supplier_catalog_items"]["Row"];
type DbSearchRow =
  Database["public"]["Functions"]["search_supplier_catalog"]["Returns"][number];

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapRow(row: DbRow): SupplierCatalogItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    productId: row.product_id,
    catalogPrice: Number(row.catalog_price),
    currency: row.currency,
    moq: row.moq,
    leadTimeDays: row.lead_time_days,
    stockAvailability: row.stock_availability as SupplierCatalogStockAvailability,
    isPublished: row.is_published,
    catalogNotes: row.catalog_notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function mapSearchRow(row: DbSearchRow): SupplierCatalogSearchResult {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku,
    catalogPrice: Number(row.catalog_price),
    currency: row.currency,
    moq: row.moq,
    leadTimeDays: row.lead_time_days,
    stockAvailability: row.stock_availability,
    catalogNotes: row.catalog_notes,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class CatalogRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async listByOrg(orgId: string): Promise<SupplierCatalogItem[]> {
    const { data, error } = await this.supabase
      .from("supplier_catalog_items")
      .select("*")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) {return [];}
    return data.map(mapRow);
  }

  async findById(id: string): Promise<SupplierCatalogItem | null> {
    const { data, error } = await this.supabase
      .from("supplier_catalog_items")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {return null;}
    return mapRow(data);
  }

  async upsert(
    orgId: string,
    input: CreateCatalogItemInput
  ): Promise<SupplierCatalogItem | null> {
    const { data, error } = await this.supabase
      .from("supplier_catalog_items")
      .upsert(
        {
          organization_id: orgId,
          product_id: input.productId,
          catalog_price: input.catalogPrice,
          currency: input.currency,
          moq: input.moq,
          lead_time_days: input.leadTimeDays ?? null,
          stock_availability: input.stockAvailability,
          is_published: input.isPublished,
          catalog_notes: input.catalogNotes ?? null,
        },
        { onConflict: "organization_id,product_id" }
      )
      .select()
      .single();

    if (error || !data) {return null;}
    return mapRow(data);
  }

  async update(
    id: string,
    input: UpdateCatalogItemInput
  ): Promise<SupplierCatalogItem | null> {
    const patch: Partial<DbRow> = {};
    if (input.catalogPrice !== undefined) {patch.catalog_price = input.catalogPrice;}
    if (input.currency !== undefined) {patch.currency = input.currency;}
    if (input.moq !== undefined) {patch.moq = input.moq;}
    if (input.leadTimeDays !== undefined) {patch.lead_time_days = input.leadTimeDays ?? null;}
    if (input.stockAvailability !== undefined)
      {patch.stock_availability = input.stockAvailability;}
    if (input.isPublished !== undefined) {patch.is_published = input.isPublished;}
    if (input.catalogNotes !== undefined) {patch.catalog_notes = input.catalogNotes ?? null;}

    const { data, error } = await this.supabase
      .from("supplier_catalog_items")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !data) {return null;}
    return mapRow(data);
  }

  async setPublished(id: string, isPublished: boolean): Promise<boolean> {
    const { error } = await this.supabase
      .from("supplier_catalog_items")
      .update({ is_published: isPublished })
      .eq("id", id)
      .is("deleted_at", null);

    return !error;
  }

  async searchConnectedSupplierCatalog(
    supplierOrgId: string,
    query?: string,
    limit = 20,
    offset = 0
  ): Promise<SupplierCatalogSearchResult[]> {
    const { data, error } = await this.supabase.rpc("search_supplier_catalog", {
      p_supplier_org_id: supplierOrgId,
      p_query: query ?? "",
      p_limit: limit,
      p_offset: offset,
    });

    if (error || !data) {return [];}
    return (data as DbSearchRow[]).map(mapSearchRow);
  }
}
