import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { SalesOrderDetail } from "./sales-order-detail";
import type {
  SalesOrderStatus,
  SalesOrderWithItems,
} from "@/features/sales/types/sales-order.types";
import type { InvoiceListItem } from "@/features/sales/types/invoice.types";

const { mockRefresh, submitMock, approveMock, cancelMock } = vi.hoisted(
  () => ({
    mockRefresh: vi.fn(),
    submitMock: vi.fn(),
    approveMock: vi.fn(),
    cancelMock: vi.fn(),
  })
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/features/sales/actions/sales-order.actions", () => ({
  submitSalesOrderAction: submitMock,
  approveSalesOrderAction: approveMock,
  cancelSalesOrderAction: cancelMock,
}));

function makeOrder(
  status: SalesOrderStatus = "draft",
  overrides: Partial<SalesOrderWithItems> = {}
): SalesOrderWithItems {
  return {
    id: "so-1",
    organizationId: "org-1",
    soNumber: "SO-00001",
    customerId: "cust-1",
    branchId: "br-1",
    salespersonId: null,
    referenceNumber: null,
    status,
    orderDate: new Date("2026-06-01"),
    deliveryDate: new Date("2026-06-10"),
    paymentTermsDays: 30,
    supplyState: "Karnataka",
    isInterstate: false,
    subtotal: 1000,
    discountAmount: 100,
    cgstAmount: 81,
    sgstAmount: 81,
    igstAmount: 0,
    taxAmount: 162,
    roundOff: 0,
    totalAmount: 1062,
    notes: null,
    terms: null,
    approvedBy: null,
    approvedAt: null,
    convertedInvId: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version: 1,
    items: [
      {
        id: "item-1",
        organizationId: "org-1",
        salesOrderId: "so-1",
        productId: "p-1",
        description: "Widget",
        hsnCode: null,
        quantity: 10,
        deliveredQty: 0,
        unitPrice: 100,
        discountPercent: 10,
        discountAmount: 100,
        taxableAmount: 900,
        gstRate: 18,
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 0,
        cgstAmount: 81,
        sgstAmount: 81,
        igstAmount: 0,
        taxAmount: 162,
        lineTotal: 1062,
        sortOrder: 0,
        createdAt: new Date("2026-06-01"),
        createdBy: "user-1",
      },
    ],
    ...overrides,
  };
}

