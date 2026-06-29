import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@/tests/utils";
import { AnimatedNumber } from "./animated-number";

describe("AnimatedNumber", () => {
  it("eventually renders the formatted final value", async () => {
    render(<AnimatedNumber value={1234} duration={1} />);
    await waitFor(() => expect(screen.getByText("1,234")).toBeInTheDocument());
  });

  it("renders the prefix and suffix around the value", async () => {
    render(
      <AnimatedNumber value={50} duration={1} prefix="$" suffix="k" />
    );
    await waitFor(() => expect(screen.getByText("$50k")).toBeInTheDocument());
  });

  it("respects the decimals option", async () => {
    render(<AnimatedNumber value={12.5} duration={1} decimals={2} />);
    await waitFor(() => expect(screen.getByText("12.50")).toBeInTheDocument());
  });
});
