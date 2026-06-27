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
});