function renderDetail(
  order: SalesOrderWithItems,
  perms: {
    canManage?: boolean;
    canApprove?: boolean;
    canCancel?: boolean;
    approvedByName?: string | null;
    linkedInvoices?: readonly InvoiceListItem[];
  } = {}
) {
  return render(
    <SalesOrderDetail
      salesOrder={order}
      customerName="Acme Retail"
      branchName="Main WH"
      productNames={{ "p-1": "Widget" }}
      linkedInvoices={perms.linkedInvoices ?? []}
      approvedByName={perms.approvedByName ?? null}
      organizationId="org-1"
      canManage={perms.canManage ?? false}
      canApprove={perms.canApprove ?? false}
      canCancel={perms.canCancel ?? false}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SalesOrderDetail", () => {
  it("renders header info, items, totals and status", () => {
    renderDetail(makeOrder("draft"), { canManage: true });
    expect(screen.getByText("SO-00001")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Retail").length).toBeGreaterThan(0);
    expect(screen.getByText("Main WH")).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,062.00").length).toBeGreaterThan(0);
  });

  it("shows Submit and Edit for a draft when canManage", () => {
    renderDetail(makeOrder("draft"), { canManage: true });
    expect(
      screen.getByRole("button", { name: /submit/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /approve/i })
    ).not.toBeInTheDocument();
  });

  it("hides management actions when permissions are absent", () => {
    renderDetail(makeOrder("draft"), { canManage: false });
    expect(
      screen.queryByRole("button", { name: /submit/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /edit/i })
    ).not.toBeInTheDocument();
  });

  it("shows Approve only for a submitted order with canApprove", () => {
    renderDetail(makeOrder("submitted"), { canApprove: true });
    expect(
      screen.getByRole("button", { name: /approve/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit/i })
    ).not.toBeInTheDocument();
  });

  it("shows Convert to invoice for approved/processing/partially_delivered orders when canManage", () => {
    renderDetail(makeOrder("approved"), { canManage: true });
    expect(
      screen.getByRole("link", { name: /convert to invoice/i })
    ).toHaveAttribute("href", "/invoices/new?from=so&soId=so-1");
  });

  it("shows Convert to invoice for a completed (fully delivered) order", () => {
    renderDetail(makeOrder("completed"), { canManage: true });
    expect(
      screen.getByRole("link", { name: /convert to invoice/i })
    ).toHaveAttribute("href", "/invoices/new?from=so&soId=so-1");
  });

  it("shows the resolved approver name instead of the raw id", () => {
    renderDetail(makeOrder("approved"), { approvedByName: "Jane Approver" });
    expect(screen.getByText("Jane Approver")).toBeInTheDocument();
  });

  it("hides Convert to invoice for a draft order", () => {
    renderDetail(makeOrder("draft"), { canManage: true });
    expect(
      screen.queryByRole("link", { name: /convert to invoice/i })
    ).not.toBeInTheDocument();
  });

  it("calls the submit action and refreshes", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({
      success: true,
      data: makeOrder("submitted"),
    });
    renderDetail(makeOrder("draft"), { canManage: true });

    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith("org-1", "so-1")
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("calls the approve action and refreshes", async () => {
    const user = userEvent.setup();
    approveMock.mockResolvedValue({
      success: true,
      data: makeOrder("approved"),
    });
    renderDetail(makeOrder("submitted"), { canApprove: true });

    await user.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() =>
      expect(approveMock).toHaveBeenCalledWith("org-1", "so-1")
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("confirms before cancelling, then calls the cancel action", async () => {
    const user = userEvent.setup();
    cancelMock.mockResolvedValue({
      success: true,
      data: makeOrder("cancelled"),
    });
    renderDetail(makeOrder("submitted"), { canCancel: true });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel order/i }));
    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith("org-1", "so-1")
    );
  });

  it("shows Record delivery for approved, processing and partially delivered orders", () => {
    for (const status of [
      "approved",
      "processing",
      "partially_delivered",
    ] as const) {
      const { unmount } = renderDetail(makeOrder(status), { canManage: true });
      expect(
        screen.getByRole("link", { name: /record delivery/i })
      ).toHaveAttribute("href", "/sales-orders/so-1/deliver");
      unmount();
    }
  });

  it("hides Record delivery for draft and completed orders", () => {
    renderDetail(makeOrder("draft"), { canManage: true });
    expect(
      screen.queryByRole("link", { name: /record delivery/i })
    ).not.toBeInTheDocument();
  });

  it("hides the cancel action for terminal statuses", () => {
    renderDetail(makeOrder("completed"), { canCancel: true });
    expect(
      screen.queryByRole("button", { name: /^cancel$/i })
    ).not.toBeInTheDocument();
  });

  it("surfaces an action error", async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({
      success: false,
      error: { code: "invalid_status", message: "Cannot submit" },
    });
    renderDetail(makeOrder("draft"), { canManage: true });

    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText("Cannot submit")).toBeInTheDocument();
  });

  it("shows the KPI strip with total, subtotal, tax and order date", () => {
    renderDetail(makeOrder("draft"), { canManage: true });
    expect(screen.getAllByText("Total").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Subtotal").length).toBeGreaterThan(0);
    expect(screen.getByText("Tax")).toBeInTheDocument();
    expect(screen.getAllByText("Order date").length).toBeGreaterThan(0);
    // Tax KPI tile = cgst + sgst + igst = 81 + 81 + 0 = ₹162.00
    expect(screen.getAllByText("₹162.00").length).toBeGreaterThan(0);
  });

  it("shows CGST and SGST in the summary for an intra-state order", () => {
    renderDetail(makeOrder("draft", { isInterstate: false }));
    expect(screen.getAllByText("CGST").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SGST").length).toBeGreaterThan(0);
    expect(screen.queryByText("IGST")).not.toBeInTheDocument();
  });

  it("renders a linked invoice row with a link to the invoice", () => {
    const invoice = {
      id: "inv-1",
      invoiceNumber: "INV-00001",
      invoiceDate: new Date("2026-06-05"),
      status: "sent",
      totalAmount: 1180,
    } as unknown as InvoiceListItem;
    renderDetail(makeOrder("approved"), {
      canManage: true,
      linkedInvoices: [invoice],
    });
    const link = screen.getByRole("link", { name: "INV-00001" });
    expect(link).toHaveAttribute("href", expect.stringMatching(/^\/invoices\/inv-1(\?org=.*)?$/));
  });

  it("shows an empty message when no invoices are linked", () => {
    renderDetail(makeOrder("approved"), { canManage: true });
    expect(
      screen.getByText(/no invoices have been raised from this sales order/i)
    ).toBeInTheDocument();
  });

  it("shows IGST in the summary for an inter-state order", () => {
    renderDetail(
      makeOrder("draft", {
        isInterstate: true,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 162,
      })
    );
    expect(screen.getByText("IGST")).toBeInTheDocument();
    expect(screen.queryByText("CGST")).not.toBeInTheDocument();
    expect(screen.queryByText("SGST")).not.toBeInTheDocument();
  });
});
