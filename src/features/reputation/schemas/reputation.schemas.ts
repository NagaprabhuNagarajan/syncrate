import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Shared validators
// ─────────────────────────────────────────────────────────────

const rating = z.coerce
  .number({ invalid_type_error: "Rating is required" })
  .int("Rating must be a whole number")
  .min(1, "Rating must be at least 1")
  .max(5, "Rating cannot exceed 5");

const optionalTitle = z
  .string()
  .trim()
  .max(150, "Title must be 150 characters or less")
  .optional()
  .or(z.literal(""));

const optionalComment = z
  .string()
  .trim()
  .max(2000, "Comment must be 2000 characters or less")
  .optional()
  .or(z.literal(""));

const isRecommended = z.coerce.boolean().optional();

// ─────────────────────────────────────────────────────────────
// Create review
// ─────────────────────────────────────────────────────────────

export const createReviewSchema = z.object({
  subjectOrganizationId: z
    .string({ required_error: "A subject organization is required" })
    .uuid("Invalid organization id"),
  rating,
  title: optionalTitle,
  comment: optionalComment,
  isRecommended,
  referenceType: z.string().trim().max(50).optional().or(z.literal("")),
  referenceId: z.string().uuid("Invalid reference id").optional().or(z.literal("")),
});

export type CreateReviewFormValues = z.infer<typeof createReviewSchema>;

// ─────────────────────────────────────────────────────────────
// Update review
// ─────────────────────────────────────────────────────────────

export const updateReviewSchema = z.object({
  rating: rating.optional(),
  title: optionalTitle,
  comment: optionalComment,
  isRecommended,
  version: z.coerce
    .number({ invalid_type_error: "Version is required" })
    .int()
    .min(1, "Invalid version"),
});

export type UpdateReviewFormValues = z.infer<typeof updateReviewSchema>;
