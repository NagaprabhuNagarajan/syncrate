import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  ReputationSummary,
  Review,
  ReviewListItem,
} from "@/features/reputation/types/reputation.types";

type DbReviewRow = Database["public"]["Tables"]["marketplace_reviews"]["Row"];
type DbReviewInsert =
  Database["public"]["Tables"]["marketplace_reviews"]["Insert"];
type DbReviewUpdate =
  Database["public"]["Tables"]["marketplace_reviews"]["Update"];
type DbReputationRow =
  Database["public"]["Functions"]["get_organization_reputation"]["Returns"][number];
type DbReviewListRow =
  Database["public"]["Functions"]["list_organization_reviews"]["Returns"][number];

/** Postgres unique-violation error code (duplicate review for same subject). */
const UNIQUE_VIOLATION = "23505";

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapReview(row: DbReviewRow): Review {
  return {
    id: row.id,
    organizationId: row.organization_id,
    subjectOrganizationId: row.subject_organization_id,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    isRecommended: row.is_recommended,
    version: row.version,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function mapSummary(row: DbReputationRow): ReputationSummary {
  return {
    reviewCount: Number(row.review_count),
    averageRating: Number(row.average_rating),
    recommendedCount: Number(row.recommended_count),
    recommendPercent: Number(row.recommend_percent),
  };
}

function mapListItem(row: DbReviewListRow): ReviewListItem {
  return {
    id: row.id,
    reviewerName: row.reviewer_name,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    isRecommended: row.is_recommended,
    createdAt: new Date(row.created_at),
  };
}

/** Outcome of a create attempt — surfaces the unique-constraint conflict. */
export interface CreateReviewOutcome {
  readonly review: Review | null;
  readonly conflict: boolean;
}

const EMPTY_SUMMARY: ReputationSummary = {
  reviewCount: 0,
  averageRating: 0,
  recommendedCount: 0,
  recommendPercent: 0,
};

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class ReputationRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  // ── Reputation reads (SECURITY DEFINER RPCs) ───────────────

  /**
   * Aggregate reputation for any org. Uses the RPC (not a direct table read)
   * because RLS on `marketplace_reviews` is scoped to the reviewing org.
   */
  async getReputation(orgId: string): Promise<ReputationSummary> {
    const { data, error } = await this.supabase.rpc(
      "get_organization_reputation",
      { p_org_id: orgId }
    );

    if (error || !data || (data as DbReputationRow[]).length === 0) {
      return EMPTY_SUMMARY;
    }
    return mapSummary((data as DbReputationRow[])[0]);
  }

  /** Public list of reviews for any org via the SECURITY DEFINER RPC. */
  async listReviews(
    orgId: string,
    limit = 20,
    offset = 0
  ): Promise<ReviewListItem[]> {
    const { data, error } = await this.supabase.rpc(
      "list_organization_reviews",
      { p_org_id: orgId, p_limit: limit, p_offset: offset }
    );

    if (error || !data) {
      return [];
    }
    return (data as DbReviewListRow[]).map(mapListItem);
  }

  // ── Own-org review CRUD (typed table access) ───────────────

  async findById(id: string): Promise<Review | null> {
    const { data, error } = await this.supabase
      .from("marketplace_reviews")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapReview(data);
  }

  /** Finds this org's existing (non-deleted) review of a given subject. */
  async findBySubject(
    organizationId: string,
    subjectOrganizationId: string
  ): Promise<Review | null> {
    const { data, error } = await this.supabase
      .from("marketplace_reviews")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("subject_organization_id", subjectOrganizationId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapReview(data);
  }

  async create(input: DbReviewInsert): Promise<CreateReviewOutcome> {
    const { data, error } = await this.supabase
      .from("marketplace_reviews")
      .insert(input)
      .select("*")
      .single();

    if (error) {
      return { review: null, conflict: error.code === UNIQUE_VIOLATION };
    }
    if (!data) {
      return { review: null, conflict: false };
    }
    return { review: mapReview(data), conflict: false };
  }

  /**
   * Optimistic-locked update: only succeeds when the stored `version` still
   * matches `expectedVersion`. Increments the version on success.
   */
  async update(
    id: string,
    expectedVersion: number,
    patch: DbReviewUpdate,
    updatedBy: string
  ): Promise<Review | null> {
    const { data, error } = await this.supabase
      .from("marketplace_reviews")
      .update({
        ...patch,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
        version: expectedVersion + 1,
      })
      .eq("id", id)
      .eq("version", expectedVersion)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapReview(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("marketplace_reviews")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    return !error;
  }
}
