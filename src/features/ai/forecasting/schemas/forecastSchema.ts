/**
 * AI Forecasting output schemas (spec §8).
 *
 * IMPORTANT: AI structured-output schemas MUST use Zod v4 — the AI Gateway
 * feeds them to the Anthropic SDK's `zodOutputFormat` helper, which only
 * understands the v4 schema shape. (The rest of the app uses classic `zod`
 * for form validation; the two coexist within the same zod 3.25+ install.)
 */
import { z } from "zod/v4";

/** The kinds of forecast a user can request. */
export const FORECAST_TYPES = [
  "sales",
  "inventory",
  "purchase",
  "revenue",
  "cash_flow",
  "seasonal_demand",
] as const;

/** Validates the `forecastType` argument crossing the server boundary. */
export const forecastTypeSchema = z.enum(FORECAST_TYPES);

/**
 * A single projected period: a human-readable label, the predicted value, and
 * an optional low/high confidence band (null when the model cannot bound it).
 */
export const forecastPointSchema = z.object({
  period: z.string().describe("Period label, e.g. '2026-07' or 'Jul 2026'"),
  predicted: z.number().describe("Predicted value for this period"),
  low: z
    .number()
    .nullable()
    .describe("Lower bound of the expected range, or null"),
  high: z
    .number()
    .nullable()
    .describe("Upper bound of the expected range, or null"),
});

/**
 * The full structured forecast. `confidence` is intentionally a TOP-LEVEL
 * number so the AI Gateway can auto-extract it for the audit trail.
 */
export const forecastResultSchema = z.object({
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall confidence in this forecast, 0..1"),
  summary: z
    .string()
    .describe("One- to three-sentence plain-language summary of the outlook"),
  reason: z
    .string()
    .describe("Why the model arrived at this projection from the data"),
  points: z
    .array(forecastPointSchema)
    .describe("Ordered future periods being forecast"),
  assumptions: z
    .array(z.string())
    .describe("Key assumptions the forecast depends on"),
  drivers: z
    .array(z.string())
    .describe("The main factors driving the projected trend"),
});

export type ForecastPoint = z.infer<typeof forecastPointSchema>;
export type ForecastResult = z.infer<typeof forecastResultSchema>;
