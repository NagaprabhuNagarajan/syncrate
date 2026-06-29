// AI structured-output schema for Business-Intelligence Insights (spec §13).
//
// IMPORTANT: AI output schemas MUST use Zod v4 — the gateway's
// `zodOutputFormat` helper only accepts v4 schemas.
import { z } from "zod/v4";

/**
 * The insight categories Syncrate surfaces on the BI dashboard (spec §13).
 */
export const INSIGHT_CATEGORIES = [
  "revenue_growth",
  "declining_sales",
  "slow_moving_inventory",
  "customer_churn_risk",
  "supplier_performance",
  "profitability_trend",
] as const;

export const insightCategorySchema = z.enum(INSIGHT_CATEGORIES);

/** Direction of the underlying trend. */
export const insightTrendSchema = z.enum(["up", "down", "flat"]);

/** How much attention the insight warrants. */
export const insightSeveritySchema = z.enum([
  "positive",
  "info",
  "warning",
  "critical",
]);

/** A headline metric that quantifies the insight. */
export const insightMetricSchema = z.object({
  label: z.string().describe("Name of the metric, e.g. 'MoM revenue'"),
  value: z
    .string()
    .describe("Current value as a display string, e.g. '₹4.2L' or '12 SKUs'"),
  changePercent: z
    .number()
    .nullable()
    .describe("Percent change vs the comparison period, or null if N/A"),
});

export const insightItemSchema = z.object({
  category: insightCategorySchema.describe("Which kind of insight this is"),
  title: z.string().describe("Short headline, e.g. 'Revenue up 18% this month'"),
  explanation: z
    .string()
    .describe("Plain-language explanation grounded in the data figures"),
  trend: insightTrendSchema.describe("Direction of the underlying movement"),
  severity: insightSeveritySchema.describe("How much attention this warrants"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Model confidence in this insight, 0..1"),
  metric: insightMetricSchema.describe("The headline figure for this insight"),
});

/**
 * Top-level insights output. The gateway auto-reads the top-level `confidence`
 * for the audit trail (spec §20).
 */
export const insightOutputSchema = z.object({
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall confidence in this set of insights, 0..1"),
  summary: z
    .string()
    .describe("One-sentence overview of the business's current health"),
  insights: z
    .array(insightItemSchema)
    .describe("The list of insights, most important first"),
});

export type InsightCategory = z.infer<typeof insightCategorySchema>;
export type InsightTrend = z.infer<typeof insightTrendSchema>;
export type InsightSeverity = z.infer<typeof insightSeveritySchema>;
export type InsightMetric = z.infer<typeof insightMetricSchema>;
export type InsightItem = z.infer<typeof insightItemSchema>;
export type InsightOutput = z.infer<typeof insightOutputSchema>;
