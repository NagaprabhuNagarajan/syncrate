import { describe, it, expect } from "vitest";
import {
  reportOutputSchema,
  reportTypeSchema,
  REPORT_TYPES,
  type ReportOutput,
} from "./reportSchema";

function buildReport(overrides: Partial<ReportOutput> = {}): ReportOutput {
  return {
    confidence: 0.82,
    reportType: "business_health",
    title: "Business Health — June 2026",
    summary: "Revenue is steady but receivables are climbing.",
    sections: [
      {
        title: "Revenue & Receivables",
        narrative: "Total billed ₹4.2L with ₹1.1L outstanding.",
        trend: "up",
        metrics: [
          { label: "Total revenue", value: "₹4.2L", changePercent: 12 },
          { label: "Outstanding", value: "₹1.1L", changePercent: null },
        ],
        recommendations: ["Chase the 3 overdue invoices."],
        confidence: 0.8,
        explanation: "Derived from invoice totals vs amounts paid.",
      },
    ],
    ...overrides,
  };
}

describe("reportSchema", () => {
  it("accepts a well-formed report", () => {
    const result = reportOutputSchema.safeParse(buildReport());
    expect(result.success).toBe(true);
  });

  it("accepts a report with no sections", () => {
    const result = reportOutputSchema.safeParse(buildReport({ sections: [] }));
    expect(result.success).toBe(true);
  });

  it("rejects confidence outside 0..1", () => {
    const result = reportOutputSchema.safeParse(
      buildReport({ confidence: -0.1 })
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unknown report type", () => {
    const result = reportOutputSchema.safeParse(
      buildReport({ reportType: "tax_filing" as ReportOutput["reportType"] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a section with an invalid trend", () => {
    const report = buildReport();
    const broken = {
      ...report,
      sections: [{ ...report.sections[0], trend: "sideways" }],
    };
    const result = reportOutputSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("exposes every report type in the enum", () => {
    for (const type of REPORT_TYPES) {
      expect(reportTypeSchema.safeParse(type).success).toBe(true);
    }
  });
});
