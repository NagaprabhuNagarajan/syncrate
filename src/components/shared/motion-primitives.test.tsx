import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { FadeIn, Stagger, StaggerItem } from "./motion-primitives";

describe("motion primitives", () => {
  it("FadeIn renders its children", () => {
    render(<FadeIn>Faded content</FadeIn>);
    expect(screen.getByText("Faded content")).toBeInTheDocument();
  });

  it("Stagger renders its children", () => {
    render(
      <Stagger>
        <span>Item one</span>
      </Stagger>
    );
    expect(screen.getByText("Item one")).toBeInTheDocument();
  });

  it("Stagger and StaggerItem compose correctly", () => {
    render(
      <Stagger as="ul">
        <StaggerItem as="li">Row A</StaggerItem>
        <StaggerItem as="li">Row B</StaggerItem>
      </Stagger>
    );
    expect(screen.getByText("Row A")).toBeInTheDocument();
    expect(screen.getByText("Row B")).toBeInTheDocument();
  });
});
