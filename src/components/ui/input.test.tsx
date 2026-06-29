import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { Input } from "./input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Email" />);
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
  });

  it("accepts a value", () => {
    render(<Input value="hello" readOnly />);
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("forwards the type attribute", () => {
    render(<Input type="email" placeholder="Email" />);
    expect(screen.getByPlaceholderText("Email")).toHaveAttribute(
      "type",
      "email"
    );
  });

  it("applies invalid styling via aria-invalid", () => {
    render(<Input aria-invalid placeholder="Bad" />);
    const el = screen.getByPlaceholderText("Bad");
    expect(el).toHaveAttribute("aria-invalid", "true");
    expect(el).toHaveClass("aria-[invalid=true]:border-destructive");
  });

  it("can be disabled", () => {
    render(<Input disabled placeholder="Off" />);
    expect(screen.getByPlaceholderText("Off")).toBeDisabled();
  });

  it("merges a custom className", () => {
    render(<Input className="custom" placeholder="Styled" />);
    expect(screen.getByPlaceholderText("Styled")).toHaveClass("custom");
  });

  it("forwards a ref", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
