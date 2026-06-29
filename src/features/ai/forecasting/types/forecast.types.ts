/**
 * AI Forecasting domain types (spec §8).
 *
 * The forecast *output* shapes are inferred from the Zod v4 schemas (single
 * source of truth) and re-exported here for ergonomic imports.
 */
import type { FORECAST_TYPES } from "@/features/ai/forecasting/schemas/forecastSchema";

export type {
  ForecastPoint,
  ForecastResult,
} from "@/features/ai/forecasting/schemas/forecastSchema";

/** The kind of forecast requested by the user. */
export type ForecastType = (typeof FORECAST_TYPES)[number];

/** UI metadata describing a selectable forecast type. */
export interface ForecastTypeOption {
  readonly value: ForecastType;
  readonly label: string;
  readonly description: string;
}

/**
 * A compact monthly historical data point the service feeds to the model.
 * Internal to the forecasting service / prompt builder.
 */
export interface HistoryPoint {
  /** ISO month bucket, e.g. "2026-06". */
  readonly period: string;
  readonly value: number;
}

/** Summarized historical data assembled from existing business repositories. */
export interface ForecastHistory {
  /** The unit the series values are measured in, e.g. "INR" or "units". */
  readonly unit: string;
  /** Ordered (oldest → newest) monthly series. */
  readonly series: readonly HistoryPoint[];
  /** Extra human-readable context lines surfaced to the model. */
  readonly context: readonly string[];
}
