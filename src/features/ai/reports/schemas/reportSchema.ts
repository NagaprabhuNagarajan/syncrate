// AI structured-output schema for Smart Reports (spec §11).
//
// The report service gathers compact figures from the real repositories, then
// asks the gateway to produce a structured report: sections with a narrative,
// key metrics, a trend, and recommendations — each carrying its own confidence
// and explanation.
//
// IMPORTANT: AI output schemas MUST use Zod v4 — the gateway's
// `zodOutputFormat` helper only accepts v4 schemas.
import { z } from "zod/v4";

/** The report kinds Smart Reports can generate (spec §11). */
export const REPORT_TYPES = [
  "business_health",
  "profit_analysis",
  "inventory_summary",
  "cash_flow",
  "customer_analysis",
  "supplier_performance",
] as const;

export const reportTypeSchema = z.enum(REPORT_TYPES);

/** Direction of a section's underlying trend. */
export const reportTrendSchema = z.enum(["up", "down", "flat", "mixed"]);

/** A headline figure within a report section. */
export const reportMetricSchema = z.object({
  label: z.string().describe("Metric name, e.g. 'Total revenue' or 'Outstanding'"),
  value: z
    .string()
    .describe("Display value as a string, e.g. '₹4.2L', '12', '38%'"),
  changePercent: z
    .number()
    .nullable()
    .describe("Percent change vs the prior period, or null if not applicable"),
});

export const reportSectionSchema = z.object({
  title: z.string().describe("Short section heading, e.g. 'Revenue & Receivables'"),
  narrative: z
    .string()
    .describe("Plain-language analysis grounded ONLY in the supplied figures"),
  trend: reportTrendSchema.describe("Overall direction this section reflects"),
  metrics: z
    .array(reportMetricSchema)
    .describe("Key figures supporting this section"),
  recommendations: z
    .array(z.string())
    .describe("Actionable next steps derived from this section's data"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Model confidence in this section, 0..1"),
  explanation: z
    .string()
    .describe("Why this section reads the way it does — the reasoning in brief"),
});

/**
 * Top-level report output. The gateway auto-reads the top-level `confidence`
 * for the audit trail (spec §20).
 */
export const reportOutputSchema = z.object({
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall confidence in this report, 0..1"),
  reportType: reportTypeSchema.describe("Which report this is"),
  title: z.string().describe("Report title, e.g. 'Business Health — June 2026'"),
  summary: z
    .string()
    .describe("One-paragraph executive summary of the whole report"),
  sections: z
    .array(reportSectionSchema)
    .describe("The report sections, most important first"),
});

export type ReportType = z.infer<typeof reportTypeSchema>;
export type ReportTrend = z.infer<typeof reportTrendSchema>;
export type ReportMetric = z.infer<typeof reportMetricSchema>;
export type ReportSection = z.infer<typeof reportSectionSchema>;
export type ReportOutput = z.infer<typeof reportOutputSchema>;
