import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

describe("Popover", () => {
  it("renders the trigger", () => {
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Panel content</PopoverContent>
      </Popover>
    );
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders the content when open", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Panel content</PopoverContent>
      </Popover>
    );
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });
});
