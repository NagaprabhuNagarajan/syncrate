import { describe, it, expect } from "vitest";
import {
  searchIntentSchema,
  searchEntitySchema,
  SEARCH_ENTITIES,
  type SearchIntent,
} from "./searchIntentSchema";

function buildIntent(overrides: Partial<SearchIntent> = {}): SearchIntent {
  return {
    confidence: 0.9,
    entity: "invoice",
    explanation: "Unpaid invoices",
    filters: {
      keyword: null,
      status: null,
      paymentStatus: "unpaid",
      lowStock: null,
      overdue: null,
    },
    timeRange: null,
    sort: null,
    limit: null,
    ...overrides,
  };
}

describe("searchIntentSchema", () => {
  it("accepts a well-formed intent", () => {
    const result = searchIntentSchema.safeParse(buildIntent());
    expect(result.success).toBe(true);
  });

  it("accepts a fully-specified intent with time range and sort", () => {
    const result = searchIntentSchema.safeParse(
      buildIntent({
        entity: "inventory",
        filters: {
          keyword: "widget",
          status: null,
          paymentStatus: null,
          lowStock: true,
          overdue: null,
        },
        timeRange: { from: "2026-06-01", to: "2026-06-30" },
        sort: { field: "name", direction: "asc" },
        limit: 25,
      })
    );
    expect(result.success).toBe(true);
  });

  it("rejects confidence outside 0..1", () => {
    const result = searchIntentSchema.safeParse(
      buildIntent({ confidence: 1.4 })
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unknown entity", () => {
    const result = searchIntentSchema.safeParse(
      buildIntent({ entity: "branch" as SearchIntent["entity"] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a limit above the maximum", () => {
    const result = searchIntentSchema.safeParse(buildIntent({ limit: 999 }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing filters object", () => {
    const { filters: _filters, ...rest } = buildIntent();
    const result = searchIntentSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("exposes every entity in the enum", () => {
    for (const entity of SEARCH_ENTITIES) {
      expect(searchEntitySchema.safeParse(entity).success).toBe(true);
    }
  });
});
