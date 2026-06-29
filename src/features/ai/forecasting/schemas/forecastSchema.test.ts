import { describe, expect, it } from "vitest";
import {
  FORECAST_TYPES,
  forecastResultSchema,
  forecastTypeSchema,
} from "./forecastSchema";

function validForecast() {
  return {
    confidence: 0.72,
    summary: "Sales are trending upward into the next quarter.",
    reason: "Three consecutive months of growth in invoiced value.",
    points: [
      { period: "2026-07", predicted: 12000, low: 10000, high: 14000 },
      { period: "2026-08", predicted: 12500, low: null, high: null },
    ],
    assumptions: ["No major customer churn", "Stable pricing"],
    drivers: ["Seasonal uptick", "New customer onboarding"],
  };
}

describe("forecastTypeSchema", () => {
  it("accepts every supported forecast type", () => {
    for (const type of FORECAST_TYPES) {
      expect(forecastTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it("rejects an unknown forecast type", () => {
    expect(forecastTypeSchema.safeParse("weather").success).toBe(false);
  });
});

describe("forecastResultSchema", () => {
  it("parses a well-formed forecast", () => {
    const result = forecastResultSchema.safeParse(validForecast());
    expect(result.success).toBe(true);
  });

  it("allows null low/high bounds on a point", () => {
    const result = forecastResultSchema.safeParse({
      ...validForecast(),
      points: [{ period: "2026-07", predicted: 100, low: null, high: null }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a confidence above 1", () => {
    const result = forecastResultSchema.safeParse({
      ...validForecast(),
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a confidence below 0", () => {
    const result = forecastResultSchema.safeParse({
      ...validForecast(),
      confidence: -0.1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing summary", () => {
    const invalid = validForecast() as Record<string, unknown>;
    delete invalid.summary;
    expect(forecastResultSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a non-numeric predicted value", () => {
    const result = forecastResultSchema.safeParse({
      ...validForecast(),
      points: [
        { period: "2026-07", predicted: "lots", low: null, high: null },
      ],
    });
    expect(result.success).toBe(false);
  });
});
