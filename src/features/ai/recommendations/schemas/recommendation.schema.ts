// AI structured-output schema for the Recommendation Engine (spec §9).
//
// IMPORTANT: AI output schemas MUST use Zod v4 — the gateway's
// `zodOutputFormat` helper (from "@anthropic-ai/sdk/helpers/zod") only accepts
// v4 schemas. The rest of the app uses classic `zod` for form validation.
import { z } from "zod/v4";

/**
 * The recommendation categories Syncrate produces (spec §9). Each maps to a
 * concrete business action a user can take.
 */
export const RECOMMENDATION_CATEGORIES = [
  "reorder",
  "best_supplier",
  "customer_followup",
  "discount",
  "inventory_optimization",
  "cross_sell",
  "upsell",
] as const;

export const recommendationCategorySchema = z.enum(RECOMMENDATION_CATEGORIES);

/** A single quantitative figure that justifies a recommendation. */
export const supportingDatumSchema = z.object({
  label: z
    .string()
    .describe("Name of the figure, e.g. 'Units sold (30d)' or 'Days of cover'"),
  value: z
    .string()
    .describe("The figure as a display string, e.g. '120 units' or '4 days'"),
});

export const recommendationItemSchema = z.object({
  category: recommendationCategorySchema.describe(
    "Which kind of recommendation this is"
  ),
  title: z
    .string()
    .describe("Short imperative headline, e.g. 'Reorder Blue Widget (SKU-12)'"),
  reason: z
    .string()
    .describe(
      "Plain-language explanation of WHY this is recommended, grounded in the data"
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Model confidence in this recommendation, 0..1"),
  priority: z
    .enum(["high", "medium", "low"])
    .describe("How urgently the user should act"),
  supportingData: z
    .array(supportingDatumSchema)
    .describe("The figures behind this recommendation (at least one)"),
  entityType: z
    .enum(["product", "supplier", "customer", "inventory", "general"])
    .describe("The kind of business entity this concerns"),
  entityRef: z
    .string()
    .nullable()
    .describe("Human-readable reference (name/code) of the entity, or null"),
});

/**
 * Top-level recommendation output. The gateway auto-reads the top-level
 * `confidence` for the audit trail (spec §20).
 */
export const recommendationOutputSchema = z.object({
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall confidence in this batch of recommendations, 0..1"),
  summary: z
    .string()
    .describe("One-sentence overview of the recommendations as a whole"),
  recommendations: z
    .array(recommendationItemSchema)
    .describe("The list of actionable recommendations, most important first"),
});

export type RecommendationCategory = z.infer<typeof recommendationCategorySchema>;
export type SupportingDatum = z.infer<typeof supportingDatumSchema>;
export type RecommendationItem = z.infer<typeof recommendationItemSchema>;
export type RecommendationOutput = z.infer<typeof recommendationOutputSchema>;
