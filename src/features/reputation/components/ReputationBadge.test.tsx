import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { ReputationBadge } from "./ReputationBadge";
import type { ReputationSummary } from "@/features/reputation/types/reputation.types";

const summary: ReputationSummary = {
  reviewCount: 12,
  averageRating: 4.3,
  recommendedCount: 9,
  recommendPercent: 75,
};

describe("ReputationBadge", () => {
  it("renders the average rating and review count inline", () => {
    render(<ReputationBadge summary={summary} />);

    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("(12 reviews)")).toBeInTheDocument();
  });

  it("renders the recommend percentage in the panel variant", () => {
    render(<ReputationBadge summary={summary} variant="panel" />);

    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("recommend")).toBeInTheDocument();
  });

  it("shows a dash placeholder when there are no reviews", () => {
    render(
      <ReputationBadge
        summary={{
          reviewCount: 0,
          averageRating: 0,
          recommendedCount: 0,
          recommendPercent: 0,
        }}
      />
    );

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("(0 reviews)")).toBeInTheDocument();
  });
});
