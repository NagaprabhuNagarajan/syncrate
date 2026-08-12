import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { SalesOrdersView } from "./sales-orders-view";
import type {
  SalesOrderListItem,
  SalesOrderListResult,
  SalesOrderStats,
} from "@/features/sales/types/sales-order.types";

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
  overrides: Partial<SalesOrderListItem> = {}
): SalesOrderListItem {
  return {
    id: "so-1",
    organizationId: "org-1",
    soNumber: "SO-00001",
    customerId: "cust-1",
    customerName: "Acme Retail",
    branchId: null,
    salespersonId: null,
    referenceNumber: null,
    orderDate: new Date("2026-06-01"),
    deliveryDate: new Date("2026-06-10"),
    paymentTermsDays: 30,
    supplyState: "Karnataka",
    isInterstate: false,
    status: "draft",
    subtotal: 1000,
    discountAmount: 0,
    cgstAmount: 90,
    sgstAmount: 90,
    igstAmount: 0,
    taxAmount: 180,
    roundOff: 0,
    totalAmount: 1180,
    notes: null,
    terms: null,
    approvedBy: null,
    approvedAt: null,
    convertedInvId: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: null,
    version: 1,
    ...overrides,
  };
}

function makeResult(
  items: SalesOrderListItem[],
  overrides: Partial<SalesOrderListResult> = {}
): SalesOrderListResult {
  return { items, total: items.length, page: 1, pageSize: 20, ...overrides };
}

function makeStats(overrides: Partial<SalesOrderStats> = {}): SalesOrderStats {
  return {
    totalValue: 1180,
    draft: 1,
    awaitingApproval: 0,
    open: 0,
    ...overrides,
  };
}

/** Renders with sane defaults so inbox tests only state what they care about. */
function renderView(
  props: Partial<React.ComponentProps<typeof SalesOrdersView>> = {}
) {
  return render(
    <SalesOrdersView
      organizationId="org-1"
      result={makeResult([makeOrder()])}
      stats={makeStats()}
      filters={{}}
      canManage
      {...props}
    />
  );
}

describe("SalesOrdersView", () => {
  it("renders an empty state when there are no orders", () => {
    render(
      <SalesOrdersView
        organizationId="org-1"
        result={makeResult([])}
        stats={makeStats({ draft: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("No sales orders yet")).toBeInTheDocument();
  });

  it("renders orders with customer name, status and amount", () => {
    render(
      <SalesOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("SO-00001")).toBeInTheDocument();
    expect(screen.getByText("Acme Retail")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getByText("₹1,180.00")).toBeInTheDocument();
  });

  it("renders the stat tiles", () => {
    render(
      <SalesOrdersView
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

  it("shows the new sales order button only when canManage is true", () => {
    const { rerender } = render(
      <SalesOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /new sales order/i })
    ).toBeInTheDocument();

    rerender(
      <SalesOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /new sales order/i })
    ).not.toBeInTheDocument();
  });

  it("renders sub-navigation links to sibling sales sections", () => {
    render(
      <SalesOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByRole("link", { name: /invoices/i })).toHaveAttribute(
      "href",
      "/invoices"
    );
  });

  it("preserves the org param in sub-navigation links", () => {
    searchParamsRef.current = "org=org-9";
    render(
      <SalesOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /invoices/i })
    ).toHaveAttribute("href", "/invoices?org=org-9");
  });

  it("pushes a search query on submit", async () => {
    const user = userEvent.setup();
    render(
      <SalesOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.type(screen.getByLabelText("Search sales orders"), "SO-001");
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/sales-orders?search=SO-001");
  });

  it("resets the list immediately when the search field is cleared", async () => {
    const user = userEvent.setup();
    render(
      <SalesOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{ search: "SO-001" }}
        canManage
      />
    );
    const input = screen.getByLabelText("Search sales orders");
    await user.clear(input);
    expect(mockPush).toHaveBeenCalledWith("/sales-orders");
  });

  it("pushes a status filter change via pills", async () => {
    const user = userEvent.setup();
    render(
      <SalesOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("tab", { name: "Approved" }));
    expect(mockPush).toHaveBeenCalledWith("/sales-orders?status=approved");
  });

  it("shows the Showing X–Y of N pagination summary", () => {
    render(
      <SalesOrdersView
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
      <SalesOrdersView
        organizationId="org-1"
        result={makeResult([makeOrder()], { total: 45, page: 2, pageSize: 20 })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/sales-orders?page=3");

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(mockPush).toHaveBeenCalledWith("/sales-orders");
  });

  // ── Network inbox tab ────────────────────────────────────────
  const incoming = [
    {
      id: "cbn-po-1",
      connectionId: "conn-1",
      number: "PO-0001",
      date: "2026-07-21",
      totalAmount: 600,
      senderName: "Bharat Traders",
    },
  ];

  it("badges the Incoming tab with the pending count", () => {
    renderView({ incoming });
    const tab = screen.getByRole("tab", { name: /incoming/i });
    expect(tab).toHaveTextContent("1");
    expect(tab).toHaveAttribute("aria-selected", "false");
  });

  it("shows the purchase-order inbox instead of the order table", () => {
    renderView({ incoming, showIncoming: true });
    expect(
      screen.getByRole("table", { name: /incoming network purchase orders/i })
    ).toBeInTheDocument();
    expect(screen.getByText("PO-0001")).toBeInTheDocument();
  });
});
