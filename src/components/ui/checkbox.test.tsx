import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@/tests/utils";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("renders a checkbox", () => {
    render(<Checkbox aria-label="Accept" />);
    expect(screen.getByRole("checkbox", { name: "Accept" })).toBeInTheDocument();
  });

  it("toggles checked state on click (uncontrolled)", () => {
    render(<Checkbox aria-label="Accept" />);
    const box = screen.getByRole("checkbox", { name: "Accept" });
    expect(box).toHaveAttribute("aria-checked", "false");
    fireEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");
  });

  it("respects the disabled prop", () => {
    render(<Checkbox aria-label="Accept" disabled />);
    const box = screen.getByRole("checkbox", { name: "Accept" });
    expect(box).toBeDisabled();
    fireEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "false");
  });
});
