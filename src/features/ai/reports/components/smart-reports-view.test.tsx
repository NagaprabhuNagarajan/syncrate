import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/tests/utils";
import { SmartReportsView } from "./smart-reports-view";
import type { SmartReport } from "@/features/ai/reports/types/report.types";

const { mockRun } = vi.hoisted(() => ({ mockRun: vi.fn() }));

vi.mock("@/features/ai/reports/actions/report.actions", () => ({
  runSmartReportAction: mockRun,
}));

const sampleReport: SmartReport = {
  confidence: 0.85,
  reportType: "business_health",
  title: "Business Health — June 2026",
  summary: "Revenue steady, receivables rising.",
  sections: [
    {
      title: "Revenue & Receivables",
      narrative: "Total billed is healthy.",
      trend: "up",
      metrics: [{ label: "Total revenue", value: "₹4.2L", changePercent: 12 }],
      recommendations: ["Chase overdue invoices."],
      confidence: 0.8,
      explanation: "From invoice totals.",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SmartReportsView", () => {
  it("renders the type selector and an initial empty state", () => {
    render(<SmartReportsView organizationId="org-1" canGenerate />);
    expect(screen.getByLabelText("Report type")).toBeInTheDocument();
    expect(screen.getByText("No report yet")).toBeInTheDocument();
  });

  it("generates a report and renders sections with recommendations", async () => {
    mockRun.mockResolvedValue({ success: true, data: sampleReport });
    render(<SmartReportsView organizationId="org-1" canGenerate />);

    fireEvent.click(screen.getByRole("button", { name: "Generate report" }));

    await waitFor(() => {
      expect(
        screen.getByText("Business Health — June 2026")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Revenue & Receivables")).toBeInTheDocument();
    expect(screen.getByText("Chase overdue invoices.")).toBeInTheDocument();
    expect(screen.getByText("Total revenue")).toBeInTheDocument();
    expect(mockRun).toHaveBeenCalledWith("org-1", "business_health");
  });

  it("sends the selected report type to the action", async () => {
    mockRun.mockResolvedValue({ success: true, data: sampleReport });
    render(<SmartReportsView organizationId="org-1" canGenerate />);

    fireEvent.change(screen.getByLabelText("Report type"), {
      target: { value: "cash_flow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate report" }));

    await waitFor(() => {
      expect(mockRun).toHaveBeenCalledWith("org-1", "cash_flow");
    });
  });

  it("shows an error message when generation fails", async () => {
    mockRun.mockResolvedValue({
      success: false,
      error: { code: "rate_limited", message: "Service is busy" },
    });
    render(<SmartReportsView organizationId="org-1" canGenerate />);

    fireEvent.click(screen.getByRole("button", { name: "Generate report" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Service is busy");
    });
  });

  it("warns and disables generation without permission", () => {
    render(<SmartReportsView organizationId="org-1" canGenerate={false} />);
    expect(screen.getByLabelText("Report type")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "do not have permission"
    );
  });
});
