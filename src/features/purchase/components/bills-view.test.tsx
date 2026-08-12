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
  return {
    totalBilled: 1180,
    outstanding: 1180,
    overdue: 0,
    paid: 0,
    draft: 1,
    posted: 0,
    ...overrides,
  };
}

describe("BillsView", () => {
  it("renders an empty state when there are no invoices", () => {
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([])}
        stats={makeStats({ totalBilled: 0, outstanding: 0, draft: 0 })}
        filters={{}}
        canManage
        canMakePayment
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
        canMakePayment
      />
    );
    expect(screen.getByText("PINV-00001")).toBeInTheDocument();
    expect(screen.getByText("Acme Supply")).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    // ₹1,180.00 shows in both Total and Balance due for an unpaid bill.
    expect(screen.getAllByText("₹1,180.00").length).toBeGreaterThan(0);
  });

  it("renders a derived payment badge for unpaid and paid rows", () => {
    const unpaid = makeInvoice({ id: "b-unpaid", amountPaid: 0 });
    const paid = makeInvoice({
      id: "b-paid",
      invoiceNumber: "PINV-00002",
      status: "posted",
      amountPaid: 1180,
    });
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([unpaid, paid])}
        stats={makeStats()}
        filters={{}}
        canManage
        canMakePayment
      />
    );
    // "Unpaid"/"Paid" also appear as payment filter pill labels, so scope the
    // assertion to the row payment badges (rendered inside table cells).
    const badges = screen
      .getAllByText(/^(Unpaid|Paid)$/)
      .filter((el) => el.closest("td") !== null)
      .map((el) => el.textContent);
    expect(badges).toContain("Unpaid");
    expect(badges).toContain("Paid");
  });

  it("renders the stat tiles", () => {
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats({
          totalBilled: 5000,
          outstanding: 3200,
          overdue: 500,
          paid: 1800,
        })}
        filters={{}}
        canManage
        canMakePayment
      />
    );
    expect(screen.getByText("Total billed")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    // "Overdue"/"Paid" appear both as a stat-tile label and a payment pill.
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
  });

  it("shows the new invoice button only when canManage is true", () => {
    const { rerender } = render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{}}
        canManage
        canMakePayment
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
        canMakePayment
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
        canMakePayment
      />
    );
    await user.type(
      screen.getByLabelText("Search bills"),
      "PINV-001"
    );
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith(
      "/bills?search=PINV-001"
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
        canMakePayment
      />
    );
    const input = screen.getByLabelText("Search bills");
    await user.clear(input);
    expect(mockPush).toHaveBeenCalledWith("/bills");
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
        canMakePayment
      />
    );
    await user.click(screen.getByRole("tab", { name: "Posted" }));
    expect(mockPush).toHaveBeenCalledWith(
      "/bills?status=posted"
    );
  });

  it("renders the payment filter pills", () => {
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{}}
        canManage
        canMakePayment
      />
    );
    const paymentRow = screen.getByRole("tablist", {
      name: /filter by payment/i,
    });
    expect(paymentRow).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Unpaid" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Partial" })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overdue" })).toBeInTheDocument();
  });

  it("pushes a payment filter change via the payment pills", async () => {
    const user = userEvent.setup();
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{}}
        canManage
        canMakePayment
      />
    );
    await user.click(screen.getByRole("tab", { name: "Overdue" }));
    expect(mockPush).toHaveBeenCalledWith(
      "/bills?paymentStatus=overdue"
    );
  });

  it("marks the active payment pill as selected", () => {
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{ paymentStatus: "partial" }}
        canManage
        canMakePayment
      />
    );
    expect(
      screen.getByRole("tab", { name: "Partial", selected: true })
    ).toBeInTheDocument();
  });

  it("reveals the bulk record-payment bar when a payable bill is selected", async () => {
    const user = userEvent.setup();
    const payable = makeInvoice({
      id: "b-payable",
      status: "posted",
      amountPaid: 500,
    });
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([payable])}
        stats={makeStats()}
        filters={{}}
        canManage
        canMakePayment
      />
    );
    // No bulk bar until something is selected.
    expect(
      screen.queryByRole("button", { name: /record payment/i })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: `Select ${payable.invoiceNumber}` })
    );

    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /record payment/i })
    ).toBeInTheDocument();
  });

  it("does not offer selection for draft or fully paid bills", () => {
    const draft = makeInvoice({ id: "b-draft", status: "draft" });
    const paid = makeInvoice({
      id: "b-paid",
      invoiceNumber: "PINV-00002",
      status: "posted",
      amountPaid: 1180,
    });
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([draft, paid])}
        stats={makeStats()}
        filters={{}}
        canManage
        canMakePayment
      />
    );
    expect(
      screen.queryByRole("checkbox", { name: /select pinv/i })
    ).not.toBeInTheDocument();
  });

  it("exposes View and Edit actions for a draft bill", async () => {
    const user = userEvent.setup();
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{}}
        canManage
        canMakePayment
      />
    );
    await user.click(
      screen.getByRole("button", { name: /actions for pinv-00001/i })
    );
    expect(screen.getByRole("menuitem", { name: /view/i })).toBeInTheDocument();
    const edit = screen.getByRole("menuitem", { name: /edit/i });
    expect(edit).toBeInTheDocument();
    expect(edit).toHaveAttribute("href", "/bills/pinv-1/edit");
  });

  it("hides the Edit action for a posted bill", async () => {
    const user = userEvent.setup();
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice({ status: "posted" })])}
        stats={makeStats()}
        filters={{}}
        canManage
        canMakePayment
      />
    );
    await user.click(
      screen.getByRole("button", { name: /actions for pinv-00001/i })
    );
    expect(screen.getByRole("menuitem", { name: /view/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /edit/i })
    ).not.toBeInTheDocument();
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
        canMakePayment
      />
    );
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getAllByText("45").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/bills?page=3");

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(mockPush).toHaveBeenCalledWith("/bills");
  });

  // ── Network inbox tab ────────────────────────────────────────
  const incoming = [
    {
      id: "cbn-inv-1",
      connectionId: "conn-1",
      number: "INV-00001",
      date: "2026-07-20",
      totalAmount: 800,
      senderName: "Acme Steel",
    },
  ];

  it("badges the Incoming tab with the pending count", () => {
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{}}
        canManage
        canMakePayment
        incoming={incoming}
      />
    );
    const tab = screen.getByRole("tab", { name: /incoming/i });
    expect(tab).toHaveTextContent("1");
    expect(tab).toHaveAttribute("aria-selected", "false");
  });

  it("shows the inbox instead of the bills table when the tab is active", () => {
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{}}
        canManage
        canMakePayment
        incoming={incoming}
        showIncoming
      />
    );
    expect(
      screen.getByRole("table", { name: /incoming network invoices/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("PINV-00001")).not.toBeInTheDocument();
  });

  it("clears bill filters when switching to the inbox", async () => {
    const user = userEvent.setup();
    searchParamsRef.current = "status=draft&page=2";
    render(
      <BillsView
        organizationId="org-1"
        result={makeResult([makeInvoice()])}
        stats={makeStats()}
        filters={{ status: "draft" }}
        canManage
        canMakePayment
        incoming={incoming}
      />
    );

    await user.click(screen.getByRole("tab", { name: /incoming/i }));
    expect(mockPush).toHaveBeenCalledWith("/bills?view=incoming");
  });
});
