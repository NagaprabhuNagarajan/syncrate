import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { Inbox, Plus, Upload } from "lucide-react";
import { render, screen } from "@/tests/utils";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the title with a status role and aria-label", () => {
    render(<EmptyState title="No invoices" />);
    const status = screen.getByRole("status", { name: "No invoices" });
    expect(status).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No invoices" })
    ).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<EmptyState title="Empty" description="Nothing here yet" />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("does not render a description paragraph when omitted", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText("Nothing here yet")).not.toBeInTheDocument();
  });

  it("renders the icon when provided", () => {
    const { container } = render(<EmptyState title="Empty" icon={Inbox} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders no action buttons by default", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders and fires the primary action", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        title="Empty"
        action={{ label: "Create", onClick, icon: Plus }}
      />
    );
    await user.click(screen.getByRole("button", { name: /create/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders and fires the secondary action", async () => {
    const onClick = vi.fn();
    const secondary = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        title="Empty"
        action={{ label: "Create", onClick }}
        secondaryAction={{ label: "Import", onClick: secondary, icon: Upload }}
      />
    );
    await user.click(screen.getByRole("button", { name: /import/i }));
    expect(secondary).toHaveBeenCalledTimes(1);
  });

  it("renders only the secondary action when no primary action is given", () => {
    render(
      <EmptyState
        title="Empty"
        secondaryAction={{ label: "Import", onClick: vi.fn() }}
      />
    );
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
  });

  it("renders action buttons without icons", () => {
    render(
      <EmptyState
        title="Empty"
        action={{ label: "Create", onClick: vi.fn() }}
      />
    );
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("merges a custom className", () => {
    render(<EmptyState title="Empty" className="my-empty" />);
    expect(screen.getByRole("status")).toHaveClass("my-empty");
  });
});
