import type { AppSupabaseClient } from "@/lib/supabase/types";
import { ReputationRepository } from "@/features/reputation/repositories/reputation.repository";
import type {
  CreateReviewInput,
  ReputationActionResult,
  ReputationError,
  ReputationErrorCode,
  ReputationSummary,
  Review,
  ReviewListItem,
  UpdateReviewInput,
} from "@/features/reputation/types/reputation.types";

function ok<T>(data: T): ReputationActionResult<T> {
  return { success: true, data };
}

function fail(
  code: ReputationErrorCode,
  message: string
): ReputationActionResult<never> {
  const error: ReputationError = { code, message };
  return { success: false, error };
}

/** Normalizes an optional string: trims and converts "" → null. */
function nz(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export class ReputationService {
  private readonly repo: ReputationRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new ReputationRepository(supabase);
  }

  // ── Reputation reads (RPC-backed, any org) ─────────────────

  async getReputation(orgId: string): Promise<ReputationSummary> {
    return this.repo.getReputation(orgId);
  }

  async listReviews(
    orgId: string,
    limit?: number,
    offset?: number
  ): Promise<ReviewListItem[]> {
    return this.repo.listReviews(orgId, limit, offset);
  }

  /** Returns this org's own (non-deleted) review of a subject, if any. */
  async getOwnReview(
    organizationId: string,
    subjectOrganizationId: string
  ): Promise<Review | null> {
    return this.repo.findBySubject(organizationId, subjectOrganizationId);
  }

  // ── Post a review ──────────────────────────────────────────

  async postReview(
    input: CreateReviewInput,
    organizationId: string,
    userId: string
  ): Promise<ReputationActionResult<Review>> {
    // Guard self-review (also enforced by a DB check constraint).
    if (input.subjectOrganizationId === organizationId) {
      return fail("forbidden", "You cannot review your own organization");
    }

    if (input.rating < 1 || input.rating > 5) {
      return fail("validation", "Rating must be between 1 and 5");
    }

    // Pre-check the unique (reviewer, subject) constraint for a clean conflict.
    const existing = await this.repo.findBySubject(
      organizationId,
      input.subjectOrganizationId
    );
    if (existing) {
      return fail(
        "conflict",
        "You have already reviewed this organization. Edit your existing review instead."
      );
    }

    const outcome = await this.repo.create({
      organization_id: organizationId,
      subject_organization_id: input.subjectOrganizationId,
      rating: input.rating,
      title: nz(input.title),
      comment: nz(input.comment),
      reference_type: nz(input.referenceType),
      reference_id: nz(input.referenceId),
      is_recommended: input.isRecommended ?? false,
      created_by: userId,
    });

    if (outcome.conflict) {
      return fail(
        "conflict",
        "You have already reviewed this organization. Edit your existing review instead."
      );
    }
    if (!outcome.review) {
      return fail("unknown", "Failed to post review. Please try again.");
    }

    return ok(outcome.review);
  }

  // ── Update a review (optimistic lock) ──────────────────────

  async updateReview(
    reviewId: string,
    input: UpdateReviewInput,
    organizationId: string,
    userId: string
  ): Promise<ReputationActionResult<Review>> {
    const existing = await this.repo.findById(reviewId);
    if (!existing) {
      return fail("not_found", "Review not found");
    }
    if (existing.organizationId !== organizationId) {
      return fail("forbidden", "You can only edit your own reviews");
    }
    if (existing.version !== input.version) {
      return fail(
        "version_conflict",
        "This review was modified elsewhere. Reload and try again."
      );
    }
    if (
      input.rating !== undefined &&
      (input.rating < 1 || input.rating > 5)
    ) {
      return fail("validation", "Rating must be between 1 and 5");
    }

    const patch: Record<string, unknown> = {};
    if (input.rating !== undefined) {
      patch.rating = input.rating;
    }
    if (input.title !== undefined) {
      patch.title = nz(input.title);
    }
    if (input.comment !== undefined) {
      patch.comment = nz(input.comment);
    }
    if (input.isRecommended !== undefined) {
      patch.is_recommended = input.isRecommended;
    }

    const updated = await this.repo.update(
      reviewId,
      input.version,
      patch,
      userId
    );
    if (!updated) {
      return fail(
        "version_conflict",
        "This review was modified elsewhere. Reload and try again."
      );
    }

    return ok(updated);
  }

  // ── Delete a review (soft delete) ──────────────────────────

  async deleteReview(
    reviewId: string,
    organizationId: string,
    userId: string
  ): Promise<ReputationActionResult<void>> {
    const existing = await this.repo.findById(reviewId);
    if (!existing) {
      return fail("not_found", "Review not found");
    }
    if (existing.organizationId !== organizationId) {
      return fail("forbidden", "You can only delete your own reviews");
    }

    const deleted = await this.repo.softDelete(reviewId, userId);
    if (!deleted) {
      return fail("unknown", "Failed to delete review. Please try again.");
    }
    return ok(undefined);
  }
}
