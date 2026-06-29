import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/tests/utils";
import { SmartSearchView } from "./smart-search-view";
import type { SmartSearchResult } from "@/features/ai/search/types/search.types";

const { mockRun } = vi.hoisted(() => ({ mockRun: vi.fn() }));

vi.mock("@/features/ai/search/actions/search.actions", () => ({
  runSmartSearchAction: mockRun,
}));

const sampleResult: SmartSearchResult = {
  query: "show unpaid invoices",
  intent: {
    confidence: 0.92,
    entity: "invoice",
    explanation: "Unpaid invoices",
    filters: {
      keyword: null,
      status: null,
      paymentStatus: "unpaid",
      lowStock: null,
      overdue: null,
    },
    timeRange: null,
    sort: null,
    limit: null,
  },
  groups: [
    {
      entity: "invoice",
      label: "Invoices",
      total: 1,
      items: [
        {
          id: "i1",
          title: "INV-1",
          subtitle: "Acme",
          meta: "unpaid",
          amount: 1000,
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SmartSearchView", () => {
  it("renders the search box and example chips", () => {
    render(<SmartSearchView organizationId="org-1" canGenerate />);
    expect(screen.getByLabelText("Smart search query")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "show unpaid invoices" })
    ).toBeInTheDocument();
  });

  it("runs a search and renders the interpreted intent + results", async () => {
    mockRun.mockResolvedValue({ success: true, data: sampleResult });
    render(<SmartSearchView organizationId="org-1" canGenerate />);

    fireEvent.change(screen.getByLabelText("Smart search query"), {
      target: { value: "show unpaid invoices" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText(/Interpreted as:/)).toBeInTheDocument();
    });
    expect(screen.getByText("Unpaid invoices")).toBeInTheDocument();
    expect(screen.getByText("INV-1")).toBeInTheDocument();
    expect(mockRun).toHaveBeenCalledWith("org-1", "show unpaid invoices");
  });

  it("shows an error message when the action fails", async () => {
    mockRun.mockResolvedValue({
      success: false,
      error: { code: "provider_error", message: "AI is busy" },
    });
    render(<SmartSearchView organizationId="org-1" canGenerate />);

    fireEvent.change(screen.getByLabelText("Smart search query"), {
      target: { value: "anything" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("AI is busy");
    });
  });

  it("renders an empty state when there are no matches", async () => {
    mockRun.mockResolvedValue({
      success: true,
      data: {
        ...sampleResult,
        groups: [{ entity: "invoice", label: "Invoices", total: 0, items: [] }],
      },
    });
    render(<SmartSearchView organizationId="org-1" canGenerate />);

    fireEvent.change(screen.getByLabelText("Smart search query"), {
      target: { value: "nothing here" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("No matches found")).toBeInTheDocument();
    });
  });

  it("disables input and warns when the user lacks permission", () => {
    render(<SmartSearchView organizationId="org-1" canGenerate={false} />);
    expect(screen.getByLabelText("Smart search query")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "do not have permission"
    );
  });
});
