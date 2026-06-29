import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useForecast } from "./useForecast";
import type { ForecastResult } from "@/features/ai/forecasting/types/forecast.types";

vi.mock("@/features/ai/forecasting/actions/forecasting.actions", () => ({
  generateForecastAction: vi.fn(),
}));

import { generateForecastAction } from "@/features/ai/forecasting/actions/forecasting.actions";

const actionMock = vi.mocked(generateForecastAction);

const FORECAST: ForecastResult = {
  confidence: 0.7,
  summary: "Up",
  reason: "Trend",
  points: [{ period: "2026-07", predicted: 10, low: null, high: null }],
  assumptions: [],
  drivers: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useForecast", () => {
  it("starts idle with no forecast", () => {
    const { result } = renderHook(() => useForecast());
    expect(result.current.forecast).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("stores the forecast on success", async () => {
    actionMock.mockResolvedValue({ success: true, data: FORECAST });
    const { result } = renderHook(() => useForecast());

    await act(async () => {
      await result.current.run("org-1", "sales");
    });

    expect(result.current.forecast).toEqual(FORECAST);
    expect(result.current.forecastType).toBe("sales");
    expect(result.current.error).toBeNull();
    expect(actionMock).toHaveBeenCalledWith("org-1", "sales");
  });

  it("stores the error message on a failure result", async () => {
    actionMock.mockResolvedValue({
      success: false,
      error: { code: "rate_limited", message: "Busy" },
    });
    const { result } = renderHook(() => useForecast());

    await act(async () => {
      await result.current.run("org-1", "revenue");
    });

    expect(result.current.forecast).toBeNull();
    expect(result.current.error).toBe("Busy");
    expect(result.current.forecastType).toBe("revenue");
  });

  it("handles a thrown error gracefully", async () => {
    actionMock.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useForecast());

    await act(async () => {
      await result.current.run("org-1", "sales");
    });

    await waitFor(() => {
      expect(result.current.error).toMatch(/something went wrong/i);
    });
    expect(result.current.isLoading).toBe(false);
  });
});
