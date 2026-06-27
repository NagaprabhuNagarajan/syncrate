import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { UnitsView } from "./units-view";
import type { Unit, UnitListResult } from "@/features/unit/types/unit.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockPush, mockRefresh, searchParamsRef, archiveActionMock } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockRefresh: vi.fn(),
    searchParamsRef: { current: "" },
    archiveActionMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("@/features/unit/actions/unit.actions", () => ({
  archiveUnitAction: archiveActionMock,
  createUnitAction: vi.fn(),
  updateUnitAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "unit-1",
    organizationId: "org-1",
    name: "Kilogram",
    symbol: "kg",
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeResult(overrides: Partial<UnitListResult> = {}): UnitListResult {
  return {
    items: [makeUnit()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("UnitsView", () => {
  it("renders the heading, rows and add button when canManage", () => {
    render(
      <UnitsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );

    expect(
      screen.getByRole("heading", { name: /units/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Kilogram")).toBeInTheDocument();
    expect(screen.getByText("kg")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add unit/i })
    ).toBeInTheDocument();
  });

  it("hides the add button when the user cannot manage", () => {
    render(
      <UnitsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /add unit/i })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no units", () => {
    render(
      <UnitsView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/no units found/i)).toBeInTheDocument();
  });

  it("updates the URL when a search is submitted", async () => {
    const user = userEvent.setup();
    render(
      <UnitsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.type(screen.getByLabelText(/search units/i), "gram{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/products/units?search=gram");
  });

  it("updates the URL when the status filter changes", async () => {
    const user = userEvent.setup();
    render(
      <UnitsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      "archived"
    );
    expect(mockPush).toHaveBeenCalledWith("/products/units?status=archived");
  });

  it("opens the inline create form when add is clicked", async () => {
    const user = userEvent.setup();
    render(
      <UnitsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /add unit/i }));
    expect(
      screen.getByRole("heading", { name: /add unit/i })
    ).toBeInTheDocument();
  });

  it("opens the inline edit form when edit is clicked", async () => {
    const user = userEvent.setup();
    render(
      <UnitsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(
      screen.getByRole("heading", { name: /edit unit/i })
    ).toBeInTheDocument();
  });

  it("archives a unit and refreshes on success", async () => {
    archiveActionMock.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(
      <UnitsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /archive/i }));
    await waitFor(() =>
      expect(archiveActionMock).toHaveBeenCalledWith("org-1", "unit-1")
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("surfaces an archive error", async () => {
    archiveActionMock.mockResolvedValue({
      success: false,
      error: { code: "forbidden", message: "Not allowed" },
    });
    const user = userEvent.setup();
    render(
      <UnitsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /archive/i }));
    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
  });

  it("does not show edit/archive actions when the user cannot manage", () => {
    render(
      <UnitsView
        organizationId="org-1"
        result={makeResult()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /edit/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /archive/i })
    ).not.toBeInTheDocument();
  });

  it("hides the archive action for already-archived units", () => {
    render(
      <UnitsView
        organizationId="org-1"
        result={makeResult({ items: [makeUnit({ status: "archived" })] })}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.queryByRole("button", { name: /archive/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });
});
