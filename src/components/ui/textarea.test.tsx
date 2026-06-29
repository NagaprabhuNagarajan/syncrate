import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders a textarea element", () => {
    render(<Textarea placeholder="Notes" />);
    expect(screen.getByPlaceholderText("Notes")).toBeInTheDocument();
  });

  it("accepts a value", () => {
    render(<Textarea value="content" readOnly />);
    expect(screen.getByDisplayValue("content")).toBeInTheDocument();
  });

  it("can be disabled", () => {
    render(<Textarea disabled placeholder="Off" />);
    expect(screen.getByPlaceholderText("Off")).toBeDisabled();
  });

  it("merges a custom className", () => {
    render(<Textarea className="custom" placeholder="Styled" />);
    expect(screen.getByPlaceholderText("Styled")).toHaveClass("custom");
  });

  it("forwards a ref", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});
