import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { PurchaseRequestsView } from "./purchase-requests-view";
import type {
  PurchaseRequestListItem,
  PurchaseRequestListResult,
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
    warehouseId: "wh-1",
    warehouseName: "Main WH",
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

describe("PurchaseRequestsView", () => {
  it("renders rows with request number, warehouse and status", () => {
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("PR-00001")).toBeInTheDocument();
    expect(screen.getByText("Main WH")).toBeInTheDocument();
    // "Draft" also appears in the status filter <option>, so scope to the badge.
    expect(
      screen.getByText("Draft", { selector: "div" })
    ).toBeInTheDocument();
  });

  it("shows the New request button when canManage", () => {
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
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
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByText("No purchase requests found")
    ).toBeInTheDocument();
  });

  it("navigates with the status filter on change", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
        filters={{}}
        canManage
      />
    );
    await user.selectOptions(
      screen.getByLabelText("Filter by status"),
      "approved"
    );
    expect(mockPush).toHaveBeenCalledWith("/purchases/requests?status=approved");
  });

  it("submits the search query", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseRequestsView
        organizationId="org-1"
        result={makeResult([makeRequest()])}
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
});
