import { describe, expect, it } from "vitest";
import { LayoutDashboard } from "lucide-react";
import { render, screen } from "@/tests/utils";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the title as a level-1 heading", () => {
    render(<PageHeader title="Dashboard" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<PageHeader title="Dashboard" description="Your overview" />);
    expect(screen.getByText("Your overview")).toBeInTheDocument();
  });

  it("does not render a description when omitted", () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.queryByText("Your overview")).not.toBeInTheDocument();
  });

  it("renders an icon when provided", () => {
    const { container } = render(
      <PageHeader title="Dashboard" icon={LayoutDashboard} />
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders no icon when omitted", () => {
    const { container } = render(<PageHeader title="Dashboard" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders action children", () => {
    render(
      <PageHeader title="Dashboard">
        <button type="button">New</button>
      </PageHeader>
    );
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("does not render the actions slot when no children are given", () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("merges a custom className on the root", () => {
    const { container } = render(
      <PageHeader title="Dashboard" className="my-header" />
    );
    expect(container.firstChild).toHaveClass("my-header");
  });
});
