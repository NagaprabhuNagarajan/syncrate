import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AuditService } from "@/features/audit/services/audit.service";
import { CatalogRepository } from "@/features/cbn/repositories/catalog.repository";
import type {
  CbnActionResult,
  CbnErrorCode,
  SupplierCatalogItem,
  SupplierCatalogSearchResult,
} from "@/features/cbn/types/cbn.types";
import type {
  CreateCatalogItemInput,
  UpdateCatalogItemInput,
} from "@/features/cbn/schemas/catalogSchema";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): CbnActionResult<T> {
  return { success: true, data };
}

function fail(code: CbnErrorCode, message: string): CbnActionResult<never> {
  return { success: false, error: { code, message } };
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class CatalogService {
  private readonly repo: CatalogRepository;
  private readonly audit: AuditService;

  constructor(private readonly supabase: AppSupabaseClient) {
    this.repo = new CatalogRepository(supabase);
    this.audit = new AuditService(supabase);
  }

  async listMyCatalog(orgId: string): Promise<SupplierCatalogItem[]> {
    return this.repo.listByOrg(orgId);
  }

  async createCatalogItem(
    orgId: string,
    input: CreateCatalogItemInput
  ): Promise<CbnActionResult<SupplierCatalogItem>> {
    const item = await this.repo.upsert(orgId, input);
    if (!item) {
      return fail(
        "unknown",
        "Failed to create catalog item. Please try again."
      );
    }

    await this.audit.log({
      organizationId: orgId,
      actorUserId: null,
      action: "cbn.catalog.create",
      entityType: "supplier_catalog_item",
      entityId: item.id,
      summary: `Created catalog item for product ${input.productId}`,
    });

    return ok(item);
  }

  async updateCatalogItem(
    orgId: string,
    id: string,
    input: UpdateCatalogItemInput
  ): Promise<CbnActionResult<SupplierCatalogItem>> {
    const item = await this.repo.update(id, input);
    if (!item) {return fail("not_found", "Catalog item not found");}

    await this.audit.log({
      organizationId: orgId,
      actorUserId: null,
      action: "cbn.catalog.update",
      entityType: "supplier_catalog_item",
      entityId: id,
      summary: `Updated catalog item ${id}`,
    });

    return ok(item);
  }

  async togglePublished(
    orgId: string,
    id: string,
    isPublished: boolean
  ): Promise<CbnActionResult<void>> {
    const success = await this.repo.setPublished(id, isPublished);
    if (!success) {return fail("not_found", "Catalog item not found");}

    await this.audit.log({
      organizationId: orgId,
      actorUserId: null,
      action: isPublished ? "cbn.catalog.publish" : "cbn.catalog.unpublish",
      entityType: "supplier_catalog_item",
      entityId: id,
      summary: `${isPublished ? "Published" : "Unpublished"} catalog item ${id}`,
    });

    return ok(undefined);
  }

  async searchSupplierCatalog(
    supplierOrgId: string,
    query?: string,
    limit = 20,
    offset = 0
  ): Promise<SupplierCatalogSearchResult[]> {
    return this.repo.searchConnectedSupplierCatalog(
      supplierOrgId,
      query,
      limit,
      offset
    );
  }

  async enableCatalog(orgId: string): Promise<CbnActionResult<void>> {
    const { error } = await this.supabase
      .from("business_profiles")
      .update({ catalog_enabled: true })
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) {
      return fail("unknown", error.message);
    }

    await this.audit.log({
      organizationId: orgId,
      actorUserId: null,
      action: "cbn.catalog.enable",
      entityType: "business_profile",
      summary: `Enabled supplier catalog for org ${orgId}`,
    });

    return ok(undefined);
  }
}
