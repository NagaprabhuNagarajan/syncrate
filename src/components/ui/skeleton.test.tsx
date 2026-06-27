import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import {
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  SkeletonText,
} from "./skeleton";

describe("Skeleton", () => {
  it("renders with base classes and aria-hidden", () => {
    render(<Skeleton data-testid="sk" />);
    const sk = screen.getByTestId("sk");
    expect(sk).toHaveAttribute("aria-hidden", "true");
    expect(sk).toHaveClass("animate-pulse");
  });

  it("merges a custom className", () => {
    render(<Skeleton data-testid="sk" className="h-8 w-8" />);
    expect(screen.getByTestId("sk")).toHaveClass("h-8", "w-8");
  });
});

describe("SkeletonText", () => {
  it("renders the default number of lines", () => {
    const { container } = render(<SkeletonText />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("renders a custom number of lines and shortens the last one", () => {
    const { container } = render(<SkeletonText lines={5} />);
    const lines = container.querySelectorAll(".animate-pulse");
    expect(lines).toHaveLength(5);
    expect(lines[4]).toHaveClass("w-3/4");
    expect(lines[0]).toHaveClass("w-full");
  });
});

describe("SkeletonCard", () => {
  it("renders the composed card skeleton", () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0
    );
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("SkeletonTable", () => {
  it("renders default rows and columns", () => {
    const { container } = render(<SkeletonTable />);
    // header (4) + 5 rows * 4 cols = 24 skeletons
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(24);
  });

  it("renders custom rows and columns", () => {
    const { container } = render(<SkeletonTable rows={2} cols={3} />);
    // header (3) + 2 rows * 3 cols = 9 skeletons
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(9);
  });
});
