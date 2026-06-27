import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { ErrorState } from "./error-state";

describe("ErrorState", () => {
  it("renders default title and message with alert role", () => {
    render(<ErrorState />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("An unexpected error occurred. Please try again.")
    ).toBeInTheDocument();
  });

  it("renders custom title and message", () => {
    render(<ErrorState title="Load failed" message="Network unreachable" />);
    expect(screen.getByText("Load failed")).toBeInTheDocument();
    expect(screen.getByText("Network unreachable")).toBeInTheDocument();
  });

  it("does not render a retry button by default", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders and fires the retry handler", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("merges a custom className", () => {
    render(<ErrorState className="my-error" />);
    expect(screen.getByRole("alert")).toHaveClass("my-error");
  });
});
