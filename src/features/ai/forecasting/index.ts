/**
 * AI Forecasting capability (spec §8) — public barrel.
 */
export { ForecastingView } from "@/features/ai/forecasting/components/forecasting-view";
export { ForecastingService } from "@/features/ai/forecasting/services/forecasting.service";
export { generateForecastAction } from "@/features/ai/forecasting/actions/forecasting.actions";
export { useForecast } from "@/features/ai/forecasting/hooks/useForecast";
export {
  FORECAST_TYPES,
  forecastResultSchema,
  forecastTypeSchema,
} from "@/features/ai/forecasting/schemas/forecastSchema";
export type {
  ForecastPoint,
  ForecastResult,
  ForecastType,
  ForecastTypeOption,
} from "@/features/ai/forecasting/types/forecast.types";
