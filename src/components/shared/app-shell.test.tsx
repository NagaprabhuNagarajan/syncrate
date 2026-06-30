import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@/tests/utils";
import { AppShell } from "./app-shell";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockSignOut, pathnameRef } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
  pathnameRef: { current: "/dashboard" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

vi.mock("@/features/identity/actions/auth.actions", () => ({
  signOutAction: mockSignOut,
}));

beforeEach(() => {
  vi.clearAllMocks();
  pathnameRef.current = "/dashboard";
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("AppShell", () => {
  it("renders the brand, main navigation and children", () => {
    render(
      <AppShell userId="user-1">
        <p>Page body</p>
      </AppShell>
    );

    expect(screen.getAllByText("Syncrate").length).toBeGreaterThan(0);
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(
      within(nav).getByRole("link", { name: /dashboard/i })
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: /customers/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Page body")).toBeInTheDocument();
  });

  it("renders the main content region with focus target", () => {
    render(
      <AppShell userId="user-1">
        <p>Page body</p>
      </AppShell>
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("marks the active nav link with aria-current based on the pathname", () => {
    pathnameRef.current = "/customers";
    render(
      <AppShell userId="user-1">
        <p>Page body</p>
      </AppShell>
    );

    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(
      within(nav).getByRole("link", { name: /customers/i })
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: /dashboard/i })
    ).not.toHaveAttribute("aria-current");
  });

  it("treats nested routes as active via prefix matching", () => {
    pathnameRef.current = "/customers/123";
    render(
      <AppShell userId="user-1">
        <p>Page body</p>
      </AppShell>
    );

    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(
      within(nav).getByRole("link", { name: /customers/i })
    ).toHaveAttribute("aria-current", "page");
  });

  it("renders the beta badge on the AI Insights nav item", () => {
    render(
      <AppShell userId="user-1">
        <p>Page body</p>
      </AppShell>
    );

    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(
      within(nav).getByRole("link", { name: /ai insights/i })
    ).toBeInTheDocument();
    expect(within(nav).getByText("Beta")).toBeInTheDocument();
  });

  it("collapses and expands the desktop sidebar", async () => {
    const user = userEvent.setup();
    render(
      <AppShell userId="user-1">
        <p>Page body</p>
      </AppShell>
    );

    // Org selector is only visible when expanded.
    expect(screen.getByText("My Organization")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /collapse sidebar/i })
    );
    expect(screen.queryByText("My Organization")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /expand sidebar/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /expand sidebar/i }));
    expect(screen.getByText("My Organization")).toBeInTheDocument();
  });

  it("opens and closes the mobile navigation drawer", async () => {
    const user = userEvent.setup();
    render(
      <AppShell userId="user-1">
        <p>Page body</p>
      </AppShell>
    );

    expect(
      screen.queryByRole("navigation", { name: /mobile navigation/i })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /open navigation menu/i })
    );
    expect(
      screen.getByRole("navigation", { name: /mobile navigation/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close navigation/i }));
    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: /mobile navigation/i })
      ).not.toBeInTheDocument()
    );
  });

  it("renders the top bar notifications control", () => {
    render(
      <AppShell userId="user-1">
        <p>Page body</p>
      </AppShell>
    );

    expect(
      screen.getByRole("button", { name: /notifications/i })
    ).toBeInTheDocument();
  });

  it("exposes sign out via the account menu", async () => {
    const user = userEvent.setup();
    render(
      <AppShell userId="user-1">
        <p>Page body</p>
      </AppShell>
    );

    // Sign out lives in the top-bar account dropdown (not the sidebar).
    expect(
      screen.queryByRole("button", { name: /^sign out$/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(
      await screen.findByRole("button", { name: /^sign out$/i })
    ).toBeInTheDocument();
  });
});
