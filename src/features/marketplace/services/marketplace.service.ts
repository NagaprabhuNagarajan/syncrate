import type { AppSupabaseClient } from "@/lib/supabase/types";
import { MarketplaceRepository } from "@/features/marketplace/repositories/marketplace.repository";
import type {
  CreateListingInput,
  ListingStatus,
  MarketplaceActionResult,
  MarketplaceBrowseListing,
  MarketplaceBrowseParams,
  MarketplaceBrowseResult,
  MarketplaceError,
  MarketplaceErrorCode,
  MarketplaceListing,
  MarketplaceListingListParams,
  MarketplaceListingListResult,
  UpdateListingInput,
} from "@/features/marketplace/types/marketplace.types";

const DEFAULT_BROWSE_PAGE_SIZE = 24;
const MAX_BROWSE_PAGE_SIZE = 60;

function ok<T>(data: T): MarketplaceActionResult<T> {
  return { success: true, data };
}

function fail(
  code: MarketplaceErrorCode,
  message: string
): MarketplaceActionResult<never> {
  const error: MarketplaceError = { code, message };
  return { success: false, error };
}

/** Trims an optional string and converts "" → null. */
function nz(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeCurrency(value: string | undefined): string {
  const trimmed = value?.trim().toUpperCase();
  return trimmed && trimmed.length === 3 ? trimmed : "INR";
}

export class MarketplaceService {
  private readonly repo: MarketplaceRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new MarketplaceRepository(supabase);
  }

  // ── Own-org reads ──────────────────────────────────────────

  async listOwnListings(
    organizationId: string,
    params?: MarketplaceListingListParams
  ): Promise<MarketplaceListingListResult> {
    return this.repo.listOwn(organizationId, params);
  }

  async getListing(
    id: string
  ): Promise<MarketplaceActionResult<MarketplaceListing>> {
    const listing = await this.repo.findById(id);
    if (!listing) {
      return fail("not_found", "Listing not found");
    }
    return ok(listing);
  }

  // ── Create ─────────────────────────────────────────────────

  async createListing(
    input: CreateListingInput,
    organizationId: string,
    userId: string
  ): Promise<MarketplaceActionResult<MarketplaceListing>> {
    const listing = await this.repo.create({
      organization_id: organizationId,
      listing_type: input.listingType,
      product_id: nz(input.productId),
      title: input.title.trim(),
      description: nz(input.description),
      category: nz(input.category),
      price: input.price ?? null,
      currency: normalizeCurrency(input.currency),
      unit: nz(input.unit),
      min_order_qty: input.minOrderQty ?? null,
      is_published: false,
      status: "active",
      created_by: userId,
    });

    if (!listing) {
      return fail("unknown", "Failed to create listing. Please try again.");
    }
    return ok(listing);
  }

  // ── Update (optimistic-locked) ─────────────────────────────

  async updateListing(
    listingId: string,
    input: UpdateListingInput,
    userId: string
  ): Promise<MarketplaceActionResult<MarketplaceListing>> {
    const existing = await this.repo.findById(listingId);
    if (!existing) {
      return fail("not_found", "Listing not found");
    }

    const listing = await this.repo.update(
      listingId,
      {
        listing_type: input.listingType,
        product_id: nz(input.productId),
        title: input.title.trim(),
        description: nz(input.description),
        category: nz(input.category),
        price: input.price ?? null,
        currency: normalizeCurrency(input.currency),
        unit: nz(input.unit),
        min_order_qty: input.minOrderQty ?? null,
      },
      userId,
      input.version
    );

    if (!listing) {
      return fail(
        "conflict",
        "This listing was changed by someone else. Reload and try again."
      );
    }
    return ok(listing);
  }

  // ── Publish / unpublish ────────────────────────────────────

  async setPublished(
    listingId: string,
    isPublished: boolean,
    userId: string
  ): Promise<MarketplaceActionResult<MarketplaceListing>> {
    const existing = await this.repo.findById(listingId);
    if (!existing) {
      return fail("not_found", "Listing not found");
    }
    if (isPublished && existing.status === "archived") {
      return fail("validation", "Archived listings cannot be published");
    }

    const listing = await this.repo.setFields(
      listingId,
      { is_published: isPublished },
      userId
    );
    if (!listing) {
      return fail("unknown", "Failed to update listing. Please try again.");
    }
    return ok(listing);
  }

  // ── Status change (active / paused) ────────────────────────

  async changeStatus(
    listingId: string,
    status: ListingStatus,
    userId: string
  ): Promise<MarketplaceActionResult<MarketplaceListing>> {
    const existing = await this.repo.findById(listingId);
    if (!existing) {
      return fail("not_found", "Listing not found");
    }

    // Pausing/archiving a listing also takes it out of the marketplace.
    const patch =
      status === "active"
        ? { status }
        : { status, is_published: false };

    const listing = await this.repo.setFields(listingId, patch, userId);
    if (!listing) {
      return fail("unknown", "Failed to update listing. Please try again.");
    }
    return ok(listing);
  }

  // ── Archive (soft delete) ──────────────────────────────────

  async archiveListing(
    listingId: string,
    userId: string
  ): Promise<MarketplaceActionResult<void>> {
    const existing = await this.repo.findById(listingId);
    if (!existing) {
      return fail("not_found", "Listing not found");
    }

    const archived = await this.repo.softDelete(listingId, userId);
    if (!archived) {
      return fail("unknown", "Failed to archive listing. Please try again.");
    }
    return ok(undefined);
  }

  // ── Cross-org browse (RPC) ─────────────────────────────────

  /**
   * Browses every org's active, published listings via the
   * `search_marketplace_listings` RPC, then attaches each seller's reputation
   * (best-effort; fetched once per distinct seller org).
   */
  async browseListings(
    params: MarketplaceBrowseParams,
    options: { withReputation?: boolean } = {}
  ): Promise<MarketplaceBrowseResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_BROWSE_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_BROWSE_PAGE_SIZE)
    );
    const offset = (page - 1) * pageSize;

    // Fetch one extra row to detect whether more pages exist.
    const rows = await this.repo.browse(params, pageSize + 1, offset);
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

    const items = options.withReputation
      ? await this.attachReputation(pageRows)
      : pageRows;

    return { items, page, pageSize, hasMore };
  }

  private async attachReputation(
    rows: readonly MarketplaceBrowseListing[]
  ): Promise<MarketplaceBrowseListing[]> {
    const orgIds = [...new Set(rows.map((r) => r.organizationId))];
    const entries = await Promise.all(
      orgIds.map(
        async (orgId) => [orgId, await this.repo.getReputation(orgId)] as const
      )
    );
    const byOrg = new Map(entries);
    return rows.map((row) => ({
      ...row,
      reputation: byOrg.get(row.organizationId) ?? null,
    }));
  }
}
