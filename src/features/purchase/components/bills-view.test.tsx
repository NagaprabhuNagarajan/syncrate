import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { BillsView } from "./bills-view";
import type {
  BillListItem,
  BillListResult,
  BillStats,
} from "@/features/purchase/types/bill.types";

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

function makeInvoice(
  overrides: Partial<BillListItem> = {}
): BillListItem {
  return {
    id: "pinv-1",
    organizationId: "org-1",
    invoiceNumber: "PINV-00001",
    supplierInvoiceNumber: null,
    purchaseOrderId: null,
    supplierId: "sup-1",
    supplierName: "Acme Supply",
    status: "draft",
    invoiceDate: new Date("2026-06-01"),
    dueDate: null,
    subtotal: 1000,
    discountAmount: 0,
    taxAmount: 180,
    totalAmount: 1180,
    amountPaid: 0,
    notes: null,
    postedAt: null,
    postedBy: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeResult(
  items: BillListItem[],
  overrides: Partial<BillListResult> = {}
): BillListResult {
  return { items, total: items.length, page: 1, pageSize: 20, ...overrides };
}

function makeStats(
  overrides: Partial<BillStats> = {}
): BillStats {
  return { totalValue: 1180, draft: 1, posted: 0, overdue: 0, ...overrides };
}

describe("BillsView", () => {
  it("renders an empty state when there are no invoices", () => {
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([])}
        stats={makeStats({ totalValue: 0, draft: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("No bills yet")).toBeInTheDocument();
  });

  it("renders invoices with supplier name, status and total", () => {
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("PINV-00001")).toBeInTheDocument();
    expect(screen.getByText("Acme Supply")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getByText("₹1,180.00")).toBeInTheDocument();
  });

  it("renders the stat tiles", () => {
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats({
          totalValue: 5000,
          draft: 2,
          posted: 3,
          overdue: 1,
        })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("Total value")).toBeInTheDocument();
    expect(screen.getAllByText("Posted").length).toBeGreaterThan(0);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("shows the new invoice button only when canManage is true", () => {
    const { rerender } = render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("link", { name: /new bill/i })
    ).toBeInTheDocument();

    rerender(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("link", { name: /new bill/i })
    ).not.toBeInTheDocument();
  });

  it("pushes a search query on submit", async () => {
    const user = userEvent.setup();
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.type(
      screen.getByLabelText("Search bills"),
      "PINV-001"
    );
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith(
      "/purchases/bills?search=PINV-001"
    );
  });

  it("resets the list when the search field is cleared", async () => {
    const user = userEvent.setup();
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{ search: "PINV-001" }}
        canManage
      />
    );
    const input = screen.getByLabelText("Search bills");
    await user.clear(input);
    expect(mockPush).toHaveBeenCalledWith("/purchases/bills");
  });

  it("pushes a status filter change via the status pills", async () => {
    const user = userEvent.setup();
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("tab", { name: "Posted" }));
    expect(mockPush).toHaveBeenCalledWith(
      "/purchases/bills?status=posted"
    );
  });

  it("renders pagination summary and navigates pages", async () => {
    const user = userEvent.setup();
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()], {
          total: 45,
          page: 2,
          pageSize: 20,
        })}
        stats={makeStats()}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getAllByText("45").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/purchases/bills?page=3");

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(mockPush).toHaveBeenCalledWith("/purchases/bills");
  });
});
