import { describe, expect, it } from "vitest";
import {
  createReviewSchema,
  updateReviewSchema,
} from "./reputation.schemas";

const SUBJECT = "11111111-1111-1111-1111-111111111111";

describe("createReviewSchema", () => {
  it("accepts a valid review", () => {
    const result = createReviewSchema.safeParse({
      subjectOrganizationId: SUBJECT,
      rating: 4,
      title: "Great",
      comment: "Reliable supplier",
      isRecommended: true,
    });
    expect(result.success).toBe(true);
  });

  it("coerces numeric-string ratings", () => {
    const result = createReviewSchema.safeParse({
      subjectOrganizationId: SUBJECT,
      rating: "5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rating).toBe(5);
    }
  });

  it.each([0, 6, -1, 10])("rejects out-of-range rating %s", (rating) => {
    const result = createReviewSchema.safeParse({
      subjectOrganizationId: SUBJECT,
      rating,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer rating", () => {
    const result = createReviewSchema.safeParse({
      subjectOrganizationId: SUBJECT,
      rating: 3.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid subject organization id", () => {
    const result = createReviewSchema.safeParse({
      subjectOrganizationId: "not-a-uuid",
      rating: 4,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an overly long comment", () => {
    const result = createReviewSchema.safeParse({
      subjectOrganizationId: SUBJECT,
      rating: 4,
      comment: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateReviewSchema", () => {
  it("requires a version for optimistic locking", () => {
    const result = updateReviewSchema.safeParse({ rating: 4 });
    expect(result.success).toBe(false);
  });

  it("accepts a partial update with a version", () => {
    const result = updateReviewSchema.safeParse({ rating: 5, version: 2 });
    expect(result.success).toBe(true);
  });

  it("rejects an out-of-range rating on update", () => {
    const result = updateReviewSchema.safeParse({ rating: 9, version: 1 });
    expect(result.success).toBe(false);
  });
});
