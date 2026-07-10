import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { PurchaseOrdersView } from "./purchase-orders-view";
import type {
  PurchaseOrderListItem,
  PurchaseOrderListResult,
  PurchaseOrderStats,
} from "@/features/purchase/types/purchase-order.types";

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

function makeOrder(
  overrides: Partial<PurchaseOrderListItem> = {}
): PurchaseOrderListItem {
  return {
    id: "po-1",
    organizationId: "org-1",
    poNumber: "PO-00001",
    supplierId: "sup-1",
    supplierName: "Acme Supply",
    branchId: null,
    status: "draft",
    orderDate: new Date("2026-06-01"),
    expectedDeliveryDate: null,
    currency: "INR",
    notes: null,
    terms: null,
    subtotal: 1000,
    discountAmount: 0,
    taxAmount: 180,
    totalAmount: 1180,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: null,
    version: 1,
    ...overrides,
  };
}

function makeResult(
  items: PurchaseOrderListItem[],
  overrides: Partial<PurchaseOrderListResult> = {}
): PurchaseOrderListResult {
  return { items, total: items.length, page: 1, pageSize: 20, ...overrides };
}

function makeStats(
  overrides: Partial<PurchaseOrderStats> = {}
): PurchaseOrderStats {
  return {
    totalValue: 1180,
    draft: 1,
    awaitingApproval: 0,
    open: 0,
    ...overrides,
  };
}

describe("PurchaseOrdersView", () => {
  it("renders an empty state when there are no orders", () => {
    render(
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([])}
        stats={makeStats({ draft: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("No purchase orders yet")).toBeInTheDocument();
  });

  it("renders orders with supplier name, status and total", () => {
    render(
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("PO-00001")).toBeInTheDocument();
    expect(screen.getByText("Acme Supply")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getByText("₹1,180.00")).toBeInTheDocument();
  });

  it("renders the stat tiles", () => {
    render(
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats({
          totalValue: 5000,
          draft: 2,
          awaitingApproval: 3,
          open: 4,
        })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("Total value")).toBeInTheDocument();
    expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("₹5,000")).toBeInTheDocument();
  });

  it("shows the new purchase order button only when canManage is true", () => {
    const { rerender } = render(
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /new purchase order/i })
    ).toBeInTheDocument();

    rerender(
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /new purchase order/i })
    ).not.toBeInTheDocument();
  });

  it("renders sub-navigation links to sibling purchase sections", () => {
    render(
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /goods receipts/i })
    ).toHaveAttribute("href", "/purchases/goods-receipts");
    expect(screen.getByRole("link", { name: /bills/i })).toHaveAttribute(
      "href",
      "/purchases/bills"
    );
    expect(screen.getByRole("link", { name: /returns/i })).toHaveAttribute(
      "href",
      "/purchases/returns"
    );
  });

  it("preserves the org param in sub-navigation links", () => {
    searchParamsRef.current = "org=org-9";
    render(
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /goods receipts/i })
    ).toHaveAttribute("href", "/purchases/goods-receipts?org=org-9");
  });

  it("pushes a search query on submit", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.type(screen.getByLabelText("Search purchase orders"), "PO-001");
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/purchases?search=PO-001");
  });

  it("resets the list immediately when the search field is cleared", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{ search: "PO-001" }}
        canManage
      />
    );
    const input = screen.getByLabelText("Search purchase orders");
    await user.clear(input);
    expect(mockPush).toHaveBeenCalledWith("/purchases");
  });

  it("pushes a status filter change via pills", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("tab", { name: "Approved" }));
    expect(mockPush).toHaveBeenCalledWith("/purchases?status=approved");
  });

  it("shows the Showing X–Y of N pagination summary", () => {
    render(
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()], { total: 45, page: 2, pageSize: 20 })}
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
      <PurchaseOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()], { total: 45, page: 2, pageSize: 20 })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/purchases?page=3");

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(mockPush).toHaveBeenCalledWith("/purchases");
  });
});
