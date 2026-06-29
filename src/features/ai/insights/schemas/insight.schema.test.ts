import { describe, it, expect } from "vitest";
import { INSIGHT_CATEGORIES, insightOutputSchema } from "./insight.schema";

function validOutput() {
  return {
    confidence: 0.78,
    summary: "Revenue is growing but churn risk is rising.",
    insights: [
      {
        category: "revenue_growth" as const,
        title: "Revenue up 18% month over month",
        explanation: "May revenue outpaced April across all customers.",
        trend: "up" as const,
        severity: "positive" as const,
        confidence: 0.88,
        metric: {
          label: "MoM revenue",
          value: "₹4.2L",
          changePercent: 18,
        },
      },
    ],
  };
}

describe("insightOutputSchema", () => {
  it("parses a well-formed insight payload", () => {
    const parsed = insightOutputSchema.parse(validOutput());
    expect(parsed.insights).toHaveLength(1);
    expect(parsed.insights[0]?.trend).toBe("up");
    expect(parsed.insights[0]?.metric.changePercent).toBe(18);
  });

  it("accepts a null metric change percent", () => {
    const output = validOutput();
    const parsed = insightOutputSchema.parse({
      ...output,
      insights: [
        {
          ...output.insights[0],
          metric: { ...output.insights[0].metric, changePercent: null },
        },
      ],
    });
    expect(parsed.insights[0]?.metric.changePercent).toBeNull();
  });

  it("accepts an empty insights list", () => {
    const parsed = insightOutputSchema.parse({
      confidence: 0.05,
      summary: "Not enough data yet.",
      insights: [],
    });
    expect(parsed.insights).toEqual([]);
  });

  it("rejects an invalid severity", () => {
    const output = validOutput();
    const bad = {
      ...output,
      insights: [{ ...output.insights[0], severity: "catastrophic" }],
    };
    expect(insightOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects confidence outside the 0..1 range", () => {
    expect(
      insightOutputSchema.safeParse({ ...validOutput(), confidence: -0.2 })
        .success
    ).toBe(false);
  });

  it("exposes the full set of insight categories", () => {
    expect(INSIGHT_CATEGORIES).toContain("customer_churn_risk");
    expect(INSIGHT_CATEGORIES).toContain("profitability_trend");
    expect(INSIGHT_CATEGORIES.length).toBe(6);
  });
});
