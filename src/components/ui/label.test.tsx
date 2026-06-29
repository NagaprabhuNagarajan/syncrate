import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { Input } from "./input";
import { Label } from "./label";

describe("Label", () => {
  it("renders its text", () => {
    render(<Label>Email</Label>);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("associates with a control via htmlFor", () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" />
      </>
    );
    expect(screen.getByText("Email")).toHaveAttribute("for", "email");
    // The label is wired to the input, so role lookup by name works.
    expect(screen.getByLabelText("Email")).toBeInstanceOf(HTMLInputElement);
  });

  it("merges a custom className", () => {
    render(<Label className="custom">Tag</Label>);
    expect(screen.getByText("Tag")).toHaveClass("custom");
  });
});
