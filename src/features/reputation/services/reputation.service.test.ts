import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  ReputationSummary,
  Review,
  ReviewListItem,
} from "@/features/reputation/types/reputation.types";
import { ReputationService } from "./reputation.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    getReputation: vi.fn(),
    listReviews: vi.fn(),
    findById: vi.fn(),
    findBySubject: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/features/reputation/repositories/reputation.repository", () => ({
  ReputationRepository: vi.fn(() => mockRepo),
}));

const fakeSupabase = {} as unknown as AppSupabaseClient;

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "review-1",
    organizationId: "org-reviewer",
    subjectOrganizationId: "org-subject",
    rating: 4,
    title: "Great",
    comment: "Reliable supplier",
    referenceType: null,
    referenceId: null,
    isRecommended: true,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

function buildSummary(
  overrides: Partial<ReputationSummary> = {}
): ReputationSummary {
  return {
    reviewCount: 10,
    averageRating: 4.3,
    recommendedCount: 8,
    recommendPercent: 80,
    ...overrides,
  };
}

function buildListItem(overrides: Partial<ReviewListItem> = {}): ReviewListItem {
  return {
    id: "review-1",
    reviewerName: "Acme Traders",
    rating: 5,
    title: "Excellent",
    comment: "Fast delivery",
    isRecommended: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

let service: ReputationService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new ReputationService(fakeSupabase);
});

// ─────────────────────────────────────────────────────────────
// Reputation reads (delegate to RPC-backed repo)
// ─────────────────────────────────────────────────────────────

describe("ReputationService reads", () => {
  it("getReputation returns the aggregate from the repository RPC", async () => {
    const summary = buildSummary();
    mockRepo.getReputation.mockResolvedValue(summary);

    const result = await service.getReputation("org-subject");

    expect(mockRepo.getReputation).toHaveBeenCalledWith("org-subject");
    expect(result).toEqual(summary);
  });

  it("listReviews returns mapped review rows from the repository RPC", async () => {
    const reviews = [buildListItem(), buildListItem({ id: "review-2" })];
    mockRepo.listReviews.mockResolvedValue(reviews);

    const result = await service.listReviews("org-subject", 5, 10);

    expect(mockRepo.listReviews).toHaveBeenCalledWith("org-subject", 5, 10);
    expect(result).toHaveLength(2);
  });

  it("getOwnReview returns the reviewer's existing review", async () => {
    const review = buildReview();
    mockRepo.findBySubject.mockResolvedValue(review);

    const result = await service.getOwnReview("org-reviewer", "org-subject");

    expect(mockRepo.findBySubject).toHaveBeenCalledWith(
      "org-reviewer",
      "org-subject"
    );
    expect(result).toEqual(review);
  });
});

// ─────────────────────────────────────────────────────────────
// Post review
// ─────────────────────────────────────────────────────────────

describe("ReputationService.postReview", () => {
  it("creates a review for another organization", async () => {
    mockRepo.findBySubject.mockResolvedValue(null);
    const created = buildReview();
    mockRepo.create.mockResolvedValue({ review: created, conflict: false });

    const result = await service.postReview(
      { subjectOrganizationId: "org-subject", rating: 4, title: "Great" },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(created);
    }
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-reviewer",
        subject_organization_id: "org-subject",
        rating: 4,
        created_by: "user-1",
      })
    );
  });

  it("rejects reviewing your own organization (self-review guard)", async () => {
    const result = await service.postReview(
      { subjectOrganizationId: "org-reviewer", rating: 5 },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("rejects out-of-range ratings", async () => {
    mockRepo.findBySubject.mockResolvedValue(null);

    const result = await service.postReview(
      { subjectOrganizationId: "org-subject", rating: 6 },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("returns conflict when a review for the subject already exists", async () => {
    mockRepo.findBySubject.mockResolvedValue(buildReview());

    const result = await service.postReview(
      { subjectOrganizationId: "org-subject", rating: 4 },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("returns conflict when the unique constraint fires on insert (race)", async () => {
    mockRepo.findBySubject.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({ review: null, conflict: true });

    const result = await service.postReview(
      { subjectOrganizationId: "org-subject", rating: 4 },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });

  it("returns unknown when the insert fails for another reason", async () => {
    mockRepo.findBySubject.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({ review: null, conflict: false });

    const result = await service.postReview(
      { subjectOrganizationId: "org-subject", rating: 4 },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Update review (optimistic lock)
// ─────────────────────────────────────────────────────────────

describe("ReputationService.updateReview", () => {
  it("updates a review when the version matches", async () => {
    const existing = buildReview({ version: 3 });
    mockRepo.findById.mockResolvedValue(existing);
    const updated = buildReview({ version: 4, rating: 5 });
    mockRepo.update.mockResolvedValue(updated);

    const result = await service.updateReview(
      "review-1",
      { rating: 5, version: 3 },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(true);
    expect(mockRepo.update).toHaveBeenCalledWith(
      "review-1",
      3,
      expect.objectContaining({ rating: 5 }),
      "user-1"
    );
  });

  it("returns version_conflict when the stored version differs", async () => {
    mockRepo.findById.mockResolvedValue(buildReview({ version: 5 }));

    const result = await service.updateReview(
      "review-1",
      { rating: 5, version: 3 },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("version_conflict");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("returns version_conflict when the optimistic update affects no rows", async () => {
    mockRepo.findById.mockResolvedValue(buildReview({ version: 3 }));
    mockRepo.update.mockResolvedValue(null);

    const result = await service.updateReview(
      "review-1",
      { rating: 5, version: 3 },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("version_conflict");
    }
  });

  it("returns not_found when the review does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.updateReview(
      "missing",
      { rating: 5, version: 1 },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("forbids editing a review owned by another organization", async () => {
    mockRepo.findById.mockResolvedValue(
      buildReview({ organizationId: "other-org" })
    );

    const result = await service.updateReview(
      "review-1",
      { rating: 5, version: 1 },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("rejects an out-of-range rating on update", async () => {
    mockRepo.findById.mockResolvedValue(buildReview({ version: 1 }));

    const result = await service.updateReview(
      "review-1",
      { rating: 0, version: 1 },
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Delete review
// ─────────────────────────────────────────────────────────────

describe("ReputationService.deleteReview", () => {
  it("soft-deletes the reviewer's own review", async () => {
    mockRepo.findById.mockResolvedValue(buildReview());
    mockRepo.softDelete.mockResolvedValue(true);

    const result = await service.deleteReview(
      "review-1",
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("review-1", "user-1");
  });

  it("forbids deleting a review owned by another organization", async () => {
    mockRepo.findById.mockResolvedValue(
      buildReview({ organizationId: "other-org" })
    );

    const result = await service.deleteReview(
      "review-1",
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it("returns not_found when deleting a missing review", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.deleteReview(
      "missing",
      "org-reviewer",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});
