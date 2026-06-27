import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { LoadingSpinner, PageLoader } from "./loading-spinner";

describe("LoadingSpinner", () => {
  it("renders with the default label and status role", () => {
    render(<LoadingSpinner />);
    const status = screen.getByRole("status", { name: "Loading..." });
    expect(status).toBeInTheDocument();
    // sr-only text present
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("uses a custom label", () => {
    render(<LoadingSpinner label="Fetching data" />);
    expect(
      screen.getByRole("status", { name: "Fetching data" })
    ).toBeInTheDocument();
  });

  it.each([
    ["sm", "h-4"],
    ["md", "h-6"],
    ["lg", "h-8"],
    ["xl", "h-12"],
  ] as const)("renders the %s size", (size, expectedClass) => {
    const { container } = render(<LoadingSpinner size={size} />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveClass(expectedClass);
  });

  it("merges a custom className on the wrapper", () => {
    render(<LoadingSpinner className="my-spinner" />);
    expect(screen.getByRole("status")).toHaveClass("my-spinner");
  });
});

describe("PageLoader", () => {
  it("renders a large spinner with the default label", () => {
    const { container } = render(<PageLoader />);
    expect(
      screen.getByRole("status", { name: "Loading..." })
    ).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toHaveClass("h-8");
  });

  it("uses a custom label", () => {
    render(<PageLoader label="Preparing dashboard" />);
    expect(
      screen.getByRole("status", { name: "Preparing dashboard" })
    ).toBeInTheDocument();
  });
});
