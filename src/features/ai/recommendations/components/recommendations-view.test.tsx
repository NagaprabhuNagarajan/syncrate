import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { RecommendationsView } from "./recommendations-view";
import type { RecommendationOutput } from "../schemas/recommendation.schema";

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));

vi.mock("../actions/recommendation.actions", () => ({
  generateRecommendationsAction: generateMock,
}));

function output(): RecommendationOutput {
  return {
    confidence: 0.8,
    summary: "Two actions identified.",
    recommendations: [
      {
        category: "reorder",
        title: "Reorder Blue Widget",
        reason: "Stock below reorder level.",
        confidence: 0.92,
        priority: "high",
        supportingData: [{ label: "On hand", value: "4 units" }],
        entityType: "product",
        entityRef: "SKU-12",
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecommendationsView", () => {
  it("renders the heading and an empty state with a generate action", () => {
    render(<RecommendationsView organizationId="org-1" canGenerate />);
    expect(
      screen.getByRole("heading", { name: /ai recommendations/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/no recommendations yet/i)).toBeInTheDocument();
  });

  it("hides the generate button when the user cannot generate", () => {
    render(
      <RecommendationsView organizationId="org-1" canGenerate={false} />
    );
    expect(
      screen.queryByRole("button", { name: /generate/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/do not have permission/i)
    ).toBeInTheDocument();
  });

  it("renders recommendation cards after a successful generation", async () => {
    generateMock.mockResolvedValue({ success: true, data: output() });
    const user = userEvent.setup();
    render(<RecommendationsView organizationId="org-1" canGenerate />);

    await user.click(
      screen.getByRole("button", { name: /^generate$/i })
    );

    expect(await screen.findByText("Reorder Blue Widget")).toBeInTheDocument();
    expect(screen.getByText(/92% confidence/i)).toBeInTheDocument();
    expect(screen.getByText("On hand")).toBeInTheDocument();
    expect(generateMock).toHaveBeenCalledWith("org-1");
  });

  it("shows an error state when generation fails", async () => {
    generateMock.mockResolvedValue({
      success: false,
      error: { code: "rate_limited", message: "Service is busy." },
    });
    const user = userEvent.setup();
    render(<RecommendationsView organizationId="org-1" canGenerate />);

    await user.click(screen.getByRole("button", { name: /^generate$/i }));

    await waitFor(() =>
      expect(screen.getByText("Service is busy.")).toBeInTheDocument()
    );
  });
});
