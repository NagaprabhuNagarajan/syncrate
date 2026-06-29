import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@/tests/utils";
import { RadioGroup, RadioGroupItem } from "./radio-group";

describe("RadioGroup", () => {
  function renderGroup() {
    return render(
      <RadioGroup defaultValue="a">
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
      </RadioGroup>
    );
  }

  it("renders all options", () => {
    renderGroup();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("has the default value selected", () => {
    renderGroup();
    expect(screen.getByRole("radio", { name: "Option A" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("changes selection on click", () => {
    renderGroup();
    const optionB = screen.getByRole("radio", { name: "Option B" });
    fireEvent.click(optionB);
    expect(optionB).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Option A" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });
});
