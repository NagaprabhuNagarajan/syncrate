import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@/tests/utils";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders with role switch", () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole("switch", { name: "Toggle" })).toBeInTheDocument();
  });

  it("toggles checked state on click", () => {
    render(<Switch aria-label="Toggle" />);
    const sw = screen.getByRole("switch", { name: "Toggle" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("respects the disabled prop", () => {
    render(<Switch aria-label="Toggle" disabled />);
    expect(screen.getByRole("switch", { name: "Toggle" })).toBeDisabled();
  });
});
