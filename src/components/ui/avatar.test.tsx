import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { Avatar, AvatarFallback } from "./avatar";

describe("Avatar", () => {
  it("renders the fallback text", () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("merges a custom className on the root", () => {
    render(
      <Avatar className="custom" data-testid="avatar">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByTestId("avatar")).toHaveClass("custom");
  });
});
