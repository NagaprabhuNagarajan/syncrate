import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

describe("Select", () => {
  it("renders the trigger with a placeholder", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Choose">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Apple</SelectItem>
          <SelectItem value="b">Banana</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByText("Pick one")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Choose" })
    ).toBeInTheDocument();
  });

  it("shows the selected value when one is provided", () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger aria-label="Choose">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Apple</SelectItem>
          <SelectItem value="b">Banana</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });
});
