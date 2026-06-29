"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { ReputationService } from "@/features/reputation/services/reputation.service";
import {
  createReviewSchema,
  updateReviewSchema,
} from "@/features/reputation/schemas/reputation.schemas";
import type {
  ReputationActionResult,
  ReputationSummary,
  Review,
  ReviewListItem,
} from "@/features/reputation/types/reputation.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): ReputationActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): ReputationActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

/**
 * Resolves the caller, verifies org membership, and checks a permission.
 * Returns the authenticated userId on success.
 */
async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  | { ok: true; userId: string }
  | { ok: false; result: ReputationActionResult<never> }
> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { ok: false, result: forbidden("Not authenticated") };
  }

  const orgService = new OrganizationService(supabase);
  const context = await orgService.getOrganizationContext(
    organizationId,
    authData.user.id
  );
  if (!context) {
    return {
      ok: false,
      result: forbidden("You do not have access to this organization"),
    };
  }
  if (!context.permissions.includes(permission)) {
    return {
      ok: false,
      result: forbidden("You do not have permission to perform this action"),
    };
  }

  return { ok: true, userId: authData.user.id };
}

// ─────────────────────────────────────────────────────────────
// Reputation reads (marketplace.view)
// ─────────────────────────────────────────────────────────────

export async function getReputationAction(
  organizationId: string,
  subjectOrganizationId: string
): Promise<ReputationActionResult<ReputationSummary>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.view");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ReputationService(supabase);
  const summary = await service.getReputation(subjectOrganizationId);
  return { success: true, data: summary };
}

export async function listReviewsAction(
  organizationId: string,
  subjectOrganizationId: string,
  limit?: number,
  offset?: number
): Promise<ReputationActionResult<ReviewListItem[]>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.view");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ReputationService(supabase);
  const reviews = await service.listReviews(subjectOrganizationId, limit, offset);
  return { success: true, data: reviews };
}

// ─────────────────────────────────────────────────────────────
// Post a review (marketplace.review)
// ─────────────────────────────────────────────────────────────

export async function postReviewAction(
  organizationId: string,
  formData: FormData
): Promise<ReputationActionResult<Review>> {
  const parsed = createReviewSchema.safeParse({
    subjectOrganizationId: formData.get("subjectOrganizationId"),
    rating: formData.get("rating"),
    title: formData.get("title") || undefined,
    comment: formData.get("comment") || undefined,
    isRecommended: formData.get("isRecommended") === "true",
    referenceType: formData.get("referenceType") || undefined,
    referenceId: formData.get("referenceId") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  // Self-review guard at the action layer (also guarded in the service + DB).
  if (parsed.data.subjectOrganizationId === organizationId) {
    return forbidden("You cannot review your own organization");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.review");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ReputationService(supabase);
  const result = await service.postReview(
    {
      subjectOrganizationId: parsed.data.subjectOrganizationId,
      rating: parsed.data.rating,
      title: parsed.data.title || undefined,
      comment: parsed.data.comment || undefined,
      isRecommended: parsed.data.isRecommended,
      referenceType: parsed.data.referenceType || undefined,
      referenceId: parsed.data.referenceId || undefined,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/marketplace/reputation");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "marketplace.review",
      entityType: "marketplace_review",
      entityId: result.data.id,
      summary: `Reviewed organization ${result.data.subjectOrganizationId} (${result.data.rating}★)`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update a review (marketplace.review)
// ─────────────────────────────────────────────────────────────

export async function updateReviewAction(
  organizationId: string,
  reviewId: string,
  formData: FormData
): Promise<ReputationActionResult<Review>> {
  const parsed = updateReviewSchema.safeParse({
    rating: formData.get("rating") || undefined,
    title: formData.get("title") || undefined,
    comment: formData.get("comment") || undefined,
    isRecommended: formData.get("isRecommended") === "true",
    version: formData.get("version"),
  });

  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.review");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ReputationService(supabase);
  const result = await service.updateReview(
    reviewId,
    {
      rating: parsed.data.rating,
      title: parsed.data.title || undefined,
      comment: parsed.data.comment || undefined,
      isRecommended: parsed.data.isRecommended,
      version: parsed.data.version,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/marketplace/reputation");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "marketplace.review.update",
      entityType: "marketplace_review",
      entityId: reviewId,
      summary: `Updated review for organization ${result.data.subjectOrganizationId}`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Delete a review (marketplace.review)
// ─────────────────────────────────────────────────────────────

export async function deleteReviewAction(
  organizationId: string,
  reviewId: string
): Promise<ReputationActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "marketplace.review");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ReputationService(supabase);
  const result = await service.deleteReview(reviewId, organizationId, auth.userId);

  if (result.success) {
    revalidatePath("/marketplace/reputation");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "marketplace.review.delete",
      entityType: "marketplace_review",
      entityId: reviewId,
      summary: "Deleted a review",
    });
  }
  return result;
}
