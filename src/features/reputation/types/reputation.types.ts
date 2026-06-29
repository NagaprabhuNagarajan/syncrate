/**
 * Reputation domain types (CBN §17 Business Reputation).
 *
 * `Review` is an org's review of a counterparty (own-org RLS, the reviewer is
 * `organizationId`). `ReputationSummary` and `ReviewListItem` are read-only
 * projections produced by SECURITY DEFINER RPCs so any org can view another
 * org's aggregate reputation despite own-org RLS on the underlying table.
 */

// ─────────────────────────────────────────────────────────────
// Domain entities
// ─────────────────────────────────────────────────────────────

export interface Review {
  readonly id: string;
  /** The reviewing organization (own-org RLS subject). */
  readonly organizationId: string;
  /** The organization being reviewed. */
  readonly subjectOrganizationId: string;
  readonly rating: number;
  readonly title: string | null;
  readonly comment: string | null;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly isRecommended: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

/** Aggregate reputation for an organization (from `get_organization_reputation`). */
export interface ReputationSummary {
  readonly reviewCount: number;
  readonly averageRating: number;
  readonly recommendedCount: number;
  readonly recommendPercent: number;
}

/** A single public review row (from `list_organization_reviews`). */
export interface ReviewListItem {
  readonly id: string;
  readonly reviewerName: string;
  readonly rating: number;
  readonly title: string | null;
  readonly comment: string | null;
  readonly isRecommended: boolean;
  readonly createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Inputs / commands
// ─────────────────────────────────────────────────────────────

export interface CreateReviewInput {
  readonly subjectOrganizationId: string;
  readonly rating: number;
  readonly title?: string;
  readonly comment?: string;
  readonly isRecommended?: boolean;
  readonly referenceType?: string;
  readonly referenceId?: string;
}

export interface UpdateReviewInput {
  readonly rating?: number;
  readonly title?: string;
  readonly comment?: string;
  readonly isRecommended?: boolean;
  /** Expected current version for optimistic locking. */
  readonly version: number;
}

export interface ListReviewsParams {
  readonly limit?: number;
  readonly offset?: number;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export type ReputationErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "conflict"
  | "version_conflict"
  | "unknown";

export interface ReputationError {
  readonly code: ReputationErrorCode;
  readonly message: string;
}

export type ReputationActionResult<T = void> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: ReputationError };
