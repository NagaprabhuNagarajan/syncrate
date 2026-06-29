"use client";

import { useCallback, useState } from "react";
import { generateForecastAction } from "@/features/ai/forecasting/actions/forecasting.actions";
import type {
  ForecastResult,
  ForecastType,
} from "@/features/ai/forecasting/types/forecast.types";

interface UseForecastState {
  readonly forecast: ForecastResult | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  /** The type of the currently-displayed forecast, if any. */
  readonly forecastType: ForecastType | null;
}

interface UseForecast extends UseForecastState {
  run: (organizationId: string, forecastType: ForecastType) => Promise<void>;
}

const INITIAL: UseForecastState = {
  forecast: null,
  isLoading: false,
  error: null,
  forecastType: null,
};

/**
 * Drives a single AI forecast request: tracks loading/error/result state and
 * invokes the `generateForecastAction` server action. UI-framework only — all
 * business logic lives in the forecasting service behind the action.
 */
export function useForecast(): UseForecast {
  const [state, setState] = useState<UseForecastState>(INITIAL);

  const run = useCallback(
    async (organizationId: string, forecastType: ForecastType) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const result = await generateForecastAction(
          organizationId,
          forecastType
        );
        if (result.success) {
          setState({
            forecast: result.data,
            isLoading: false,
            error: null,
            forecastType,
          });
        } else {
          setState({
            forecast: null,
            isLoading: false,
            error: result.error.message,
            forecastType,
          });
        }
      } catch {
        setState({
          forecast: null,
          isLoading: false,
          error: "Something went wrong while generating the forecast.",
          forecastType,
        });
      }
    },
    []
  );

  return { ...state, run };
}
