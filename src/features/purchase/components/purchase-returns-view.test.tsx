import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { PurchaseReturnsView } from "./purchase-returns-view";
import type {
  PurchaseReturnListItem,
  PurchaseReturnListResult,
  PurchaseReturnStats,
} from "@/features/purchase/types/purchase-return.types";

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

function makeReturn(
  overrides: Partial<PurchaseReturnListItem> = {}
): PurchaseReturnListItem {
  return {
    id: "pret-1",
    organizationId: "org-1",
    returnNumber: "PRET-00001",
    purchaseOrderId: null,
    supplierId: "sup-1",
    supplierName: "Acme Supply",
    branchId: "wh-1",
    status: "draft",
    returnDate: new Date("2026-06-01"),
    reason: "damaged",
    subtotal: 1000,
    taxAmount: 180,
    totalAmount: 1180,
    notes: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeResult(
  items: PurchaseReturnListItem[],
  overrides: Partial<PurchaseReturnListResult> = {}
): PurchaseReturnListResult {
  return { items, total: items.length, page: 1, pageSize: 20, ...overrides };
}

function makeStats(
  overrides: Partial<PurchaseReturnStats> = {}
): PurchaseReturnStats {
  return {
    totalValue: 1180,
    draft: 1,
    completed: 0,
    cancelled: 0,
    ...overrides,
  };
}

describe("PurchaseReturnsView", () => {
  it("renders an empty state when there are no returns", () => {
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([])}
        stats={makeStats({ draft: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("No purchase returns yet")).toBeInTheDocument();
  });

  it("renders returns with supplier name, status and total", () => {
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("PRET-00001")).toBeInTheDocument();
    expect(screen.getByText("Acme Supply")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getByText("₹1,180.00")).toBeInTheDocument();
  });

  it("renders the stat tiles", () => {
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        stats={makeStats({
          totalValue: 5000,
          draft: 2,
          completed: 3,
          cancelled: 4,
        })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("Total value")).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
    expect(screen.getByText("₹5,000")).toBeInTheDocument();
  });

  it("shows the new purchase return button only when canManage is true", () => {
    const { rerender } = render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /new purchase return/i })
    ).toBeInTheDocument();

    rerender(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        stats={makeStats()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /new purchase return/i })
    ).not.toBeInTheDocument();
  });

  it("renders sub-navigation links to sibling purchase sections", () => {
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
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
      "/purchases/bills"
    );
  });

  it("preserves the org param in sub-navigation links", () => {
    searchParamsRef.current = "org=org-9";
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
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
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.type(screen.getByLabelText("Search purchase returns"), "PRET-001");
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/purchases/returns?search=PRET-001");
  });

  it("resets the list immediately when the search field is cleared", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        stats={makeStats()}
        filters={{ search: "PRET-001" }}
        canManage
      />
    );
    const input = screen.getByLabelText("Search purchase returns");
    await user.clear(input);
    expect(mockPush).toHaveBeenCalledWith("/purchases/returns");
  });

  it("pushes a status filter change via pills", async () => {
    const user = userEvent.setup();
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("tab", { name: "Completed" }));
    expect(mockPush).toHaveBeenCalledWith("/purchases/returns?status=completed");
  });

  it("shows the Showing X–Y of N pagination summary", () => {
    render(
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()], { total: 45, page: 2, pageSize: 20 })}
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
      <PurchaseReturnsView
        organizationId="org-1"
        result={makeResult([makeReturn()], { total: 45, page: 2, pageSize: 20 })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/purchases/returns?page=3");

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(mockPush).toHaveBeenCalledWith("/purchases/returns");
  });
});
