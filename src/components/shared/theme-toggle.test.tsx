import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/tests/utils";
import { ThemeToggle } from "./theme-toggle";

// Mock next-themes so we control resolvedTheme and observe setTheme calls.
const setTheme = vi.fn();
let mockResolvedTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme, setTheme }),
}));

describe("ThemeToggle", () => {
  afterEach(() => {
    setTheme.mockClear();
    mockResolvedTheme = "light";
  });

  it("renders a toggle button", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("switches to dark when current theme is light", () => {
    mockResolvedTheme = "light";
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /switch to dark theme/i });
    fireEvent.click(btn);
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("switches to light when current theme is dark", () => {
    mockResolvedTheme = "dark";
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /switch to light theme/i });
    fireEvent.click(btn);
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("merges a custom className", () => {
    render(<ThemeToggle className="custom-class" />);
    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });

  it("exposes an accessible label", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAccessibleName();
  });
});
