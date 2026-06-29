/**
 * Marketplace domain types.
 *
 * Two distinct read models:
 *  - `MarketplaceListing`  — an org's OWN listing (table-backed, full CRUD).
 *  - `MarketplaceBrowseListing` — any org's active/published listing, returned
 *    by the `search_marketplace_listings` SECURITY DEFINER RPC (cross-tenant
 *    discovery; never a direct table select).
 */

export type ListingType = "product" | "supplier";

export type ListingStatus = "active" | "paused" | "archived";

// ─────────────────────────────────────────────────────────────
// Own-org listing (table-backed)
// ─────────────────────────────────────────────────────────────

export interface MarketplaceListing {
  readonly id: string;
  readonly organizationId: string;
  readonly listingType: ListingType;
  readonly productId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly category: string | null;
  /** `null` means quote-on-request. */
  readonly price: number | null;
  readonly currency: string;
  readonly unit: string | null;
  readonly minOrderQty: number | null;
  readonly isPublished: boolean;
  readonly status: ListingStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  /** Optimistic-lock token. */
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Cross-org browse listing (RPC-backed)
// ─────────────────────────────────────────────────────────────

export interface ReputationSummary {
  readonly reviewCount: number;
  readonly averageRating: number;
  readonly recommendedCount: number;
  readonly recommendPercent: number;
}

export interface MarketplaceBrowseListing {
  readonly id: string;
  readonly organizationId: string;
  readonly sellerName: string;
  readonly listingType: ListingType;
  readonly productId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly price: number | null;
  readonly currency: string;
  readonly unit: string | null;
  readonly minOrderQty: number | null;
  readonly createdAt: Date;
  /** Seller reputation, attached when available. */
  readonly reputation: ReputationSummary | null;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateListingInput {
  readonly listingType: ListingType;
  readonly productId?: string;
  readonly title: string;
  readonly description?: string;
  readonly category?: string;
  readonly price?: number;
  readonly currency?: string;
  readonly unit?: string;
  readonly minOrderQty?: number;
}

export interface UpdateListingInput {
  readonly listingType: ListingType;
  readonly productId?: string;
  readonly title: string;
  readonly description?: string;
  readonly category?: string;
  readonly price?: number;
  readonly currency?: string;
  readonly unit?: string;
  readonly minOrderQty?: number;
  /** Optimistic-lock token the edit form was loaded with. */
  readonly version: number;
}

// ─────────────────────────────────────────────────────────────
// Listing / browse params
// ─────────────────────────────────────────────────────────────

export interface MarketplaceListingListParams {
  readonly search?: string;
  readonly status?: ListingStatus;
  readonly listingType?: ListingType;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface MarketplaceListingListResult {
  readonly items: readonly MarketplaceListing[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface MarketplaceBrowseParams {
  readonly query?: string;
  readonly listingType?: ListingType;
  readonly category?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface MarketplaceBrowseResult {
  readonly items: readonly MarketplaceBrowseListing[];
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type MarketplaceErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "conflict"
  | "unknown";

export interface MarketplaceError {
  readonly code: MarketplaceErrorCode;
  readonly message: string;
}

export type MarketplaceActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: MarketplaceError };
