import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { Separator } from "./separator";

describe("Separator", () => {
  it("renders with horizontal orientation by default", () => {
    render(<Separator data-testid="sep" />);
    const sep = screen.getByTestId("sep");
    expect(sep).toHaveAttribute("data-orientation", "horizontal");
    expect(sep).toHaveClass("w-full");
  });

  it("renders with vertical orientation when specified", () => {
    render(<Separator data-testid="sep" orientation="vertical" />);
    const sep = screen.getByTestId("sep");
    expect(sep).toHaveAttribute("data-orientation", "vertical");
    expect(sep).toHaveClass("h-full");
  });

  it("is decorative by default (no separator role)", () => {
    render(<Separator data-testid="sep" />);
    expect(screen.getByTestId("sep")).not.toHaveAttribute("role", "separator");
  });

  it("exposes the separator role when not decorative", () => {
    render(<Separator data-testid="sep" decorative={false} />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("merges a custom className", () => {
    render(<Separator data-testid="sep" className="my-sep" />);
    expect(screen.getByTestId("sep")).toHaveClass("my-sep");
  });

  it("forwards a ref to the underlying element", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Separator ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });
});
