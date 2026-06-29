import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { BrandLockup, BrandLogo, BrandMark } from "./logo";

describe("Brand logo", () => {
  it("BrandMark renders the icon with an accessible alt", () => {
    render(<BrandMark />);
    expect(screen.getByAltText("Syncrate")).toBeInTheDocument();
  });

  it("BrandLockup renders the icon and the wordmark", () => {
    render(<BrandLockup />);
    expect(screen.getByAltText("Syncrate")).toBeInTheDocument();
    expect(screen.getByText("Syncrate")).toBeInTheDocument();
  });

  it("BrandLogo renders the full lockup with tagline alt", () => {
    render(<BrandLogo />);
    expect(
      screen.getByAltText("Syncrate — Sync. Connect. Grow.")
    ).toBeInTheDocument();
  });

  it("BrandMark merges a custom className", () => {
    render(<BrandMark className="custom-class" />);
    expect(screen.getByAltText("Syncrate")).toHaveClass("custom-class");
  });
});
