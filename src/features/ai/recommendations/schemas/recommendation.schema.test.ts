import { describe, it, expect } from "vitest";
import {
  RECOMMENDATION_CATEGORIES,
  recommendationOutputSchema,
} from "./recommendation.schema";

function validOutput() {
  return {
    confidence: 0.82,
    summary: "Three high-impact actions identified.",
    recommendations: [
      {
        category: "reorder" as const,
        title: "Reorder Blue Widget (SKU-12)",
        reason: "Stock is below the reorder level and sells steadily.",
        confidence: 0.9,
        priority: "high" as const,
        supportingData: [
          { label: "On hand", value: "4 units" },
          { label: "Reorder level", value: "20 units" },
        ],
        entityType: "product" as const,
        entityRef: "SKU-12 Blue Widget",
      },
    ],
  };
}

describe("recommendationOutputSchema", () => {
  it("parses a well-formed recommendation payload", () => {
    const parsed = recommendationOutputSchema.parse(validOutput());
    expect(parsed.recommendations).toHaveLength(1);
    expect(parsed.recommendations[0]?.category).toBe("reorder");
    expect(parsed.confidence).toBeCloseTo(0.82);
  });

  it("accepts an empty recommendations list", () => {
    const parsed = recommendationOutputSchema.parse({
      confidence: 0.1,
      summary: "Not enough data.",
      recommendations: [],
    });
    expect(parsed.recommendations).toEqual([]);
  });

  it("rejects confidence outside the 0..1 range", () => {
    const bad = { ...validOutput(), confidence: 1.5 };
    expect(recommendationOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown category", () => {
    const output = validOutput();
    const bad = {
      ...output,
      recommendations: [
        { ...output.recommendations[0], category: "teleport" },
      ],
    };
    expect(recommendationOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("requires a reason on each recommendation", () => {
    const output = validOutput();
    const item = { ...output.recommendations[0] } as Record<string, unknown>;
    delete item.reason;
    const bad = { ...output, recommendations: [item] };
    expect(recommendationOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("exposes the full set of recommendation categories", () => {
    expect(RECOMMENDATION_CATEGORIES).toContain("cross_sell");
    expect(RECOMMENDATION_CATEGORIES).toContain("upsell");
    expect(RECOMMENDATION_CATEGORIES.length).toBe(7);
  });
});
