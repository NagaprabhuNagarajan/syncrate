import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { VerificationBadge } from "./VerificationBadge";

describe("VerificationBadge", () => {
  it.each([
    [0, "Unverified"],
    [1, "Email Verified"],
    [2, "Mobile Verified"],
    [3, "GST Verified"],
    [4, "Document Verified"],
    [5, "Syncrate Trusted"],
  ])("renders level %i as %s", (level, label) => {
    render(<VerificationBadge level={level} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(
      screen.getByLabelText(`Verification: ${label}`)
    ).toBeInTheDocument();
  });

  it("clamps a level above 5 down to Syncrate Trusted", () => {
    render(<VerificationBadge level={9} />);
    expect(screen.getByText("Syncrate Trusted")).toBeInTheDocument();
  });

  it("clamps a negative level up to Unverified", () => {
    render(<VerificationBadge level={-3} />);
    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("floors a fractional level", () => {
    render(<VerificationBadge level={2.9} />);
    expect(screen.getByText("Mobile Verified")).toBeInTheDocument();
  });

  it("hides the label text when showLabel is false but keeps the aria-label", () => {
    render(<VerificationBadge level={3} showLabel={false} />);
    expect(screen.queryByText("GST Verified")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Verification: GST Verified")
    ).toBeInTheDocument();
  });

  it("renders the md size variant", () => {
    render(<VerificationBadge level={1} size="md" />);
    expect(screen.getByText("Email Verified")).toBeInTheDocument();
  });

  it("applies a custom className", () => {
    render(<VerificationBadge level={1} className="extra-cls" />);
    expect(
      screen.getByLabelText("Verification: Email Verified")
    ).toHaveClass("extra-cls");
  });
});
