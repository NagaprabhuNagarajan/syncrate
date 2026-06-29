import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { InsightsView } from "./insights-view";
import type { InsightOutput } from "../schemas/insight.schema";

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));

vi.mock("../actions/insight.actions", () => ({
  generateInsightsAction: generateMock,
}));

function output(): InsightOutput {
  return {
    confidence: 0.75,
    summary: "Revenue up, churn rising.",
    insights: [
      {
        category: "revenue_growth",
        title: "Revenue up 18%",
        explanation: "May outpaced April.",
        trend: "up",
        severity: "positive",
        confidence: 0.88,
        metric: { label: "MoM revenue", value: "4.2L", changePercent: 18 },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InsightsView", () => {
  it("renders the heading and an empty state with an analyze action", () => {
    render(<InsightsView organizationId="org-1" canGenerate />);
    expect(
      screen.getByRole("heading", { name: /ai insights/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/no insights yet/i)).toBeInTheDocument();
  });

  it("hides the analyze button when the user cannot generate", () => {
    render(<InsightsView organizationId="org-1" canGenerate={false} />);
    expect(
      screen.queryByRole("button", { name: /analyze business/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
  });

  it("renders insight cards after a successful analysis", async () => {
    generateMock.mockResolvedValue({ success: true, data: output() });
    const user = userEvent.setup();
    render(<InsightsView organizationId="org-1" canGenerate />);

    await user.click(screen.getByRole("button", { name: /^analyze$/i }));

    expect(await screen.findByText("Revenue up 18%")).toBeInTheDocument();
    expect(screen.getByText("MoM revenue")).toBeInTheDocument();
    expect(screen.getByText("+18.0%")).toBeInTheDocument();
    expect(generateMock).toHaveBeenCalledWith("org-1");
  });

  it("shows an error state when analysis fails", async () => {
    generateMock.mockResolvedValue({
      success: false,
      error: { code: "provider_error", message: "AI service is down." },
    });
    const user = userEvent.setup();
    render(<InsightsView organizationId="org-1" canGenerate />);

    await user.click(screen.getByRole("button", { name: /^analyze$/i }));

    await waitFor(() =>
      expect(screen.getByText("AI service is down.")).toBeInTheDocument()
    );
  });
});
