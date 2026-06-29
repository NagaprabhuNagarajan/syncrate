import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { Badge, badgeVariants, type BadgeProps } from "./badge";

const variants: NonNullable<BadgeProps["variant"]>[] = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "success",
  "warning",
  "info",
  "muted",
];

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies the default variant classes when no variant is given", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toHaveClass("bg-primary");
  });

  it.each(variants)("renders the %s variant", (variant) => {
    render(<Badge variant={variant}>{variant}</Badge>);
    expect(screen.getByText(variant)).toBeInTheDocument();
  });

  it("merges a custom className", () => {
    render(<Badge className="custom-class">Tagged</Badge>);
    expect(screen.getByText("Tagged")).toHaveClass("custom-class");
  });

  it("forwards arbitrary HTML attributes", () => {
    render(<Badge data-testid="badge-el" id="my-badge">Spread</Badge>);
    const el = screen.getByTestId("badge-el");
    expect(el).toHaveAttribute("id", "my-badge");
  });

  it("exposes the badgeVariants helper", () => {
    expect(typeof badgeVariants).toBe("function");
    expect(badgeVariants({ variant: "success" })).toContain("text-success");
  });

  it("renders a leading status dot when dot is set", () => {
    render(<Badge dot>Online</Badge>);
    const badge = screen.getByText("Online");
    const dot = badge.querySelector("span[aria-hidden='true']");
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass("rounded-full");
  });

  it("does not render a dot by default", () => {
    render(<Badge>Plain</Badge>);
    expect(
      screen.getByText("Plain").querySelector("span[aria-hidden='true']")
    ).toBeNull();
  });

  it("applies the sm size classes", () => {
    render(<Badge size="sm">Small</Badge>);
    expect(screen.getByText("Small")).toHaveClass("px-2");
  });
});
