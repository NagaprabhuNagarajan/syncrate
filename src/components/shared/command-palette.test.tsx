import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@/tests/utils";
import { CommandPalette } from "./command-palette";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { pushMock, searchMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/search/actions/search.actions", () => ({
  globalSearchAction: searchMock,
}));

const EMPTY = { customers: [], suppliers: [], products: [], invoices: [] };

beforeEach(() => {
  vi.clearAllMocks();
  searchMock.mockResolvedValue(EMPTY);
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    render(<CommandPalette open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/search customers/i)).toBeNull();
  });

  it("shows navigation and action commands when open with an empty query", () => {
    render(<CommandPalette open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Go to")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("New customer")).toBeInTheDocument();
  });

  it("filters navigation commands by the typed query", async () => {
    const user = userEvent.setup();
    render(<CommandPalette open onOpenChange={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/search customers/i), "invoi");

    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("navigates and closes when a nav command is selected", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<CommandPalette open onOpenChange={onOpenChange} />);

    await user.click(screen.getByText("Customers"));

    expect(pushMock).toHaveBeenCalledWith("/customers");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("runs a server search and renders entity results for a 2+ char query", async () => {
    searchMock.mockResolvedValue({
      ...EMPTY,
      customers: [
        {
          id: "c1",
          entity: "customer",
          title: "Acme Corp",
          subtitle: "CUST-001",
          href: "/customers/c1",
        },
      ],
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<CommandPalette open onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText(/search customers/i), "acme");

    await waitFor(() => expect(searchMock).toHaveBeenCalledWith("acme"));
    const item = await screen.findByText("Acme Corp");
    expect(screen.getByText("CUST-001")).toBeInTheDocument();

    await user.click(item);
    expect(pushMock).toHaveBeenCalledWith("/customers/c1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not call the search action for a single-character query", async () => {
    const user = userEvent.setup();
    render(<CommandPalette open onOpenChange={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/search customers/i), "a");

    // give the debounce window a chance to (not) fire
    await new Promise((r) => setTimeout(r, 250));
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    render(<CommandPalette open onOpenChange={vi.fn()} />);

    await user.type(
      screen.getByPlaceholderText(/search customers/i),
      "zzzzznomatch"
    );

    await waitFor(() => expect(searchMock).toHaveBeenCalled());
    // no nav/action/entity items match → cmdk empty state
    expect(await screen.findByText(/no results found/i)).toBeInTheDocument();
    // sanity: the list region has no selectable items
    const list = screen.getByRole("listbox");
    expect(within(list).queryByRole("option")).toBeNull();
  });
});
