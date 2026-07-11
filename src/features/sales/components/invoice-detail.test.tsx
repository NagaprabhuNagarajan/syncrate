import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { InvoiceDetail } from "./invoice-detail";
import type {
  InvoiceStatus,
  InvoiceWithItems,
  PaymentStatus,
} from "@/features/sales/types/invoice.types";

const { mockRefresh, postMock, cancelMock } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  postMock: vi.fn(),
  cancelMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/features/sales/actions/invoice.actions", () => ({
  postInvoiceAction: postMock,
  cancelInvoiceAction: cancelMock,
}));

function makeInvoice(
  status: InvoiceStatus = "draft",
  overrides: Partial<InvoiceWithItems> = {}
): InvoiceWithItems {
  return {
    id: "inv-1",
    organizationId: "org-1",
    invoiceNumber: "INV-00001",
    invoiceType: "tax_invoice",
    customerId: "cust-1",
    salesOrderId: null,
    branchId: null,
    salespersonId: null,
    referenceNumber: "PO-77",
    invoiceDate: new Date("2026-06-01"),
    dueDate: new Date("2026-07-01"),
    paymentTermsDays: 30,
    supplyState: "Karnataka",
    isInterstate: false,
    status,
    paymentStatus: "partial" as PaymentStatus,
    subtotal: 1000,
    discountAmount: 100,
    cgstAmount: 81,
    sgstAmount: 81,
    igstAmount: 0,
    taxAmount: 162,
    roundOff: 0,
    totalAmount: 1062,
    amountPaid: 500,
    notes: null,
    terms: null,
    postedAt: null,
    postedBy: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    createdBy: "user-1",
    version: 1,
    items: [
      {
        id: "item-1",
        organizationId: "org-1",
        invoiceId: "inv-1",
        productId: "p-1",
        description: "Widget",
        hsnCode: "1234",
        quantity: 10,
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
  invoice: InvoiceWithItems,
  perms: { canManage?: boolean; canCancel?: boolean } = {}
) {
  return render(
    <InvoiceDetail
      invoice={invoice}
      customerName="Acme Retail"
      productNames={{ "p-1": "Widget" }}
      organizationId="org-1"
      canManage={perms.canManage ?? false}
      canCancel={perms.canCancel ?? false}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InvoiceDetail", () => {
  it("renders number, customer, line item and totals", () => {
    renderDetail(makeInvoice("draft"), { canManage: true });
    expect(screen.getByText("INV-00001")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Retail").length).toBeGreaterThan(0);
    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    // Total appears in the KPI strip and the summary.
    expect(screen.getAllByText("₹1,062.00").length).toBeGreaterThan(0);
  });

  it("shows both the status and payment badges", () => {
    renderDetail(makeInvoice("posted"), { canManage: true });
    expect(screen.getByText("Posted")).toBeInTheDocument();
    expect(screen.getByText("Partial")).toBeInTheDocument();
  });

  it("shows the KPI strip with balance due and due date", () => {
    renderDetail(makeInvoice("draft"), { canManage: true });
    expect(screen.getAllByText("Total").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Amount paid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Balance due").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Due date").length).toBeGreaterThan(0);
    // Balance due = total 1062 − paid 500 = ₹562.00
    expect(screen.getAllByText("₹562.00").length).toBeGreaterThan(0);
  });

  it("shows Post and Edit for a draft when canManage", () => {
    renderDetail(makeInvoice("draft"), { canManage: true });
    expect(screen.getByRole("button", { name: /post/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
  });

  it("hides Post and Edit when canManage is false", () => {
    renderDetail(makeInvoice("draft"), { canManage: false });
    expect(
      screen.queryByRole("button", { name: /post/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /edit/i })
    ).not.toBeInTheDocument();
  });

  it("hides Post for a posted invoice", () => {
    renderDetail(makeInvoice("posted"), { canManage: true });
    expect(
      screen.queryByRole("button", { name: /post/i })
    ).not.toBeInTheDocument();
  });

  it("calls the post action and refreshes", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({ success: true, data: makeInvoice("posted") });
    renderDetail(makeInvoice("draft"), { canManage: true });

    await user.click(screen.getByRole("button", { name: /post/i }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("org-1", "inv-1")
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("confirms before cancelling, then calls the cancel action", async () => {
    const user = userEvent.setup();
    cancelMock.mockResolvedValue({
      success: true,
      data: makeInvoice("cancelled"),
    });
    renderDetail(makeInvoice("draft"), { canCancel: true });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel invoice/i }));
    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith("org-1", "inv-1")
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("hides the cancel action for a posted invoice", () => {
    renderDetail(makeInvoice("posted"), { canCancel: true });
    expect(
      screen.queryByRole("button", { name: /^cancel$/i })
    ).not.toBeInTheDocument();
  });

  it("renders the Share link with the expected href", () => {
    renderDetail(makeInvoice("draft"), { canManage: true });
    expect(
      screen.getByRole("link", { name: /share invoice/i })
    ).toHaveAttribute("href", "/invoices/inv-1/share");
  });

  it("surfaces an action error", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({
      success: false,
      error: { code: "invalid_status", message: "Cannot post" },
    });
    renderDetail(makeInvoice("draft"), { canManage: true });

    await user.click(screen.getByRole("button", { name: /post/i }));
    expect(await screen.findByText("Cannot post")).toBeInTheDocument();
  });

  it("shows CGST and SGST in the summary for an intra-state invoice", () => {
    renderDetail(makeInvoice("draft", { isInterstate: false }));
    expect(screen.getByText("CGST")).toBeInTheDocument();
    expect(screen.getByText("SGST")).toBeInTheDocument();
    expect(screen.queryByText("IGST")).not.toBeInTheDocument();
  });

  it("shows IGST in the summary for an inter-state invoice", () => {
    renderDetail(
      makeInvoice("draft", {
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

  it("links to the sales order when salesOrderId is set", () => {
    renderDetail(makeInvoice("draft", { salesOrderId: "so-9" }), {
      canManage: true,
    });
    const link = screen.getByRole("link", { name: /view sales order/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/sales-orders\/so-9(\?org=.*)?$/)
    );
  });

  it("does not render a sales-order link when unlinked", () => {
    renderDetail(makeInvoice("draft"), { canManage: true });
    expect(
      screen.queryByRole("link", { name: /view sales order/i })
    ).not.toBeInTheDocument();
  });
});
