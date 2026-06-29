import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

describe("Tooltip", () => {
  it("renders an accessible trigger", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Helpful hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(
      screen.getByRole("button", { name: "Hover me" })
    ).toBeInTheDocument();
  });
});
