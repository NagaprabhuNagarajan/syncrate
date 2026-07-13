import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { PurchaseRequestsView } from "./purchase-requests-view";
import type {
  PurchaseRequestListItem,
  PurchaseRequestListResult,
  PurchaseRequestStats,
} from "@/features/purchase/types/purchase-request.types";

const { mockPush, searchParamsRef } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

function makeRequest(
  overrides: Partial<PurchaseRequestListItem> = {}
): PurchaseRequestListItem {
  return {
    id: "pr-1",
    organizationId: "org-1",
    requestNumber: "PR-00001",
    status: "draft",
    branchId: "wh-1",
    branchName: "Main WH",
    requiredDate: new Date("2026-06-10"),
    notes: null,
    approvedBy: null,
    approvedAt: null,
    rejectedReason: null,
    convertedPoId: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: null,
    version: 1,
    ...overrides,
  };
}

function makeResult(
  items: PurchaseRequestListItem[],
  overrides: Partial<PurchaseRequestListResult> = {}
): PurchaseRequestListResult {
  return { items, total: items.length, page: 1, pageSize: 20, ...overrides };
}

function makeStats(
  overrides: Partial<PurchaseRequestStats> = {}
): PurchaseRequestStats {
  return {
    draft: 1,
    awaitingApproval: 0,
    approved: 0,
    converted: 0,
    ...overrides,
  };
}

describe("PurchaseRequestsView", () => {
  it("renders rows with request number, branch and status", () => {
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("PR-00001")).toBeInTheDocument();
    expect(screen.getByText("Main WH")).toBeInTheDocument();
    // "Draft" also appears as a status filter pill, so allow multiple matches.
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  });

  it("shows the New request button when canManage", () => {
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /new request/i })
    ).toBeInTheDocument();
  });

  it("hides the New request button without canManage", () => {
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
        stats={makeStats()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /new request/i })
    ).not.toBeInTheDocument();
  });

  it("renders the empty state when there are no requests", () => {
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([])}
        stats={makeStats({ draft: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("No purchase requests yet")).toBeInTheDocument();
  });

  it("renders the empty state with a filtered message when filters are active", () => {
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([])}
        stats={makeStats({ draft: 0 })}
        filters={{ search: "zzz" }}
        canManage
      />
    );
    expect(
      screen.getByText("No matching purchase requests")
    ).toBeInTheDocument();
  });

  it("renders the stat tiles", () => {
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
        stats={makeStats({
          draft: 2,
          awaitingApproval: 3,
          approved: 4,
          converted: 5,
        })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Converted").length).toBeGreaterThan(0);
  });

  it("pushes a status filter change via pills", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("tab", { name: "Approved" }));
    expect(mockPush).toHaveBeenCalledWith(
      "/purchases/requests?status=approved"
    );
  });

  it("submits the search query", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.type(
      screen.getByLabelText("Search purchase requests"),
      "PR-9{enter}"
    );
    expect(mockPush).toHaveBeenCalledWith("/purchases/requests?search=PR-9");
  });

  it("resets the list immediately when the search field is cleared", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
        stats={makeStats()}
        filters={{ search: "PR-9" }}
        canManage
      />
    );
    const input = screen.getByLabelText("Search purchase requests");
    await user.clear(input);
    expect(mockPush).toHaveBeenCalledWith("/purchases/requests");
  });

  it("renders sub-navigation links to sibling purchase sections", () => {
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /purchase orders/i })
    ).toHaveAttribute("href", "/purchases");
    expect(
      screen.getByRole("link", { name: /goods receipts/i })
    ).toHaveAttribute("href", "/purchases/goods-receipts");
    expect(screen.getByRole("link", { name: /bills/i })).toHaveAttribute(
      "href",
      "/bills"
    );
    expect(screen.getByRole("link", { name: /returns/i })).toHaveAttribute(
      "href",
      "/purchases/returns"
    );
  });

  it("preserves the org param in sub-navigation links", () => {
    searchParamsRef.current = "org=org-9";
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /goods receipts/i })
    ).toHaveAttribute("href", "/purchases/goods-receipts?org=org-9");
  });

  it("shows the Showing X–Y of N pagination summary", () => {
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()], { total: 45, page: 2, pageSize: 20 })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getAllByText("45").length).toBeGreaterThan(0);
  });

  it("navigates via Previous/Next pagination buttons", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()], { total: 45, page: 2, pageSize: 20 })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/purchases/requests?page=3");

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(mockPush).toHaveBeenCalledWith("/purchases/requests");
  });
});
