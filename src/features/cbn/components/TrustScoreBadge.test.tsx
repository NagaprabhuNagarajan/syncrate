import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { TrustScoreBadge } from "./TrustScoreBadge";

describe("TrustScoreBadge", () => {
  it("renders the numeric score and the matching label", () => {
    render(<TrustScoreBadge score={95} />);
    expect(screen.getByText("95")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Trust score: 95 — Excellent")
    ).toBeInTheDocument();
  });

  it.each([
    [95, "Excellent"],
    [80, "Good"],
    [65, "Fair"],
    [45, "Poor"],
    [10, "Very Poor"],
  ])("maps score %i to label %s", (score, label) => {
    render(<TrustScoreBadge score={score} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("clamps a score above 100 to 100", () => {
    render(<TrustScoreBadge score={150} />);
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Trust score: 100 — Excellent")
    ).toBeInTheDocument();
  });

  it("clamps a negative score to 0", () => {
    render(<TrustScoreBadge score={-25} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Trust score: 0 — Very Poor")
    ).toBeInTheDocument();
  });

  it.each(["sm", "md", "lg"] as const)("renders the %s size", (size) => {
    const { container } = render(<TrustScoreBadge score={70} size={size} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("applies a custom className to the container", () => {
    render(<TrustScoreBadge score={70} className="custom-cls" />);
    expect(
      screen.getByLabelText(/trust score: 70/i)
    ).toHaveClass("custom-cls");
  });
});
