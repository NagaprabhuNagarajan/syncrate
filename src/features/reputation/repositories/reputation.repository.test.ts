import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { ReputationRepository } from "./reputation.repository";

type DbReviewRow = Database["public"]["Tables"]["marketplace_reviews"]["Row"];
type DbReputationRow =
  Database["public"]["Functions"]["get_organization_reputation"]["Returns"][number];
type DbReviewListRow =
  Database["public"]["Functions"]["list_organization_reviews"]["Returns"][number];

interface QueryResult {
  data: unknown;
  error: unknown;
}

/** A chainable, thenable PostgREST-style query builder. */
interface MockBuilder {
  insert: Mock;
  update: Mock;
  select: Mock;
  eq: Mock;
  is: Mock;
  single: Mock;
  then: (resolve: (r: QueryResult) => unknown) => unknown;
  __result: QueryResult;
}

interface MockClient {
  client: AppSupabaseClient;
  from: Mock;
  rpc: Mock;
  builders: MockBuilder[];
}

function createMockClient(
  fromResults: QueryResult[],
  rpcResult: QueryResult = { data: null, error: null }
): MockClient {
  const builders: MockBuilder[] = [];
  let index = 0;

  const from = vi.fn(() => {
    const result = fromResults[index] ?? { data: null, error: null };
    index += 1;

    const builder = {
      __result: result,
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      then: (resolve: (r: QueryResult) => unknown) => resolve(result),
    } as MockBuilder;

    builders.push(builder);
    return builder;
  });

  const rpc = vi.fn(() => Promise.resolve(rpcResult));
  const client = { from, rpc } as unknown as AppSupabaseClient;
  return { client, from, rpc, builders };
}

function buildReviewRow(overrides: Partial<DbReviewRow> = {}): DbReviewRow {
  return {
    id: "review-1",
    organization_id: "org-reviewer",
    subject_organization_id: "org-subject",
    rating: 4,
    title: "Great",
    comment: "Reliable",
    reference_type: null,
    reference_id: null,
    is_recommended: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    created_by: "user-1",
    updated_by: null,
    deleted_by: null,
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// RPC reads
// ─────────────────────────────────────────────────────────────

describe("ReputationRepository.getReputation", () => {
  it("maps the aggregate RPC row", async () => {
    const row: DbReputationRow = {
      review_count: 12,
      average_rating: 4.25,
      recommended_count: 9,
      recommend_percent: 75,
    };
    const { client, rpc } = createMockClient([], { data: [row], error: null });
    const repo = new ReputationRepository(client);

    const result = await repo.getReputation("org-subject");

    expect(rpc).toHaveBeenCalledWith("get_organization_reputation", {
      p_org_id: "org-subject",
    });
    expect(result).toEqual({
      reviewCount: 12,
      averageRating: 4.25,
      recommendedCount: 9,
      recommendPercent: 75,
    });
  });

  it("returns an empty summary when the RPC errors or is empty", async () => {
    const { client } = createMockClient([], { data: [], error: null });
    const repo = new ReputationRepository(client);

    const result = await repo.getReputation("org-subject");

    expect(result).toEqual({
      reviewCount: 0,
      averageRating: 0,
      recommendedCount: 0,
      recommendPercent: 0,
    });
  });
});

describe("ReputationRepository.listReviews", () => {
  it("maps the list RPC rows", async () => {
    const row: DbReviewListRow = {
      id: "review-1",
      reviewer_name: "Acme Traders",
      rating: 5,
      title: "Excellent",
      comment: "Fast",
      is_recommended: true,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const { client, rpc } = createMockClient([], { data: [row], error: null });
    const repo = new ReputationRepository(client);

    const result = await repo.listReviews("org-subject", 10, 5);

    expect(rpc).toHaveBeenCalledWith("list_organization_reviews", {
      p_org_id: "org-subject",
      p_limit: 10,
      p_offset: 5,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "review-1",
      reviewerName: "Acme Traders",
      rating: 5,
      isRecommended: true,
    });
    expect(result[0].createdAt).toBeInstanceOf(Date);
  });

  it("returns an empty array on RPC error", async () => {
    const { client } = createMockClient([], {
      data: null,
      error: { message: "boom" },
    });
    const repo = new ReputationRepository(client);

    expect(await repo.listReviews("org-subject")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// Table CRUD
// ─────────────────────────────────────────────────────────────

describe("ReputationRepository.create", () => {
  it("returns the mapped review on success", async () => {
    const { client } = createMockClient([
      { data: buildReviewRow(), error: null },
    ]);
    const repo = new ReputationRepository(client);

    const outcome = await repo.create({
      organization_id: "org-reviewer",
      subject_organization_id: "org-subject",
      rating: 4,
    });

    expect(outcome.conflict).toBe(false);
    expect(outcome.review?.id).toBe("review-1");
  });

  it("flags conflict on a unique-violation (23505)", async () => {
    const { client } = createMockClient([
      { data: null, error: { code: "23505", message: "duplicate" } },
    ]);
    const repo = new ReputationRepository(client);

    const outcome = await repo.create({
      organization_id: "org-reviewer",
      subject_organization_id: "org-subject",
      rating: 4,
    });

    expect(outcome.conflict).toBe(true);
    expect(outcome.review).toBeNull();
  });
});

describe("ReputationRepository.update", () => {
  it("issues an optimistic-locked update incrementing the version", async () => {
    const { client, builders } = createMockClient([
      { data: buildReviewRow({ version: 4, rating: 5 }), error: null },
    ]);
    const repo = new ReputationRepository(client);

    const result = await repo.update("review-1", 3, { rating: 5 }, "user-1");

    expect(result?.version).toBe(4);
    const builder = builders[0];
    // version guard + new version on the update payload
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ version: 4, rating: 5, updated_by: "user-1" })
    );
    expect(builder.eq).toHaveBeenCalledWith("version", 3);
  });

  it("returns null when no row matches the expected version", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "no rows" } },
    ]);
    const repo = new ReputationRepository(client);

    expect(await repo.update("review-1", 3, { rating: 5 }, "user-1")).toBeNull();
  });
});

describe("ReputationRepository.softDelete", () => {
  it("returns true when the soft delete succeeds", async () => {
    const { client } = createMockClient([{ data: null, error: null }]);
    const repo = new ReputationRepository(client);

    expect(await repo.softDelete("review-1", "user-1")).toBe(true);
  });

  it("returns false when the soft delete errors", async () => {
    const { client } = createMockClient([
      { data: null, error: { message: "boom" } },
    ]);
    const repo = new ReputationRepository(client);

    expect(await repo.softDelete("review-1", "user-1")).toBe(false);
  });
});
